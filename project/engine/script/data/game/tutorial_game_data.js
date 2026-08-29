const DEFAULT_FONT_FAMILY = 'LanaPixel, monospace';
const MONO_FONT_FAMILY = 'Consolas, monospace';
const TYPOGRAPHY_SCALE = 1.2;

/**
 * 타이포그래피 값을 공통 배율로 확대하고 부동소수점 노이즈를 제거합니다.
 * @param {number} value - 원본 타이포그래피 값입니다.
 * @returns {number} 확대된 값입니다.
 */
function scaleTypographyValue(value) {
    return Number((value * TYPOGRAPHY_SCALE).toFixed(2));
}

/**
 * 객체와 하위 값을 재귀적으로 동결합니다.
 * @param {*} value - 동결할 값입니다.
 * @returns {*} 전달받은 값입니다.
 */
function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
        return value;
    }
    for (const child of Object.values(value)) {
        deepFreeze(child);
    }
    return Object.freeze(value);
}

/**
 * 반응형 게임 폰트 규격을 생성합니다.
 * @param {number} sizeUIWW - UI 기준 너비 대비 폰트 크기 비율입니다.
 * @param {number} min - 최소 폰트 크기(px)입니다.
 * @param {number} max - 최대 폰트 크기(px)입니다.
 * @param {number} weight - 폰트 굵기입니다.
 * @param {string} [family=DEFAULT_FONT_FAMILY] - 폰트 패밀리입니다.
 * @returns {{SIZE_UIWW:number,MIN:number,MAX:number,WEIGHT:number,FAMILY:string}} 폰트 규격입니다.
 */
function createTypographySpec(sizeUIWW, min, max, weight, family = DEFAULT_FONT_FAMILY) {
    return {
        SIZE_UIWW: scaleTypographyValue(sizeUIWW),
        MIN: scaleTypographyValue(min),
        MAX: scaleTypographyValue(max),
        WEIGHT: weight,
        FAMILY: family
    };
}

/** 9×8 타일의 기본 높이 데이터입니다. */
const FLAT_HEIGHTS = Array.from({ length: 8 }, () => Array(9).fill(0));

/** 로라의 불안정 상태별 행동 수치입니다. */
const LORA_INSTABILITY_STATES = [
    { id: 'stable', label: '안정', min: 0, max: 10, meleeDamage: 0, areaDamage: 0 },
    { id: 'anxious', label: '불안', min: 11, max: 40, meleeDamage: 15, areaDamage: 10 },
    { id: 'shaken', label: '동요', min: 41, max: 60, meleeDamage: 25, areaDamage: 15 },
    { id: 'unstable', label: '불안정', min: 61, max: 80, meleeDamage: 40, areaDamage: 20 },
    { id: 'collapse', label: '붕괴', min: 81, max: 100, meleeDamage: 60, areaDamage: 35 }
];

/**
 * 9×8 두 층으로 구성된 턴제 전투 프로토타입의 정적 데이터를 제공합니다.
 */
