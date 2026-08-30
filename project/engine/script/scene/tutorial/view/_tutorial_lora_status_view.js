import { clampBattleViewNumber } from './_tutorial_battle_view_helpers.js';
import { drawBattleHpValue } from './_tutorial_battle_hp_value_view.js';
import {
    drawTutorialPixelAsset,
    fitTutorialAssetRect
} from './_tutorial_asset_view_helpers.js';
import { LORA_STATUS_PANEL_LAYOUT } from './_tutorial_battle_hud_layout.js';
import { resolveTutorialLoraPortraitPresentation } from './_tutorial_lora_portrait_presentation.js';
import { drawTutorialLoraStatusText } from './_tutorial_lora_status_text_view.js';

/**
 * @class TutorialLoraStatusView
 * @description 로라 상태 패널의 초상·상태 문구·HP·불안정 표시를 원본 픽셀 좌표에 맞춰 그립니다.
 */
export class TutorialLoraStatusView {
    #renderPort;
    #assetPort;

    /**
     * @param {{render:Function,measureText?:Function}} renderPort - HUD 렌더 포트입니다.
     * @param {{getUiAsset?:Function,getLoraPortrait?:Function}} assetPort - 읽기 전용 에셋 포트입니다.
     */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
    }

    /**
     * 모델이 계산한 로라 상태 표시값을 원본 패널 안에 그립니다.
     * @param {object} viewModel - 장면이 조립한 읽기 전용 BattleViewModel입니다.
     */
    draw(viewModel) {
        if (!viewModel?.snapshot || !viewModel?.layout) {
            return;
        }
        const { colors, hud, layout, snapshot, world } = viewModel;
        const container = layout.hudRects.LORA_CARD;
        const panelImage = this.#assetPort.getUiAsset?.('loraPanel');
        const panelRect = this.#resolveSourcePanelRect(
            container,
            LORA_STATUS_PANEL_LAYOUT.SOURCE,
            panelImage
        );
        drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: panelImage,
            rect: panelRect,
            mode: 'exact',
            alpha: 1
        });

        const portraitViewport = this.#resolveSourcePanelPart(
            panelRect,
            LORA_STATUS_PANEL_LAYOUT.PORTRAIT_VIEWPORT,
            LORA_STATUS_PANEL_LAYOUT.SOURCE
        );
        const portraitPresentation = resolveTutorialLoraPortraitPresentation(
            this.#assetPort,
            hud.instabilityState?.id,
            LORA_STATUS_PANEL_LAYOUT
        );
        const portrait = portraitPresentation.image;
        if (portrait && portraitViewport) {
            const portraitWidth = Math.max(1, Math.round(
                portraitViewport.w * LORA_STATUS_PANEL_LAYOUT.PORTRAIT_SCALE
            ));
            const portraitHeight = Math.max(1, Math.round(
                portraitViewport.h * LORA_STATUS_PANEL_LAYOUT.PORTRAIT_SCALE
            ));
            const visualCenter = portraitPresentation.visualCenter;
            this.#renderPort.render('ui', {
                shape: 'image',
                image: portrait,
                x: Math.round(
                    portraitViewport.x + (portraitViewport.w * 0.5)
                    - (portraitWidth * visualCenter.X)
                ),
                y: Math.round(
                    portraitViewport.y + (portraitViewport.h * 0.5)
                    - (portraitHeight * visualCenter.Y)
                ),
                w: portraitWidth,
                h: portraitHeight,
                clipVertices: this.#resolveSourcePanelVertices(
                    panelRect,
                    LORA_STATUS_PANEL_LAYOUT.PORTRAIT_CLIP,
                    LORA_STATUS_PANEL_LAYOUT.SOURCE
                ),
                smoothing: false
            });
        } else if (portraitViewport) {
            this.#renderPort.render('ui', {
                shape: 'rect',
                ...portraitViewport,
                fill: colors.UI.CardHeader,
                stroke: colors.UI.Border,
                lineWidth: 1
            });
        }
        this.#drawPortraitFrame(panelImage, panelRect);
        drawTutorialLoraStatusText(this.#renderPort, {
            copy: hud.config.text?.LORA_STATUS,
            stateId: hud.instabilityState?.id,
            actionType: hud.readability?.loraIntent?.actionType,
            lineRects: LORA_STATUS_PANEL_LAYOUT.STATUS_LINES.map((line) => (
                this.#resolveSourcePanelPart(
                    panelRect,
                    line,
                    LORA_STATUS_PANEL_LAYOUT.SOURCE
                )
            )),
            font: viewModel.fonts.SMALL,
            fontScale: LORA_STATUS_PANEL_LAYOUT.STATUS_FONT_SCALE,
            minFontSize: LORA_STATUS_PANEL_LAYOUT.STATUS_MIN_FONT_PX,
            fill: colors.UI.GaugeValue || colors.UI.Text
        });

        const loraHp = Math.max(0, Number(world.presentation.loraHp) || 0);
        const loraMaxHp = Math.max(1, Number(snapshot.lora?.maxHp) || 100);
        const instability = clampBattleViewNumber(
            world.presentation.instability,
            0,
            100
        );
        const actualInstability = clampBattleViewNumber(
            snapshot.lora?.instability,
            0,
            100
        );
        const preview = hud.readability?.playerPreview;
        const expectedLoraHp = preview?.available
            ? Math.max(0, Number(preview.expected?.loraHp) || 0)
            : loraHp;
        const expectedInstability = preview?.available
            ? clampBattleViewNumber(preview.expected?.instability, 0, 100)
            : instability;
        this.#drawEmbeddedGauge(
            viewModel,
            this.#resolveSourcePanelPart(
                panelRect,
                LORA_STATUS_PANEL_LAYOUT.HP_BAR,
                LORA_STATUS_PANEL_LAYOUT.SOURCE
            ),
            loraHp / loraMaxHp,
            colors.UI.GaugeHp,
            expectedLoraHp / loraMaxHp,
            'loraHpBar'
        );
        drawBattleHpValue(this.#renderPort, {
            rect: this.#resolveSourcePanelPart(
                panelRect,
                LORA_STATUS_PANEL_LAYOUT.HP_VALUE,
                LORA_STATUS_PANEL_LAYOUT.SOURCE
            ),
            value: loraHp,
            font: viewModel.fonts.SMALL,
            fill: colors.UI.GaugeValue || colors.UI.Text
        });
        this.#drawEmbeddedGauge(
            viewModel,
            this.#resolveSourcePanelPart(
                panelRect,
                LORA_STATUS_PANEL_LAYOUT.INSTABILITY_BAR,
                LORA_STATUS_PANEL_LAYOUT.SOURCE
            ),
            instability / 100,
            colors.UI.GaugeInstability,
            expectedInstability / 100,
            'loraGaugeBar'
        );
        drawBattleHpValue(this.#renderPort, {
            rect: this.#resolveSourcePanelPart(
                panelRect,
                LORA_STATUS_PANEL_LAYOUT.INSTABILITY_VALUE,
                LORA_STATUS_PANEL_LAYOUT.SOURCE
            ),
            value: actualInstability,
            font: viewModel.fonts.SMALL,
            fill: colors.UI.GaugeValue || colors.UI.Text
        });
    }

    /** 확대 초상 위에 원본 마름모 장식을 다시 덮습니다. @private */
    #drawPortraitFrame(panelImage, panelRect) {
        if (!panelImage || !panelRect) {
            return;
        }
        for (const frameClip of LORA_STATUS_PANEL_LAYOUT.PORTRAIT_FRAME_CLIPS) {
            this.#renderPort.render('ui', {
                shape: 'image',
                image: panelImage,
                ...panelRect,
                clipVertices: this.#resolveSourcePanelVertices(
                    panelRect,
                    frameClip,
                    LORA_STATUS_PANEL_LAYOUT.SOURCE
                ),
                smoothing: false
            });
        }
    }

    /** 원본 크기가 있는 패널을 예약 영역 안에 비율 유지로 맞춥니다. @private */
    #resolveSourcePanelRect(container, source, image = null) {
        const sourceWidth = Number(source?.WIDTH);
        const sourceHeight = Number(source?.HEIGHT);
        const dimensions = sourceWidth > 0 && sourceHeight > 0
            ? { width: sourceWidth, height: sourceHeight }
            : null;
        return fitTutorialAssetRect(image || dimensions, container) || {
            x: Math.round(container.x),
            y: Math.round(container.y),
            w: Math.max(1, Math.round(container.w)),
            h: Math.max(1, Math.round(container.h))
        };
    }

    /** 패널 원본 픽셀 사각형을 현재 렌더 좌표로 투영합니다. @private */
    #resolveSourcePanelPart(panelRect, part, source) {
        const sourceWidth = Number(source?.WIDTH);
        const sourceHeight = Number(source?.HEIGHT);
        const partWidth = Number(part?.WIDTH);
        const partHeight = Number(part?.HEIGHT);
        if (!(sourceWidth > 0) || !(sourceHeight > 0)
            || !(partWidth > 0) || !(partHeight > 0)) {
            return null;
        }
        const scaleX = panelRect.w / sourceWidth;
        const scaleY = panelRect.h / sourceHeight;
        return {
            x: Math.round(panelRect.x + (Number(part.X) * scaleX)),
            y: Math.round(panelRect.y + (Number(part.Y) * scaleY)),
            w: Math.max(1, Math.round(partWidth * scaleX)),
            h: Math.max(1, Math.round(partHeight * scaleY))
        };
    }

    /** 패널 원본 픽셀 꼭짓점을 현재 렌더 좌표의 평면 배열로 투영합니다. @private */
    #resolveSourcePanelVertices(panelRect, points, source) {
        const sourceWidth = Number(source?.WIDTH);
        const sourceHeight = Number(source?.HEIGHT);
        if (!(sourceWidth > 0) || !(sourceHeight > 0)
            || !Array.isArray(points) || points.length < 3) {
            return null;
        }
        const scaleX = panelRect.w / sourceWidth;
        const scaleY = panelRect.h / sourceHeight;
        return points.flatMap((point) => [
            Math.round(panelRect.x + (Number(point.X) * scaleX)),
            Math.round(panelRect.y + (Number(point.Y) * scaleY))
        ]);
    }

    /** 원본 트랙에 현재 게이지와 선택 행동의 예상 구간을 그립니다. @private */
    #drawEmbeddedGauge(viewModel, rect, ratio, fill, pendingRatio, assetKey) {
        if (!rect) {
            return;
        }
        const safeRatio = clampBattleViewNumber(ratio, 0, 1);
        const safePending = pendingRatio !== null
            && pendingRatio !== undefined
            && Number.isFinite(Number(pendingRatio))
            ? clampBattleViewNumber(pendingRatio, 0, 1)
            : safeRatio;
        if (safeRatio > 0) {
            const fillRect = {
                x: rect.x,
                y: rect.y,
                w: Math.max(1, rect.w * safeRatio),
                h: rect.h
            };
            const drewAsset = drawTutorialPixelAsset(this.#renderPort, {
                layer: 'ui',
                image: this.#assetPort.getUiAsset?.(assetKey),
                rect: fillRect,
                mode: 'exact',
                alpha: 1
            });
            if (!drewAsset) {
                this.#renderPort.render('ui', {
                    shape: 'rect',
                    ...fillRect,
                    fill
                });
            }
        }
        if (Math.abs(safePending - safeRatio) <= 0.0001) {
            return;
        }
        const startRatio = Math.min(safeRatio, safePending);
        const segmentRatio = Math.abs(safePending - safeRatio);
        this.#renderPort.render('ui', {
            shape: 'rect',
            x: rect.x + (rect.w * startRatio),
            y: rect.y,
            w: rect.w * segmentRatio,
            h: rect.h,
            fill: safePending > safeRatio
                ? viewModel.colors.UI.Success
                : viewModel.colors.UI.Danger
        });
    }
}
