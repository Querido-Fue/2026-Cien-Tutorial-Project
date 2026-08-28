const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;

/**
 * Figma 참조와 런타임이 공유하는 16:9 디자인 좌표계를 만듭니다.
 * UIWW 바깥의 울트라와이드 거터와 세로 여백은 안전 영역에 포함하지 않습니다.
 * @param {{UIWW:number,UIOffsetX:number,WH:number}} viewport - 직렬화 가능한 뷰포트입니다.
 * @returns {Readonly<{x:number,y:number,w:number,h:number,scale:number,designWidth:number,designHeight:number}>}
 */
export function createTutorialDesignSpace(viewport) {
    const uiWidth = Math.max(0, Number(viewport?.UIWW) || 0);
    const viewportHeight = Math.max(0, Number(viewport?.WH) || 0);
    const scale = Math.max(0, Math.min(
        uiWidth / DESIGN_WIDTH,
        viewportHeight / DESIGN_HEIGHT
    ));
    const width = Math.round(DESIGN_WIDTH * scale);
    const height = Math.round(DESIGN_HEIGHT * scale);
    return Object.freeze({
        x: Math.round((Number(viewport?.UIOffsetX) || 0) + ((uiWidth - width) * 0.5)),
        y: Math.round((viewportHeight - height) * 0.5),
        w: width,
        h: height,
        scale,
        designWidth: DESIGN_WIDTH,
        designHeight: DESIGN_HEIGHT
    });
}

/**
 * 정규화된 Figma 관찰 좌표를 디자인 안전 영역의 정수 픽셀 사각형으로 변환합니다.
 * @param {ReturnType<typeof createTutorialDesignSpace>} space - 디자인 안전 영역입니다.
 * @param {{x:number,y:number,w:number,h:number}} normalizedRect - 0..1 정규화 사각형입니다.
 * @returns {Readonly<{x:number,y:number,w:number,h:number}>}
 */
export function projectTutorialDesignRect(space, normalizedRect) {
    return Object.freeze({
        x: Math.round(space.x + (space.w * Number(normalizedRect?.x || 0))),
        y: Math.round(space.y + (space.h * Number(normalizedRect?.y || 0))),
        w: Math.max(0, Math.round(space.w * Number(normalizedRect?.w || 0))),
        h: Math.max(0, Math.round(space.h * Number(normalizedRect?.h || 0)))
    });
}

/** @param {ReturnType<typeof createTutorialDesignSpace>} space @param {number} value */
export function scaleTutorialDesignValue(space, value) {
    return Math.max(0, Math.round(Number(value || 0) * space.scale));
}

export const TUTORIAL_DESIGN_CANVAS = Object.freeze({
    WIDTH: DESIGN_WIDTH,
    HEIGHT: DESIGN_HEIGHT,
    ASPECT_RATIO: DESIGN_WIDTH / DESIGN_HEIGHT,
    MIN_SUPPORTED_HEIGHT: 720,
    PIXEL_ROUNDING: 'nearest-integer',
    IMAGE_SMOOTHING: false
});

