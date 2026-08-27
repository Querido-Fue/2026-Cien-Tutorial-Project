/**
 * @class AudioManifestResolver
 * @description 의미 cue ID를 비순환 fallback 체인을 따라 실제 런타임 항목으로 해석합니다.
 */
export class AudioManifestResolver {
    #entries;

    /** @param {object|readonly object[]} manifest - ENTRIES 또는 항목 배열입니다. */
    constructor(manifest = []) {
        const entries = Array.isArray(manifest) ? manifest : manifest?.ENTRIES;
        this.#entries = new Map();
        for (const entry of Array.isArray(entries) ? entries : []) {
            if (entry && typeof entry.id === 'string' && !this.#entries.has(entry.id)) {
                this.#entries.set(entry.id, entry);
            }
        }
    }

    /** @param {string} cueId @returns {object|null} 선언된 원본 항목입니다. */
    getEntry(cueId) {
        return this.#entries.get(cueId) || null;
    }

    /**
     * @param {string} cueId - 요청 의미 ID입니다.
     * @param {string|null} [expectedBus=null] - 허용할 버스입니다.
     * @returns {Readonly<object>|null} 재생 가능한 항목과 fallback 경로입니다.
     */
    resolve(cueId, expectedBus = null) {
        if (typeof cueId !== 'string' || cueId.length === 0) {
            return null;
        }
        const visited = new Set();
        const fallbackChain = [];
        let currentId = cueId;
        while (currentId && !visited.has(currentId)) {
            visited.add(currentId);
            fallbackChain.push(currentId);
            const entry = this.#entries.get(currentId);
            if (!entry) {
                return null;
            }
            const busMatches = !expectedBus || entry.bus === expectedBus;
            const hasRuntimePath = typeof entry.runtimePath === 'string'
                && entry.runtimePath.length > 0;
            if (entry.available !== false && busMatches && hasRuntimePath) {
                return Object.freeze({
                    requestedId: cueId,
                    resolvedId: entry.id,
                    fallbackUsed: entry.id !== cueId,
                    fallbackChain: Object.freeze([...fallbackChain]),
                    entry
                });
            }
            currentId = typeof entry.fallback === 'string' ? entry.fallback : '';
        }
        return null;
    }
}
