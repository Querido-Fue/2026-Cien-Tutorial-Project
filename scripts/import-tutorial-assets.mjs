import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TUTORIAL_ASSET_MANIFEST } from '../project/engine/script/data/game/tutorial_asset_manifest.js';
import { TUTORIAL_AUDIO_MANIFEST } from '../project/engine/script/data/sound/tutorial_audio_manifest.js';
import { auditTutorialAssets } from './tutorial-assets/tutorial_asset_audit.mjs';
import { auditTutorialAudioAssets } from './tutorial-assets/tutorial_audio_asset_audit.mjs';
import { copyTutorialManifestEntries } from './tutorial-assets/tutorial_asset_copy.mjs';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..');

/** @param {string} message 오류 종료를 예약합니다. */
function reportFailure(message) {
    console.error(`[import:assets] 오류: ${message}`);
    process.exitCode = 1;
}

const jobs = [
    {
        label: 'PNG',
        manifest: TUTORIAL_ASSET_MANIFEST,
        entries: TUTORIAL_ASSET_MANIFEST.ENTRIES.filter(
            (entry) => entry.type === 'image/png'
        ),
        audit: auditTutorialAssets
    },
    {
        label: 'MP3',
        manifest: TUTORIAL_AUDIO_MANIFEST,
        entries: TUTORIAL_AUDIO_MANIFEST.ENTRIES.filter(
            (entry) => entry.type === 'audio/mpeg' && entry.available !== false
        ),
        audit: auditTutorialAudioAssets
    }
];

const totals = { copied: 0, unchanged: 0 };
for (const job of jobs) {
    const sourceAudit = await job.audit({
        manifest: job.manifest,
        repositoryRoot: REPOSITORY_ROOT,
        checkRuntime: false
    });
    sourceAudit.warnings.forEach((warning) => (
        console.warn(`[import:assets] ${job.label} 경고: ${warning}`)
    ));
    if (!sourceAudit.ok) {
        sourceAudit.errors.forEach(reportFailure);
        continue;
    }
    const result = await copyTutorialManifestEntries({
        manifest: job.manifest,
        entries: job.entries,
        repositoryRoot: REPOSITORY_ROOT
    });
    result.errors.forEach(reportFailure);
    totals.copied += result.copied.length;
    totals.unchanged += result.unchanged.length;
}

if (process.exitCode !== 1) {
    for (const job of jobs) {
        const runtimeAudit = await job.audit({
            manifest: job.manifest,
            repositoryRoot: REPOSITORY_ROOT,
            checkRuntime: true
        });
        runtimeAudit.warnings.forEach((warning) => (
            console.warn(`[import:assets] ${job.label} 경고: ${warning}`)
        ));
        runtimeAudit.errors.forEach(reportFailure);
    }
}

if (process.exitCode !== 1) {
    console.log(
        `[import:assets] 성공: 신규 ${totals.copied}개, 동일 ${totals.unchanged}개, 충돌 0개`
    );
}
