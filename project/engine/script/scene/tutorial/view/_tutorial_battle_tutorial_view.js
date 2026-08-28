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
            const pad = clampBattleViewNumber(rect.w * 0.075, 7, 14);
            const lineH = clampBattleViewNumber(rect.h * 0.22, 14, 20);
            this.#renderPort.render('ui', {
                shape: 'roundRect',
                x: rect.x + 2,
                y: rect.y + 3,
                w: rect.w,
                h: rect.h,
                radius: Math.max(5, space.scale * 6),
                fill: colors.UI.CardShadow
            });
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
            drawTutorialPixelAsset(this.#renderPort, {
                layer: 'ui',
                image: this.#assetPort.getUiAsset?.('tutorialPaper'),
                rect,
                alpha: 0.48,
                mode: 'exact'
            });
            const rodH = Math.max(4, rect.h * 0.09);
            drawTutorialPixelAsset(this.#renderPort, {
                layer: 'ui',
                image: this.#assetPort.getUiAsset?.('tutorialRodTop'),
                rect: { x: rect.x, y: rect.y, w: rect.w, h: rodH },
                alpha: 0.92,
                mode: 'exact'
            });
            drawTutorialPixelAsset(this.#renderPort, {
                layer: 'ui',
                image: this.#assetPort.getUiAsset?.('tutorialRodBottom'),
                rect: { x: rect.x, y: rect.y + rect.h - rodH, w: rect.w, h: rodH },
                alpha: 0.92,
                mode: 'exact'
            });
            this.#drawText(
                String(index + 1).padStart(2, '0'),
                rect.x + pad,
                rect.y + pad + (lineH * 0.1),
                fonts.SMALL,
                colors.UI.Primary
            );
            const lines = wrapBattleViewText(
                this.#renderPort,
                sentence,
                fonts.SMALL,
                rect.w - (pad * 2),
                3
            );
            lines.forEach((line, lineIndex) => this.#drawText(
                line,
                rect.x + pad,
                rect.y + pad + (lineH * (1.1 + lineIndex)),
                fonts.SMALL,
                colors.UI.Text
            ));
        });
        const replayRect = rects[1];
        this.#drawText(
            copy.replay,
            replayRect.x,
            replayRect.y + replayRect.h + Math.max(12, space.scale * 10),
            fonts.SMALL,
            colors.UI.Muted
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
            const space = viewModel.layout.designSpace
                || createTutorialDesignSpace(viewModel.viewport);
            return [{
                key: 'battle-guide-open',
                x: space.x + (space.w * 0.31),
                y: space.y + (space.h * 0.06),
                w: space.w * 0.035,
                h: space.h * 0.045,
                label: '?',
                backgroundAssetKey: 'mainButton',
                backgroundImageAlpha: 0.82,
                fitHitToBackground: true,
                idleColor: viewModel.colors.UI.CardHeader,
                hoverColor: viewModel.colors.UI.ButtonHover,
                command: { type: TUTORIAL_COMMANDS.GUIDE_SHOW }
            }];
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
            label: '확인 / 건너뛰기',
            backgroundAssetKey: 'mainButton',
            backgroundImageAlpha: 0.9,
            fitHitToBackground: true,
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
    #drawText(text, x, y, font, fill) {
        drawBattleViewText(this.#renderPort, {
            layer: 'ui', text, x, y, font, fill
        });
    }
}
