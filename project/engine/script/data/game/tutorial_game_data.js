const DEFAULT_FONT_FAMILY = 'Pretendard Variable, arial';
const MONO_FONT_FAMILY = 'Consolas, monospace';

/**
 * 반응형 게임 폰트 규격을 생성합니다.
 * @param {number} sizeUIWW - UI 기준 너비 대비 폰트 크기 비율입니다.
 * @param {number} min - 최소 폰트 크기(px)입니다.
 * @param {number} max - 최대 폰트 크기(px)입니다.
 * @param {number} weight - 폰트 굵기입니다.
 * @param {string} [family=DEFAULT_FONT_FAMILY] - 폰트 패밀리입니다.
 * @returns {{SIZE_UIWW:number,MIN:number,MAX:number,WEIGHT:number,FAMILY:string}} 고정된 폰트 규격입니다.
 */
function createTypographySpec(sizeUIWW, min, max, weight, family = DEFAULT_FONT_FAMILY) {
    return Object.freeze({
        SIZE_UIWW: sizeUIWW,
        MIN: min,
        MAX: max,
        WEIGHT: weight,
        FAMILY: family
    });
}

/** 우상단 2단 고지와 한 칸짜리 1단 계단을 포함한 시각 전용 높이 데이터입니다. */
const TUTORIAL_MAP_HEIGHTS = Object.freeze([
    Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2]),
    Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2]),
    Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2]),
    Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
]);

const LORA_INSTABILITY_STATES = Object.freeze([
    Object.freeze({ id: 'stable', label: '안정', min: 0, max: 10 }),
    Object.freeze({ id: 'anxious', label: '불안', min: 11, max: 40 }),
    Object.freeze({ id: 'shaken', label: '동요', min: 41, max: 60 }),
    Object.freeze({ id: 'unstable', label: '불안정', min: 61, max: 80 }),
    Object.freeze({ id: 'collapse', label: '붕괴', min: 81, max: 100 })
]);

/**
 * 2D 탑뷰 턴제 튜토리얼 프로토타입의 정적 규칙과 표시 데이터를 제공합니다.
 */
