import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import {
    clampBattleViewNumber,
    drawBattleViewText,
    wrapBattleViewText
} from './_tutorial_battle_view_helpers.js';
import { drawTutorialPixelAsset } from './_tutorial_asset_view_helpers.js';
import {
    createTutorialDesignSpace,
    projectTutorialDesignRect
} from './_tutorial_design_space.js';
import { TUTORIAL_UI_LAYOUT_TOKENS } from './_tutorial_ui_layout_tokens.js';

/** @param {string} font @param {number} scale @returns {string} */
function scaleTutorialCalloutFont(font, scale) {
    return String(font).replace(
        /(\d+(?:\.\d+)?)px/,
        (_, size) => `${Number(size) * scale}px`
    );
}

/**
 * @class TutorialBattleTutorialView
 * @description 전투 안내 오버레이와 다시 열기 버튼 표시만 담당합니다.
 */
export class TutorialBattleTutorialView {
    #renderPort;
    #assetPort;

    /** @param {{render:Function,wrapText:Function}} renderPort - UI 렌더 포트입니다. @param {object} assetPort - 에셋 읽기 포트입니다. */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
    }

    /** @param {object} viewModel - 장면이 조립한 안내 표시 모델입니다. */
    draw(viewModel) {
        if (!viewModel?.open) {
            return;
        }
        const { colors, copy, fonts, viewport } = viewModel;
        const space = viewModel.layout?.designSpace
            || createTutorialDesignSpace(viewport);
        const rects = this.#getCalloutRects(space);
        this.#renderPort.render('ui', {
            shape: 'rect',
            x: space.x,
            y: space.y,
            w: space.w,
            h: space.h,
            fill: colors.UI.CardShadow,
            alpha: 0.38
        });
        rects.forEach((rect, index) => {
            const sentence = copy.sentences[index] || '';
            const pad = clampBattleViewNumber(rect.w * 0.17, 10, 28);
            const calloutFont = scaleTutorialCalloutFont(
                fonts.SMALL,
                index === 0 ? 0.86 : 0.68
            );
            const lineH = clampBattleViewNumber(rect.h * 0.16, 12, 19);
            const popupDrawn = drawTutorialPixelAsset(this.#renderPort, {
                layer: 'ui',
                image: this.#assetPort.getUiAsset?.('tutorialPopupFull'),
                rect,
                alpha: 1,
                mode: 'exact'
            });
            if (!popupDrawn) {
                this.#renderPort.render('ui', {
                    shape: 'roundRect',
                    x: rect.x,
                    y: rect.y,
                    w: rect.w,
                    h: rect.h,
                    radius: Math.max(5, space.scale * 6),
                    fill: colors.UI.Card,
                    stroke: colors.UI.Border,
                    lineWidth: 1
                });
            }
            const lines = wrapBattleViewText(
                this.#renderPort,
                sentence,
                calloutFont,
                rect.w - (pad * 2),
                index === 0 ? 6 : 5
            );
            const firstLineY = rect.y + (rect.h * 0.5)
                - (((lines.length - 1) * lineH) * 0.5);
            lines.forEach((line, lineIndex) => this.#drawText(
                line,
                rect.x + (rect.w * 0.5),
                firstLineY + (lineH * lineIndex),
                calloutFont,
                colors.UI.PanelStrong,
                'center'
            ));
        });
        const skipRect = projectTutorialDesignRect(
            space,
            TUTORIAL_UI_LAYOUT_TOKENS.TUTORIAL.SKIP
        );
        drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: this.#assetPort.getUiAsset?.('tutorialPopupFull'),
            rect: skipRect,
            alpha: 1,
            mode: 'exact'
        });
        this.#drawText(
            '건너뛰기 [Space]',
            skipRect.x + (skipRect.w * 0.5),
            skipRect.y + (skipRect.h * 0.5),
            scaleTutorialCalloutFont(fonts.SMALL, 0.82),
            colors.UI.PanelStrong || colors.UI.Text,
            'center'
        );
    }

    /**
     * 안내 열기 또는 닫기 버튼 사양을 만듭니다.
     * @param {object} viewModel - 안내 표시 모델입니다.
     * @returns {object[]} 버튼 사양입니다.
     */
    getButtonSpecs(viewModel) {
        if (!viewModel?.layout) {
            return [];
        }
        if (!viewModel.open) {
            return [];
        }
        const space = viewModel.layout.designSpace
            || createTutorialDesignSpace(viewModel.viewport);
        const rect = projectTutorialDesignRect(
            space,
            TUTORIAL_UI_LAYOUT_TOKENS.TUTORIAL.SKIP
        );
        return [{
            key: 'battle-guide-dismiss',
            ...rect,
            label: '',
            tooltip: 'Space로 건너뛰기',
            drawBackground: false,
            idleColor: viewModel.colors.UI.Primary,
            hoverColor: viewModel.colors.UI.PrimaryHover,
            textColor: viewModel.colors.UI.OnPrimary,
            command: { type: TUTORIAL_COMMANDS.GUIDE_DISMISS }
        }];
    }

    /** @param {object} space @returns {object[]} Figma 관찰 좌표의 콜아웃입니다. @private */
    #getCalloutRects(space) {
        return TUTORIAL_UI_LAYOUT_TOKENS.TUTORIAL.CALLOUTS.map(
            (token) => projectTutorialDesignRect(space, token)
        );
    }

    /** @private */
    #drawText(text, x, y, font, fill, align = 'left') {
        drawBattleViewText(this.#renderPort, {
            layer: 'ui', text, x, y, font, fill, align
        });
    }
}
