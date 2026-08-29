/** @param {*} value @returns {string} 지원 방향입니다. */
function normalizeFacing(value) {
    return ['left', 'right', 'up', 'down'].includes(value) ? value : 'down';
}

/**
 * @class TutorialSpriteClipResolver
 * @description 요청 동작·방향을 실제 제공 시트 또는 명시적 폴백 클립으로 해석합니다.
 */
export class TutorialSpriteClipResolver {
    #clips;

    /** @param {object} data - TUTORIAL_SPRITE_CLIPS 데이터입니다. */
    constructor(data = {}) {
        this.#clips = data.CLIPS || {};
    }

    /**
     * @param {object} request - 배우 종류, 동작, 방향과 색상 변형입니다.
     * @returns {Readonly<object>|null} 실제 프레임과 요청 타이밍이 결합된 클립입니다.
     */
    resolve({ actorType, animationId, facing = 'down', variant = 'blue' } = {}) {
        const requested = this.#findRequestedClip(actorType, animationId, facing);
        if (!requested) {
            return null;
        }
        const resolved = this.#followFallback(requested);
        if (!resolved || resolved.frames.length === 0) {
            return null;
        }
        const requestedCount = Math.max(1, Number(requested.playbackFrameCount) || 1);
        const frames = Array.from({ length: requestedCount }, (_, index) => (
            resolved.frames[Math.min(index, resolved.frames.length - 1)]
                || resolved.frames[index % resolved.frames.length]
        ));
        const assetId = resolved.assetIds?.[variant]
            || resolved.assetIds?.blue
            || resolved.assetId;
        if (!assetId) {
            return null;
        }
        const fallbackUsed = resolved.id !== requested.id;
        return Object.freeze({
            requestedClipId: requested.id,
            resolvedClipId: resolved.id,
            actorType: requested.actorType,
            animationId: requested.animationId,
            facing: requested.facing || normalizeFacing(facing),
            assetId,
            frames: Object.freeze(frames),
            fps: requested.fps,
            loop: requested.loop,
            impactFrame: requested.impactFrame,
            frameEvents: requested.frameEvents,
            logicalSize: requested.logicalSize || resolved.logicalSize,
            anchor: requested.anchor || resolved.anchor,
            scaleTileRatio: requested.scaleTileRatio || resolved.scaleTileRatio,
            visualTopInsetRatio: requested.visualTopInsetRatio
                ?? resolved.visualTopInsetRatio
                ?? 0,
            fallbackUsed,
            fallbackEffect: fallbackUsed ? requested.fallbackEffect : null,
            terminal: requested.terminal,
            hideOnComplete: requested.hideOnComplete
        });
    }

    /** @param {object} request @returns {number} 타격 프레임까지 걸리는 초입니다. */
    getImpactDelay(request = {}) {
        const clip = this.resolve(request);
        return clip && Number.isInteger(clip.impactFrame)
            ? clip.impactFrame / clip.fps
            : 0;
    }

    /** @param {string} actorType @param {string} animationId @param {string} facing @returns {object|null} @private */
    #findRequestedClip(actorType, animationId, facing) {
        if (typeof actorType !== 'string' || typeof animationId !== 'string') {
            return null;
        }
        const direction = normalizeFacing(facing);
        const candidates = [
            `${actorType}.${animationId}.${direction}`,
            `${actorType}.${animationId}`,
            `${actorType}.idle.${direction}`,
            `${actorType}.idle`
        ];
        for (const id of candidates) {
            if (this.#clips[id]) {
                return this.#clips[id];
            }
        }
        return null;
    }

    /** @param {object} requested @returns {object|null} @private */
    #followFallback(requested) {
        const visited = new Set();
        let current = requested;
        while (current && !visited.has(current.id)) {
            visited.add(current.id);
            if (current.available !== false && current.frames.length > 0) {
                return current;
            }
            current = current.fallbackClipId ? this.#clips[current.fallbackClipId] : null;
        }
        return null;
    }
}
