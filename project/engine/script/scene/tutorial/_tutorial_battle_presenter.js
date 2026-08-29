import {
    TUTORIAL_AUDIO_CUE_IDS as AUDIO_IDS,
    TUTORIAL_PRESENTATION_CUE_TYPES as CUE_TYPES
} from './_tutorial_presentation_contract.js';
import { resolveLoraFrontFacing } from './_tutorial_lora_facing_policy.js';

/** @param {*} value @returns {object[]} 안전한 이벤트 배열입니다. */
function toEventList(value) {
    return Array.isArray(value) ? value : [];
}

/** @param {*} value @param {number} fallback @returns {number} 유한 숫자입니다. */
function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

/** @param {*} value @returns {{x:number,y:number}|null} 유효 타일입니다. */
function cloneCueTile(value) {
    const x = Number(value?.x);
    const y = Number(value?.y);
    return Number.isInteger(x) && Number.isInteger(y)
        ? Object.freeze({ x, y })
        : null;
}

/** @param {object} from @param {object} to @param {string} fallback @returns {string} 목표 방향입니다. */
function getCueFacing(from, to, fallback = 'down') {
    const dx = Number(to?.x) - Number(from?.x);
    const dy = Number(to?.y) - Number(from?.y);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
        return fallback;
    }
    if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) > 0.001) {
        return dx < 0 ? 'left' : 'right';
    }
    if (Math.abs(dy) > 0.001) {
        return dy < 0 ? 'up' : 'down';
    }
    return fallback;
}

/** @param {object} cue @returns {object} 중첩 좌표까지 동결한 cue입니다. */
function freezeCue(cue) {
    const normalized = { ...cue };
    if (cue.tile) {
        normalized.tile = cloneCueTile(cue.tile);
    }
    if (cue.from && typeof cue.from === 'object') {
        normalized.from = cloneCueTile(cue.from);
    }
    if (cue.to && typeof cue.to === 'object') {
        normalized.to = cloneCueTile(cue.to);
    }
    if (Array.isArray(cue.path)) {
        normalized.path = Object.freeze(cue.path.map(cloneCueTile).filter(Boolean));
    }
    return Object.freeze(normalized);
}

/**
 * @class TutorialBattlePresenter
 * @description 모델 이벤트와 전후 스냅샷을 결정론적인 표현 cue로만 변환합니다.
 */
export class TutorialBattlePresenter {
    #itemLabels;
    #animation;

