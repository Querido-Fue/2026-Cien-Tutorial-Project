import { drawBattleViewText } from './_tutorial_battle_view_helpers.js';
import { drawTutorialPixelAsset } from './_tutorial_asset_view_helpers.js';

/**
 * @class TutorialAchievementView
 * @description 세션 한정 발견 업적 알림을 에셋 기반 배너로 표시합니다.
 */
export class TutorialAchievementView {
    #renderPort;
    #assetPort;

    /** @param {object} renderPort - UI 렌더 포트입니다. @param {object} assetPort - 에셋 읽기 포트입니다. */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
    }

    /** @param {object} viewModel - 전투 표시 모델입니다. */
    draw(viewModel) {
        const achievement = viewModel?.achievement;
        const viewport = viewModel?.viewport;
        if (!achievement?.visible || !viewport) {
            return;
        }
        const rect = {
            x: viewport.UIOffsetX + (viewport.UIWW * 0.355),
            y: viewport.WH * 0.055,
            w: viewport.UIWW * 0.29,
            h: viewport.WH * 0.095
        };
        const art = this.#assetPort.getUiAsset?.('achievementPopup') || null;
        if (!drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: art,
            rect,
            alpha: 0.98
        })) {
            this.#renderPort.render('ui', {
                shape: 'roundRect',
                ...rect,
                radius: viewport.WH * 0.012,
                fill: viewModel.colors.UI.Card,
                stroke: viewModel.colors.UI.Accent,
                lineWidth: 2
            });
        }
        const centerX = rect.x + (rect.w * 0.5);
        drawBattleViewText(this.#renderPort, {
            layer: 'ui',
            text: achievement.title,
            x: centerX,
            y: rect.y + (rect.h * 0.38),
            font: viewModel.fonts.SMALL,
            fill: viewModel.colors.UI.Accent,
            align: 'center'
        });
        drawBattleViewText(this.#renderPort, {
            layer: 'ui',
            text: achievement.detail,
            x: centerX,
            y: rect.y + (rect.h * 0.68),
            font: viewModel.fonts.BODY,
            fill: viewModel.colors.UI.Text,
            align: 'center'
        });
    }
}
