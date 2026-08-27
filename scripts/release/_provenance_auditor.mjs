import { access, readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

/** @param {string} value @returns {string} */
function toPosix(value) {
    return value.split(sep).join('/');
}

/** @param {string} root @returns {Promise<string[]>} */
async function listFiles(root) {
    const output = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
        const target = join(root, entry.name);
        if (entry.isDirectory()) {
            output.push(...await listFiles(target));
        } else if (entry.isFile()) {
            output.push(target);
        }
    }
    return output;
}

/** @param {string} path @param {string} pattern @returns {boolean} */
function matchesPath(path, pattern) {
    if (pattern.endsWith('/**')) {
        const prefix = pattern.slice(0, -3);
        return path === prefix || path.startsWith(prefix + '/');
    }
    return path === pattern;
}

/**
 * @class ProvenanceAuditor
 * @description 모든 저장소 에셋이 출처 규칙에 포함되고 불명확한 권리가 차단 상태인지 검사합니다.
 */
export class ProvenanceAuditor {
    /** @param {{repositoryRoot:string,manifestPath?:string}} options */
    constructor(options) {
        this.repositoryRoot = resolve(options.repositoryRoot);
        this.manifestPath = resolve(
            options.manifestPath
                || join(this.repositoryRoot, 'manifests', 'asset-provenance.json')
        );
    }

    /** @returns {Promise<object>} 출처 감사 결과입니다. */
    async audit() {
        const errors = [];
        const manifest = JSON.parse(await readFile(this.manifestPath, 'utf8'));
        if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.components)) {
            errors.push('출처 매니페스트 스키마 또는 components가 잘못되었습니다.');
        }
        const ids = new Set();
        for (const component of manifest.components || []) {
            if (typeof component.id !== 'string' || !component.id) {
                errors.push('출처 구성 요소 ID가 비어 있습니다.');
                continue;
            }
            if (ids.has(component.id)) {
                errors.push(`출처 구성 요소 ID가 중복됩니다: ${component.id}`);
            }
            ids.add(component.id);
            const unknown = ['unknown', 'third-party-reference-unverified']
                .includes(component.originStatus);
            if (unknown && component.releaseStatus !== 'blocked') {
                errors.push(`${component.id}: 불명확한 출처는 blocked여야 합니다.`);
            }
            if (component.releaseStatus === 'blocked' && !component.blocker) {
                errors.push(`${component.id}: 차단 사유가 없습니다.`);
            }
            if (component.releaseStatus === 'approved' && component.notice) {
                try {
                    await access(join(this.repositoryRoot, component.notice));
                } catch {
                    errors.push(`${component.id}: 고지 파일이 없습니다: ${component.notice}`);
                }
            }
        }

        const assetRoot = join(this.repositoryRoot, 'project', 'asset');
        const assetFiles = (await listFiles(assetRoot)).map(
            (file) => toPosix(relative(this.repositoryRoot, file))
        );
        for (const file of assetFiles) {
            const covered = (manifest.components || []).some((component) => (
                (component.paths || []).some((pattern) => matchesPath(file, pattern))
            ));
            if (!covered) {
                errors.push(`출처 규칙에 포함되지 않은 에셋: ${file}`);
            }
        }

        const reference = (manifest.components || []).find(
            ({ id }) => id === 'external-reference-item-icons'
        );
        for (const required of [
            'Minecraft',
            'Mario',
            'The Legend of Zelda',
            'MapleStory'
        ]) {
            if (!reference?.references?.includes(required)) {
                errors.push(`외부 게임 참조 권리 검토 누락: ${required}`);
            }
        }

        return Object.freeze({
            assetFileCount: assetFiles.length,
            componentCount: manifest.components?.length || 0,
            errors: Object.freeze(errors),
            blockers: Object.freeze((manifest.components || [])
                .filter(({ releaseStatus }) => releaseStatus === 'blocked')
                .map(({ id, blocker }) => Object.freeze({ id, blocker })))
        });
    }
}
