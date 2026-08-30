/**
 * @class TutorialGalleryPageTurnView
 * @description 이전 페이지 내용 교체 시점, PNG 폴백과 WebGL 컬 명령을 조립합니다.
 */
export class TutorialGalleryPageTurnView {
    #effectPort;
    #config;

    /** @param {object} effectPort - 페이지 전환 렌더 포트입니다. @param {object} config - 정적 표현 설정입니다. */
    constructor(effectPort = {}, config = {}) {
        this.#effectPort = effectPort;
        this.#config = config;
    }

    /**
     * 현재 전환 시점에 그릴 내용과 책 프레임을 선택합니다.
     * @param {object} viewModel - 현재 갤러리 뷰 모델입니다.
     * @returns {Readonly<object>} 내용 모델·프레임·뒤집기 정보입니다.
     */
    createPresentation(viewModel) {
        const turn = viewModel?.pageTurn;
        if (turn?.active !== true) {
            return Object.freeze({
                contentViewModel: viewModel,
                frameKey: null,
                flipBookFrame: false
            });
        }
        const progress = Math.max(0, Math.min(1, Number(turn.progress) || 0));
        const usePrevious = progress < Number(this.#config.CONTENT_SWAP_PROGRESS)
            && turn.previousGallery;
        const contentViewModel = usePrevious
            ? Object.freeze({ ...viewModel, ...turn.previousGallery })
            : viewModel;
        if (turn.webglAvailable === true) {
            return Object.freeze({
                contentViewModel,
                frameKey: 'endingBook1',
                flipBookFrame: false
            });
        }
        const keys = this.#config.FALLBACK_FRAME_KEYS || ['endingBook1'];
        const frameIndex = Math.min(
            keys.length - 1,
            Math.floor(progress * keys.length)
        );
        return Object.freeze({
            contentViewModel,
            frameKey: keys[frameIndex] || 'endingBook1',
            flipBookFrame: Number(turn.direction) < 0
        });
    }

    /**
     * 책의 출발 페이지를 실제 이전 UI 텍스처로 휘어 그립니다.
     * @param {object} viewModel - 페이지 전환 상태를 포함한 뷰 모델입니다.
     * @param {object} layout - 최종 갤러리 책 레이아웃입니다.
     */
    draw(viewModel, layout) {
        const turn = viewModel?.pageTurn;
        const progress = Math.max(0, Math.min(1, Number(turn?.progress) || 0));
        if (turn?.active !== true
            || turn.webglAvailable !== true
            || progress <= 0
            || progress >= 1) {
            return;
        }
        const direction = Number(turn.direction) < 0 ? -1 : 1;
        this.#effectPort.renderPageTurn?.({
            shape: this.#config.EFFECT_TYPE || 'pageTurn',
            pageRect: direction > 0 ? layout.rightPage : layout.leftPage,
            progress,
            direction,
            curlStrength: this.#config.CURL_STRENGTH,
            depthRatio: this.#config.DEPTH_RATIO,
            perspectiveRatio: this.#config.PERSPECTIVE_RATIO,
            shadowAlpha: this.#config.SHADOW_ALPHA,
            backColor: this.#config.MATERIAL?.BACK_COLOR,
            edgeColor: this.#config.MATERIAL?.EDGE_COLOR,
            shadowColor: this.#config.MATERIAL?.SHADOW_COLOR,
            alpha: 1
        });
    }
}
