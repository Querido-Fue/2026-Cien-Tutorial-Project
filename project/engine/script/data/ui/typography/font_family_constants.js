/** 게임 화면에서 사용하는 PF 스타더스트 CSS 패밀리 이름입니다. */
export const PRIMARY_GAME_FONT_FAMILY = 'PFStardust';

/** 정보 중요도에 따라 사용하는 PF 스타더스트 원본 굵기입니다. */
export const GAME_FONT_WEIGHTS = Object.freeze({
    BODY: 400,
    EMPHASIS: 700,
    DISPLAY: 800
});

/** 폰트 로드 실패 시 시스템 산세리프를 사용하는 기본 폰트 스택입니다. */
export const PRIMARY_GAME_FONT_STACK = `${PRIMARY_GAME_FONT_FAMILY}, sans-serif`;
