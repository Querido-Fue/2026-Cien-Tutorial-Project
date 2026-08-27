/**
 * TutorialBattleModel이 외부로 반환하는 모델 이벤트 타입의 단일 문서 계약입니다.
 * @type {readonly string[]}
 */
export const TUTORIAL_MODEL_EVENT_TYPES = Object.freeze([
    'battle-finished',
    'event-tile-cleansed',
    'event-tile-triggered',
    'extra-player-turn',
    'floor-transition',
    'instability-changed',
    'item-dropped',
    'item-picked',
    'item-used',
    'lora-attack',
    'lora-damaged',
    'mob-attack',
    'mob-damaged',
    'mob-defeated',
    'mob-waited',
    'movement-step',
    'mushroom-activated',
    'mushroom-ended',
    'peace',
    'player-damaged',
    'player-healed',
    'player-turn-complete',
    'player-turn-started',
    'player-waited',
    'teleported',
    'wall-destroyed'
]);

/**
 * 프레젠터와 소비자 사이의 직렬화 가능한 cue 타입입니다.
 * @type {Readonly<Record<string,string>>}
 */
export const TUTORIAL_PRESENTATION_CUE_TYPES = Object.freeze({
    EVENT_LOG: 'event-log',
    FLOATING_TEXT: 'floating-text',
    HEALTH_TRANSITION: 'health-transition',
    INSTABILITY_TRANSITION: 'instability-transition',
    ACTOR_ANIMATION: 'actor-animation',
    SCREEN_SHAKE: 'screen-shake',
    FLASH: 'flash',
    STABILIZE: 'stabilize',
    PATH_PARTICLES: 'path-particles',
    AUDIO: 'audio'
});

/**
 * Turn 14의 오디오 소비자가 구독할 수 있는 내부 cue ID입니다.
 * 이 턴에는 실제 음원 재생이나 파일 매핑을 하지 않습니다.
 * @type {Readonly<Record<string,string>>}
 */
export const TUTORIAL_AUDIO_CUE_IDS = Object.freeze({
    FOOTSTEP: 'tutorial.footstep',
    DAMAGE: 'tutorial.damage',
    HEAL: 'tutorial.heal',
    ITEM_PICKUP: 'tutorial.item.pickup',
    ITEM_USE: 'tutorial.item.use',
    TELEPORT: 'tutorial.teleport',
    EVENT_TILE: 'tutorial.event-tile',
    FLOOR_TRANSITION: 'tutorial.floor-transition',
    BATTLE_RESULT: 'tutorial.battle-result'
});
