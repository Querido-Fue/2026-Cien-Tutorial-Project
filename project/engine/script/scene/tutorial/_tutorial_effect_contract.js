/** 튜토리얼 콘텐츠가 사용할 수 있는 안정된 효과 트리거 ID입니다. */
export const TUTORIAL_EFFECT_TRIGGERS = Object.freeze({
    ACQUIRE: 'onAcquire',
    USE: 'onUse',
    TURN_START: 'onTurnStart',
    TURN_END: 'onTurnEnd',
    MOVE_ENTER: 'onMoveEnter',
    BEFORE_DAMAGE: 'onBeforeDamage',
    BEFORE_INSTABILITY_CHANGE: 'onBeforeInstabilityChange',
    ATTACK: 'onAttack'
});

/** 튜토리얼 콘텐츠가 공유하는 안정된 operation ID입니다. */
export const TUTORIAL_EFFECT_OPERATIONS = Object.freeze({
    SET_RANGED_DAMAGE: 'set-ranged-damage',
    CHANGE_DAMAGE_FLAT: 'change-damage-flat',
    MULTIPLY_DAMAGE: 'multiply-damage',
    REDUCE_DAMAGE_FLAT: 'reduce-damage-flat',
    CHANGE_INSTABILITY_FLAT: 'change-instability-flat',
    SCALE_INSTABILITY_CURRENT: 'scale-instability-current',
    SUPPRESS_POSITIVE_INSTABILITY: 'suppress-positive-instability',
    SET_PEACE_TURNS_MIN: 'set-peace-turns-min',
    ADD_EXTRA_PLAYER_TURNS: 'add-extra-player-turns',
    SET_MUSHROOM_ACTIVE: 'set-mushroom-active',
    MULTIPLY_MOVE_RANGE: 'multiply-move-range',
    GRANT_WALL_TRAVERSAL: 'grant-wall-traversal',
    ADD_ACTIONS_PER_TURN: 'add-actions-per-turn',
    END_MUSHROOM_ON_DAMAGE: 'end-mushroom-on-damage',
    REPLACE_EVENT_TILE_TYPE: 'replace-event-tile-type',
    REDUCE_REMAINING_MOVES: 'reduce-remaining-moves',
    DEAL_PLAYER_DAMAGE: 'deal-player-damage'
});

/** 데이터에서 사용할 수 있는 명시적 조건 ID입니다. */
export const TUTORIAL_EFFECT_CONDITIONS = Object.freeze({
    ACTOR_PLAYER: 'actor-player',
    ACTOR_LORA: 'actor-lora',
    TARGET_PLAYER: 'target-player',
    WEAPON_BOW: 'weapon-bow',
    PEACE_ACTIVE: 'peace-active',
    POSITIVE_BASE_DAMAGE: 'positive-base-damage',
    POSITIVE_FINAL_DAMAGE: 'positive-final-damage',
    POSITIVE_INSTABILITY_CHANGE: 'positive-instability-change',
    NEGATIVE_EVENT_TILE: 'negative-event-tile'
});

/** preview와 apply가 공유하는 실행 목적 ID입니다. */
export const TUTORIAL_EFFECT_EXECUTION_MODES = Object.freeze([
    'preview',
    'apply'
]);
