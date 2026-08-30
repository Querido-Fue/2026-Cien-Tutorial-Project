import {
    drawBattleViewText,
    getBattleViewFontPixelSize,
    truncateBattleViewText,
    wrapBattleViewText
} from './_tutorial_battle_view_helpers.js';
import {
    drawTutorialPixelAsset,
    fitTutorialAssetRect
} from './_tutorial_asset_view_helpers.js';
import { ITEM_DESCRIPTION_PANEL_LAYOUT } from './_tutorial_battle_hud_layout.js';

/**
 * 아이템 설명 패널을 예약 영역 안에 원본 비율로 맞춥니다.
 * @param {object} container - HUD가 예약한 설명 영역입니다.
 * @param {object|null} image - 설명 패널 이미지입니다.
 * @returns {{x:number,y:number,w:number,h:number}} 실제 패널 사각형입니다.
 */
function resolveItemPanelRect(container, image) {
    const source = ITEM_DESCRIPTION_PANEL_LAYOUT.SOURCE;
    return fitTutorialAssetRect(image || {
        width: source.WIDTH,
        height: source.HEIGHT
    }, container) || {
        x: Math.round(container.x),
        y: Math.round(container.y),
        w: Math.max(1, Math.round(container.w)),
        h: Math.max(1, Math.round(container.h))
    };
}

/**
 * 아이템 패널의 원본 픽셀 사각형을 현재 렌더 좌표로 투영합니다.
 * @param {object} panelRect - 실제 패널 사각형입니다.
 * @param {object} part - 원본 픽셀 기준 내부 사각형입니다.
 * @returns {{x:number,y:number,w:number,h:number}|null} 투영된 사각형입니다.
 */
function resolveItemPanelPart(panelRect, part) {
    const source = ITEM_DESCRIPTION_PANEL_LAYOUT.SOURCE;
    const partWidth = Number(part?.WIDTH);
    const partHeight = Number(part?.HEIGHT);
    if (!(partWidth > 0) || !(partHeight > 0)) {
        return null;
    }
    const scaleX = panelRect.w / source.WIDTH;
    const scaleY = panelRect.h / source.HEIGHT;
    return {
        x: Math.round(panelRect.x + (Number(part.X) * scaleX)),
        y: Math.round(panelRect.y + (Number(part.Y) * scaleY)),
        w: Math.max(1, Math.round(partWidth * scaleX)),
        h: Math.max(1, Math.round(partHeight * scaleY))
    };
}

/**
 * @class TutorialItemDescriptionView
 * @description 아이템 설명 패널의 장식 내부 텍스트 배치와 줄간격을 전담합니다.
 */
export class TutorialItemDescriptionView {
    #renderPort;
    #assetPort;

