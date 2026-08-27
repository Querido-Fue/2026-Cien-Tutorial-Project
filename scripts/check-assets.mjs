import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TUTORIAL_ASSET_MANIFEST } from '../project/engine/script/data/game/tutorial_asset_manifest.js';
import { TUTORIAL_AUDIO_MANIFEST } from '../project/engine/script/data/sound/tutorial_audio_manifest.js';
import { auditTutorialAssets } from './tutorial-assets/tutorial_asset_audit.mjs';
import { auditTutorialAudioAssets } from './tutorial-assets/tutorial_audio_asset_audit.mjs';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..');

const [audit, audioAudit] = await Promise.all([
    auditTutorialAssets({
        manifest: TUTORIAL_ASSET_MANIFEST,
        repositoryRoot: REPOSITORY_ROOT,
        checkRuntime: true
    }),
    auditTutorialAudioAssets({
        manifest: TUTORIAL_AUDIO_MANIFEST,
        repositoryRoot: REPOSITORY_ROOT,
        checkRuntime: true
    })
]);

audit.warnings.forEach((warning) => console.warn(`[check:assets] 경고: ${warning}`));
audioAudit.warnings.forEach((warning) => console.warn(`[check:assets] 경고: ${warning}`));
if (!audit.ok || !audioAudit.ok) {
    audit.errors.forEach((error) => console.error(`[check:assets] 오류: ${error}`));
    audioAudit.errors.forEach((error) => console.error(`[check:assets] 오류: ${error}`));
    console.error(
        `[check:assets] 실패: 오류 ${audit.errors.length + audioAudit.errors.length}개, `
        + `경고 ${audit.warnings.length + audioAudit.warnings.length}개`
    );
    process.exitCode = 1;
} else {
    const readyCount = audit.entries.filter((entry) => entry.status === 'ready').length;
    const fallbackCount = audit.entries.filter(
        (entry) => entry.status === 'generated-fallback'
    ).length;
    const audioReadyCount = audioAudit.entries.filter(
        (entry) => entry.status === 'ready'
    ).length;
    const audioFallbackCount = audioAudit.entries.filter(
        (entry) => entry.status === 'declared-fallback'
    ).length;
    console.log(
        `[check:assets] 성공: PNG ${readyCount}개, MP3 ${audioReadyCount}개, `
        + `코드 폴백 ${fallbackCount}개, 오디오 폴백 ${audioFallbackCount}개, `
        + `경고 ${audit.warnings.length + audioAudit.warnings.length}개`
    );
}
