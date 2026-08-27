const ACTION_PRIORITIES = Object.freeze({
    death: 100,
    hit: 80,
    melee: 60,
    ranged: 60,
    area: 60,
    attack: 60,
    heal: 55,
    item: 55,
    teleport: 50,
    idle: 0,
    walk: 0,
    unstable: 0,
    collapse: 0
});

/** @param {*} value @returns {number} 0 이상의 유한 초입니다. */
function toDelta(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
}

/** @param {object} from @param {object} to @param {string} fallback @returns {string} 이동 방향입니다. */
function resolveFacing(from, to, fallback = 'down') {
    const dx = Number(to?.x) - Number(from?.x);
    const dy = Number(to?.y) - Number(from?.y);
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) + Math.abs(dy) < 0.0001) {
        return fallback;
    }
    if (Math.abs(dx) >= Math.abs(dy)) {
        return dx < 0 ? 'left' : 'right';
    }
    return dy < 0 ? 'up' : 'down';
}

/**
 * @class TutorialSpriteAnimator
 * @description 배우별 델타 기반 프레임 진행, 우선순위 중단, 루프와 수명 정리를 소유합니다.
 */
export class TutorialSpriteAnimator {
    #resolver;
    #tracks;
    #events;
    #destroyed;

    /** @param {{resolver:object}} options - 클립 해석기입니다. */
    constructor({ resolver } = {}) {
        this.#resolver = resolver;
        this.#tracks = new Map();
        this.#events = [];
        this.#destroyed = false;
    }

    /**
     * 현재 화면에 존재하는 배우 전체를 동기화하고 사라진 배우 트랙을 제거합니다.
     * @param {readonly object[]} actors - 배우 표시 상태입니다.
     */
    syncActors(actors = []) {
        if (this.#destroyed) {
            return;
        }
        const seen = new Set();
        for (const actor of Array.isArray(actors) ? actors : []) {
            if (!actor || typeof actor.id !== 'string' || typeof actor.actorType !== 'string') {
                continue;
            }
            seen.add(actor.id);
            this.#syncActor(actor);
        }
        for (const actorId of this.#tracks.keys()) {
            if (!seen.has(actorId)) {
                this.#tracks.delete(actorId);
            }
        }
    }

    /**
     * 우선순위 규칙에 따라 배우 동작을 즉시 시작합니다.
     * @param {string} actorId - 배우 ID입니다.
     * @param {string} animationId - 의미 동작 ID입니다.
     * @param {object} [options={}] - 방향과 명시 우선순위입니다.
     * @returns {boolean} 시작 여부입니다.
     */
    play(actorId, animationId, options = {}) {
        const track = this.#tracks.get(actorId);
        if (!track || this.#destroyed) {
            return false;
        }
        const priority = Number.isFinite(Number(options.priority))
            ? Number(options.priority)
            : (ACTION_PRIORITIES[animationId] ?? 40);
        if (track.locked && priority < track.priority) {
            return false;
        }
        const facing = options.facing || track.facing;
        return this.#startClip(track, animationId, facing, priority);
    }