export const TUTORIAL_GAME_DATA = Object.freeze({
    MAP: Object.freeze({
        WIDTH: 12,
        HEIGHT: 10,
        MOVE_RANGE: 4,
        HEIGHTS: TUTORIAL_MAP_HEIGHTS,
        STAIRS: Object.freeze([
            Object.freeze({ x: 8, y: 2 })
        ])
    }),
    ACTORS: Object.freeze({
        PLAYER: Object.freeze({
            START: Object.freeze({ x: 5, y: 5 }),
            MAX_HP: 100,
            DEFEND_DAMAGE_REDUCTION: 0.3
        }),
        LORA: Object.freeze({
            START: Object.freeze({ x: 5, y: 1 }),
            MAX_HP: 100,
            START_INSTABILITY: 80,
            MAX_INSTABILITY: 100,
            MOVE_RANGE: 1,
            GATE_ZONE_RADIUS: 1,
            MELEE_DAMAGE: 20,
            MELEE_RANGE: 1,
            RANGED_DAMAGE: 15,
            RANGED_RANGE: 3,
            DEFEND_DAMAGE_REDUCTION: 0.5,
            DEFEND_COOLDOWN: 3,
            INSTABILITY_STATES: LORA_INSTABILITY_STATES
        })
    }),
    OBJECTS: Object.freeze({
        DOOR: Object.freeze({ x: 5, y: 0 }),
        BOXES: Object.freeze([
            Object.freeze({ id: 'box-a', x: 2, y: 2 }),
            Object.freeze({ id: 'box-b', x: 8, y: 1 }),
            Object.freeze({ id: 'box-c', x: 4, y: 4 }),
            Object.freeze({ id: 'box-d', x: 2, y: 6 }),
            Object.freeze({ id: 'box-e', x: 8, y: 6 })
        ])
    }),
    RULES: Object.freeze({
        MAX_ROUNDS: 8,
        PLAYER_ATTACK_DAMAGE: 50,
        PLAYER_ATTACK_RANGE: 1,
        PLAYER_ATTACK_INSTABILITY: 10,
        CONSECUTIVE_ATTACK_INSTABILITY: 4,
        EVENT_LOG_LIMIT: 5
    }),
    DIALOGUE: Object.freeze({
        CHOICES: Object.freeze([
            Object.freeze({ id: 'avoid', label: '회피' }),
            Object.freeze({ id: 'attack', label: '공격' }),
            Object.freeze({ id: 'understand', label: '이해' }),
            Object.freeze({ id: 'lie', label: '거짓말' })
        ])
    }),
    LAYOUT: Object.freeze({
        BOARD: Object.freeze({
            X_UIWW: 4,
            Y_WH: 10,
            MAX_WIDTH_UIWW: 64,
            MAX_HEIGHT_WH: 82,
            FRAME_PADDING_RATIO: 0.035,
            TILE_GAP_RATIO: 0.055,
            ELEVATION_LIFT_RATIO: 0.18,
            ENTITY_SCALE_RATIO: 0.64,
            SHADOW_OFFSET_RATIO: 0.08,
            PATH_MARKER_RATIO: 0.16
        }),
        SIDEBAR: Object.freeze({
            X_UIWW: 72,
            Y_WH: 7,
            WIDTH_UIWW: 24,
            HEIGHT_WH: 86,
            PADDING_UIWW: 1.35,
            RADIUS_WH: 1.35
        }),
        HEADER: Object.freeze({
            X_UIWW: 4,
            Y_WH: 3.4
        }),
        ACTIONS: Object.freeze({
            TOP_WH: 68,
            BUTTON_HEIGHT_WH: 5.2,
            GAP_WH: 1,
            BUTTON_RADIUS_WH: 0.7
        }),
        SPEECH: Object.freeze({
            WIDTH_UIWW: 22,
            HEIGHT_WH: 9,
            RADIUS_WH: 1.4,
            OFFSET_Y_TILES: 1.25
        }),
        MODAL: Object.freeze({
            WIDTH_UIWW: 38,
            HEIGHT_WH: 34,
            RADIUS_WH: 2
        })
    }),
    ANIMATION: Object.freeze({
        MOVE_SECONDS_PER_TILE: 0.18,
        ATTACK_SECONDS: 0.34,
        LORA_TURN_SECONDS: 1.15,
        SPEECH_SECONDS: 2.4,
        TURN_GATE_SECONDS: 0.22,
        PARTICLE_SECONDS: 0.48,
        SHAKE_SECONDS: 0.18,
        PARTICLE_COUNT: 12,
        SHAKE_TILE_RATIO: 0.055
    }),
    TYPOGRAPHY: Object.freeze({
        TITLE: createTypographySpec(2.15, 24, 42, 800),
        SUBTITLE: createTypographySpec(1.1, 15, 22, 600),
        HEADING: createTypographySpec(1.25, 17, 24, 750),
        BODY: createTypographySpec(0.95, 14, 19, 500),
        SMALL: createTypographySpec(0.72, 11, 14, 500),
        BUTTON: createTypographySpec(0.9, 13, 18, 700),
        MONO: createTypographySpec(0.78, 11, 16, 600, MONO_FONT_FAMILY)
    }),
    TEXT: Object.freeze({
        TITLE: '철문 앞의 로라',
        SUBTITLE: '2D 탑뷰 턴제 전술 프로토타입',
        OBJECTIVE: '목표: 로라의 불안정도를 관리하며 무력화한 뒤 열린 게이트로 탈출하세요.',
        CONTROLS: '클릭 · 방향키/WASD · Enter · R 재시작',
        ACTIONS: Object.freeze({
            MOVE_CONFIRM: '이동 확정',
            ATTACK: '공격',
            TALK: '대화',
            DEFEND: '방어',
            WAIT: '대기',
            END_TURN: '턴 종료',
            ESCAPE: '탈출',
            STAY: '제자리 확정',
            UNDO: '이동 취소',
            RESTART: '다시 시작'
        }),
        DIALOGUE_CHOICES: Object.freeze({
            avoid: '회피',
            attack: '공격',
            understand: '이해',
            lie: '거짓말'
        }),
        LORA_LINES: Object.freeze([
            '여기서 더 가까이 오지 마.',
            '문은 내가 지킬 거야.',
            '네가 무슨 말을 해도 아직은 못 믿겠어.',
            '이번에는 내가 막아야 해.'
        ]),
        PLAYER_TALK_LINES: Object.freeze([
            '로라, 내 이야기를 잠깐만 들어 줘.',
            '널 다치게 하려는 게 아니야.',
            '문을 열고 같이 나가자.',
            '이 상황을 끝낼 방법을 찾을게.'
        ])
    })
});
