/**
 * 단일 의미를 갖는 튜토리얼 KeyboardEvent.code 매핑입니다.
 * @type {Readonly<Record<string,string>>}
 */
export const TUTORIAL_KEY_CODES = Object.freeze({
    CONFIRM: 'Enter',
    ALTERNATE_CONFIRM: 'Space',
    CANCEL: 'Escape',
    RESTART: 'KeyR',
    PATH_BACK: 'Backspace',
    TARGET_NEXT: 'Tab',
    ACTION_MELEE: 'Digit1',
    ACTION_RANGED: 'Digit2',
    ACTION_HEAL: 'Digit3',
    ACTION_IDLE: 'Digit4',
    GUIDE: 'KeyH'
});

/**
 * 메뉴와 갤러리 선택 이동에 사용하는 키 그룹입니다.
 * @type {Readonly<Record<'PREVIOUS'|'NEXT',readonly string[]>>}
 */
export const TUTORIAL_SELECTION_KEY_CODES = Object.freeze({
    PREVIOUS: Object.freeze(['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW']),
    NEXT: Object.freeze(['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS'])
});

/**
 * 전술 경로 입력의 방향 벡터와 대응 키입니다.
 * @type {ReadonlyArray<Readonly<{codes:readonly string[],x:number,y:number}>>}
 */
export const TUTORIAL_KEY_DIRECTIONS = Object.freeze([
    Object.freeze({ codes: Object.freeze(['ArrowUp', 'KeyW']), x: 0, y: -1 }),
    Object.freeze({ codes: Object.freeze(['ArrowRight', 'KeyD']), x: 1, y: 0 }),
    Object.freeze({ codes: Object.freeze(['ArrowDown', 'KeyS']), x: 0, y: 1 }),
    Object.freeze({ codes: Object.freeze(['ArrowLeft', 'KeyA']), x: -1, y: 0 })
]);

/**
 * 상승 에지 추적 대상 키의 중복 없는 전체 목록입니다.
 * @type {readonly string[]}
 */
export const TUTORIAL_WATCHED_KEY_CODES = Object.freeze([
    'ArrowUp',
    'ArrowRight',
    'ArrowDown',
    'ArrowLeft',
    'KeyW',
    'KeyD',
    'KeyS',
    'KeyA',
    TUTORIAL_KEY_CODES.CONFIRM,
    TUTORIAL_KEY_CODES.ALTERNATE_CONFIRM,
    TUTORIAL_KEY_CODES.ACTION_MELEE,
    TUTORIAL_KEY_CODES.ACTION_RANGED,
    TUTORIAL_KEY_CODES.ACTION_HEAL,
    TUTORIAL_KEY_CODES.ACTION_IDLE,
    TUTORIAL_KEY_CODES.GUIDE,
    TUTORIAL_KEY_CODES.PATH_BACK,
    TUTORIAL_KEY_CODES.RESTART,
    TUTORIAL_KEY_CODES.TARGET_NEXT,
    TUTORIAL_KEY_CODES.CANCEL
]);
