import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TUTORIAL_ASSET_MANIFEST } from '../project/engine/script/data/game/tutorial_asset_manifest.js';
import { auditTutorialAssets } from './tutorial-assets/tutorial_asset_audit.mjs';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..');

const audit = await auditTutorialAssets({
    manifest: TUTORIAL_ASSET_MANIFEST,
    repositoryRoot: REPOSITORY_ROOT,
    checkRuntime: true
});

audit.warnings.forEach((warning) => console.warn(`[check:assets] 경고: ${warning}`));
if (!audit.ok) {
    audit.errors.forEach((error) => console.error(`[check:assets] 오류: ${error}`));
    console.error(
        `[check:assets] 실패: 오류 ${audit.errors.length}개, 경고 ${audit.warnings.length}개`
    );
    process.exitCode = 1;
} else {
    const readyCount = audit.entries.filter((entry) => entry.status === 'ready').length;
    const fallbackCount = audit.entries.filter(
        (entry) => entry.status === 'generated-fallback'
    ).length;
    console.log(
        `[check:assets] 성공: PNG ${readyCount}개, 코드 폴백 ${fallbackCount}개, `
        + `경고 ${audit.warnings.length}개`
    );
}
