import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { WebReleaseManifestBuilder } from './web/_web_release_manifest_builder.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const engineRoot = path.join(repositoryRoot, 'project', 'engine');
const assetRoot = path.join(repositoryRoot, 'project', 'asset');
const defaultOutputRoot = path.join(repositoryRoot, 'dist', 'web');
const buildMarkerName = '.nthplayer-web-build';
const textExtensions = new Set(['.css', '.html', '.js', '.json']);

const isPathInside = (candidate, parent) => {
    const relativePath = path.relative(parent, candidate);
    return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

const pathExists = async (targetPath) => {
    try {
        await stat(targetPath);
        return true;
    } catch {
        return false;
    }
};

const cleanOutputRoot = async (outputRoot) => {
    const resolvedOutputRoot = path.resolve(outputRoot);
    const isDefaultTarget = resolvedOutputRoot === defaultOutputRoot;
    const hasBuildMarker = await pathExists(path.join(resolvedOutputRoot, buildMarkerName));

    if (resolvedOutputRoot === repositoryRoot
        || resolvedOutputRoot === engineRoot
        || resolvedOutputRoot === assetRoot
        || isPathInside(resolvedOutputRoot, engineRoot)
        || isPathInside(resolvedOutputRoot, assetRoot)
        || isPathInside(engineRoot, resolvedOutputRoot)
        || isPathInside(assetRoot, resolvedOutputRoot)) {
        throw new Error(`안전하지 않은 웹 빌드 출력 경로입니다: ${resolvedOutputRoot}`);
    }

    if (await pathExists(resolvedOutputRoot)) {
        if (!isDefaultTarget && !hasBuildMarker) {
            const entries = await readdir(resolvedOutputRoot);
            if (entries.length > 0) {
                throw new Error(`기존 파일이 있는 출력 경로는 정리하지 않습니다: ${resolvedOutputRoot}`);
            }
        } else {
            await rm(resolvedOutputRoot, { recursive: true, force: true });
        }
    }

    await mkdir(resolvedOutputRoot, { recursive: true });
    await writeFile(path.join(resolvedOutputRoot, buildMarkerName), 'Nth Player web build output\n');
};

const collectFiles = async (directoryPath) => {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const entryPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            files.push(...await collectFiles(entryPath));
        } else if (entry.isFile()) {
            files.push(entryPath);
        }
    }

    return files;
};

