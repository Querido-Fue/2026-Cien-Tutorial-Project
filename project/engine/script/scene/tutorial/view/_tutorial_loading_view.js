import {
    createCenteredTutorialRect,
    createTutorialTextAnchor,
    drawTutorialText,
    getTutorialUiCenterX,
    toTutorialUiHeight
} from './_tutorial_nonbattle_view_helpers.js';

/** @param {*} value @returns {number} 0과 1 사이의 진행률입니다. */
function clampProgressRatio(value) {
    const number = Number(value);
    return Number.isFinite(number)
        ? Math.max(0, Math.min(1, number))
        : 0;
}

/**
 * @class TutorialLoadingView
 * @description 메타·에셋 진행률과 픽셀 로딩 바를 UI 레이어에 렌더합니다.
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
     * @returns {{contentRects:object[],buttons:object[],messageAnchor:object,bar:object,percentAnchor:object}} 레이아웃입니다.
     */
    getLayout(viewModel) {
        const { viewport } = viewModel;
        const centerX = getTutorialUiCenterX(viewport);
        const messageAnchor = createTutorialTextAnchor(
            centerX,
            toTutorialUiHeight(viewport, 45)
        );
        const bar = createCenteredTutorialRect(viewport, 38, 2.8, 51);
        const percentAnchor = createTutorialTextAnchor(
            centerX,
            bar.y + bar.h + toTutorialUiHeight(viewport, 3.2)
        );
        return {
            contentRects: [messageAnchor, bar, percentAnchor],
            buttons: [],
            messageAnchor,
            bar,
            percentAnchor
        };
    }

    /**
     * 로딩 문구를 그립니다.
     * @param {object} viewModel - 읽기 전용 로딩 상태입니다.
     */
    draw(viewModel) {
        const layout = this.getLayout(viewModel);
        const ratio = clampProgressRatio(viewModel.progressRatio);
        const percent = Math.round(ratio * 100);
        const border = Math.max(2, Math.round(Math.min(
            viewModel.viewport.UIWW,
            viewModel.viewport.WH
        ) * 0.003));
        const bar = {
            x: Math.round(layout.bar.x),
            y: Math.round(layout.bar.y),
            w: Math.max(1, Math.round(layout.bar.w)),
            h: Math.max((border * 2) + 1, Math.round(layout.bar.h))
        };
        const track = {
            x: bar.x + border,
            y: bar.y + border,
            w: Math.max(1, bar.w - (border * 2)),
            h: Math.max(1, bar.h - (border * 2))
        };
        const fillWidth = ratio > 0
            ? Math.max(1, Math.round(track.w * ratio))
            : 0;

        this.#renderPort.render('ui', {
            shape: 'rect',
            x: bar.x + border,
            y: bar.y + border,
            w: bar.w,
            h: bar.h,
            fill: viewModel.colors.UI.ButtonShadow || 'rgba(0, 0, 0, 0.38)'
        });
        this.#renderPort.render('ui', {
            shape: 'rect',
            ...bar,
            fill: viewModel.colors.UI.Muted
        });
        this.#renderPort.render('ui', {
            shape: 'rect',
            ...track,
            fill: viewModel.colors.UI.PanelStrong
        });
        if (fillWidth > 0) {
            this.#renderPort.render('ui', {
                shape: 'rect',
                x: track.x,
                y: track.y,
                w: fillWidth,
                h: track.h,
                fill: viewModel.colors.UI.Accent
            });
            this.#renderPort.render('ui', {
                shape: 'rect',
                x: track.x,
                y: track.y,
                w: fillWidth,
                h: Math.max(1, Math.round(track.h * 0.24)),
                fill: viewModel.colors.UI.Text,
                alpha: 0.34
            });
        }
        drawTutorialText(this.#renderPort, {
            text: viewModel.message,
            x: layout.messageAnchor.x,
            y: layout.messageAnchor.y,
            font: viewModel.fonts.HEADING,
            fill: viewModel.colors.UI.Text,
            align: 'center'
        });
        drawTutorialText(this.#renderPort, {
            text: `${Number.isFinite(Number(viewModel.progressPercent))
                ? Math.max(0, Math.min(100, Math.round(Number(viewModel.progressPercent))))
                : percent}%`,
            x: layout.percentAnchor.x,
            y: layout.percentAnchor.y,
            font: viewModel.fonts.SMALL,
            fill: viewModel.colors.UI.Text,
            align: 'center'
        });
    }

    /** @returns {object[]} 로딩 화면에는 버튼이 없습니다. */
    getButtonSpecs() {
        return [];
    }
}