    /** @param {string} actorId @param {string} animationId @param {string} facing @returns {number} 타격 지연 초입니다. */
    getImpactDelay(actorId, animationId, facing) {
        const track = this.#tracks.get(actorId);
        if (!track) {
            return 0;
        }
        return this.#resolver?.getImpactDelay?.({
            actorType: track.actorType,
            animationId,
            facing: facing || track.facing,
            variant: track.variant
        }) || 0;
    }

    /** @param {number} deltaSeconds - 실제 프레임 델타입니다. */
    update(deltaSeconds) {
        const delta = toDelta(deltaSeconds);
        if (delta <= 0 || this.#destroyed) {
            return;
        }
        for (const track of this.#tracks.values()) {
            this.#advanceTrack(track, delta);
        }
    }

    /** @returns {readonly object[]} 프레임 이벤트를 한 번만 반환합니다. */
    drainEvents() {
        const events = Object.freeze(this.#events.map((event) => Object.freeze({ ...event })));
        this.#events = [];
        return events;
    }

    /** @returns {Readonly<Record<string,object>>} 렌더 전용 프레임 스냅샷입니다. */
    getSnapshot() {
        return Object.freeze(Object.fromEntries(Array.from(this.#tracks.entries()).map(
            ([actorId, track]) => [actorId, this.#createTrackSnapshot(track)]
        )));
    }

    /** @returns {number} 진단용 활성 트랙 수입니다. */
    getTrackCount() {
        return this.#tracks.size;
    }

    /** @returns {boolean} 완료 전인 비루프 동작이 하나라도 있는지 여부입니다. */
    hasBlockingAnimation() {
        if (this.#destroyed) {
            return false;
        }
        return Array.from(this.#tracks.values()).some((track) => track.locked);
    }

    /** 모든 트랙과 대기 이벤트를 새 런 상태로 비웁니다. */
    reset() {
        this.#tracks.clear();
        this.#events = [];
    }

    /** 수명 종료 후 재사용을 막습니다. */
    destroy() {
        this.reset();
        this.#destroyed = true;
        this.#resolver = null;
    }

    /** @param {object} actor @private */
    #syncActor(actor) {
        let track = this.#tracks.get(actor.id);
        const position = { x: Number(actor.x) || 0, y: Number(actor.y) || 0 };
        if (!track) {
            track = {
                actorId: actor.id,
                actorType: actor.actorType,
                variant: actor.variant || 'blue',
                facing: actor.facing || 'down',
                position,
                alive: actor.alive !== false,
                ambientAnimationId: actor.ambientAnimationId || 'idle',
                clip: null,
                elapsed: 0,
                absoluteFrame: 0,
                frameIndex: 0,
                priority: 0,
                locked: false,
                visible: true,
                impactFired: false,
                completed: false
            };
            this.#tracks.set(actor.id, track);
            this.#startClip(track, track.ambientAnimationId, track.facing, 0);
        }

        const previousPosition = track.position;
        track.actorType = actor.actorType;
        track.variant = actor.variant || track.variant;
        track.position = position;
        const moving = actor.detectMovement === true
            && (Math.abs(position.x - previousPosition.x)
                + Math.abs(position.y - previousPosition.y)) > 0.0001;
        if (moving) {
            track.facing = resolveFacing(previousPosition, position, track.facing);
        } else if (actor.facing) {
            track.facing = actor.facing;
        }
        track.ambientAnimationId = moving
            ? 'walk'
            : (actor.ambientAnimationId || 'idle');

        // 사망 전환은 프레젠터의 impact 동기화 cue가 시작한다.
        track.alive = actor.alive !== false;
        if (!track.locked && !track.clip?.terminal) {
            const ambientChanged = track.clip?.animationId !== track.ambientAnimationId;
            const facingChanged = track.clip?.facing !== track.facing;
            if (ambientChanged || facingChanged) {
                this.#startClip(track, track.ambientAnimationId, track.facing, 0);
            }
        }
    }

    /** @param {object} track @param {string} animationId @param {string} facing @param {number} priority @returns {boolean} @private */
    #startClip(track, animationId, facing, priority) {
        const clip = this.#resolver?.resolve?.({
            actorType: track.actorType,
            animationId,
            facing,
            variant: track.variant
        });
        if (!clip) {
            return false;
        }
        track.clip = clip;
        track.facing = facing;
        track.elapsed = 0;
        track.absoluteFrame = 0;
        track.frameIndex = 0;
        track.priority = priority;
        track.locked = priority > 0 && !clip.loop;
        track.visible = true;
        track.impactFired = false;
        track.completed = false;
        this.#emitFrameEvents(track, 0);
        return true;
    }

    /** @param {object} track @param {number} delta @private */
    #advanceTrack(track, delta) {
        const clip = track.clip;
        if (!clip || !track.visible || track.completed) {
            return;
        }
        const frameCount = clip.frames.length;
        const oldAbsolute = track.absoluteFrame;
        const nextElapsed = track.elapsed + delta;
        const rawAbsolute = Math.floor(nextElapsed * clip.fps);
        if (clip.loop) {
            track.elapsed = nextElapsed;
            track.absoluteFrame = rawAbsolute;
            track.frameIndex = rawAbsolute % frameCount;
            this.#emitCrossedFrames(track, oldAbsolute, rawAbsolute, true);
            return;
        }

        const duration = frameCount / clip.fps;
        const boundedElapsed = Math.min(nextElapsed, duration);
        const boundedAbsolute = Math.min(frameCount - 1, Math.floor(boundedElapsed * clip.fps));
        track.elapsed = boundedElapsed;
        track.absoluteFrame = boundedAbsolute;
        track.frameIndex = boundedAbsolute;
        this.#emitCrossedFrames(track, oldAbsolute, boundedAbsolute, false);
        if (nextElapsed < duration) {
            return;
        }

        track.locked = false;
        this.#events.push({
            id: 'complete',
            actorId: track.actorId,
            animationId: clip.animationId,
            clipId: clip.requestedClipId
        });
        if (clip.terminal) {
            track.priority = 0;
            track.visible = clip.hideOnComplete !== true;
            track.completed = true;
            return;
        }
        const overflow = Math.max(0, nextElapsed - duration);
        this.#startClip(track, track.ambientAnimationId, track.facing, 0);
        if (overflow > 0) {
            this.#advanceTrack(track, overflow);
        }
    }

    /** @param {object} track @param {number} oldFrame @param {number} newFrame @param {boolean} loop @private */
    #emitCrossedFrames(track, oldFrame, newFrame, loop) {
        if (newFrame <= oldFrame) {
            return;
        }
        const frameCount = track.clip.frames.length;
        const first = Math.max(oldFrame + 1, newFrame - 64);
        for (let absolute = first; absolute <= newFrame; absolute++) {
            const frameIndex = loop ? absolute % frameCount : Math.min(absolute, frameCount - 1);
            this.#emitFrameEvents(track, frameIndex);
        }
        if (!track.impactFired
            && Number.isInteger(track.clip.impactFrame)
            && newFrame >= track.clip.impactFrame) {
            this.#emitImpact(track);
        }
    }

    /** @param {object} track @param {number} frameIndex @private */
    #emitFrameEvents(track, frameIndex) {
        if (!track.impactFired && frameIndex === track.clip.impactFrame) {
            this.#emitImpact(track);
        }
        for (const eventId of track.clip.frameEvents?.[String(frameIndex)] || []) {
            this.#events.push({
                id: eventId,
                actorId: track.actorId,
                animationId: track.clip.animationId,
                frameIndex
            });
        }
    }

    /** @param {object} track @private */
    #emitImpact(track) {
        track.impactFired = true;
        this.#events.push({
            id: 'impact',
            actorId: track.actorId,
            animationId: track.clip.animationId,
            frameIndex: track.clip.impactFrame
        });
    }

    /** @param {object} track @returns {Readonly<object>} @private */
    #createTrackSnapshot(track) {
        const clip = track.clip;
        const frame = clip?.frames[track.frameIndex] || { layers: [] };
        const duration = clip?.loop ? 1 : (clip?.frames.length || 1) / (clip?.fps || 1);
        return Object.freeze({
            actorId: track.actorId,
            actorType: track.actorType,
            animationId: clip?.animationId || 'idle',
            requestedClipId: clip?.requestedClipId || null,
            resolvedClipId: clip?.resolvedClipId || null,
            assetId: clip?.assetId || null,
            frameIndex: track.frameIndex,
            layers: frame.layers || Object.freeze([]),
            logicalSize: clip?.logicalSize,
            anchor: clip?.anchor,
            scaleTileRatio: clip?.scaleTileRatio || 0.92,
            facing: track.facing,
            fallbackUsed: clip?.fallbackUsed === true,
            fallbackEffect: clip?.fallbackEffect || null,
            progress: clip?.loop
                ? (track.elapsed * clip.fps % clip.frames.length) / clip.frames.length
                : Math.min(1, track.elapsed / Math.max(0.001, duration)),
            visible: track.visible,
            locked: track.locked,
            completed: track.completed
        });
    }
}
