import { TUTORIAL_PRESENTATION_CUE_TYPES as CUE_TYPES } from './_tutorial_presentation_contract.js';

/** @returns {object} 새 표현 상태입니다. */
function createDefaultPresentationState() {
    return {
        floorIndex: 0,
        playerX: 0,
        playerY: 0,
        playerAlpha: 1,
        playerScale: 1,
        playerHp: 100,
        loraHp: 100,
        instability: 0,
        hoverProgress: 1,
        pathProgress: 1,
        attackProgress: 1,
        menuSelectionProgress: 1,
        actionPulse: 0
    };
}

/** @param {*} value @returns {{x:number,y:number}|null} 유효 타일입니다. */
function cloneTimelineTile(value) {
    const x = Number(value?.x);
    const y = Number(value?.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

/**
 * @class TutorialAnimationTimeline
 * @description 표현 상태, AnimationSystem 슬롯, 입력 잠금과 경로·층 전환 실행을 소유합니다.
 */
export class TutorialAnimationTimeline {
    #animationPort;
    #config;
    #onLockChange;
    #state;
    #locked;
    #destroyed;
    #generation;
    #ownedAnimationIds;
    #animationSlots;
    #activeLockTokens;
    #nextLockToken;

    /**
     * @param {object} options - 애니메이션 포트, 정적 시간 설정과 잠금 알림입니다.
     */
    constructor({ animationPort, config = {}, onLockChange = () => {} } = {}) {
        this.#animationPort = animationPort || {};
        this.#config = Object.freeze({ ...config });
        this.#onLockChange = onLockChange;
        this.#state = createDefaultPresentationState();
        this.#locked = false;
        this.#destroyed = false;
        this.#generation = 0;
        this.#ownedAnimationIds = new Set();
        this.#animationSlots = new Map();
        this.#activeLockTokens = new Set();
        this.#nextLockToken = 0;
    }

    /** @returns {object} AnimationSystem이 갱신하는 현재 표현 상태입니다. */
    getState() {
        return this.#state;
    }

    /** @returns {boolean} 전투 입력 잠금 여부입니다. */
    isLocked() {
        return this.#locked;
    }

    /**
     * 새 런의 논리 상태와 표시 상태를 맞추고 기존 타임라인을 취소합니다.
     * @param {object} initialState - 초기 표시값입니다.
     */
    reset(initialState = {}) {
        this.cancel();
        this.#state = {
            ...createDefaultPresentationState(),
            ...initialState
        };
    }

    /** 진행 중인 애니메이션을 취소하고 stale 완료 콜백을 무효화합니다. */
    cancel() {
        this.#generation += 1;
        for (const animationId of this.#ownedAnimationIds) {
            this.#animationPort.remove?.(animationId);
        }
        this.#ownedAnimationIds.clear();
        this.#animationSlots.clear();
        this.#activeLockTokens.clear();
        this.#setLocked(false);
    }

    /** @param {'hover'|'path'|'attack'|'menu-selection'} kind - 선택 연출 종류입니다. */
    startSelection(kind) {
        const fields = {
            hover: 'hoverProgress',
            path: 'pathProgress',
            attack: 'attackProgress',
            'menu-selection': 'menuSelectionProgress'
        };
        const field = fields[kind];
        if (!field || this.#destroyed) {
            return;
        }
        this.#state[field] = 0;
        void this.#animateSlot(
            'selection-' + kind,
            field,
            1,
            this.#config.SELECTION_SECONDS,
            0
        );
    }

    /**
     * 프레젠터의 HP·불안정도 transition cue를 현재 표시 상태에 적용합니다.
     * @param {readonly object[]} cues - 순서가 부여된 cue입니다.
     */
    applyCues(cues) {
        const targets = new Map();
        for (const cue of Array.isArray(cues) ? cues : []) {
            if (cue?.type === CUE_TYPES.HEALTH_TRANSITION) {
                if (cue.actorId === 'player') {
                    targets.set('playerHp', cue);
                } else if (cue.actorId === 'lora') {
                    targets.set('loraHp', cue);
                }
            } else if (cue?.type === CUE_TYPES.INSTABILITY_TRANSITION) {
                targets.set('instability', cue);
            }
        }
        for (const [field, cue] of targets) {
            void this.#animateSlot(
                'hud-' + field.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase()),
                field,
                Number(cue.to) || 0,
                Number(cue.duration) || this.#config.GAUGE_SECONDS
            );
        }
    }

    /** @param {number} [duration] - 행동 충격 연출 시간입니다. */
    startAction(duration = this.#config.ATTACK_SECONDS) {
        if (this.#destroyed) {
            return;
        }
        const generation = this.#generation;
        const lockToken = this.#beginLock();
        this.#state.actionPulse = 1;
        void this.#animateSlot(
            'action-pulse',
            'actionPulse',
            0,
            duration,
            1
        ).then(
            () => this.#finishLock(generation, lockToken),
            () => this.#finishLock(generation, lockToken)
        );
    }

    /**
     * 실제 이동 경로를 칸별로 재생하고 텔레포트를 축소·페이드로 처리합니다.
     * @param {object} options - 경로, 포탈 구간과 최종 모델 좌표입니다.
     */
    startPlayerPath({
        path = [],
        teleportSegments = [],
        finalPlayer = null,
        logicalFloorIndex = 0,
        visibleFloorIndex = 0
    } = {}) {
        if (this.#destroyed) {
            return;
        }
        const route = path.map(cloneTimelineTile).filter(Boolean);
        const generation = this.#generation;
        const lockToken = this.#beginLock();
        if (route.length <= 1) {
            const stayScale = Number(this.#config.STAY_SCALE) || 0.86;
            this.#state.playerScale = stayScale;
            void this.#animateSlot(
                'player-scale',
                'playerScale',
                1,
                this.#config.SELECTION_SECONDS,
                stayScale
            ).then(
                () => this.#finishLock(generation, lockToken),
                () => this.#finishLock(generation, lockToken)
            );
            return;
        }
        void this.#animatePlayerRoute(
            route,
            generation,
            this.#config.MOVE_SECONDS_PER_TILE,
            teleportSegments
        ).then(
            () => {
                if (this.#isCurrent(generation)) {
                    const target = cloneTimelineTile(finalPlayer);
                    if (target) {
                        this.#state.playerX = target.x;
                        this.#state.playerY = target.y;
                    }
                    this.#state.playerAlpha = 1;
                    this.#state.playerScale = 1;
                    if (Number(visibleFloorIndex) === Number(logicalFloorIndex)) {
                        this.#state.floorIndex = Number(logicalFloorIndex) || 0;
                    }
                }
                this.#finishLock(generation, lockToken);
            },
            () => this.#finishLock(generation, lockToken)
        );
    }

    /**
     * 기존 층에서 플레이어를 숨긴 뒤 새 층 표시 스냅샷으로 교체합니다.
     * @param {object} options - 목표 좌표·층과 중간 교체 콜백입니다.
     */
    startFloorTransition({ target, floorIndex, onSwap = () => {} } = {}) {
        const tile = cloneTimelineTile(target);
        if (!tile || this.#destroyed) {
            return;
        }
        const generation = this.#generation;
        const lockToken = this.#beginLock();
        void this.#animateFloorSwapTo(tile, floorIndex, generation, onSwap)
            .then(
                () => this.#finishLock(generation, lockToken),
                () => this.#finishLock(generation, lockToken)
            );
    }

    /** 소유 애니메이션과 콜백을 정리합니다. */
    destroy() {
        this.cancel();
        this.#destroyed = true;
        this.#onLockChange = () => {};
    }

    /** @param {string} slot @param {string} field @param {number} endValue @param {number} duration @param {number|string} [startValue='current'] @returns {Promise<void>} @private */
    #animateSlot(slot, field, endValue, duration, startValue = 'current') {
        const previousId = this.#animationSlots.get(slot);
        if (Number.isInteger(previousId) && previousId >= 0) {
            this.#animationPort.remove?.(previousId);
            this.#ownedAnimationIds.delete(previousId);
        }
        const safeDuration = Math.max(0, Number(duration) || 0);
        if (safeDuration <= 0 || Number(this.#state[field]) === Number(endValue)) {
            this.#state[field] = endValue;
            this.#animationSlots.delete(slot);
            return Promise.resolve();
        }
        let animation = null;
        try {
            animation = this.#animationPort.animate?.(this.#state, {
                variable: field,
                startValue,
                endValue,
                duration: safeDuration,
                type: this.#config.EASING
            });
        } catch (error) {
            animation = null;
        }
        if (!animation || !Number.isInteger(animation.id) || animation.id < 0) {
            this.#state[field] = endValue;
            this.#animationSlots.delete(slot);
            return Promise.resolve();
        }
        this.#animationSlots.set(slot, animation.id);
        this.#ownedAnimationIds.add(animation.id);
        return Promise.resolve(animation.promise).then(() => {
            if (this.#animationSlots.get(slot) === animation.id) {
                this.#animationSlots.delete(slot);
            }
            this.#ownedAnimationIds.delete(animation.id);
        });
    }

    /** @param {object[]} route @param {number} generation @param {number} secondsPerTile @param {object[]} teleportSegments @returns {Promise<void>} @private */
    async #animatePlayerRoute(route, generation, secondsPerTile, teleportSegments) {
        for (const tile of route) {
            if (!this.#isCurrent(generation) || !tile) {
                return;
            }
            const dx = tile.x - Number(this.#state.playerX);
            const dy = tile.y - Number(this.#state.playerY);
            if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
                continue;
            }
            const isAdjacent = Math.abs(dx) + Math.abs(dy) <= 1.001;
            if (!isAdjacent || this.#isTeleportTransition(this.#state, tile, teleportSegments)) {
                await this.#animateTeleportTo(tile, generation);
                continue;
            }
            await Promise.all([
                this.#animateSlot('player-x', 'playerX', tile.x, secondsPerTile),
                this.#animateSlot('player-y', 'playerY', tile.y, secondsPerTile)
            ]);
        }
    }

    /** @param {{x:number,y:number}} tile @param {number} generation @returns {Promise<void>} @private */
    async #animateTeleportTo(tile, generation) {
        await Promise.all([
            this.#animateSlot(
                'player-alpha', 'playerAlpha', 0, this.#config.TELEPORT_OUT_SECONDS
            ),
            this.#animateSlot(
                'player-scale', 'playerScale', this.#config.TELEPORT_MIN_SCALE,
                this.#config.TELEPORT_OUT_SECONDS
            )
        ]);
        if (!this.#isCurrent(generation)) {
            return;
        }
        this.#state.playerX = tile.x;
        this.#state.playerY = tile.y;
        await Promise.all([
            this.#animateSlot(
                'player-alpha', 'playerAlpha', 1,
                this.#config.TELEPORT_IN_SECONDS, 0
            ),
            this.#animateSlot(
                'player-scale', 'playerScale', 1,
                this.#config.TELEPORT_IN_SECONDS, this.#config.TELEPORT_MIN_SCALE
            )
        ]);
    }

    /** @param {{x:number,y:number}} tile @param {number} floorIndex @param {number} generation @param {Function} onSwap @returns {Promise<void>} @private */
    async #animateFloorSwapTo(tile, floorIndex, generation, onSwap) {
        await Promise.all([
            this.#animateSlot(
                'player-alpha', 'playerAlpha', 0, this.#config.FLOOR_FADE_SECONDS
            ),
            this.#animateSlot(
                'player-scale', 'playerScale', this.#config.TELEPORT_MIN_SCALE,
                this.#config.FLOOR_FADE_SECONDS
            )
        ]);
        if (!this.#isCurrent(generation)) {
            return;
        }
        onSwap();
        this.#state.floorIndex = Number(floorIndex) || 0;
        this.#state.playerX = tile.x;
        this.#state.playerY = tile.y;
        await Promise.all([
            this.#animateSlot(
                'player-alpha', 'playerAlpha', 1,
                this.#config.TELEPORT_IN_SECONDS, 0
            ),
            this.#animateSlot(
                'player-scale', 'playerScale', 1,
                this.#config.TELEPORT_IN_SECONDS, this.#config.TELEPORT_MIN_SCALE
            )
        ]);
    }

    /** @param {object} from @param {object} to @param {object[]} segments @returns {boolean} @private */
    #isTeleportTransition(from, to, segments) {
        const fromX = Number(from?.playerX ?? from?.x);
        const fromY = Number(from?.playerY ?? from?.y);
        return (Array.isArray(segments) ? segments : []).some((segment) => {
            const start = cloneTimelineTile(segment?.from);
            const end = cloneTimelineTile(segment?.to);
            return Boolean(start && end && (
                (start.x === fromX && start.y === fromY && end.x === to.x && end.y === to.y)
                || (end.x === fromX && end.y === fromY && start.x === to.x && start.y === to.y)
            ));
        });
    }

    /** @param {number} generation @returns {boolean} @private */
    #isCurrent(generation) {
        return !this.#destroyed && generation === this.#generation;
    }

    /** @returns {number} 새 활성 잠금 토큰입니다. @private */
    #beginLock() {
        const token = this.#nextLockToken++;
        this.#activeLockTokens.add(token);
        this.#setLocked(true);
        return token;
    }

    /** @param {number} generation @param {number} token @private */
    #finishLock(generation, token) {
        if (!this.#isCurrent(generation) || !this.#activeLockTokens.delete(token)) {
            return;
        }
        this.#setLocked(this.#activeLockTokens.size > 0);
    }

    /** @param {boolean} locked @private */
    #setLocked(locked) {
        const next = locked === true;
        if (this.#locked === next) {
            return;
        }
        this.#locked = next;
        this.#onLockChange(next);
    }
}
