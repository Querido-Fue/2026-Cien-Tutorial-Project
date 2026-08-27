import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import {
    clampBattleViewNumber,
    drawBattleViewText,
    wrapBattleViewText
} from './_tutorial_battle_view_helpers.js';
import { drawTutorialPixelAsset } from './_tutorial_asset_view_helpers.js';

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
        const rect = this.#getModalRect(viewModel);
        const pad = clampBattleViewNumber(rect.w * 0.07, 18, 30);
        const lineH = clampBattleViewNumber(viewport.WH * 0.038, 24, 34);
        this.#renderPort.render('ui', {
            shape: 'rect',
            x: viewport.UIOffsetX,
            y: 0,
            w: viewport.UIWW,
            h: viewport.WH,
            fill: colors.UI.CardShadow,
            alpha: 0.58
        });
        this.#renderPort.render('ui', {
            shape: 'roundRect',
            x: rect.x + 3,
            y: rect.y + 4,
            w: rect.w,
            h: rect.h,
            radius: viewport.WH * 0.02,
            fill: colors.UI.CardShadow
        });
        this.#renderPort.render('ui', {
            shape: 'roundRect',
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: rect.h,
            radius: viewport.WH * 0.02,
            fill: colors.UI.Card,
            stroke: colors.UI.Border,
            lineWidth: 1
        });
        drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: this.#assetPort.getUiAsset?.('tutorialPopup'),
            rect,
            alpha: 0.72
        });
        let y = rect.y + pad;
        this.#drawText(copy.title, rect.x + pad, y, fonts.HEADING, colors.UI.Primary);
        y += lineH * 1.45;
        for (const sentence of copy.sentences) {
            const lines = wrapBattleViewText(
                this.#renderPort,
                '· ' + sentence,
                fonts.BODY,
                rect.w - (pad * 2),
                2
            );
            for (const line of lines) {
                this.#drawText(line, rect.x + pad, y, fonts.BODY, colors.UI.Text);
                y += lineH;
            }
            y += lineH * 0.22;
        }
        this.#drawText(
            copy.replay,
            rect.x + pad,
            rect.y + rect.h - pad - (lineH * 1.45),
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
            const rect = viewModel.layout.hudRects.MISSION_CARD;
            return [{
                key: 'battle-guide-open',
                x: rect.x + (rect.w * 0.64),
                y: rect.y + (rect.h * 0.025),
                w: rect.w * 0.31,
                h: clampBattleViewNumber(rect.h * 0.1, 28, 38),
                label: '?  도움',
                idleColor: viewModel.colors.UI.CardHeader,
                hoverColor: viewModel.colors.UI.ButtonHover,
                command: { type: TUTORIAL_COMMANDS.GUIDE_SHOW }
            }];
        }
        const rect = this.#getModalRect(viewModel);
        const buttonW = rect.w * 0.34;
        const buttonH = clampBattleViewNumber(rect.h * 0.16, 38, 54);
        return [{
            key: 'battle-guide-dismiss',
            x: rect.x + rect.w - buttonW - (rect.w * 0.07),
            y: rect.y + rect.h - buttonH - (rect.h * 0.07),
            w: buttonW,
            h: buttonH,
            label: '확인  [Enter]',
            backgroundAssetKey: 'mainButton',
            backgroundImageAlpha: 0.9,
            idleColor: viewModel.colors.UI.Primary,
            hoverColor: viewModel.colors.UI.PrimaryHover,
            textColor: viewModel.colors.UI.OnPrimary,
            command: { type: TUTORIAL_COMMANDS.GUIDE_DISMISS }
        }];
    }

    /** @param {object} viewModel @returns {{x:number,y:number,w:number,h:number}} 중앙 모달 영역입니다. @private */
    #getModalRect(viewModel) {
        const { modal, viewport } = viewModel;
        const w = viewport.UIWW * ((Number(modal.WIDTH_UIWW) || 42) / 100);
        const h = viewport.WH * ((Number(modal.HEIGHT_WH) || 42) / 100);
        return {
            x: viewport.UIOffsetX + ((viewport.UIWW - w) * 0.5),
            y: (viewport.WH - h) * 0.5,
            w,
            h
        };
    }

    /** @private */
    #drawText(text, x, y, font, fill) {
        drawBattleViewText(this.#renderPort, {
            layer: 'ui', text, x, y, font, fill
        });
    }
}
