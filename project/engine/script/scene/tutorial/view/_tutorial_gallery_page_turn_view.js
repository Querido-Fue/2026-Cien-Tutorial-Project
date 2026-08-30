/**
 * @class TutorialGalleryPageTurnView
 * @description 이전·다음 콘텐츠 래스터 콜백, 양면 페이지 영역과 PNG 폴백을 조립합니다.
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
     * WebGL을 사용할 수 없을 때 그릴 내용과 책 프레임을 선택합니다.
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
     * 이전·다음 책 전체를 래스터화하고 내용이 붙은 양면 페이지를 그립니다.
     * @param {object} viewModel - 페이지 전환 상태를 포함한 뷰 모델입니다.
     * @param {object} layout - 최종 갤러리 책 레이아웃입니다.
     * @param {Function} drawSpread - 주어진 뷰 모델을 오프스크린 렌더 포트에 그립니다.
     * @returns {boolean} 책·내용을 WebGL로 모두 그렸는지 여부입니다.
     */
    draw(viewModel, layout, drawSpread) {
        const turn = viewModel?.pageTurn;
        const progress = Math.max(0, Math.min(1, Number(turn?.progress) || 0));
        if (turn?.active !== true
            || turn.webglAvailable !== true
            || viewModel.recordPopup === true
            || !turn.previousGallery
            || typeof drawSpread !== 'function') {
            return false;
        }
        const direction = Number(turn.direction) < 0 ? -1 : 1;
        const spineX = (layout.leftPage.x + layout.leftPage.w + layout.rightPage.x) * 0.5;
        const pageTop = Math.min(
            layout.leftPage.y,
            layout.rightPage.y,
            layout.achievementRibbon?.y ?? Infinity
        );
        const pageBottom = Math.max(
            layout.leftPage.y + layout.leftPage.h,
            layout.rightPage.y + layout.rightPage.h
        );
        const left = {
            x: layout.leftPage.x,
            y: pageTop,
            w: spineX - layout.leftPage.x,
            h: pageBottom - pageTop
        };
        const right = {
            x: spineX,
            y: pageTop,
            w: layout.rightPage.x + layout.rightPage.w - spineX,
            h: pageBottom - pageTop
        };
        const previous = Object.freeze({ ...viewModel, ...turn.previousGallery, pageTurn: null });
        const next = Object.freeze({ ...viewModel, pageTurn: null });
        return this.#effectPort.renderPageTurn?.({
            shape: this.#config.EFFECT_TYPE || 'pageTurn',
            pageRect: direction > 0 ? right : left,
            backPageRect: direction > 0 ? left : right,
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
        }, {
            viewport: viewModel.viewport,
            previous: (renderPort) => drawSpread(previous, renderPort),
            next: (renderPort) => drawSpread(next, renderPort)
        }) === true;
    }
}
