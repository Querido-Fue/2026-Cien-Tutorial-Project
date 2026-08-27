/**
 * 2D 이미지 한 장을 선택적 nearest-neighbor 상태로 렌더링하고 컨텍스트 상태를 복원합니다.
 * @param {CanvasRenderingContext2D} context - 대상 컨텍스트입니다.
 * @param {object} options - 이미지와 대상 사각형입니다.
 */
export function renderDrawImage(context, options) {
    const previousSmoothing = context.imageSmoothingEnabled;
    if (options.smoothing === undefined) {
        context.drawImage(options.image, options.x, options.y, options.w, options.h);
        return;
    }
    context.imageSmoothingEnabled = options.smoothing !== false;
    try {
        context.drawImage(options.image, options.x, options.y, options.w, options.h);
    } finally {
        context.imageSmoothingEnabled = previousSmoothing;
    }
}