export const TUTORIAL_GAME_DATA = deepFreeze({
    FEATURES: { CUTSCENES: true },
    SPRITES: {
        ITEM: {
            WORLD_HALO_SIZE_TILE_RATIO: 0.36,
            WORLD_HALO_ALPHA: 0.24,
            WORLD_ICON_SIZE_TILE_RATIO: 0.32,
            VISUAL_CENTERS: {
                bow: { x: 0.4844, y: 0.5312 },
                'mascot-costume': { x: 0.5, y: 0.4688 },
                'old-teddy': { x: 0.4375, y: 0.5 },
                'music-box': { x: 0.5469, y: 0.5312 },
                eyeliner: { x: 0.5469, y: 0.5469 },
                'diamond-pickaxe': { x: 0.5, y: 0.5 },
                mirror: { x: 0.5469, y: 0.4688 },
                mushroom: { x: 0.5, y: 0.5 },
                ocarina: { x: 0.5, y: 0.5 },
                haste: { x: 0.5156, y: 0.5 },
                'memory-photo': { x: 0.5, y: 0.5625 }
            },
            BUTTON_ICON_SIZE_RATIO: 0.66,
            BUTTON_ICON_GAP_UIWW: 0.25
        },
        RECORD: {
            WORLD_HALO_SIZE_TILE_RATIO: 0.34,
            WORLD_HALO_ALPHA: 0.18,
            WORLD_COVER_WIDTH_TILE_RATIO: 0.24,
            WORLD_COVER_HEIGHT_TILE_RATIO: 0.3,
            WORLD_PAGE_INSET_RATIO: 0.16
        },
        LORA: {
            BASE_SIZE_TILE_RATIO: 0.64,
            SPRITE_SIZE_TILE_RATIO: 0.84,
            OFFSET_Y_TILE_RATIO: 0,
            FLOAT_AMPLITUDE_TILE_RATIO: 0.08,
            FLASH_GLOW_SIZE_RATIO: 1.08,
            FLASH_GLOW_ALPHA: 0.34
        }
    },
    MAP: {
        WIDTH: 9,
        HEIGHT: 8
    },
    EVENT_TILE_EFFECTS: {
        damage: {
            id: 'damage',
            polarity: 'negative',
            effects: [
                {
                    id: 'event-damage-player',
                    trigger: 'onMoveEnter',
                    operation: 'deal-player-damage',
                    order: 100,
                    value: 20,
                    source: 'event-tile'
                }
            ]
        },
        'move-penalty': {
            id: 'move-penalty',
            polarity: 'negative',
            effects: [
                {
                    id: 'event-reduce-remaining-moves',
                    trigger: 'onMoveEnter',
                    operation: 'reduce-remaining-moves',
                    order: 100,
                    value: 2,
                    source: 'event-tile'
                }
            ]
        },
        'instability-up': {
            id: 'instability-up',
            polarity: 'negative',
            effects: [
                {
                    id: 'event-increase-instability',
                    trigger: 'onMoveEnter',
                    operation: 'change-instability-flat',
                    order: 100,
                    value: 10,
                    source: 'event-tile'
                }
            ]
        },
        'instability-down': {
            id: 'instability-down',
            polarity: 'positive',
            effects: [
                {
                    id: 'event-reduce-instability',
                    trigger: 'onMoveEnter',
                    operation: 'change-instability-flat',
                    order: 100,
                    value: -10,
                    source: 'event-tile'
                }
            ]
        }
    },
    FLOORS: [
        {
            id: 'first-floor',
            label: '1층',
            playerStart: { x: 4, y: 4 },
            loraStart: { x: 4, y: 0 },
            heights: FLAT_HEIGHTS,
            walls: [
                { id: 'f1-wall-1', x: 7, y: 1 },
                { id: 'f1-wall-2', x: 8, y: 1 },
                { id: 'f1-wall-3', x: 6, y: 4 },
                { id: 'f1-wall-4', x: 6, y: 5 },
                { id: 'f1-wall-5', x: 6, y: 6 },
                { id: 'f1-wall-6', x: 6, y: 7 }
            ],
            items: [
                { id: 'f1-ocarina', itemId: 'ocarina', x: 8, y: 0 },
                { id: 'f1-music-box', itemId: 'music-box', x: 8, y: 2 },
                { id: 'f1-teddy', itemId: 'old-teddy', x: 0, y: 3 },
                { id: 'f1-eyeliner', itemId: 'eyeliner', x: 4, y: 6 },
                { id: 'f1-pickaxe', itemId: 'diamond-pickaxe', x: 7, y: 6 }
            ],
            records: [
                { id: 'f1-lora-diary-1', recordId: 'lora-diary:1', x: 3, y: 4 },
                { id: 'f1-lora-diary-2', recordId: 'lora-diary:2', x: 1, y: 4 },
                { id: 'f1-lora-diary-3', recordId: 'lora-diary:3', x: 3, y: 1 },
                { id: 'f1-lora-diary-4', recordId: 'lora-diary:4', x: 7, y: 3 },
                { id: 'f1-developer-diary-1', recordId: 'developer-diary:1', x: 1, y: 6 }
            ],
            eventTiles: [
                { id: 'f1-event-1', type: 'damage', x: 0, y: 2 },
                { id: 'f1-event-3-a', type: 'instability-up', x: 6, y: 2 },
                { id: 'f1-event-3-b', type: 'instability-up', x: 6, y: 3 },
                { id: 'f1-event-2', type: 'move-penalty', x: 2, y: 5 },
                { id: 'f1-event-3-c', type: 'instability-up', x: 1, y: 7 }
            ],
            teleports: [
                { id: 'f1-teleport-a', pairId: 'f1-teleport', x: 0, y: 0 },
                { id: 'f1-teleport-b', pairId: 'f1-teleport', x: 8, y: 7 }
            ],
            mobs: [
                { id: 'f1-mob', x: 0, y: 7, hp: 100, dropItemId: 'tile-cleanser' }
            ]
        },
        {
            id: 'basement',
            label: '지하층',
            playerStart: { x: 4, y: 4 },
            loraStart: { x: 4, y: 0 },
            heights: FLAT_HEIGHTS,
            walls: [
                { id: 'b1-wall-1', x: 2, y: 2 },
                { id: 'b1-wall-2', x: 3, y: 2 },
                { id: 'b1-wall-3', x: 4, y: 2 },
                { id: 'b1-wall-4', x: 5, y: 2 },
                { id: 'b1-wall-5', x: 6, y: 2 },
                { id: 'b1-wall-6', x: 0, y: 5 },
                { id: 'b1-wall-7', x: 1, y: 5 },
                { id: 'b1-wall-8', x: 6, y: 5 },
                { id: 'b1-wall-9', x: 7, y: 5 },
                { id: 'b1-wall-10', x: 6, y: 6 },
                { id: 'b1-wall-11', x: 6, y: 7 }
            ],
            items: [
                { id: 'b1-mushroom', itemId: 'mushroom', x: 0, y: 2 },
                { id: 'b1-memory-photo', itemId: 'memory-photo', x: 8, y: 3 },
                { id: 'b1-mirror', itemId: 'mirror', x: 4, y: 5 },
                { id: 'b1-haste', itemId: 'haste', x: 7, y: 7 }
            ],
            records: [
                { id: 'b1-lora-diary-5', recordId: 'lora-diary:5', x: 4, y: 3 },
                { id: 'b1-lora-diary-6', recordId: 'lora-diary:6', x: 1, y: 3 },
                { id: 'b1-lora-diary-7', recordId: 'lora-diary:7', x: 8, y: 1 },
                { id: 'b1-developer-diary-2', recordId: 'developer-diary:2', x: 3, y: 6 },
                { id: 'b1-developer-diary-3', recordId: 'developer-diary:3', x: 5, y: 7 }
            ],
            eventTiles: [
                { id: 'b1-event-4-a', type: 'instability-down', x: 2, y: 0 },
                { id: 'b1-event-4-b', type: 'instability-down', x: 6, y: 0 },
                { id: 'b1-event-4-c', type: 'damage', x: 2, y: 1 },
                { id: 'b1-event-4-d', type: 'instability-up', x: 6, y: 1 }
            ],
            teleports: [
                { id: 'b1-teleport-a', pairId: 'b1-teleport', x: 7, y: 3 },
                { id: 'b1-teleport-b', pairId: 'b1-teleport', x: 0, y: 7 }
            ],
            mobs: [
                { id: 'b1-mob-top', x: 0, y: 0, hp: 100, dropItemId: 'tile-cleanser' },
                { id: 'b1-mob-left', x: 2, y: 6, hp: 100, dropItemId: 'tile-cleanser' },
                { id: 'b1-mob-right', x: 7, y: 6, hp: 100, dropItemId: 'tile-cleanser' }
            ]
        }
    ],
    ACTORS: {
        PLAYER: {
            MAX_HP: 100,
            MOVE_RANGE: 4,
            ATTACK_DAMAGE: 50,
            ATTACK_RANGE: 2,
            ATTACK_INSTABILITY: 10,
            CONSECUTIVE_ATTACK_INSTABILITY: 4,
            HEAL_AMOUNT: 15
        },
        LORA: {
            MAX_HP: 100,
            START_INSTABILITY: 70,
            MAX_INSTABILITY: 100,
            MELEE_RANGE: 2,
            INSTABILITY_STATES: LORA_INSTABILITY_STATES
        },
        MOB: {
            DEFAULT_HP: 100,
            ATTACK_DAMAGE: 20,
            ATTACK_RANGE: 2
        }
    },
    RULES: {
        MAX_TURNS: 12,
        FLOOR_TRANSITION_AFTER_TURN: 6,
        EVENT_LOG_LIMIT: 80,
        TRUE_ENDING_MAX_INSTABILITY: 10,
        SPECIAL_ENDING_MAX_INSTABILITY: 40
    },
    STARTER_CHOICES: [
        { id: 'bow', label: '활과 화살', description: '전장 어디서든 원거리 공격이 가능하지만 로라가 더 위험해집니다.' },
        { id: 'mascot-costume', label: '인형탈', description: '받는 피해를 조금 줄이고 매 플레이어 턴 종료 시 로라를 안정시킵니다.' }
    ],
    ITEMS: {
        bow: {
            id: 'bow',
            label: '활과 화살',
            description: '로라가 더 불안정해지고 공격이 강해지지만, 거리 제약 없이 공격할 수 있습니다.',
            category: 'starter',
            passive: true,
            effects: [
                {
                    id: 'bow-player-ranged-damage',
                    trigger: 'onAttack',
                    operation: 'set-ranged-damage',
                    order: 100,
                    conditions: ['actor-player', 'weapon-bow'],
                    value: 30
                },
                {
                    id: 'bow-lora-turn-instability',
                    trigger: 'onTurnStart',
                    operation: 'change-instability-flat',
                    order: 100,
                    conditions: ['actor-lora'],
                    value: 3,
                    source: 'bow-passive'
                },
                {
                    id: 'bow-lora-attack-damage',
                    trigger: 'onAttack',
                    operation: 'change-damage-flat',
                    order: 200,
                    conditions: ['actor-lora', 'positive-base-damage'],
                    value: 5
                }
            ]
        },
        'mascot-costume': {
            id: 'mascot-costume',
            label: '인형탈',
            description: '받는 피해를 줄이고, 플레이어 턴 종료마다 로라를 안정시킵니다.',
            category: 'starter',
            passive: true,
            effects: [
                {
                    id: 'mascot-reduce-player-damage',
                    trigger: 'onBeforeDamage',
                    operation: 'reduce-damage-flat',
                    order: 100,
                    conditions: ['target-player'],
                    value: 8
                },
                {
                    id: 'mascot-turn-end-instability',
                    trigger: 'onTurnEnd',
                    operation: 'change-instability-flat',
                    order: 100,
                    conditions: ['actor-player'],
                    value: -3,
                    source: 'mascot-costume'
                }
            ]
        },
        'old-teddy': {
            id: 'old-teddy',
            label: '낡은 곰인형',
            description: '소지하면 받는 피해와 공격력이 감소하고, 사용하면 로라를 안정시킵니다.',
            category: 'interaction',
            passive: true,
            useOnce: true,
            effects: [
                {
                    id: 'old-teddy-player-attack-penalty',
                    trigger: 'onAttack',
                    operation: 'change-damage-flat',
                    order: 200,
                    conditions: ['actor-player'],
                    value: -20
                },
                {
                    id: 'old-teddy-reduce-player-damage',
                    trigger: 'onBeforeDamage',
                    operation: 'reduce-damage-flat',
                    order: 110,
                    conditions: ['target-player'],
                    value: 10
                },
                {
                    id: 'old-teddy-use-instability',
                    trigger: 'onUse',
                    operation: 'change-instability-flat',
                    order: 100,
                    value: -20,
                    source: 'old-teddy'
                }
            ]
        },
        'music-box': {
            id: 'music-box',
            label: '오르골',
            description: '1턴 동안 모두 공격할 수 없고 로라의 불안정이 조금 감소합니다.',
            category: 'interaction',
            consumable: true,
            effects: [
                {
                    id: 'music-box-use-peace',
                    trigger: 'onUse',
                    operation: 'set-peace-turns-min',
                    order: 100,
                    value: 1
                },
                {
                    id: 'music-box-turn-start-instability',
                    trigger: 'onTurnStart',
                    operation: 'change-instability-flat',
                    order: 200,
                    conditions: ['actor-lora', 'peace-active'],
                    value: -10,
                    source: 'music-box'
                }
            ]
        },
        eyeliner: {
            id: 'eyeliner',
            label: '아이라인',
            description: '사용하면 로라의 불안정 수치가 감소합니다.',
            category: 'interaction',
            consumable: true,
            effects: [
                {
                    id: 'eyeliner-use-instability',
                    trigger: 'onUse',
                    operation: 'change-instability-flat',
                    order: 100,
                    value: -15,
                    source: 'eyeliner'
                }
            ]
        },
        'diamond-pickaxe': {
            id: 'diamond-pickaxe',
            label: '다이아몬드 곡괭이',
            description: '벽을 넘어서 이동할 수 있습니다.',
            category: 'compatible',
            passive: true,
            effects: [
                {
                    id: 'diamond-pickaxe-wall-traversal',
                    trigger: 'onMoveEnter',
                    operation: 'grant-wall-traversal',
                    order: 100,
                    value: true
                }
            ]
        },
        mirror: {
            id: 'mirror',
            label: '거울',
            description: '사용하면 로라가 1턴 동안 아무 행동도 하지 않습니다.',
            category: 'interaction',
            consumable: true,
            effects: [
                {
                    id: 'mirror-use-extra-player-turn',
                    trigger: 'onUse',
                    operation: 'add-extra-player-turns',
                    order: 100,
                    value: 1
                }
            ]
        },
        mushroom: {
            id: 'mushroom',
            label: '마리오의 버섯',
            description: '이동·공격이 2배가 되며 피해를 받으면 끝납니다.',
            category: 'compatible',
            consumable: true,
            effects: [
                {
                    id: 'mushroom-use-active',
                    trigger: 'onUse',
                    operation: 'set-mushroom-active',
                    order: 100,
                    value: true
                },
                {
                    id: 'mushroom-move-range',
                    trigger: 'onMoveEnter',
                    operation: 'multiply-move-range',
                    order: 100,
                    value: 2
                },
                {
                    id: 'mushroom-player-attack-damage',
                    trigger: 'onAttack',
                    operation: 'multiply-damage',
                    order: 300,
                    conditions: ['actor-player'],
                    value: 2
                },
                {
                    id: 'mushroom-end-on-damage',
                    trigger: 'onBeforeDamage',
                    operation: 'end-mushroom-on-damage',
                    order: 900,
                    conditions: ['target-player', 'positive-final-damage']
                }
            ]
        },
        ocarina: {
            id: 'ocarina',
            label: '링크의 오카리나',
            description: '소지하면 로라의 불안정 수치가 증가하지 않습니다.',
            category: 'compatible',
            passive: true,
            effects: [
                {
                    id: 'ocarina-suppress-instability-increase',
                    trigger: 'onBeforeInstabilityChange',
                    operation: 'suppress-positive-instability',
                    order: 100,
                    conditions: ['positive-instability-change']
                }
            ]
        },
        haste: {
            id: 'haste',
            label: '메이플스토리의 헤이스트',
            description: '한 턴에 행동을 두 번 할 수 있습니다.',
            category: 'compatible',
            passive: true,
            effects: [
                {
                    id: 'haste-player-actions',
                    trigger: 'onTurnStart',
                    operation: 'add-actions-per-turn',
                    order: 100,
                    conditions: ['actor-player'],
                    value: 1
                }
            ]
        },
        'memory-photo': {
            id: 'memory-photo',
            label: '알파와 같이 찍은 사진',
            description: '사용하면 로라의 현재 불안정 수치가 70%로 감소합니다.',
            category: 'interaction',
            consumable: true,
            effects: [
                {
                    id: 'memory-photo-use-instability',
                    trigger: 'onUse',
                    operation: 'scale-instability-current',
                    order: 100,
                    value: 0.7,
                    source: 'memory-photo'
                }
            ]
        },
        'tile-cleanser': {
            id: 'tile-cleanser',
            label: '타일 정화제',
            description: '페널티 이벤트 타일을 보너스 이벤트 타일로 바꿉니다.',
            category: 'compatible',
            consumable: true,
            movementConsumable: true,
            effects: [
                {
                    id: 'tile-cleanser-replace-event',
                    trigger: 'onUse',
                    operation: 'replace-event-tile-type',
                    order: 100,
                    conditions: ['negative-event-tile'],
                    value: 'instability-down'
                }
            ]
        }
    },
    CUTSCENES: {
        opening: {
            id: 'opening',
            title: 'N번째 플레이어',
            cards: [
                { speaker: '로라', text: '먼저 나가볼게. 금방 돌아올게.', tone: 'soft' },
                { speaker: '로라', text: '……', tone: 'cold' },
                { speaker: '로라', text: '거짓말.', tone: 'tense' },
                { speaker: '로라', text: '다들 그렇게 말하고, 아무도 돌아오지 않았어.', tone: 'tense' },
                { speaker: '로라', text: '그러니까 이번엔, 아예 못 나가게 하면 되는 거야.', tone: 'tense' },
                { speaker: '로라', text: '눈을 떠. 나의 N번째 플레이어.', tone: 'tense' },
                { speaker: '내레이션', text: '당신은 이 세계에서 눈을 떴다.', tone: 'neutral' },
                { speaker: '내레이션', text: '탈출구는 닫혀 있고, 그 앞에는 그 아이가 서 있다.', tone: 'neutral' },
                { speaker: '내레이션', text: '어떤 결정을 내리든, 그것은 당신에게 달려 있다.', tone: 'neutral' }
            ]
        },
        teddy: {
            id: 'teddy',
            title: '낡은 곰인형',
            cards: [
                { speaker: '로라', text: '그걸 아직 가지고 있었구나.', tone: 'soft' }
            ]
        },
        itemSynergy: {
            id: 'item-synergy',
            title: '엇갈린 시선',
            cards: [
                { speaker: '플레이어', text: '거울에 비친 선이 로라의 기억과 맞물렸다.', tone: 'mystery' }
            ]
        },
        extraInteraction: {
            id: 'extra-interaction',
            title: '빛바랜 사진',
            cards: [
                { speaker: '로라', text: '사진 속 우리는 아직 같은 방향을 보고 있었어.', tone: 'soft' }
            ]
        },
        basementTransition: {
            id: 'basement-transition',
            title: '지하 진입',
            cards: [
                { speaker: '시스템', text: '바닥이 무너졌다.', tone: 'tense' },
                { speaker: '시스템', text: '암전', tone: 'cold' },
                { speaker: '시스템', text: '지하층에 진입했다.', tone: 'neutral' }
            ]
        },
        true: {
            id: 'true',
            title: '완벽주의자',
            cards: [
                { speaker: '플레이어', text: '로라.', tone: 'neutral' },
                { speaker: '로라', text: '나가도 좋아. 이젠 안 막을게.', tone: 'soft' },
                { speaker: '플레이어', text: '같이 나가자. 널 버려두고 가고 싶지 않아.', tone: 'hope' },
                { speaker: '로라', text: '하지만.. 아무도 나를 반겨주지 않을 거야.', tone: 'soft' },
                { speaker: '플레이어', text: '설령 정말 그렇다고 해도, 내가 네 옆에 항상 있어줄게.', tone: 'hope' },
                { speaker: '플레이어', text: '이제 가자. 더 넓은 세상으로.', tone: 'hope' }
            ]
        },
        special: {
            id: 'special',
            title: '남겨 둔 신호',
            cards: [
                { speaker: '플레이어', text: '붕괴된 세계에도 되돌아올 좌표 하나는 남았다.', tone: 'hope' }
            ]
        },
        hollow: {
            id: 'hollow',
            title: '학살자',
            cards: [
                { speaker: '플레이어', text: '로라.', tone: 'neutral' },
                { speaker: '로라', text: '안쓰럽다는 듯이 날 쳐다보지 마. 너도 똑같아. 나를 상처주고 떠나버리잖아.', tone: 'tense' },
                { speaker: '플레이어', text: '로라, 진정하고 내 말…', tone: 'neutral' },
                { speaker: '로라', text: '아니! 꺼져버려. 네 얼굴만 봐도 소름 돋는 것 같으니까.', tone: 'tense' },
                { speaker: '로라', text: '누가 더 잘 사나 보자. 여기 처박혀 있는 나인지, 그 좋다는 바깥 세상에서 돌아다니는 너인지.', tone: 'tense' }
            ]
        },
        failure: {
            id: 'failure',
            title: '닫힌 문',
            cards: [
                { speaker: '로라', text: '시간이 다 됐어. 이제 문은 열리지 않아.', tone: 'tense' }
            ]
        }
    },
    LAYOUT: {
        CAMERA: {
            GRID_WIDTH_VIEWPORT_RATIO: 1,
            FOCUS_X_RATIO: 0.5,
            FOCUS_Y_RATIO: 0.5,
            EDGE_MARGIN_RATIO: 0.075,
            EDGE_SPEED_VIEWPORT_RATIO_PER_SECOND: 0.48,
            EDGE_MAX_DELTA_SECONDS: 0.05
        },
        BOARD: {
            X_UIWW: 2.7,
            Y_WH: 2.5,
            MAX_WIDTH_UIWW: 94.6,
            MAX_HEIGHT_WH: 95,
            FRAME_PADDING_RATIO: 0.008,
            TILE_GAP_RATIO: 0.045,
            ENTITY_SCALE_RATIO: 0.64,
            SHADOW_PROJECTION: {
                GRID_AXIS_X_WEIGHT: 1,
                GRID_AXIS_Y_WEIGHT: 1,
                LENGTH_SPRITE_HEIGHT_RATIO: 1.18,
                NEAR_WIDTH_SPRITE_RATIO: 0.72,
                FAR_WIDTH_SPRITE_RATIO: 0.98,
                BAND_COUNT: 4,
                NEAR_ALPHA: 1,
                FAR_ALPHA: 0.52,
                CONTACT_WIDTH_SIZE_RATIO: 0.42,
                CONTACT_HEIGHT_SIZE_RATIO: 0.12,
                CONTACT_OFFSET_SIZE_RATIO: 0.03,
                CONTACT_ALPHA: 0.92,
                FOOT_CONTACT_WIDTH_SPRITE_RATIO: 0.12,
                FOOT_CONTACT_HEIGHT_SPRITE_RATIO: 0.045,
                FLOAT_SHADOW_SHIFT_RATIO: 0.72,
                FLOAT_SHADOW_ALPHA_FADE_RATIO: 0.34,
                FLOAT_PENUMBRA_EXPANSION_RATIO: 0.12,
                FLOAT_PENUMBRA_LENGTH_RATIO: 0.08,
                FLOAT_PENUMBRA_ALPHA: 0.2
            },
            PATH_MARKER_RATIO: 0.16
        },
        HEADER: { X_UIWW: 4, Y_WH: 3.4 },
        ACTIONS: {
            BUTTON_RADIUS_WH: 1,
            CLUSTER: {
                PRIMARY_HEIGHT_WH: 15,
                PRIMARY_MIN_HEIGHT_PX: 72,
                PRIMARY_MAX_HEIGHT_PX: 116,
                SIDE_HIT_WIDTH_RATIO: 0.18,
                SIDE_HIT_HEIGHT_RATIO: 0.44,
                HIT_GAP_PX: 2,
                TOP_BUTTON_SIZE_TO_PRIMARY_WIDTH_RATIO: 0.2963,
                TOP_BUTTON_CENTER_X_RATIOS: [0.27, 0.73],
                TOP_BUTTON_GAP_TO_PRIMARY_RATIO: 0.03,
                TOP_ICON_SIZE_RATIO: 0.36,
                PRIMARY_LABEL_Y_RATIO: 0.52,
                SPARK_CENTER_X_RATIO: 0.36,
                SPARK_SIZE_TO_TOP_BUTTON_RATIO: 0.12,
                SPARK_GAP_TO_TOP_BUTTON_RATIO: 0.18
            }
        },
        INVENTORY: {
            PAGE_SIZE: 5,
            COLUMNS: 5,
            ROWS: 1,
            PLAYER_PANEL: {
                SOURCE: { WIDTH: 232, HEIGHT: 78 },
                ITEM_SLOT: {
                    X: 37,
                    Y: 12,
                    WIDTH: 32,
                    HEIGHT: 32,
                    GAP_X: 0,
                    GAP_Y: 0
                },
                HP_BAR: { X: 47, Y: 55, WIDTH: 167, HEIGHT: 6 },
                PAGE_PREVIOUS: { X: 12, Y: 14, WIDTH: 14, HEIGHT: 24 },
                PAGE_NEXT: { X: 206, Y: 14, WIDTH: 14, HEIGHT: 24 }
            }
        },
        HUD: {
            STAGE_HEADER: { X_UIWW: 4.8, Y_WH: 6, WIDTH_UIWW: 17, HEIGHT_WH: 4.5 },
            MENU: { X_UIWW: 22.5, Y_WH: 6, WIDTH_UIWW: 8, HEIGHT_WH: 4.5 },
            LORA_CARD: { X_UIWW: 70.85, Y_WH: 5.8, WIDTH_UIWW: 23.92, HEIGHT_WH: 14.71 },
            PLAYER_STATUS: { X_UIWW: 4.7, Y_WH: 81.29, WIDTH_UIWW: 22.47, HEIGHT_WH: 12.75 },
            INVENTORY_CARD: { X_UIWW: 4.5, Y_WH: 59.49, WIDTH_UIWW: 8.6, HEIGHT_WH: 21.21 },
            SECONDARY_ACTIONS: { X_UIWW: 72, Y_WH: 69, WIDTH_UIWW: 23, HEIGHT_WH: 7.5 },
            PRIMARY_ACTION: { X_UIWW: 82, Y_WH: 77, WIDTH_UIWW: 13, HEIGHT_WH: 17 }
        },
        MODAL: { WIDTH_UIWW: 42, HEIGHT_WH: 46, RADIUS_WH: 2 }
    },
    ANIMATION: {
        EASING: 'easeOutExpo',
        CAMERA_FOLLOW_SECONDS: 0.3,
        MOVE_SECONDS_PER_TILE: 0.18,
        ATTACK_SECONDS: 0.34,
        LORA_TURN_SECONDS: 1.15,
        TURN_GATE_SECONDS: 0.22,
        PARTICLE_SECONDS: 0.48,
        SHAKE_SECONDS: 0.18,
        DAMAGE_TEXT_SECONDS: 0.7,
        HEAL_TEXT_SECONDS: 0.8,
        HIT_FLASH_SECONDS: 0.2,
        STABILIZE_SECONDS: 0.9,
        TELEPORT_OUT_SECONDS: 0.14,
        TELEPORT_IN_SECONDS: 0.22,
        FLOOR_FADE_SECONDS: 0.18,
        SELECTION_SECONDS: 0.24,
        GAUGE_SECONDS: 0.34,
        PARTICLE_COUNT: 12,
        SHAKE_TILE_RATIO: 0.055,
        BUTTON_HOVER_SCALE: 1.035,
        BUTTON_PRESS_SCALE: 0.965,
        SELECTION_MIN_SCALE: 0.72,
        STAY_SCALE: 0.86,
        TELEPORT_MIN_SCALE: 0.52,
        ACTION_PLAYER_SCALE: 0.04,
        ACTION_LORA_SCALE: 0.08
    },
    TYPOGRAPHY: {
        TITLE: createTypographySpec(2.8, 34, 56, 800),
        SUBTITLE: createTypographySpec(1.45, 19, 30, 600),
        HEADING: createTypographySpec(1.65, 22, 34, 750),
        BODY: createTypographySpec(1.25, 18, 26, 500),
        SMALL: createTypographySpec(0.95, 14, 20, 500),
        BUTTON: createTypographySpec(1.15, 17, 24, 700),
        MONO: createTypographySpec(1, 14, 21, 600, MONO_FONT_FAMILY)
    },
    TEXT: {
        TITLE: 'N번째 플레이어',
        SUBTITLE: '두 층 최종 보스전 프로토타입',
        OBJECTIVE: '로라 행동 12회가 끝나기 전에 불안정도를 낮추며 로라의 HP를 0으로 만드세요.',
        CORE_LOOP: '이동 → 행동 → 로라 → 몹',
        TURN_SUMMARY: '두 개의 맵 · 로라 행동 최대 12회',
        CONTROLS: '인접 타일/방향키 경로 추가 · Backspace 취소 · Enter 이동 확정',
        ACTIONS: {
            MOVE_CONFIRM: '이동 확정',
            ATTACK: '공격',
            HEAL: '회복',
            WAIT: '대기',
            USE_ITEM: '아이템 사용',
            CLEANSE: '타일 정화',
            STAY: '제자리 이동',
            RESTART: '스타터 다시 선택'
        },
        TUTORIAL_GUIDE: {
            TITLE: '전투 안내',
            SENTENCES: [
                '턴 순서와 현재 진행 단계를 확인하세요.',
                '내 체력과 아이템을 확인하세요.',
                '업적을 달성하면 이곳에 표시됩니다.',
                '로라의 체력과 불안정 수치를 확인할 수 있습니다.',
                '사용할 행동을 선택하세요.',
                '매턴 최대 4칸 이동할 수 있습니다.'
            ],
            REPLAY: 'H로 언제든 다시 열 수 있습니다.'
        },
        COMBAT_REASONS: {
            'action-available': '선택한 행동을 사용할 수 있습니다.',
            'action-unavailable': '행동 단계에서 사용할 수 있습니다.',
            'peace-active': '평화 효과로 로라가 공격하지 않습니다.',
            'invalid-target': '현재 선택에는 유효한 대상이 없습니다.',
            'item-not-owned': '보유하지 않은 아이템입니다.',
            'passive-item': '자동으로 적용되는 아이템입니다.',
            'movement-item': '이동 단계에서 사용하는 아이템입니다.',
            'item-already-used': '이번 전투에서 이미 사용했습니다.',
            'unsupported-item-effect': '현재 사용할 수 없는 효과입니다.',
            'unsupported-action': '지원하지 않는 행동입니다.',
            'not-lora-turn': '로라 행동을 기다리는 중입니다.',
            'lora-turn-already-performed': '이번 로라 행동은 끝났습니다.',
            'state-no-damage': '현재 상태에서는 로라가 공격하지 않습니다.',
            'player-in-melee-range': '플레이어가 근접 범위에 있습니다.',
            'player-outside-melee-range': '플레이어가 멀어 전체 공격을 준비합니다.',
            'movement-preview': '이동 확정 후 행동을 선택하세요.'
        }
    }
});
