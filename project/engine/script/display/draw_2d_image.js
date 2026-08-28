/**
 * 2D 이미지 한 장을 선택적 nearest-neighbor 상태로 렌더링하고 컨텍스트 상태를 복원합니다.
 * @param {CanvasRenderingContext2D} context - 대상 컨텍스트입니다.
 * @param {object} options - 이미지와 대상 사각형입니다.
 */
export function renderDrawImage(context, options) {
    const previousSmoothing = context.imageSmoothingEnabled;
    const flipX = options.flipX === true;
    const flipY = options.flipY === true;
    const draw = () => {
        if (!flipX && !flipY) {
            context.drawImage(options.image, options.x, options.y, options.w, options.h);
            return;
        }
        context.save();
        try {
            context.translate(
                options.x + (flipX ? options.w : 0),
                options.y + (flipY ? options.h : 0)
            );
            context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
            context.drawImage(options.image, 0, 0, options.w, options.h);
        } finally {
            context.restore();
        }
    };
    if (options.smoothing === undefined) {
        draw();
        return;
    }
    context.imageSmoothingEnabled = options.smoothing !== false;
    try {
        draw();
    } finally {
        context.imageSmoothingEnabled = previousSmoothing;
    }
}
