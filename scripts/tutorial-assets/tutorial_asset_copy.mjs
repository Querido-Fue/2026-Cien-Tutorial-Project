import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { resolveTutorialAssetPaths } from './tutorial_asset_paths.mjs';

/** @param {string} filePath @returns {Promise<string>} SHA-256입니다. */
async function hashFile(filePath) {
    const contents = await readFile(filePath);
    return createHash('sha256').update(contents).digest('hex');
}

/**
 * 감사된 매니페스트 항목을 원본 보존·충돌 거부 정책으로 안전 복사합니다.
 * @param {object} options - 매니페스트, 항목과 저장소 루트입니다.
 * @returns {Promise<Readonly<object>>} 신규·동일·오류 경로입니다.
 */
export async function copyTutorialManifestEntries({ manifest, entries, repositoryRoot }) {
    const copied = [];
    const unchanged = [];
    const errors = [];
    for (const entry of entries || []) {
        let paths;
        try {
            paths = resolveTutorialAssetPaths(manifest, entry, repositoryRoot);
            await mkdir(dirname(paths.runtimePath), { recursive: true });
            await copyFile(paths.sourcePath, paths.runtimePath, fsConstants.COPYFILE_EXCL);
            copied.push(paths.runtimeRelativePath);
        } catch (error) {
            if (error?.code !== 'EEXIST' || !paths) {
                errors.push(`${entry.id}: 복사 실패 (${error.message})`);
                continue;
            }
            const [sourceHash, runtimeHash] = await Promise.all([
                hashFile(paths.sourcePath),
                hashFile(paths.runtimePath)
            ]);
            if (sourceHash === runtimeHash) {
                unchanged.push(paths.runtimeRelativePath);
            } else {
                errors.push(
                    `${entry.id}: 다른 내용의 기존 런타임 파일과 충돌 `
                    + `(${paths.runtimeRelativePath})`
                );
            }
        }
    }
    return Object.freeze({
        copied: Object.freeze(copied),
        unchanged: Object.freeze(unchanged),
        errors: Object.freeze(errors)
    });
}
