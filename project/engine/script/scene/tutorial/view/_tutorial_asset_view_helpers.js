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
 * UI PNG를 비율 유지·정수 좌표·nearest-neighbor 옵션으로 그립니다.
 * @param {object} renderPort - render 함수를 가진 포트입니다.
 * @param {object} options - 이미지와 레이어·대상 영역입니다.
 * @returns {boolean} 그리기 명령 생성 여부입니다.
 */
export function drawTutorialPixelAsset(renderPort, options) {
    const target = fitTutorialAssetRect(options?.image, options?.rect);
    if (!target || typeof renderPort?.render !== 'function') {
        return false;
    }
    renderPort.render(options.layer || 'ui', {
        shape: 'image',
        image: options.image,
        ...target,
        alpha: options.alpha ?? 1,
        smoothing: false
    });
    return true;
}
