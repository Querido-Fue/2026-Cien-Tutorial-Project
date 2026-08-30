/** @param {*} value @returns {string} 지원 방향입니다. */
function normalizeFacing(value) {
    return ['left', 'right', 'up', 'down'].includes(value) ? value : 'down';
}

/**
 * 좌우 반전된 스프라이트의 양발 접점을 같은 화면 방향으로 변환합니다.
 * @param {readonly (readonly {x:number,y:number}[])[]} frames - 원본 발 접점입니다.
 * @param {boolean} flipX - 좌우 반전 여부입니다.
 * @returns {readonly (readonly {x:number,y:number}[])[]} 화면 방향의 발 접점입니다.
 */
function orientShadowFootFrames(frames, flipX) {
    if (!flipX) {
        return frames;
    }
    return Object.freeze((frames || []).map((feet) => Object.freeze(
        (feet || []).map((foot) => Object.freeze({
            x: 1 - Number(foot.x),
            y: Number(foot.y)
        })).sort((left, right) => left.x - right.x)
    )));
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
        const shadowFootFrames = Array.from({ length: requestedCount }, (_, index) => (
            resolved.shadowFootFrames?.[
                Math.min(index, Math.max(0, resolved.shadowFootFrames.length - 1))
            ] || Object.freeze([])
        ));
        const assetId = resolved.assetIds?.[variant]
            || resolved.assetIds?.blue
            || resolved.assetId;
        if (!assetId) {
            return null;
        }
        const fallbackUsed = resolved.id !== requested.id;
        const flipX = requested.flipX === true || resolved.flipX === true;
        return Object.freeze({
            requestedClipId: requested.id,
            resolvedClipId: resolved.id,
            actorType: requested.actorType,
            animationId: requested.animationId,
            facing: requested.facing || normalizeFacing(facing),
            flipX,
            assetId,
            frames: Object.freeze(frames),
            shadowFootFrames: orientShadowFootFrames(
                Object.freeze(shadowFootFrames),
                flipX
            ),
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
