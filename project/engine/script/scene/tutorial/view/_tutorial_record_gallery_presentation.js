/** @param {number} value @returns {number} 0~1 범위 값입니다. */
function clampProgress(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

/**
 * 책 중심을 유지하면서 사각형을 정수 픽셀 단위로 확대·축소합니다.
 * @param {object} rect - 변환할 사각형입니다.
 * @param {{x:number,y:number}} center - 책 중심점입니다.
 * @param {number} scale - 현재 확대 배율입니다.
 * @returns {object} 변환된 사각형입니다.
 */
function scaleRect(rect, center, scale) {
    const width = Math.max(0, Math.round(Number(rect.w) * scale));
    const height = Math.max(0, Math.round(Number(rect.h) * scale));
    const rectCenterX = Number(rect.x) + (Number(rect.w) * 0.5);
    const rectCenterY = Number(rect.y) + (Number(rect.h) * 0.5);
    return {
        ...rect,
        x: Math.round(center.x + ((rectCenterX - center.x) * scale) - (width * 0.5)),
        y: Math.round(center.y + ((rectCenterY - center.y) * scale) - (height * 0.5)),
        w: width,
        h: height
    };
}

/** @param {*} value @param {object} center @param {number} scale @returns {*} */
function scaleLayoutValue(value, center, scale) {
    if (Array.isArray(value)) {
        return value.map((child) => scaleLayoutValue(child, center, scale));
    }
    if (!value || typeof value !== 'object') {
        return value;
    }
    const isRect = ['x', 'y', 'w', 'h'].every(
        (key) => Number.isFinite(Number(value[key]))
    );
    if (isRect) {
        return scaleRect(value, center, scale);
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => (
        [key, scaleLayoutValue(child, center, scale)]
    )));
}

/**
 * 지정 레이어와 알파를 모든 갤러리 렌더 명령에 일관되게 적용합니다.
 * @param {object} renderPort - 원본 렌더 포트입니다.
 * @param {string} targetLayer - 실제 출력 레이어입니다.
 * @param {number} alpha - 공통 투명도입니다.
 * @returns {object} 갤러리 전용 렌더 포트입니다.
 */
function createLayerRenderPort(renderPort, targetLayer, alpha) {
    const applyAlpha = (command = {}) => ({
        ...command,
        alpha: (command.alpha ?? 1) * alpha
    });
    return Object.freeze({
        render(_layer, command) {
            renderPort.render?.(targetLayer, applyAlpha(command));
        },
        renderGL(layer, command) {
            if (targetLayer !== 'top') {
                renderPort.renderGL?.(layer, applyAlpha(command));
                return;
            }
            const next = applyAlpha(command);
            if (next.shape === 'rect') {
                renderPort.render?.('top', {
                    ...next,
                    x: next.x - (next.w * 0.5),
                    y: next.y - (next.h * 0.5)
                });
            }
        },
        measureText: (...args) => renderPort.measureText?.(...args),
        wrapText: (...args) => renderPort.wrapText?.(...args) || []
    });
}

/**
 * 일반 갤러리와 전투 기록 팝업이 공유할 책 레이아웃·레이어·알파를 만듭니다.
 * @param {object} viewModel - 갤러리 표시 모델입니다.
 * @param {object} layout - 최종 크기의 갤러리 레이아웃입니다.
 * @param {object} renderPort - 원본 렌더 포트입니다.
 * @returns {Readonly<object>} 프레임·본문 렌더 표현입니다.
 */
export function createTutorialRecordGalleryPresentation(
    viewModel,
    layout,
    renderPort
) {
    const isRecordPopup = viewModel.recordPopup === true;
    const snapshot = viewModel.recordPresentation;
    const hasSnapshot = isRecordPopup && snapshot && typeof snapshot === 'object';
    const progress = hasSnapshot ? clampProgress(snapshot.progress) : 1;
    const scale = hasSnapshot
        ? Math.max(0.1, Math.min(1, Number(snapshot.scale) || 1))
        : 1;
    const frameAlpha = isRecordPopup ? progress : 1;
    const requestedContentAlpha = Number(snapshot?.contentAlpha);
    const contentAlpha = isRecordPopup
        ? (Number.isFinite(requestedContentAlpha)
            ? clampProgress(requestedContentAlpha)
            : progress)
        : 1;
    const center = {
        x: layout.book.x + (layout.book.w * 0.5),
        y: layout.book.y + (layout.book.h * 0.5)
    };
    const drawLayout = isRecordPopup && scale < 1
        ? scaleLayoutValue(layout, center, scale)
        : layout;
    const targetLayer = isRecordPopup ? 'top' : 'ui';
    return Object.freeze({
        layout: drawLayout,
        framePort: createLayerRenderPort(renderPort, targetLayer, frameAlpha),
        contentPort: createLayerRenderPort(renderPort, targetLayer, contentAlpha),
        pageProgress: hasSnapshot
            ? clampProgress(snapshot.pageProgress)
            : clampProgress(viewModel.selectionProgress),
        targetLayer,
        buttonAlpha: contentAlpha,
        interactive: !isRecordPopup || snapshot?.interactive === true
    });
}
