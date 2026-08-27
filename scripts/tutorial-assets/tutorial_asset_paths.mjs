import { isAbsolute, relative, resolve, sep } from 'node:path';

/** @param {string} parent @param {string} candidate @returns {boolean} 포함 여부입니다. */
function isWithin(parent, candidate) {
    const relativePath = relative(parent, candidate);
    return !isAbsolute(relativePath) && (relativePath === ''
        || (!relativePath.startsWith('..' + sep) && relativePath !== '..'));
}

/** @param {string} value @returns {boolean} ASCII 안전 경로 여부입니다. */
function isSafeRuntimePath(value) {
    return value.split(/[\\/]+/).every((segment) => (
        segment.length > 0 && /^[a-z0-9][a-z0-9._-]*$/i.test(segment)
    ));
}

/**
 * 매니페스트 항목의 원본·런타임 절대 경로를 저장소 내부로 제한해 계산합니다.
 * @param {object} manifest - 에셋 매니페스트입니다.
 * @param {object} entry - 단일 매니페스트 항목입니다.
 * @param {string} repositoryRoot - 저장소 절대 경로입니다.
 * @returns {{sourcePath:string,runtimePath:string,runtimeRelativePath:string}} 검증된 경로입니다.
 */
export function resolveTutorialAssetPaths(manifest, entry, repositoryRoot) {
    const sourceRoot = resolve(repositoryRoot, manifest.SOURCE_ROOT);
    const runtimeRoot = resolve(repositoryRoot, manifest.RUNTIME_ROOT);
    const engineRoot = resolve(repositoryRoot, 'project', 'engine');
    const sourcePath = resolve(sourceRoot, entry.sourceName);
    const runtimePath = resolve(engineRoot, entry.runtimePath);
    const runtimeRelativePath = relative(runtimeRoot, runtimePath);

    if (!isWithin(sourceRoot, sourcePath)) {
        throw new Error(`원본 경로가 SOURCE_ROOT 밖입니다: ${entry.sourceName}`);
    }
    if (!isWithin(runtimeRoot, runtimePath)) {
        throw new Error(`런타임 경로가 RUNTIME_ROOT 밖입니다: ${entry.runtimePath}`);
    }
    if (!isWithin(repositoryRoot, runtimePath)) {
        throw new Error(`런타임 경로가 저장소 밖입니다: ${entry.runtimePath}`);
    }
    if (!isSafeRuntimePath(runtimeRelativePath)) {
        throw new Error(`런타임 파일명이 ASCII 안전 규칙을 위반합니다: ${runtimeRelativePath}`);
    }
    if (sourcePath === runtimePath) {
        throw new Error(`원본과 런타임 경로가 같습니다: ${entry.id}`);
    }
    return Object.freeze({ sourcePath, runtimePath, runtimeRelativePath });
}
