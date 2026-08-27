import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import {
    createCenteredTutorialRect,
    createTutorialTextAnchor,
    drawTutorialText,
    toTutorialUiHeight,
    toTutorialUiWidth,
    wrapTutorialText
} from './_tutorial_nonbattle_view_helpers.js';

/**
 * @class TutorialCutsceneView
 * @description 고정 컷씬 카드 모달의 표시와 진행 버튼 사양을 제공합니다.
 */
export class TutorialCutsceneView {
    #renderPort;

    /** @param {object} renderPort - 주입된 렌더 의존성입니다. */
    constructor(renderPort) {
        this.#renderPort = renderPort;
    }

    /**
     * 컷씬 모달의 순수 레이아웃을 계산합니다.
     * @param {object} viewModel - 컷씬 뷰 모델입니다.
     * @returns {object} 모달·텍스트·버튼 레이아웃입니다.
     */
    getLayout(viewModel) {
        const { viewport } = viewModel;
        const modal = createCenteredTutorialRect(viewport, 52, 48);
        const buttonH = toTutorialUiHeight(viewport, 5);
        const buttonY = modal.y + modal.h - buttonH - toTutorialUiHeight(viewport, 2.2);
        return {
            modal,
            contentRects: [
                modal,
                createTutorialTextAnchor(
                    modal.x + (modal.w * 0.5),
                    modal.y + toTutorialUiHeight(viewport, 5)
                )
            ],
            buttons: [
                {
                    x: modal.x + (modal.w * 0.61),
                    y: buttonY,
                    w: modal.w * 0.27,
                    h: buttonH
                },
                {
                    x: modal.x + (modal.w * 0.12),
                    y: buttonY,
                    w: modal.w * 0.2,
                    h: buttonH
                }
            ]
        };
    }

    /**
     * 현재 컷씬 카드를 모달로 그립니다.
     * @param {object} viewModel - 읽기 전용 컷씬 상태입니다.
     */
    draw(viewModel) {
        const layout = this.getLayout(viewModel);
        const { viewport, colors, fonts, state, card } = viewModel;
        this.#renderPort.render('ui', {
            shape: 'rect',
            x: 0,
            y: 0,
            w: viewport.WW,
            h: viewport.WH,
            fill: colors.UI.OverlayDim,
            alpha: 0.78
        });
        this.#renderPort.render('ui', {
            shape: 'roundRect',
            x: layout.modal.x,
            y: layout.modal.y,
            w: layout.modal.w,
            h: layout.modal.h,
            radius: toTutorialUiHeight(viewport, 1.5),
            fill: colors.UI.PanelStrong,
            alpha: 0.99
        });
        drawTutorialText(this.#renderPort, {
            text: state.title,
            x: layout.modal.x + (layout.modal.w * 0.5),
            y: layout.modal.y + toTutorialUiHeight(viewport, 5),
            font: fonts.HEADING,
            fill: colors.UI.Text,
            align: 'center'
        });
        drawTutorialText(this.#renderPort, {
            text: String(state.cardIndex + 1) + ' / ' + String(state.cardCount),
            x: layout.modal.x + layout.modal.w - toTutorialUiWidth(viewport, 2),
            y: layout.modal.y + toTutorialUiHeight(viewport, 5),
            font: fonts.MONO,
            fill: colors.UI.Muted,
            align: 'right'
        });
        drawTutorialText(this.#renderPort, {
            text: card.speaker || '',
            x: layout.modal.x + toTutorialUiWidth(viewport, 4),
            y: layout.modal.y + toTutorialUiHeight(viewport, 11),
            font: fonts.BODY,
            fill: colors.UI.Accent
        });
        const lines = wrapTutorialText(
            this.#renderPort,
            card.text || '',
            fonts.BODY,
            layout.modal.w - toTutorialUiWidth(viewport, 8),
            5
        );
        lines.forEach((line, index) => {
            drawTutorialText(this.#renderPort, {
                text: line,
                x: layout.modal.x + toTutorialUiWidth(viewport, 4),
                y: layout.modal.y + toTutorialUiHeight(viewport, 17)
                    + (index * toTutorialUiHeight(viewport, 3.8)),
                font: fonts.BODY,
                fill: colors.UI.Text
            });
        });
    }

    /**
     * 컷씬 진행과 닫기 명령 버튼 사양을 반환합니다.
     * @param {object} viewModel - 컷씬 뷰 모델입니다.
     * @returns {object[]} 직렬화 가능한 버튼 사양입니다.
     */
    getButtonSpecs(viewModel) {
        const layout = this.getLayout(viewModel);
        return [
            {
                key: 'cutscene-next',
                ...layout.buttons[0],
                label: viewModel.state.hasNextCard
                    ? '다음  [Enter]'
                    : '완료  [Enter]',
                enabled: !viewModel.presentationLocked,
                command: { type: TUTORIAL_COMMANDS.CUTSCENE_NEXT }
            },
            {
                key: 'cutscene-close',
                ...layout.buttons[1],
                label: '스킵  [Esc]',
                enabled: !viewModel.presentationLocked,
                command: { type: TUTORIAL_COMMANDS.CUTSCENE_CLOSE }
            }
        ];
    }
}
