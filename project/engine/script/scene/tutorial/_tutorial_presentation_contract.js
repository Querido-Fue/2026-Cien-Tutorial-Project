import { TUTORIAL_SFX_IDS } from '../../data/sound/tutorial_audio_manifest.js';

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
    'record-picked',
    'teleported',
    'wall-destroyed',
    'wall-traversed'
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

/** presenter와 sprite router가 내보내는 실제 오디오 매니페스트 ID입니다. */
export const TUTORIAL_AUDIO_CUE_IDS = Object.freeze({
    PLAYER_FOOTSTEP: TUTORIAL_SFX_IDS.PLAYER_FOOTSTEP,
    PLAYER_MELEE: TUTORIAL_SFX_IDS.PLAYER_MELEE,
    PLAYER_RANGED: TUTORIAL_SFX_IDS.PLAYER_RANGED,
    PLAYER_HEAL: TUTORIAL_SFX_IDS.PLAYER_HEAL,
    PLAYER_HURT: TUTORIAL_SFX_IDS.PLAYER_HURT,
    PLAYER_DEATH: TUTORIAL_SFX_IDS.PLAYER_DEATH,
    LORA_MELEE: TUTORIAL_SFX_IDS.LORA_MELEE,
    LORA_AREA: TUTORIAL_SFX_IDS.LORA_AREA,
    LORA_HURT: TUTORIAL_SFX_IDS.LORA_HURT,
    LORA_DEATH: TUTORIAL_SFX_IDS.LORA_DEATH,
    SLIME_HURT: TUTORIAL_SFX_IDS.SLIME_HURT,
    ITEM_EQUIP: TUTORIAL_SFX_IDS.ITEM_EQUIP,
    ITEM_APPLY: TUTORIAL_SFX_IDS.ITEM_APPLY,
    TELEPORT: TUTORIAL_SFX_IDS.TELEPORT,
    FLOOR_BREAK: TUTORIAL_SFX_IDS.FLOOR_BREAK
});
