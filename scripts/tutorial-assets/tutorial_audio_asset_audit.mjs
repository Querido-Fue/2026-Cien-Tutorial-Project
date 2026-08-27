import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';

import { resolveTutorialAssetPaths } from './tutorial_asset_paths.mjs';
import { readTutorialMp3Header } from './tutorial_mp3_header.mjs';

/** @param {string} filePath @returns {Promise<boolean>} 존재 여부입니다. */
async function exists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

/** @param {string} filePath @returns {Promise<string>} SHA-256입니다. */
async function hashFile(filePath) {
    return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

/** @param {Map<string,object>} byId @param {string} startId @returns {boolean} */
function fallbackTerminates(byId, startId) {
    const visited = new Set();
    let current = byId.get(startId);
    while (current) {
        if (visited.has(current.id)) {
            return false;
        }
        visited.add(current.id);
        if (current.available !== false) {
            return true;
        }
        current = byId.get(current.fallback);
    }
    return false;
}

/**
 * 오디오 매니페스트, 원본 MP3와 선택적 런타임 복사본을 함께 검사합니다.
 * @param {object} options - 감사 입력입니다.
 * @returns {Promise<Readonly<object>>} 오류·경고·항목 결과입니다.
 */
export async function auditTutorialAudioAssets({
    manifest,
    repositoryRoot,
    checkRuntime = true
}) {
    const errors = [];
    const warnings = [];
    const entries = [];
    const byId = new Map();
    const runtimePaths = new Set();
    for (const entry of manifest?.ENTRIES || []) {
        if (!entry || typeof entry.id !== 'string' || entry.id.length === 0) {
            errors.push('비어 있거나 문자열이 아닌 오디오 ID가 있습니다.');
            continue;
        }
        if (byId.has(entry.id)) {
            errors.push(`중복 오디오 ID: ${entry.id}`);
            continue;
        }
        byId.set(entry.id, entry);
    }

    for (const entry of byId.values()) {
        if (entry.type !== 'audio/mpeg') {
            errors.push(`${entry.id}: 지원하지 않는 type '${entry.type}'`);
            continue;
        }
        if (!['bgm', 'sfx', 'ui'].includes(entry.bus)) {
            errors.push(`${entry.id}: 알 수 없는 bus '${entry.bus}'`);
        }
        if (typeof entry.loop !== 'boolean'
            || typeof entry.required !== 'boolean'
            || !Number.isFinite(entry.defaultVolume)
            || entry.defaultVolume < 0 || entry.defaultVolume > 1
            || !Number.isInteger(entry.polyphony) || entry.polyphony < 1
            || !Number.isFinite(entry.cooldownSeconds) || entry.cooldownSeconds < 0) {
            errors.push(`${entry.id}: 재생 정책 필드가 유효하지 않습니다.`);
        }
        if (entry.fallback && !byId.has(entry.fallback)) {
            errors.push(`${entry.id}: 존재하지 않는 fallback '${entry.fallback}'`);
        }
        if (!fallbackTerminates(byId, entry.id)) {
            errors.push(`${entry.id}: fallback이 재생 가능한 항목에서 끝나지 않습니다.`);
        }
        if (entry.available === false) {
            entries.push(Object.freeze({
                id: entry.id,
                status: 'declared-fallback',
                fallback: entry.fallback
            }));
            continue;
        }

        let paths;
        try {
            paths = resolveTutorialAssetPaths(manifest, entry, repositoryRoot);
        } catch (error) {
            errors.push(`${entry.id}: ${error.message}`);
            continue;
        }
        if (runtimePaths.has(paths.runtimePath)) {
            errors.push(`${entry.id}: 런타임 경로 충돌 '${paths.runtimeRelativePath}'`);
            continue;
        }
        runtimePaths.add(paths.runtimePath);
        if (!await exists(paths.sourcePath)) {
            const message = `${entry.id}: 원본 없음 '${entry.sourceName}'`;
            (entry.required ? errors : warnings).push(message);
            entries.push(Object.freeze({ id: entry.id, status: 'source-missing' }));
            continue;
        }
        let sourceHeader;
        try {
            sourceHeader = await readTutorialMp3Header(paths.sourcePath);
        } catch (error) {
            errors.push(`${entry.id}: 원본 MP3 검사 실패 (${error.message})`);
            continue;
        }
        if (!checkRuntime) {
            entries.push(Object.freeze({ id: entry.id, status: 'source-ready', sourceHeader }));
            continue;
        }
        if (!await exists(paths.runtimePath)) {
            const message = `${entry.id}: 런타임 복사본 없음 '${paths.runtimeRelativePath}'`;
            (entry.required ? errors : warnings).push(message);
            entries.push(Object.freeze({ id: entry.id, status: 'runtime-missing' }));
            continue;
        }
        try {
            const runtimeHeader = await readTutorialMp3Header(paths.runtimePath);
            const [sourceHash, runtimeHash] = await Promise.all([
                hashFile(paths.sourcePath),
                hashFile(paths.runtimePath)
            ]);
            if (sourceHash !== runtimeHash) {
                errors.push(`${entry.id}: 런타임 MP3 내용이 원본과 다릅니다.`);
            }
            entries.push(Object.freeze({
                id: entry.id,
                status: 'ready',
                sourceHeader,
                runtimeHeader,
                runtimeRelativePath: paths.runtimeRelativePath
            }));
        } catch (error) {
            errors.push(`${entry.id}: 런타임 MP3 검사 실패 (${error.message})`);
        }
    }
    return Object.freeze({
        ok: errors.length === 0,
        errors: Object.freeze(errors),
        warnings: Object.freeze(warnings),
        entries: Object.freeze(entries)
    });
}
