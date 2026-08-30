/** @param {object} image @returns {{width:number,height:number}|null} 이미지 크기입니다. */
export function getTutorialAssetDimensions(image) {
    const width = Number(image?.naturalWidth || image?.width);
    const height = Number(image?.naturalHeight || image?.height);
    return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * 이미지를 왜곡하지 않고 대상 사각형 안에 정수 좌표로 맞춥니다.
 * @param {object} image - CanvasImageSource입니다.
 * @param {{x:number,y:number,w:number,h:number}} container - 대상 영역입니다.
 * @returns {{x:number,y:number,w:number,h:number}|null} 픽셀 정렬된 사각형입니다.
 */
export function fitTutorialAssetRect(image, container) {
    const dimensions = getTutorialAssetDimensions(image);
    const containerW = Number(container?.w);
    const containerH = Number(container?.h);
    if (!dimensions || !(containerW > 0) || !(containerH > 0)) {
        return null;
    }
    const scale = Math.min(
        containerW / dimensions.width,
        containerH / dimensions.height
    );
    const width = Math.max(1, Math.round(dimensions.width * scale));
    const height = Math.max(1, Math.round(dimensions.height * scale));
    return Object.freeze({
        x: Math.round(Number(container.x) + ((containerW - width) * 0.5)),
        y: Math.round(Number(container.y) + ((containerH - height) * 0.5)),
        w: width,
        h: height
    });
}

/**
 * 지정 렌더 모드로 픽셀 에셋 대상 사각형을 계산합니다.
 * exact는 화면별 layout builder가 이미 원본 비율을 보장할 때만 사용합니다.
 * @param {object} image - CanvasImageSource입니다.
 * @param {{x:number,y:number,w:number,h:number}} container - 대상 영역입니다.
 * @param {'contain'|'exact'} [mode='contain'] - 렌더 모드입니다.
 * @returns {{x:number,y:number,w:number,h:number}|null} 정수 대상 사각형입니다.
 */
export function resolveTutorialAssetRect(image, container, mode = 'contain') {
    if (mode === 'exact') {
        const dimensions = getTutorialAssetDimensions(image);
        const width = Number(container?.w);
        const height = Number(container?.h);
        if (!dimensions || !(width > 0) || !(height > 0)) {
            return null;
        }
        return Object.freeze({
            x: Math.round(Number(container.x)),
            y: Math.round(Number(container.y)),
            w: Math.max(1, Math.round(width)),
            h: Math.max(1, Math.round(height))
        });
    }
    return fitTutorialAssetRect(image, container);
}

/**
 * UI PNG를 비율 유지·정수 좌표·nearest-neighbor 옵션으로 그립니다.
 * @param {object} renderPort - render 함수를 가진 포트입니다.
 * @param {object} options - 이미지와 레이어·대상 영역입니다.
 * @returns {boolean} 그리기 명령 생성 여부입니다.
 */
export function drawTutorialPixelAsset(renderPort, options) {
    const target = resolveTutorialAssetRect(
        options?.image,
        options?.rect,
        options?.mode || 'contain'
    );
    if (!target || typeof renderPort?.render !== 'function') {
        return false;
    }
    renderPort.render(options.layer || 'ui', {
        shape: 'image',
        image: options.image,
        ...target,
        alpha: options.alpha ?? 1,
        smoothing: false,
        flipX: options.flipX === true,
        flipY: options.flipY === true
    });
    return true;
}
