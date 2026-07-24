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
    ASSETS: {
        LORA_PORTRAIT: '../asset/ui/tutorial/lora-portrait.png'
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
            gate: null,
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
                { id: 'f1-teddy', itemId: 'old-teddy', x: 0, y: 2 },
                { id: 'f1-music-box', itemId: 'music-box', x: 8, y: 2 },
                { id: 'f1-eyeliner', itemId: 'eyeliner', x: 4, y: 6 },
                { id: 'f1-pickaxe', itemId: 'diamond-pickaxe', x: 7, y: 6, hidden: true },
                { id: 'f1-glitch-item', itemId: 'glitch-item', x: 8, y: 0, hidden: true }
            ],
            traps: [
                { id: 'f1-slip', type: 'slip', x: 2, y: 4 },
                { id: 'f1-item-loss', type: 'item-loss', x: 3, y: 6 },
                { id: 'f1-slow', type: 'slow', x: 7, y: 3 }
            ],
            teleports: [
                { id: 'f1-teleport', x: 8, y: 7 }
            ],
            mobs: [
                { id: 'f1-mob-item', x: 1, y: 5, hp: 50, dropItemId: 'bandage' }
            ]
        },
        {
            id: 'basement',
            label: '지하층',
            playerStart: { x: 4, y: 7 },
            loraStart: { x: 4, y: 1 },
            gate: { x: 4, y: 0 },
            heights: FLAT_HEIGHTS,
            walls: [
                { id: 'b1-wall-1', x: 2, y: 1 },
                { id: 'b1-wall-2', x: 6, y: 1 },
                { id: 'b1-wall-3', x: 2, y: 2 },
                { id: 'b1-wall-4', x: 6, y: 2 },
                { id: 'b1-wall-5', x: 2, y: 5 },
                { id: 'b1-wall-6', x: 6, y: 5 },
                { id: 'b1-wall-7', x: 2, y: 6 },
                { id: 'b1-wall-8', x: 6, y: 6 }
            ],
            items: [
                { id: 'b1-mirror', itemId: 'mirror', x: 4, y: 5 },
                { id: 'b1-mushroom', itemId: 'mushroom', x: 8, y: 1, hidden: true },
                { id: 'b1-speed-boots', itemId: 'speed-boots', x: 0, y: 4, hidden: true },
                { id: 'b1-shield-core', itemId: 'shield-core', x: 8, y: 4, hidden: true },
                { id: 'b1-memory-photo', itemId: 'memory-photo', x: 0, y: 1 }
            ],
            traps: [
                { id: 'b1-slip', type: 'slip', x: 3, y: 4 },
                { id: 'b1-item-loss', type: 'item-loss', x: 5, y: 4 },
                { id: 'b1-slow', type: 'slow', x: 4, y: 6 }
            ],
            teleports: [
                { id: 'b1-teleport', x: 0, y: 7 }
            ],
            mobs: [
                { id: 'b1-mob-left', x: 1, y: 3, hp: 50 },
                { id: 'b1-mob-right', x: 7, y: 3, hp: 50 }
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
            DEFEND_DAMAGE_REDUCTION: 0.3,
            HEAL_AMOUNT: 20
        },
        LORA: {
            MAX_HP: 100,
            START_INSTABILITY: 70,
            MAX_INSTABILITY: 100,
            MELEE_RANGE: 1,
            DEFEND_DAMAGE_REDUCTION: 0.5,
            LOW_HP_THRESHOLD: 50,
            LOW_HP_STABILIZE_MULTIPLIER: 1.5,
            INSTABILITY_STATES: LORA_INSTABILITY_STATES
        },
        MOB: {
            DEFAULT_HP: 50
        }
    },
    RULES: {
        MAX_TURNS: 8,
        FLOOR_TRANSITION_AFTER_TURN: 4,
        EVENT_LOG_LIMIT: 80,
        BOW_INSTABILITY_PER_TURN: 5,
        BOW_LORA_DAMAGE_BONUS: 5,
        SLOW_TRAP_MOVE_PENALTY: 2,
        TRUE_ENDING_MAX_INSTABILITY: 10,
        SPECIAL_ENDING_MAX_INSTABILITY: 40
    },
    STARTER_CHOICES: [
        { id: 'bow', label: '활과 화살', description: '전장 어디서든 30 피해를 주지만 매 턴 위험이 커집니다.' },
        { id: 'bandage', label: '붕대', description: '플레이어를 20 회복하고 로라를 조금 안정시킵니다.' }
    ],
    ITEMS: {
        bow: {
            id: 'bow',
            label: '활과 화살',
            category: 'starter',
            passive: true,
            effect: { type: 'bow', rangedDamage: 30 }
        },
        bandage: {
            id: 'bandage',
            label: '붕대',
            category: 'starter',
            consumable: true,
            effect: { type: 'bandage', playerHeal: 20, loraHeal: 10, instabilityReduction: 15 }
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
                playerDamageMultiplier: 0.7,
                playerDamageReduction: 0.2
            }
        },
        'music-box': {
            id: 'music-box',
            label: '오르골',
            category: 'interaction',
            consumable: true,
            effect: { type: 'music-box', durationLoraTurns: 2, instabilityReductionPerTurn: 10 }
        },
        eyeliner: {
            id: 'eyeliner',
            label: '아이라인',
            category: 'interaction',
            consumable: true,
            effect: { type: 'eyeliner', instabilityReduction: 15, afterMirrorBonusReduction: 20 }
        },
        'diamond-pickaxe': {
            id: 'diamond-pickaxe',
            label: '다이아몬드 곡괭이',
            category: 'compatible',
            passive: true,
            effect: { type: 'diamond-pickaxe' }
        },
        'glitch-item': {
            id: 'glitch-item',
            label: '글리치 코어',
            category: 'compatible',
            consumable: true,
            effect: { type: 'glitch-item', mobDamage: 50, instabilityReduction: 20 }
        },
        mirror: {
            id: 'mirror',
            label: '거울',
            category: 'interaction',
            consumable: true,
            effect: { type: 'mirror', restrainedLoraTurns: 1, afterEyelinerInstabilityIncrease: 35 }
        },
        mushroom: {
            id: 'mushroom',
            label: '마리오의 버섯',
            category: 'compatible',
            consumable: true,
            effect: { type: 'mushroom', moveRange: 8, nextAttackMultiplier: 2 }
        },
        'speed-boots': {
            id: 'speed-boots',
            label: '스피드 부츠',
            category: 'compatible',
            passive: true,
            effect: { type: 'speed-boots', moveRangeBonus: 2 }
        },
        'shield-core': {
            id: 'shield-core',
            label: '실드 코어',
            category: 'compatible',
            consumable: true,
            effect: { type: 'shield-core', damageReduction: 0.5, loraTurns: 1 }
        },
        'memory-photo': {
            id: 'memory-photo',
            label: '빛바랜 사진',
            category: 'interaction',
            consumable: true,
            effect: { type: 'memory-photo', instabilityReduction: 25 }
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
            X_UIWW: 35.5,
            Y_WH: 26.5,
            MAX_WIDTH_UIWW: 38,
            MAX_HEIGHT_WH: 58,
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
        INVENTORY: { PAGE_SIZE: 6, COLUMNS: 3, ROWS: 2 },
        HUD: {
            STAGE_HEADER: { X_UIWW: 4.5, Y_WH: 4.8, WIDTH_UIWW: 21.5, HEIGHT_WH: 12 },
            MENU: { X_UIWW: 27, Y_WH: 3.6, WIDTH_UIWW: 7, HEIGHT_WH: 4.8 },
            UNDO: { X_UIWW: 27, Y_WH: 9.2, WIDTH_UIWW: 7, HEIGHT_WH: 4.8 },
            LORA_CARD: { X_UIWW: 69.5, Y_WH: 4.5, WIDTH_UIWW: 27.5, HEIGHT_WH: 21 },
            MISSION_CARD: { X_UIWW: 76, Y_WH: 30, WIDTH_UIWW: 21, HEIGHT_WH: 36 },
            PLAYER_STATUS: { X_UIWW: 4, Y_WH: 67.5, WIDTH_UIWW: 27, HEIGHT_WH: 5 },
            INVENTORY_CARD: { X_UIWW: 4, Y_WH: 74, WIDTH_UIWW: 27, HEIGHT_WH: 22 },
            SECONDARY_ACTIONS: { X_UIWW: 35.5, Y_WH: 87, WIDTH_UIWW: 38, HEIGHT_WH: 9 },
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
        TELEPORT_OUT_SECONDS: 0.14,
        TELEPORT_IN_SECONDS: 0.22,
        UNDO_SECONDS_PER_TILE: 0.12,
        UNDO_FADE_SECONDS: 0.18,
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
        OBJECTIVE: '로라를 안정된 상태로 무력화한 뒤 지하 게이트로 탈출하세요.',
        CORE_LOOP: '탐색 · 조합 · 탈출',
        TURN_SUMMARY: '두 개의 맵 · 총 8턴',
        CONTROLS: '클릭 · 방향키/WASD · Enter · Ctrl+Z 되돌리기 · R 재시작',
        ACTIONS: {
            MOVE_CONFIRM: '이동 확정',
            ATTACK: '공격',
            DEFEND: '방어',
            WAIT: '대기',
            USE_ITEM: '아이템 사용',
            END_TURN: '턴 종료',
            ESCAPE: '탈출',
            STAY: '제자리 이동',
            RESTART: '다시 시작',
            UNDO: '되돌리기',
            UNDO_SHORT: 'Ctrl+Z',
            UNDO_EVENT: '직전 행동을 되돌렸습니다.'
        }
    }
});