    /**
     * @param {{render:Function,measureText:Function,wrapText:Function}} renderPort - 렌더 포트입니다.
     * @param {{getUiAsset?:Function}} assetPort - UI 에셋 포트입니다.
     */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
    }

    /**
     * 현재 조사 중인 아이템의 이름·적용 방식·설명·페이지를 그립니다.
     * @param {object} viewModel - 읽기 전용 전투 뷰 모델입니다.
     */
    draw(viewModel) {
        const inspectedItem = viewModel?.hud?.readability?.inspectedItem || null;
        const container = viewModel?.layout?.hudRects?.INVENTORY_CARD;
        if (!inspectedItem || !container) {
            return;
        }
        const panelImage = this.#assetPort.getUiAsset?.('itemPanel');
        const panelRect = resolveItemPanelRect(container, panelImage);
        const titleRect = resolveItemPanelPart(
            panelRect,
            ITEM_DESCRIPTION_PANEL_LAYOUT.TITLE
        );
        const statusRect = resolveItemPanelPart(
            panelRect,
            ITEM_DESCRIPTION_PANEL_LAYOUT.STATUS
        );
        const descriptionRect = resolveItemPanelPart(
            panelRect,
            ITEM_DESCRIPTION_PANEL_LAYOUT.DESCRIPTION
        );
        const pageRect = resolveItemPanelPart(
            panelRect,
            ITEM_DESCRIPTION_PANEL_LAYOUT.PAGE
        );
        if (!titleRect || !statusRect || !descriptionRect || !pageRect) {
            return;
        }

        drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: panelImage,
            rect: panelRect,
            mode: 'exact',
            alpha: 1
        });
        this.#drawHeader(viewModel, inspectedItem, titleRect, statusRect);
        this.#drawDescription(viewModel, inspectedItem, statusRect, descriptionRect);
        this.#drawPage(viewModel, pageRect);
    }

    /** @param {object} viewModel @param {object} item @param {object} titleRect @param {object} statusRect @private */
    #drawHeader(viewModel, item, titleRect, statusRect) {
        const font = viewModel.fonts.SMALL;
        drawBattleViewText(this.#renderPort, {
            layer: 'ui',
            text: truncateBattleViewText(
                this.#renderPort,
                String(item.label || 'ITEM') + ' ×' + String(item.count || 0),
                font,
                titleRect.w
            ),
            x: titleRect.x + (titleRect.w * 0.5),
            y: titleRect.y + (titleRect.h * 0.5),
            font,
            fill: viewModel.colors.UI.Text,
            align: 'center'
        });
        drawBattleViewText(this.#renderPort, {
            layer: 'ui',
            text: truncateBattleViewText(
                this.#renderPort,
                String(item.statusLabel || ''),
                font,
                statusRect.w
            ),
            x: statusRect.x + (statusRect.w * 0.5),
            y: statusRect.y + (statusRect.h * 0.5),
            font,
            fill: viewModel.colors.UI.Accent,
            align: 'center'
        });
    }

    /** @param {object} viewModel @param {object} item @param {object} statusRect @param {object} descriptionRect @private */
    #drawDescription(viewModel, item, statusRect, descriptionRect) {
        const font = viewModel.fonts.SMALL;
        const lines = wrapBattleViewText(
            this.#renderPort,
            String(item.description || ''),
            font,
            descriptionRect.w,
            ITEM_DESCRIPTION_PANEL_LAYOUT.MAX_DESCRIPTION_LINES
        );
        if (lines.length === 0) {
            return;
        }
        const fontSize = getBattleViewFontPixelSize(font, statusRect.h);
        const statusCenterY = statusRect.y + (statusRect.h * 0.5);
        const descriptionBottom = descriptionRect.y + descriptionRect.h;
        const gapMultiplier = ITEM_DESCRIPTION_PANEL_LAYOUT
            .STATUS_DESCRIPTION_GAP_MULTIPLIER;
        const lineMultiplier = ITEM_DESCRIPTION_PANEL_LAYOUT
            .DESCRIPTION_LINE_HEIGHT_MULTIPLIER;
        const spacingUnits = gapMultiplier
            + (lineMultiplier * Math.max(0, lines.length - 1));
        const availableForBaselines = Math.max(
            1,
            descriptionBottom - statusCenterY - (fontSize * 0.5)
        );
        const baseLineHeight = Math.min(
            fontSize,
            availableForBaselines / Math.max(1, spacingUnits)
        );
        const firstLineY = statusCenterY + (baseLineHeight * gapMultiplier);
        const descriptionLineHeight = baseLineHeight * lineMultiplier;
        lines.forEach((line, index) => drawBattleViewText(this.#renderPort, {
            layer: 'ui',
            text: line,
            x: descriptionRect.x,
            y: firstLineY + (descriptionLineHeight * index),
            font,
            fill: viewModel.colors.UI.Text,
            align: 'left'
        }));
    }

    /** @param {object} viewModel @param {object} pageRect @private */
    #drawPage(viewModel, pageRect) {
        drawBattleViewText(this.#renderPort, {
            layer: 'ui',
            text: String(viewModel.hud.inventory.page + 1) + '/'
                + String(viewModel.hud.inventory.pageCount),
            x: pageRect.x + (pageRect.w * 0.5),
            y: pageRect.y + (pageRect.h * 0.5),
            font: viewModel.fonts.SMALL,
            fill: viewModel.colors.UI.Muted,
            align: 'center'
        });
    }
}
