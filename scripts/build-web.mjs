import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

const rewriteAssetPaths = async (outputRoot) => {
    const files = await collectFiles(outputRoot);
    for (const filePath of files) {
        if (!textExtensions.has(path.extname(filePath).toLowerCase())) {
            continue;
        }

        const originalText = await readFile(filePath, 'utf-8');
        const rewrittenText = originalText.replaceAll('../asset/', './asset/');
        if (rewrittenText !== originalText) {
            await writeFile(filePath, rewrittenText);
        }
    }
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
    await cleanOutputRoot(outputRoot);
    await cp(engineRoot, outputRoot, { recursive: true });
    await copyRuntimeAssets(outputRoot);
    await rewriteAssetPaths(outputRoot);
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