const rewriteAssetPaths = async (outputRoot, releaseId) => {
    const files = await collectFiles(outputRoot);
    for (const filePath of files) {
        if (!textExtensions.has(path.extname(filePath).toLowerCase())) {
            continue;
        }

        const originalText = await readFile(filePath, 'utf-8');
        const rewrittenText = originalText
            .replaceAll('../asset/', './asset/')
            .replace(
                /(['"`])(\.\/asset\/[^'"`\s<>]+)\1/g,
                (literal, quote, assetPath) => (
                    assetPath.includes('?') || assetPath.includes('${')
                        ? literal
                        : `${quote}${assetPath}?v=${releaseId}${quote}`
                )
            );
        if (rewrittenText !== originalText) {
            await writeFile(filePath, rewrittenText);
        }
    }
};

/**
 * 정적 HTML이 현재 배포 ID와 배포별 모듈 경로를 사용하도록 변환합니다.
 * @param {string} outputRoot - 웹 출력 루트입니다.
 * @param {object} releaseManifest - 생성된 릴리스 정보입니다.
 */
const rewriteWebIndex = async (outputRoot, releaseManifest) => {
    const indexPath = path.join(outputRoot, 'index.html');
    const originalText = await readFile(indexPath, 'utf8');
    const scriptBase = `./releases/${releaseManifest.id}/script/`;
    const rewrittenText = originalText
        .replace(
            '<meta name="nthplayer-release-id" content="development">',
            `<meta name="nthplayer-release-id" content="${releaseManifest.id}">`
        )
        .replace(
            '<meta name="nthplayer-release-version" content="dev">',
            `<meta name="nthplayer-release-version" content="${releaseManifest.version}">`
        )
        .replaceAll('./script/', scriptBase)
        .replace(
            'href="./style.css"',
            `href="./style.css?v=${releaseManifest.id}"`
        );
    if (rewrittenText === originalText
        || !rewrittenText.includes(scriptBase)
        || !rewrittenText.includes(`content="${releaseManifest.id}"`)) {
        throw new Error('웹 진입점에 릴리스 버전과 모듈 경로를 주입하지 못했습니다.');
    }
    await writeFile(indexPath, rewrittenText);
};

/** @param {object} manifest @returns {object} 안전한 웹 경로에 사용할 릴리스 정보입니다. */
const validateReleaseManifest = (manifest) => {
    if (!manifest
        || manifest.schemaVersion !== 1
        || !/^\d{4}_\d{4}-(?:[0-9a-f]{7,12}|local)$/.test(manifest.id || '')
        || !/^\d{4}_\d{4}$/.test(manifest.version || '')
        || !Array.isArray(manifest.changelog)) {
        throw new Error('유효하지 않은 웹 릴리스 매니페스트입니다.');
    }
    return manifest;
};

const copyRuntimeAssets = async (outputRoot) => {
    const outputAssetRoot = path.join(outputRoot, 'asset');
    await mkdir(path.join(outputAssetRoot, 'font'), { recursive: true });
    await mkdir(path.join(outputAssetRoot, 'old', 'icon'), { recursive: true });
    await cp(path.join(assetRoot, 'tutorial'), path.join(outputAssetRoot, 'tutorial'), { recursive: true });
    await cp(path.join(assetRoot, 'font', 'LanaPixel.ttf'), path.join(outputAssetRoot, 'font', 'LanaPixel.ttf'));
    await cp(path.join(assetRoot, 'old', 'icon', 'logo.ico'), path.join(outputAssetRoot, 'old', 'icon', 'logo.ico'));
};

/**
 * GitHub Pages에 올릴 상대 경로 기반 정적 게임 번들을 생성합니다.
 * @param {{outputRoot?: string}} [options]
 * @returns {Promise<string>} 생성된 절대 출력 경로입니다.
 */
export const buildWeb = async (options = {}) => {
    const outputRoot = path.resolve(options.outputRoot || defaultOutputRoot);
    const releaseManifest = validateReleaseManifest(
        options.releaseManifest || await new WebReleaseManifestBuilder({
            repositoryRoot
        }).create()
    );
    await cleanOutputRoot(outputRoot);
    await cp(engineRoot, outputRoot, { recursive: true });
    await copyRuntimeAssets(outputRoot);
    const versionedScriptRoot = path.join(
        outputRoot,
        'releases',
        releaseManifest.id,
        'script'
    );
    await mkdir(path.dirname(versionedScriptRoot), { recursive: true });
    await cp(path.join(outputRoot, 'script'), versionedScriptRoot, { recursive: true });
    await rewriteAssetPaths(outputRoot, releaseManifest.id);
    await rewriteWebIndex(outputRoot, releaseManifest);
    await writeFile(
        path.join(outputRoot, 'release.json'),
        JSON.stringify(releaseManifest, null, 2) + '\n'
    );
    await writeFile(path.join(outputRoot, '.nojekyll'), '');
    return outputRoot;
};

const parseOutputArgument = () => {
    const outputIndex = process.argv.indexOf('--output');
    if (outputIndex === -1) {
        return undefined;
    }

    const outputValue = process.argv[outputIndex + 1];
    if (!outputValue) {
        throw new Error('--output 뒤에 출력 경로를 지정해야 합니다.');
    }
    return path.resolve(process.cwd(), outputValue);
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const outputRoot = await buildWeb({ outputRoot: parseOutputArgument() });
    console.log(`Web build created: ${outputRoot}`);
}
