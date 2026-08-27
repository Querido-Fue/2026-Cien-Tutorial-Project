import {
    createTutorialTextAnchor,
    drawTutorialText,
    getTutorialUiCenterX
} from './_tutorial_nonbattle_view_helpers.js';

/**
 * @class TutorialLoadingView
 * @description 메타 진행도 로딩 화면만 렌더합니다.
 */
export class TutorialLoadingView {
    #renderPort;

    /**
     * @param {{render:Function,renderGL:Function,wrapText:Function}} renderPort - 렌더 의존성입니다.
     */
    constructor(renderPort) {
        this.#renderPort = renderPort;
    }

    /**
     * 로딩 화면의 순수 레이아웃을 계산합니다.
     * @param {object} viewModel - 로딩 뷰 모델입니다.
     * @returns {{contentRects:object[],buttons:object[]}} 레이아웃입니다.
     */
    getLayout(viewModel) {
        const { viewport } = viewModel;
        return {
            contentRects: [createTutorialTextAnchor(
                getTutorialUiCenterX(viewport),
                viewport.WH * 0.5
            )],
            buttons: []
        };
    }

    /**
     * 로딩 문구를 그립니다.
     * @param {object} viewModel - 읽기 전용 로딩 상태입니다.
     */
    draw(viewModel) {
        const anchor = this.getLayout(viewModel).contentRects[0];
        drawTutorialText(this.#renderPort, {
            text: viewModel.message,
            x: anchor.x,
            y: anchor.y,
            font: viewModel.fonts.HEADING,
            fill: viewModel.colors.UI.Text,
            align: 'center'
        });
    }

    /** @returns {object[]} 로딩 화면에는 버튼이 없습니다. */
    getButtonSpecs() {
        return [];
    }
}
