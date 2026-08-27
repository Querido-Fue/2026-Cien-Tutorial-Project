/** @param {*} value @param {number} fallback @returns {number} 유한 숫자입니다. */
function finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

/**
 * 전체 이미지 또는 안전한 sourceRect를 WebGL UV 좌표로 변환합니다.
 * @param {CanvasImageSource} image - 텍스처 원본입니다.
 * @param {object|null} sourceRect - 픽셀 단위 크롭 영역입니다.
 * @param {{flipX?:boolean,flipY?:boolean}} options - 축 반전입니다.
 * @returns {{u0:number,v0:number,u1:number,v1:number}} 정규화된 UV입니다.
 */
export function resolveImageTextureCoordinates(image, sourceRect, options = {}) {
    const imageWidth = finite(image?.naturalWidth || image?.videoWidth || image?.width, 0);
    const imageHeight = finite(image?.naturalHeight || image?.videoHeight || image?.height, 0);
    let u0 = 0;
    let v0 = 0;
    let u1 = 1;
    let v1 = 1;
    if (sourceRect && imageWidth > 0 && imageHeight > 0) {
        const x = finite(sourceRect.x, 0);
        const y = finite(sourceRect.y, 0);
        const width = finite(sourceRect.w, 0);
        const height = finite(sourceRect.h, 0);
        if (x >= 0 && y >= 0 && width > 0 && height > 0
            && x + width <= imageWidth && y + height <= imageHeight) {
            u0 = x / imageWidth;
            v0 = y / imageHeight;
            u1 = (x + width) / imageWidth;
            v1 = (y + height) / imageHeight;
        }
    }
    if (options.flipX === true) {
        [u0, u1] = [u1, u0];
    }
    if (options.flipY === true) {
        [v0, v1] = [v1, v0];
    }
    return { u0, v0, u1, v1 };
}