    /**
     * @param {object} config - 아이템 표시명과 기존 애니메이션 시간 설정입니다.
     */
    constructor(config = {}) {
        this.#itemLabels = Object.freeze(Object.fromEntries(
            Object.entries(config.items || {}).map(([itemId, item]) => (
                [itemId, item?.label || itemId]
            ))
        ));
        this.#animation = Object.freeze({ ...(config.animation || {}) });
    }

    /**
     * 같은 입력에 항상 같은 순서와 값을 가진 cue 배열을 만듭니다.
     * @param {object} input - 이벤트, 전후 스냅샷, 선택적 이동 경로와 실패 사유입니다.
     * @returns {readonly object[]} 직렬화 가능한 cue 배열입니다.
     */
    createCues({
        events = [],
        previousSnapshot = null,
        nextSnapshot = null,
        path = [],
        failureReason = ''
    } = {}) {
        const cues = [];
        const previous = previousSnapshot || {};
        const next = nextSnapshot || {};
        const tracker = {
            playerHp: toFiniteNumber(previous.player?.hp, toFiniteNumber(next.player?.hp)),
            loraHp: toFiniteNumber(previous.lora?.hp, toFiniteNumber(next.lora?.hp)),
            instability: toFiniteNumber(
                previous.lora?.instability,
                toFiniteNumber(next.lora?.instability)
            ),
            startedSourceAnimations: new Set()
        };
        const route = toEventList(path).map(cloneCueTile).filter(Boolean);
        if (route.length > 1) {
            cues.push(freezeCue({
                type: CUE_TYPES.PATH_PARTICLES,
                path: route,
                count: Math.max(1, toFiniteNumber(this.#animation.PARTICLE_COUNT, 12)),
                duration: Math.max(
                    0.01,
                    toFiniteNumber(this.#animation.PARTICLE_SECONDS, 0.48)
                )
            }));
        }
        if (failureReason) {
            cues.push(freezeCue({
                type: CUE_TYPES.EVENT_LOG,
                message: this.formatFailureReason(failureReason),
                sourceEventType: 'action-failed'
            }));
            cues.push(freezeCue({
                type: CUE_TYPES.FLOATING_TEXT,
                actorId: 'player',
                text: '무효',
                tone: 'danger',
                duration: toFiniteNumber(this.#animation.HEAL_TEXT_SECONDS, 0.62),
                sourceEventType: 'action-failed'
            }));
        }
        const eventList = toEventList(events);
        for (let index = 0; index < eventList.length; index++) {
            this.#appendEventCues(
                cues,
                eventList[index],
                tracker,
                previous,
                next,
                eventList,
                index
            );
        }
        this.#appendSnapshotFallbackCues(cues, tracker, next);
        return Object.freeze(cues);
    }

    /**
     * 모델 거절 사유를 기존 사용자 안내 문구로 변환합니다.
     * @param {*} reason - 모델 사유입니다.
     * @returns {string} 안내 문구입니다.
     */
    formatFailureReason(reason) {
        const values = {
            'movement-used': '이번 턴 이동을 이미 사용했습니다.',
            'action-used': '이번 턴 행동을 이미 사용했습니다.',
            'movement-unavailable': '이번 턴 이동을 사용할 수 없습니다.',
            'action-unavailable': '이번 턴 행동을 사용할 수 없습니다.',
            'unreachable-destination': '그 타일까지 도달할 수 없습니다.',
            'invalid-path': '그 경로로 이동할 수 없습니다.',
            'path-cost-exceeded': '남은 이동력이 부족합니다.',
            'blocked-by-wall': '벽이 경로를 막고 있습니다.',
            'blocked-by-lora': '로라가 그 타일을 점유하고 있습니다.',
            'blocked-by-mob': '몹이 그 타일을 점유하고 있습니다.',
            'out-of-range': '대상이 범위 밖에 있습니다.',
            'invalid-target': '선택할 수 없는 대상입니다.',
            'item-missing': '해당 아이템이 없습니다.',
            'item-not-owned': '해당 아이템을 보유하지 않았습니다.',
            'passive-item': '자동 적용 아이템은 직접 사용할 수 없습니다.',
            'item-already-used': '이번 플레이에서 이미 사용한 아이템입니다.',
            'peace-active': '평화 효과 중에는 공격할 수 없습니다.',
            'invalid-event-tile': '정화 가능한 negative 이벤트 타일을 선택하세요.'
        };
        return values[reason] || '지금은 그 선택을 적용할 수 없습니다.';
    }

    /** @param {object[]} cues @param {object} event @param {object} tracker @param {object} previous @param {object} next @param {object[]} events @param {number} eventIndex @private */
    #appendEventCues(cues, event, tracker, previous, next, events, eventIndex) {
        if (!event || typeof event.type !== 'string') {
            return;
        }
        const message = this.#formatEvent(event);
        if (message) {
            cues.push(freezeCue({
                type: CUE_TYPES.EVENT_LOG,
                message,
                sourceEventType: event.type
            }));
        }
        switch (event.type) {
        case 'player-damaged':
            this.#appendDamageCues(
                cues, event, 'player', tracker, previous, next, events, eventIndex
            );
            break;
        case 'lora-damaged':
            this.#appendDamageCues(
                cues, event, 'lora', tracker, previous, next, events, eventIndex
            );
            break;
        case 'mob-damaged':
            this.#appendDamageCues(
                cues,
                event,
                event.mobId || 'mob',
                tracker,
                previous,
                next,
                events,
                eventIndex
            );
            break;
        case 'player-healed':
            this.#appendHealCues(cues, event, tracker, next);
            break;
        case 'instability-changed':
            this.#appendInstabilityCues(cues, event, tracker, next);
            break;
        case 'peace':
            cues.push(freezeCue({
                type: CUE_TYPES.FLOATING_TEXT,
                actorId: 'lora',
                text: '무공격',
                tone: 'success',
                duration: toFiniteNumber(this.#animation.HEAL_TEXT_SECONDS, 0.62),
                sourceEventType: event.type
            }));
            break;
        case 'item-picked':
        case 'record-picked':
            cues.push(freezeCue({
                type: CUE_TYPES.AUDIO,
                id: AUDIO_IDS.ITEM_EQUIP,
                sourceEventType: event.type
            }));
            break;
        case 'item-used':
            cues.push(freezeCue({
                type: CUE_TYPES.ACTOR_ANIMATION,
                animationId: 'item',
                actorId: 'player',
                sourceEventType: event.type
            }));
            cues.push(freezeCue({
                type: CUE_TYPES.AUDIO,
                id: AUDIO_IDS.ITEM_APPLY,
                sourceEventType: event.type
            }));
            break;
        case 'teleported':
            cues.push(freezeCue({
                type: CUE_TYPES.ACTOR_ANIMATION,
                animationId: 'teleport',
                actorId: 'player',
                from: event.from,
                to: event.to,
                sourceEventType: event.type
            }));
            cues.push(freezeCue({
                type: CUE_TYPES.AUDIO,
                id: AUDIO_IDS.TELEPORT,
                sourceEventType: event.type
            }));
            break;
        case 'event-tile-triggered':
            break;
        case 'floor-transition':
            cues.push(freezeCue({
                type: CUE_TYPES.ACTOR_ANIMATION,
                animationId: 'floor-transition',
                actorId: 'player',
                to: event.player,
                sourceEventType: event.type
            }));
            cues.push(freezeCue({
                type: CUE_TYPES.AUDIO,
                id: AUDIO_IDS.FLOOR_BREAK,
                sourceEventType: event.type
            }));
            break;
        case 'battle-finished':
            cues.push(freezeCue({
                type: CUE_TYPES.ACTOR_ANIMATION,
                animationId: 'battle-result',
                outcome: event.outcome,
                sourceEventType: event.type
            }));
            break;
        case 'lora-attack':
            cues.push(freezeCue({
                type: CUE_TYPES.ACTOR_ANIMATION,
                animationId: event.action === 'area'
                    ? 'area'
                    : event.action === 'idle' ? 'idle' : 'melee',
                actorId: 'lora',
                facing: resolveLoraFrontFacing(previous.lora, previous.player),
                sourceEventType: event.type
            }));
            if (event.action !== 'idle') {
                cues.push(freezeCue({
                    type: CUE_TYPES.AUDIO,
                    id: event.action === 'area'
                        ? AUDIO_IDS.LORA_AREA
                        : AUDIO_IDS.LORA_MELEE,
                    sourceEventType: event.type
                }));
            }
            break;
        case 'mob-attack':
            break;
        default:
            break;
        }
    }

    /** @param {object[]} cues @param {object} event @param {string} actorId @param {object} tracker @param {object} previous @param {object} next @param {object[]} events @param {number} eventIndex @private */
    #appendDamageCues(cues, event, actorId, tracker, previous, next, events, eventIndex) {
        const amount = Math.max(0, Math.round(toFiniteNumber(event.damage ?? event.amount)));
        const trackerKey = actorId === 'player'
            ? 'playerHp'
            : actorId === 'lora' ? 'loraHp' : null;
        const fallbackHp = actorId === 'player'
            ? next.player?.hp
            : actorId === 'lora' ? next.lora?.hp : toFiniteNumber(event.hp);
        const to = toFiniteNumber(event.hp, toFiniteNumber(fallbackHp));
        const from = trackerKey ? tracker[trackerKey] : to + amount;
        if (trackerKey) {
            tracker[trackerKey] = to;
        }
        const impact = this.#resolveDamageImpact(
            event,
            actorId,
            previous,
            next,
            events,
            eventIndex
        );
        if (impact?.startSource) {
            const sourceKey = impact.actorId + ':' + impact.animationId;
            if (!tracker.startedSourceAnimations.has(sourceKey)) {
                tracker.startedSourceAnimations.add(sourceKey);
                cues.push(freezeCue({
                    type: CUE_TYPES.ACTOR_ANIMATION,
                    actorId: impact.actorId,
                    animationId: impact.animationId,
                    facing: impact.facing,
                    sourceEventType: event.type
                }));
                const attackAudioId = impact.actorId === 'player'
                    ? impact.animationId === 'ranged'
                        ? AUDIO_IDS.PLAYER_RANGED
                        : AUDIO_IDS.PLAYER_MELEE
                    : null;
                if (attackAudioId) {
                    cues.push(freezeCue({
                        type: CUE_TYPES.AUDIO,
                        id: attackAudioId,
                        sourceEventType: event.type
                    }));
                }
            }
        }
        cues.push(freezeCue({
            type: CUE_TYPES.HEALTH_TRANSITION,
            actorId,
            from,
            to,
            duration: toFiniteNumber(this.#animation.GAUGE_SECONDS, 0.26),
            sourceEventType: event.type
        }));
        if (amount <= 0) {
            return;
        }
        const impactFields = impact ? {
            impactActorId: impact.actorId,
            impactAnimationId: impact.animationId,
            impactFacing: impact.facing
        } : {};
        cues.push(freezeCue({
            type: CUE_TYPES.FLOATING_TEXT,
            actorId,
            tile: cloneCueTile(event),
            text: '-' + String(amount),
            tone: 'danger',
            duration: toFiniteNumber(this.#animation.DAMAGE_TEXT_SECONDS, 0.62),
            ...impactFields,
            sourceEventType: event.type
        }));
        cues.push(freezeCue({
            type: CUE_TYPES.ACTOR_ANIMATION,
            animationId: to <= 0 ? 'death' : 'hit',
            actorId,
            facing: impact?.targetFacing,
            tile: cloneCueTile(event),
            waitForImpact: Boolean(impact),
            ...impactFields,
            sourceEventType: event.type
        }));
        cues.push(freezeCue({
            type: CUE_TYPES.SCREEN_SHAKE,
            duration: toFiniteNumber(this.#animation.SHAKE_SECONDS, 0.18),
            ...impactFields,
            sourceEventType: event.type
        }));
        cues.push(freezeCue({
            type: CUE_TYPES.FLASH,
            duration: toFiniteNumber(this.#animation.HIT_FLASH_SECONDS, 0.18),
            ...impactFields,
            sourceEventType: event.type
        }));
        cues.push(freezeCue({
            type: CUE_TYPES.AUDIO,
            id: actorId === 'player'
                ? to <= 0 ? AUDIO_IDS.PLAYER_DEATH : AUDIO_IDS.PLAYER_HURT
                : actorId === 'lora'
                    ? to <= 0 ? AUDIO_IDS.LORA_DEATH : AUDIO_IDS.LORA_HURT
                    : AUDIO_IDS.SLIME_HURT,
            ...impactFields,
            sourceEventType: event.type
        }));
    }

    /** @param {object} event @param {string} targetActorId @param {object} previous @param {object} next @param {object[]} events @param {number} eventIndex @returns {object|null} @private */
    #resolveDamageImpact(event, targetActorId, previous, next, events, eventIndex) {
        const weapon = event.weapon || next.lastPlayerAction?.weapon;
        const isPlayerAttack = event.source === 'player-attack'
            || (targetActorId === 'lora' && ['melee', 'bow'].includes(weapon));
        if (isPlayerAttack) {
            const target = targetActorId === 'lora' ? next.lora : event;
            return {
                actorId: 'player',
                animationId: weapon === 'bow' ? 'ranged' : 'melee',
                facing: getCueFacing(previous.player, target, 'right'),
                targetFacing: targetActorId === 'lora'
                    ? resolveLoraFrontFacing(target, previous.player)
                    : getCueFacing(target, previous.player, 'left'),
                startSource: true
            };
        }
        if (targetActorId !== 'player') {
            return null;
        }
        if (typeof event.source === 'string' && event.source.startsWith('lora-')) {
            const animationId = event.source === 'lora-area' ? 'area' : 'melee';
            return {
                actorId: 'lora',
                animationId,
                facing: resolveLoraFrontFacing(previous.lora, previous.player),
                targetFacing: getCueFacing(previous.player, previous.lora),
                startSource: false
            };
        }
        if (event.source === 'mob-attack') {
            const attackEvent = events.slice(eventIndex + 1).find(
                (candidate) => candidate?.type === 'mob-attack'
            );
            if (!attackEvent?.mobId) {
                return null;
            }
            return {
                actorId: attackEvent.mobId,
                animationId: 'attack',
                facing: getCueFacing(attackEvent, previous.player),
                targetFacing: getCueFacing(previous.player, attackEvent),
                startSource: true
            };
        }
        return null;
    }

    /** @param {object[]} cues @param {object} event @param {object} tracker @param {object} next @private */
    #appendHealCues(cues, event, tracker, next) {
        const amount = Math.max(0, Math.round(toFiniteNumber(event.amount ?? event.heal)));
        const to = toFiniteNumber(event.hp, toFiniteNumber(next.player?.hp));
        const from = tracker.playerHp;
        tracker.playerHp = to;
        cues.push(freezeCue({
            type: CUE_TYPES.HEALTH_TRANSITION,
            actorId: 'player',
            from,
            to,
            duration: toFiniteNumber(this.#animation.GAUGE_SECONDS, 0.26),
            sourceEventType: event.type
        }));
        if (amount <= 0) {
            return;
        }
        cues.push(freezeCue({
            type: CUE_TYPES.FLOATING_TEXT,
            actorId: 'player',
            text: '+' + String(amount),
            tone: 'success',
            duration: toFiniteNumber(this.#animation.HEAL_TEXT_SECONDS, 0.62),
            sourceEventType: event.type
        }));
        cues.push(freezeCue({
            type: CUE_TYPES.ACTOR_ANIMATION,
            animationId: 'heal',
            actorId: 'player',
            sourceEventType: event.type
        }));
        cues.push(freezeCue({
            type: CUE_TYPES.AUDIO,
            id: AUDIO_IDS.PLAYER_HEAL,
            sourceEventType: event.type
        }));
    }

    /** @param {object[]} cues @param {object} event @param {object} tracker @param {object} next @private */
    #appendInstabilityCues(cues, event, tracker, next) {
        const from = toFiniteNumber(event.before, tracker.instability);
        const to = toFiniteNumber(event.after, toFiniteNumber(next.lora?.instability));
        const change = toFiniteNumber(event.change, to - from);
        tracker.instability = to;
        cues.push(freezeCue({
            type: CUE_TYPES.INSTABILITY_TRANSITION,
            from,
            to,
            change,
            suppressed: event.suppressed === true,
            duration: toFiniteNumber(this.#animation.GAUGE_SECONDS, 0.26),
            sourceEventType: event.type
        }));
        if (change !== 0) {
            cues.push(freezeCue({
                type: CUE_TYPES.FLOATING_TEXT,
                actorId: 'lora',
                text: (change > 0 ? '+' : '') + String(Math.round(change)),
                tone: change < 0 ? 'success' : 'danger',
                duration: toFiniteNumber(this.#animation.HEAL_TEXT_SECONDS, 0.62),
                sourceEventType: event.type
            }));
        }
        if (change < 0) {
            cues.push(freezeCue({
                type: CUE_TYPES.STABILIZE,
                duration: toFiniteNumber(this.#animation.STABILIZE_SECONDS, 0.55),
                actorId: 'lora',
                sourceEventType: event.type
            }));
        }
    }

    /** @param {object[]} cues @param {object} tracker @param {object} next @private */
    #appendSnapshotFallbackCues(cues, tracker, next) {
        const transitions = [
            ['playerHp', 'player', next.player?.hp, CUE_TYPES.HEALTH_TRANSITION],
            ['loraHp', 'lora', next.lora?.hp, CUE_TYPES.HEALTH_TRANSITION],
            ['instability', 'lora', next.lora?.instability, CUE_TYPES.INSTABILITY_TRANSITION]
        ];
        for (const [trackerKey, actorId, rawTarget, type] of transitions) {
            const target = Number(rawTarget);
            if (!Number.isFinite(target) || target === tracker[trackerKey]) {
                continue;
            }
            const cue = {
                type,
                actorId,
                from: tracker[trackerKey],
                to: target,
                duration: toFiniteNumber(this.#animation.GAUGE_SECONDS, 0.26),
                sourceEventType: 'snapshot-sync'
            };
            if (type === CUE_TYPES.INSTABILITY_TRANSITION) {
                cue.change = target - tracker[trackerKey];
            }
            cues.push(freezeCue(cue));
            tracker[trackerKey] = target;
        }
    }

    /** @param {object} event @returns {string} 기존 전투 로그 문구입니다. @private */
    #formatEvent(event) {
        const itemLabel = this.#itemLabels[event.itemId] || event.itemId || '아이템';
        const damage = Math.max(
            0,
            Math.round(toFiniteNumber(event.damage ?? event.amount))
        );
        if (event.type === 'event-tile-triggered') {
            const labels = {
                damage: '피해 -20 이벤트 타일 발동',
                'move-penalty': '이동력 -2 이벤트 타일 발동',
                'instability-up': '불안정도 +10 이벤트 타일 발동',
                'instability-down': '불안정도 -10 이벤트 타일 발동'
            };
            return labels[event.eventType] || '이벤트 타일 발동';
        }
        if (event.type === 'instability-changed') {
            const change = Math.round(toFiniteNumber(event.change));
            return '로라 불안정도 ' + (change >= 0 ? '+' : '') + String(change);
        }
        const values = {
            'item-picked': itemLabel + ' 획득',
            'item-dropped': itemLabel + ' 드롭',
            'wall-destroyed': '벽 파괴',
            teleported: '텔레포트 작동',
            'mob-damaged': '몹에게 ' + String(damage) + ' 피해',
            'mob-defeated': '몹 격파',
            'lora-damaged': '로라에게 ' + String(damage) + ' 피해',
            'player-healed': '플레이어 HP 회복',
            'player-damaged': '플레이어가 ' + String(damage) + ' 피해',
            'item-used': itemLabel + ' 사용',
            'player-waited': '플레이어 대기',
            'record-picked': '기록 획득',
            'event-tile-cleansed': '이벤트 타일을 positive로 정화',
            'extra-player-turn': '거울 효과 · 플레이어 추가 턴 예약',
            'mob-attack': '몹 공격 ' + String(damage) + ' 피해',
            'mob-waited': '몹 대기',
            'mushroom-activated': '버섯 효과 · 이동과 공격 2배',
            'mushroom-ended': '피해를 받아 버섯 효과 종료',
            peace: '로라가 공격하지 않았습니다.',
            'lora-attack': '로라 공격',
            'floor-transition': '6번째 로라 행동 종료 · 지하층 붕괴',
            'battle-finished': '작전 판정 완료'
        };
        return values[event.type] || '';
    }
}
