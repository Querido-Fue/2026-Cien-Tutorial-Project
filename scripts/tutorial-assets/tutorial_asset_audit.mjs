import { access } from 'node:fs/promises';

import { resolveTutorialAssetPaths } from './tutorial_asset_paths.mjs';
import { readTutorialPngDimensions } from './tutorial_png_header.mjs';

/** @param {string} filePath @returns {Promise<boolean>} 파일 존재 여부입니다. */
async function exists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

/** @param {object} left @param {object} right @returns {boolean} 크기 일치 여부입니다. */
function dimensionsMatch(left, right) {
    return Number(left?.width) === Number(right?.width)
        && Number(left?.height) === Number(right?.height);
}

/**
 * 원본 및 선택적으로 런타임 복사본을 매니페스트 계약과 대조합니다.
 * @param {object} options - 감사 입력입니다.
 * @returns {Promise<object>} 오류·경고·항목 결과입니다.
 */
export async function auditTutorialAssets({
    manifest,
    repositoryRoot,
    checkRuntime = true
}) {
    const errors = [];
    const warnings = [];
    const entries = [];
    const ids = new Set();
    const runtimePaths = new Set();
    const manifestIds = new Set((manifest?.ENTRIES || []).map((entry) => entry?.id));

    for (const entry of manifest?.ENTRIES || []) {
        if (!entry || typeof entry.id !== 'string' || entry.id.length === 0) {
            errors.push('비어 있거나 문자열이 아닌 논리 ID가 있습니다.');
            continue;
        }
        if (ids.has(entry.id)) {
            errors.push(`중복 논리 ID: ${entry.id}`);
            continue;
        }
        ids.add(entry.id);
        if (entry.fallback && !manifestIds.has(entry.fallback)) {
            errors.push(`${entry.id}: 존재하지 않는 fallback '${entry.fallback}'`);
        }
        if (entry.type === 'generated-fallback') {
            entries.push(Object.freeze({ id: entry.id, status: 'generated-fallback' }));
            continue;
        }
        if (entry.type !== 'image/png') {
            errors.push(`${entry.id}: 지원하지 않는 type '${entry.type}'`);
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

        const sourceExists = await exists(paths.sourcePath);
        if (!sourceExists) {
            const message = `${entry.id}: 원본 없음 '${entry.sourceName}'`;
            (entry.required ? errors : warnings).push(message);
            entries.push(Object.freeze({ id: entry.id, status: 'source-missing' }));
            continue;
        }

        let sourceDimensions;
        try {
            sourceDimensions = await readTutorialPngDimensions(paths.sourcePath);
        } catch (error) {
            errors.push(`${entry.id}: 원본 PNG 검사 실패 (${error.message})`);
            continue;
        }
        if (!dimensionsMatch(sourceDimensions, entry.expectedDimensions)
            || !dimensionsMatch(sourceDimensions, entry.actualDimensions)) {
            errors.push(
                `${entry.id}: 원본 크기 ${sourceDimensions.width}×${sourceDimensions.height}, `
                + `계약 ${entry.expectedDimensions?.width}×${entry.expectedDimensions?.height}`
            );
        }
        if (entry.sourceRect) {
            const rect = entry.sourceRect;
            const validRect = Number.isInteger(rect.x)
                && Number.isInteger(rect.y)
                && Number.isInteger(rect.w)
                && Number.isInteger(rect.h)
                && rect.x >= 0
                && rect.y >= 0
                && rect.w > 0
                && rect.h > 0
                && rect.x + rect.w <= sourceDimensions.width
                && rect.y + rect.h <= sourceDimensions.height;
            if (!validRect) {
                errors.push(`${entry.id}: sourceRect가 원본 경계를 벗어납니다.`);
            }
        }

        if (!checkRuntime) {
            entries.push(Object.freeze({
                id: entry.id,
                status: 'source-ready',
                sourceDimensions
            }));
            continue;
        }
        const runtimeExists = await exists(paths.runtimePath);
        if (!runtimeExists) {
            const message = `${entry.id}: 런타임 복사본 없음 '${paths.runtimeRelativePath}'`;
            (entry.required ? errors : warnings).push(message);
            entries.push(Object.freeze({ id: entry.id, status: 'runtime-missing' }));
            continue;
        }
        try {
            const runtimeDimensions = await readTutorialPngDimensions(paths.runtimePath);
            if (!dimensionsMatch(runtimeDimensions, sourceDimensions)) {
                errors.push(
                    `${entry.id}: 런타임 크기 ${runtimeDimensions.width}×${runtimeDimensions.height}`
                    + `가 원본과 다릅니다.`
                );
            }
            entries.push(Object.freeze({
                id: entry.id,
                status: 'ready',
                sourceDimensions,
                runtimeDimensions,
                runtimeRelativePath: paths.runtimeRelativePath
            }));
        } catch (error) {
            errors.push(`${entry.id}: 런타임 PNG 검사 실패 (${error.message})`);
        }
    }

    return Object.freeze({
        ok: errors.length === 0,
        errors: Object.freeze(errors),
        warnings: Object.freeze(warnings),
        entries: Object.freeze(entries)
    });
}
