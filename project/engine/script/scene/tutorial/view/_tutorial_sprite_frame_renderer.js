/** @param {*} value @returns {number} 유한 숫자 또는 0입니다. */
function toFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

/**
 * @class TutorialSpriteFrameRenderer
 * @description 스프라이트 이미지 조회와 레이어별 정수 위치·nearest 렌더만 담당합니다.
 */
export class TutorialSpriteFrameRenderer {
    #renderPort;
    #assetPort;

    /** @param {object} renderPort - WebGL 렌더 포트입니다. @param {object} assetPort - 이미지 조회 포트입니다. */
    constructor(renderPort, assetPort) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
    }

    /**
     * 몸·머리 같은 한 프레임의 레이어를 미세 위치 보정과 함께 합성합니다.
     * @param {object} options - 애니메이션, 대상 사각형과 알파입니다.
     * @returns {boolean} 실제 이미지 명령을 만들었는지 여부입니다.
     */
    draw({ animation, geometry, alpha = 1, effectAlpha = 1 } = {}) {
        if (!animation?.assetId
            || !geometry
            || !Array.isArray(animation.layers)
            || animation.layers.length === 0) {
            return false;
        }
        const image = this.#assetPort.getImage?.(animation.assetId) || null;
        if (!image) {
            return false;
        }
        const flipX = animation.flipX === true;
        for (const sourceRect of animation.layers) {
            const offsetX = toFiniteNumber(sourceRect.offsetXRatio)
                * geometry.width
                * (flipX ? -1 : 1);
            const offsetY = toFiniteNumber(sourceRect.offsetYRatio)
                * geometry.height;
            this.#renderPort.renderGL('object', {
                image,
                sourceRect,
                flipX,
                x: Math.round(geometry.x + offsetX),
                y: Math.round(geometry.y + offsetY),
                w: Math.round(geometry.width),
                h: Math.round(geometry.height),
                alpha: toFiniteNumber(alpha) * toFiniteNumber(effectAlpha),
                smoothing: false
            });
        }
        return true;
    }
}
