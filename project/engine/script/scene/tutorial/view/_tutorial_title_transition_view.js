import {
    drawTutorialPixelAsset,
    fitTutorialAssetRect
} from './_tutorial_asset_view_helpers.js';

/** @param {number} value @returns {number} 0~1 범위 진행도입니다. */
function clampTransitionProgress(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

/** @param {number} from @param {number} to @param {number} progress @returns {number} */
function interpolateTransitionValue(from, to, progress) {
    return Number(from) + ((Number(to) - Number(from)) * progress);
}

/**
 * @class TutorialTitleTransitionView
 * @description 선택 아이콘의 카드→HUD 모핑과 전투 화면 공개 오버레이를 그립니다.
 */
export class TutorialTitleTransitionView {
    #renderPort;
    #assetPort;

    /** @param {object} renderPort - UI 렌더 포트입니다. @param {object} assetPort - 에셋 읽기 포트입니다. */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
    }

    /**
     * 선택 아이콘의 시작·도착·현재 사각형을 계산합니다.
     * @param {object} viewModel - 타이틀 전환 뷰 모델입니다.
     * @returns {object|null} 전환 레이아웃입니다.
     */
    getLayout(viewModel) {
        if (!viewModel?.sourceRect || !viewModel?.playerStatusRect) {
            return null;
        }
        const targetRect = this.#resolveTargetIconRect(viewModel);
        if (!targetRect) {
            return null;
        }
        const progress = clampTransitionProgress(viewModel.transition?.progress);
        const sourceRect = viewModel.sourceRect;
        return Object.freeze({
            sourceRect,
            targetRect,
            currentRect: Object.freeze({
                x: Math.round(interpolateTransitionValue(sourceRect.x, targetRect.x, progress)),
                y: Math.round(interpolateTransitionValue(sourceRect.y, targetRect.y, progress)),
                w: Math.max(1, Math.round(interpolateTransitionValue(sourceRect.w, targetRect.w, progress))),
                h: Math.max(1, Math.round(interpolateTransitionValue(sourceRect.h, targetRect.h, progress)))
            })
        });
    }

    /**
     * 모핑 중에는 이동 아이콘을, 전투 공개 중에는 암전과 교차 페이드 아이콘을 그립니다.
     * @param {object|null} viewModel - 타이틀 전환 뷰 모델입니다.
     */
    draw(viewModel) {
        const phase = viewModel?.transition?.phase;
        if (phase !== 'starter-morph' && phase !== 'battle-reveal') {
            return;
        }
        const layout = this.getLayout(viewModel);
        if (!layout) {
            return;
        }
        const progress = clampTransitionProgress(viewModel.transition.progress);
        if (phase === 'battle-reveal') {
            this.#renderPort.render('ui', {
                shape: 'rect',
                x: 0,
                y: 0,
                w: viewModel.viewport.WW,
                h: viewModel.viewport.WH,
                fill: viewModel.colors.WorldBackdrop,
                alpha: 1 - progress
            });
        }
        drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: this.#assetPort.getItemIcon?.(viewModel.transition.selectedItemId),
            rect: phase === 'starter-morph'
                ? layout.currentRect
                : layout.targetRect,
            mode: 'exact',
            alpha: phase === 'battle-reveal' ? 1 - progress : 1
        });
    }

    /** @param {object} viewModel @returns {object|null} @private */
    #resolveTargetIconRect(viewModel) {
        const inventory = viewModel.inventoryLayout;
        const panel = inventory?.PLAYER_PANEL;
        const source = panel?.SOURCE;
        const slot = panel?.ITEM_SLOT;
        if (!(Number(source?.WIDTH) > 0) || !(Number(source?.HEIGHT) > 0)
            || !(Number(slot?.WIDTH) > 0) || !(Number(slot?.HEIGHT) > 0)) {
            return null;
        }
        const panelRect = fitTutorialAssetRect(
            this.#assetPort.getUiAsset?.('playerPanel') || {
                width: source.WIDTH,
                height: source.HEIGHT
            },
            viewModel.playerStatusRect
        );
        if (!panelRect) {
            return null;
        }
        const scaleX = panelRect.w / Number(source.WIDTH);
        const scaleY = panelRect.h / Number(source.HEIGHT);
        const slotRect = {
            x: Math.round(panelRect.x + (Number(slot.X) * scaleX)),
            y: Math.round(panelRect.y + (Number(slot.Y) * scaleY)),
            w: Math.max(1, Math.round(Number(slot.WIDTH) * scaleX)),
            h: Math.max(1, Math.round(Number(slot.HEIGHT) * scaleY))
        };
        const iconLayout = viewModel.itemIconLayout || {};
        const iconSize = Math.max(1, Math.round(
            Math.min(slotRect.w, slotRect.h)
                * (Number(iconLayout.BUTTON_ICON_SIZE_RATIO) || 0.66)
        ));
        const visualCenter = iconLayout.VISUAL_CENTERS?.[
            viewModel.transition.selectedItemId
        ] || {};
        const centerX = Number.isFinite(Number(visualCenter.x))
            ? Number(visualCenter.x)
            : 0.5;
        const centerY = Number.isFinite(Number(visualCenter.y))
            ? Number(visualCenter.y)
            : 0.5;
        return Object.freeze({
            x: Math.round(
                slotRect.x + ((slotRect.w - iconSize) * 0.5)
                + (iconSize * (0.5 - centerX))
            ),
            y: Math.round(
                slotRect.y + ((slotRect.h - iconSize) * 0.5)
                + (iconSize * (0.5 - centerY))
            ),
            w: iconSize,
            h: iconSize
        });
    }
}
