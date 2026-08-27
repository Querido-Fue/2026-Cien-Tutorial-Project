const DEFAULT_FONT_FAMILY = 'Pretendard Variable, arial';
const MONO_FONT_FAMILY = 'Consolas, monospace';

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
    return { SIZE_UIWW: sizeUIWW, MIN: min, MAX: max, WEIGHT: weight, FAMILY: family };
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
    FEATURES: { CUTSCENES: false },
    ASSETS: {
        LORA_PORTRAIT: '../asset/ui/tutorial/lora-portrait.png',
        ITEM_ICON_ATLAS: '../asset/ui/tutorial/item-icons-atlas.png',
        LORA_SPRITE: '../asset/ui/tutorial/lora-sprite.png'
    },
    SPRITES: {
        ITEM_ATLAS: {
            COLUMNS: 4,
            ROWS: 2,
            CELLS: {
                'music-box': { COLUMN: 0, ROW: 0 },
                'old-teddy': { COLUMN: 1, ROW: 0 },
                mirror: { COLUMN: 2, ROW: 0 },
                eyeliner: { COLUMN: 3, ROW: 0 },
                bow: { COLUMN: 0, ROW: 1 },
                'diamond-pickaxe': { COLUMN: 2, ROW: 1 },
                mushroom: { COLUMN: 3, ROW: 1 }
            },
            WORLD_HALO_SIZE_TILE_RATIO: 0.45,
            WORLD_ICON_SIZE_TILE_RATIO: 0.64,
            BUTTON_ICON_SIZE_RATIO: 0.66,
            BUTTON_ICON_GAP_UIWW: 0.25
        },
        LORA: {
            BASE_SIZE_TILE_RATIO: 0.64,
            SPRITE_SIZE_TILE_RATIO: 0.84,
            OFFSET_Y_TILE_RATIO: 0,
            FLASH_GLOW_SIZE_RATIO: 1.08,
            FLASH_GLOW_ALPHA: 0.34
        }
    },
    MAP: {
        WIDTH: 9,
        HEIGHT: 8
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
            eventTiles: [
                { id: 'b1-event-4-a', type: 'instability-down', x: 2, y: 0 },
                { id: 'b1-event-4-b', type: 'instability-down', x: 6, y: 0 },
                { id: 'b1-event-4-c', type: 'instability-down', x: 2, y: 1 },
                { id: 'b1-event-4-d', type: 'instability-down', x: 6, y: 1 }
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
            HEAL_AMOUNT: 20
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
        BOW_INSTABILITY_PER_TURN: 3,
        BOW_LORA_DAMAGE_BONUS: 5,
        EVENT_MOVE_PENALTY: 2,
        TRUE_ENDING_MAX_INSTABILITY: 10,
        SPECIAL_ENDING_MAX_INSTABILITY: 40
    },
    STARTER_CHOICES: [
        { id: 'bow', label: '활과 화살', description: '전장 어디서든 원거리 공격이 가능하지만 로라가 더 위험해집니다.' },
        { id: 'mascot-costume', label: '인형탈', description: '받는 피해를 10 줄이고 매 플레이어 턴 종료 시 로라를 안정시킵니다.' }
    ],
    ITEMS: {
        bow: {
            id: 'bow',
            label: '활과 화살',
            category: 'starter',
            passive: true,
            effect: { type: 'bow', rangedDamage: 30 }
        },
        'mascot-costume': {
            id: 'mascot-costume',
            label: '인형탈',
            category: 'starter',
            passive: true,
            effect: { type: 'mascot-costume', damageReduction: 10, turnEndInstabilityReduction: 5 }
        },
        'old-teddy': {
            id: 'old-teddy',
            label: '낡은 곰인형',
            category: 'interaction',
            passive: true,
            useOnce: true,
            effect: {
                type: 'old-teddy',
                instabilityReduction: 30,
                attackDamagePenalty: 20,
                damageReduction: 10
            }
        },
        'music-box': {
            id: 'music-box',
            label: '오르골',
            category: 'interaction',
            consumable: true,
            effect: { type: 'music-box', durationLoraTurns: 2, instabilityReductionPerTurn: 20 }
        },
        eyeliner: {
            id: 'eyeliner',
            label: '아이라인',
            category: 'interaction',
            consumable: true,
            effect: { type: 'eyeliner', instabilityReduction: 15 }
        },
        'diamond-pickaxe': {
            id: 'diamond-pickaxe',
            label: '다이아몬드 곡괭이',
            category: 'compatible',
            passive: true,
            effect: { type: 'diamond-pickaxe' }
        },
        mirror: {
            id: 'mirror',
            label: '거울',
            category: 'interaction',
            consumable: true,
            effect: { type: 'mirror', extraPlayerTurns: 1 }
        },
        mushroom: {
            id: 'mushroom',
            label: '마리오의 버섯',
            category: 'compatible',
            consumable: true,
            effect: { type: 'mushroom', moveMultiplier: 2, attackMultiplier: 2 }
        },
        ocarina: {
            id: 'ocarina',
            label: '링크의 오카리나',
            category: 'compatible',
            passive: true,
            effect: { type: 'ocarina' }
        },
        haste: {
            id: 'haste',
            label: '메이플스토리의 헤이스트',
            category: 'compatible',
            passive: true,
            effect: { type: 'haste', actionCountBonus: 1 }
        },
        'memory-photo': {
            id: 'memory-photo',
            label: '알파와 같이 찍은 사진',
            category: 'interaction',
            consumable: true,
            effect: { type: 'memory-photo', instabilityRatio: 0.5 }
        },
        'tile-cleanser': {
            id: 'tile-cleanser',
            label: '타일 정화제',
            category: 'compatible',
            consumable: true,
            movementConsumable: true,
            effect: { type: 'tile-cleanser', cleansedType: 'instability-down' }
        }
    },
    CUTSCENES: {
        opening: {
            id: 'opening',
            title: '마지막 문',
            cards: [
                { speaker: '플레이어', text: '무너지는 두 층 너머, 로라와 출구가 동시에 보였다.', tone: 'neutral' },
                { speaker: '로라', text: '가까이 오지 마. 이 문은 아직 열 수 없어.', tone: 'tense' }
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
        true: {
            id: 'true',
            title: '함께 나가는 문',
            cards: [
                { speaker: '로라', text: '이번에는 도망치지 않을게.', tone: 'hope' }
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
            title: '빈 탈출',
            cards: [
                { speaker: '플레이어', text: '문은 열렸지만 아무것도 해결되지 않았다.', tone: 'cold' }
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
        BOARD: {
            X_UIWW: 32.5,
            Y_WH: 20,
            MAX_WIDTH_UIWW: 43,
            MAX_HEIGHT_WH: 64,
            FRAME_PADDING_RATIO: 0.025,
            TILE_GAP_RATIO: 0.045,
            ENTITY_SCALE_RATIO: 0.64,
            SHADOW_OFFSET_RATIO: 0.08,
            PATH_MARKER_RATIO: 0.16
        },
        HEADER: { X_UIWW: 4, Y_WH: 3.4 },
        ACTIONS: {
            COLUMNS: 4,
            GAP_X_UIWW: 0.6,
            BUTTON_RADIUS_WH: 1
        },
        INVENTORY: { PAGE_SIZE: 15, COLUMNS: 3, ROWS: 5 },
        HUD: {
            STAGE_HEADER: { X_UIWW: 4.5, Y_WH: 4.8, WIDTH_UIWW: 21.5, HEIGHT_WH: 12 },
            MENU: { X_UIWW: 27, Y_WH: 3.6, WIDTH_UIWW: 7, HEIGHT_WH: 4.8 },
            LORA_CARD: { X_UIWW: 69.5, Y_WH: 4.5, WIDTH_UIWW: 27.5, HEIGHT_WH: 21 },
            MISSION_CARD: { X_UIWW: 76, Y_WH: 30, WIDTH_UIWW: 21, HEIGHT_WH: 36 },
            PLAYER_STATUS: { X_UIWW: 4, Y_WH: 59.5, WIDTH_UIWW: 27, HEIGHT_WH: 5 },
            INVENTORY_CARD: { X_UIWW: 4, Y_WH: 66, WIDTH_UIWW: 27, HEIGHT_WH: 30 },
            SECONDARY_ACTIONS: { X_UIWW: 32.5, Y_WH: 87, WIDTH_UIWW: 43, HEIGHT_WH: 9 },
            PRIMARY_ACTION: { X_UIWW: 78, Y_WH: 87, WIDTH_UIWW: 19, HEIGHT_WH: 9 }
        },
        MODAL: { WIDTH_UIWW: 38, HEIGHT_WH: 34, RADIUS_WH: 2 }
    },
    ANIMATION: {
        EASING: 'easeOutExpo',
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
        }
    }
});
