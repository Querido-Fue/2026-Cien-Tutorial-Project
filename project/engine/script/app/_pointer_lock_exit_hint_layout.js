const toFiniteNumber = (value, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);

const clamp = (value, minimum, maximum) => (
    Math.min(maximum, Math.max(minimum, value))
);

/**
 * 포인터 안내 팝업의 전체 상자가 뷰포트 안전 영역 안에 남도록 배치합니다.
 * @param {object} options - 뷰포트, 팝업, 포인터 정보입니다.
 * @returns {{left:number,top:number}} 잘린 좌상단 CSS 좌표입니다.
 */
export function resolvePointerLockExitHintPosition(options = {}) {
    const viewportWidth = Math.max(1, toFiniteNumber(options.viewportWidth, 1));
    const viewportHeight = Math.max(1, toFiniteNumber(options.viewportHeight, 1));
    const inset = Math.max(0, toFiniteNumber(options.inset, 0));
    const horizontalInset = Math.min(inset, viewportWidth / 2);
    const verticalInset = Math.min(inset, viewportHeight / 2);
    const popupWidth = clamp(
        Math.max(0, toFiniteNumber(options.popupWidth, 0)),
        0,
        Math.max(0, viewportWidth - (horizontalInset * 2))
    );
    const popupHeight = clamp(
        Math.max(0, toFiniteNumber(options.popupHeight, 0)),
        0,
        Math.max(0, viewportHeight - (verticalInset * 2))
    );
    const pointerX = clamp(toFiniteNumber(options.pointerX, 0), 0, viewportWidth);
    const pointerY = clamp(toFiniteNumber(options.pointerY, 0), 0, viewportHeight);
    const cursorOffset = Math.max(0, toFiniteNumber(options.cursorOffset, 0));
    let left = pointerX - (popupWidth / 2);
    let top = pointerY - (popupHeight / 2);

    if (options.edge === 'left') {
        left = pointerX + cursorOffset;
    } else if (options.edge === 'right') {
        left = pointerX - popupWidth - cursorOffset;
    } else if (options.edge === 'top') {
        top = pointerY + cursorOffset;
    } else if (options.edge === 'bottom') {
        top = pointerY - popupHeight - cursorOffset;
    }

    return Object.freeze({
        left: clamp(
            left,
            horizontalInset,
            Math.max(horizontalInset, viewportWidth - popupWidth - horizontalInset)
        ),
        top: clamp(
            top,
            verticalInset,
            Math.max(verticalInset, viewportHeight - popupHeight - verticalInset)
        )
    });
}
