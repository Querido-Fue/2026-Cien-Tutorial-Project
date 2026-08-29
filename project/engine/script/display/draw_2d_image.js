/**
 * 이미지 명령의 선택적 다각형 클리핑 경로를 적용합니다.
 * @param {CanvasRenderingContext2D} context - 대상 컨텍스트입니다.
 * @param {number[]|null|undefined} vertices - 절대 좌표의 평면 꼭짓점 배열입니다.
 * @returns {boolean} 유효한 경로를 적용했는지 여부입니다.
 */
function applyImageClipVertices(context, vertices) {
    if (!Array.isArray(vertices)
        || vertices.length < 6
        || vertices.length % 2 !== 0
        || vertices.some((value) => !Number.isFinite(Number(value)))) {
        return false;
    }
    context.beginPath();
    context.moveTo(Number(vertices[0]), Number(vertices[1]));
    for (let index = 2; index < vertices.length; index += 2) {
        context.lineTo(Number(vertices[index]), Number(vertices[index + 1]));
    }
    context.closePath();
    context.clip();
    return true;
}

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
    const drawClipped = () => {
        if (!Array.isArray(options.clipVertices)) {
            draw();
            return;
        }
        context.save();
        try {
            if (!applyImageClipVertices(context, options.clipVertices)) {
                draw();
                return;
            }
            draw();
        } finally {
            context.restore();
        }
    };
    if (options.smoothing === undefined) {
        drawClipped();
        return;
    }
    context.imageSmoothingEnabled = options.smoothing !== false;
    try {
        drawClipped();
    } finally {
        context.imageSmoothingEnabled = previousSmoothing;
    }
}
