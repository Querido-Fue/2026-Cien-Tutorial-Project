import { constants as fsConstants } from 'node:fs';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TUTORIAL_ASSET_MANIFEST } from '../project/engine/script/data/game/tutorial_asset_manifest.js';
import { auditTutorialAssets } from './tutorial-assets/tutorial_asset_audit.mjs';
import { resolveTutorialAssetPaths } from './tutorial-assets/tutorial_asset_paths.mjs';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..');

/** @param {string} filePath @returns {Promise<string>} SHA-256 해시입니다. */
async function hashFile(filePath) {
    const contents = await readFile(filePath);
    return createHash('sha256').update(contents).digest('hex');
}

/** @param {string} message @returns {never} 오류 종료를 예약합니다. */
function reportFailure(message) {
    console.error(`[import:assets] 오류: ${message}`);
    process.exitCode = 1;
}

const sourceAudit = await auditTutorialAssets({
    manifest: TUTORIAL_ASSET_MANIFEST,
    repositoryRoot: REPOSITORY_ROOT,
    checkRuntime: false
});
for (const warning of sourceAudit.warnings) {
    console.warn(`[import:assets] 경고: ${warning}`);
}
if (!sourceAudit.ok) {
    sourceAudit.errors.forEach(reportFailure);
} else {
    const copied = [];
    const unchanged = [];
    const collisions = [];
    for (const entry of TUTORIAL_ASSET_MANIFEST.ENTRIES) {
        if (entry.type !== 'image/png') {
            continue;
        }
        const paths = resolveTutorialAssetPaths(
            TUTORIAL_ASSET_MANIFEST,
            entry,
            REPOSITORY_ROOT
        );
        await mkdir(dirname(paths.runtimePath), { recursive: true });
        try {
            await copyFile(paths.sourcePath, paths.runtimePath, fsConstants.COPYFILE_EXCL);
            copied.push(paths.runtimeRelativePath);
        } catch (error) {
            if (error?.code !== 'EEXIST') {
                reportFailure(`${entry.id}: 복사 실패 (${error.message})`);
                continue;
            }
            const [sourceHash, runtimeHash] = await Promise.all([
                hashFile(paths.sourcePath),
                hashFile(paths.runtimePath)
            ]);
            if (sourceHash === runtimeHash) {
                unchanged.push(paths.runtimeRelativePath);
            } else {
                collisions.push(paths.runtimeRelativePath);
                reportFailure(
                    `${entry.id}: 다른 내용의 기존 런타임 파일과 충돌 (${paths.runtimeRelativePath})`
                );
            }
        }
    }

    if (process.exitCode !== 1) {
        const runtimeAudit = await auditTutorialAssets({
            manifest: TUTORIAL_ASSET_MANIFEST,
            repositoryRoot: REPOSITORY_ROOT,
            checkRuntime: true
        });
        runtimeAudit.warnings.forEach((warning) => (
            console.warn(`[import:assets] 경고: ${warning}`)
        ));
        if (!runtimeAudit.ok) {
            runtimeAudit.errors.forEach(reportFailure);
        } else {
            console.log(
                `[import:assets] 성공: 신규 ${copied.length}개, 동일 ${unchanged.length}개, `
                + `충돌 ${collisions.length}개`
            );
        }
    }
}
