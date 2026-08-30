import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import {
    clampBattleViewNumber,
    drawBattleViewText,
    getBattleViewFontPixelSize,
    wrapBattleViewText
} from './_tutorial_battle_view_helpers.js';
import { drawTutorialPixelAsset } from './_tutorial_asset_view_helpers.js';
import {
    createTutorialDesignSpace,
    projectTutorialDesignRect
} from './_tutorial_design_space.js';
import { TutorialGuidanceBackdropView } from './_tutorial_guidance_backdrop_view.js';
import { TUTORIAL_UI_LAYOUT_TOKENS } from './_tutorial_ui_layout_tokens.js';

const DEFAULT_PRESENTATION = Object.freeze({
    MAX_BLUR_PX: 8,
    MIN_BRIGHTNESS: 0.84,
    DIM_ALPHA: 0.07,
    FOCUS_PADDING_DESIGN_PX: 14,
    FOCUS_FEATHER_CSS_PX: 18,
    PAPER: Object.freeze({
        CONTENT_LEFT_RATIO: 0.2,
        CONTENT_RIGHT_RATIO: 0.2,
        CONTENT_TOP_RATIO: 0.22,
        CONTENT_BOTTOM_RATIO: 0.18,
        MESSAGE_FONT_SCALE: 0.68,
        FIRST_MESSAGE_FONT_SCALE: 0.76,
        MESSAGE_LINE_HEIGHT_RATIO: 1.24
    })
});

/** @param {string} font @param {number} scale @returns {string} */
function scaleTutorialCalloutFont(font, scale) {
    return String(font).replace(
        /(\d+(?:\.\d+)?)px/,
        (_, size) => `${Number(size) * scale}px`
    );
}

/** @param {object} left @param {object} right @returns {object} */
function unionRects(left, right) {
    const x = Math.min(left.x, right.x);
    const y = Math.min(left.y, right.y);
    const rightEdge = Math.max(left.x + left.w, right.x + right.w);
    const bottomEdge = Math.max(left.y + left.h, right.y + right.h);
    return { x, y, w: rightEdge - x, h: bottomEdge - y };
}

/** @param {object} from @param {object} to @param {number} progress */
function interpolateRect(from, to, progress) {
    const t = clampBattleViewNumber(progress, 0, 1);
    return {
        x: from.x + ((to.x - from.x) * t),
        y: from.y + ((to.y - from.y) * t),
        w: from.w + ((to.w - from.w) * t),
        h: from.h + ((to.h - from.h) * t)
    };
}

/**
 * @class TutorialBattleTutorialView
 * @description 단일 전투 안내 양피지와 이동하는 아웃포커스 영역만 담당합니다.
 */
export class TutorialBattleTutorialView {
    #renderPort;
    #assetPort;
    #config;
    #backdropView;

    /**
     * @param {{render:Function,wrapText:Function}} renderPort - UI 렌더 포트입니다.
     * @param {object} assetPort - 에셋 읽기 포트입니다.
     * @param {{config?:object,backdropView?:object,documentRef?:Document|null}} options
     */
    constructor(renderPort, assetPort = {}, options = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
        this.#config = {
            ...DEFAULT_PRESENTATION,
            ...(options.config || {}),
            PAPER: {
                ...DEFAULT_PRESENTATION.PAPER,
                ...(options.config?.PAPER || {})
            }
        };
        this.#backdropView = options.backdropView
            || new TutorialGuidanceBackdropView(
                this.#config,
                options.documentRef ?? globalThis.document ?? null
            );
    }

    /** @param {object|null} viewModel - 장면이 조립한 안내 표시 모델입니다. */
    draw(viewModel) {
        if (!viewModel) {
            this.clear();
            return;
        }
        const guidance = this.#resolveGuidance(viewModel);
        const space = viewModel.layout?.designSpace
            || createTutorialDesignSpace(viewModel.viewport);
        const focusRects = this.#getFocusRects(viewModel, space);
        const stepIndex = Math.min(
            focusRects.length - 1,
            Math.max(0, Math.trunc(Number(guidance.stepIndex)) || 0)
        );
        const previousIndex = Number.isInteger(guidance.previousStepIndex)
            ? Math.min(focusRects.length - 1, Math.max(0, guidance.previousStepIndex))
            : stepIndex;
        const focusRect = interpolateRect(
            focusRects[previousIndex],
            focusRects[stepIndex],
            guidance.focusProgress
        );
        this.#backdropView.sync({
            visible: guidance.open,
            blurProgress: guidance.blurProgress,
            focusRect,
            viewport: viewModel.viewport
        });
        if (!guidance.open) {
            return;
        }

        const rect = projectTutorialDesignRect(
            space,
            TUTORIAL_UI_LAYOUT_TOKENS.TUTORIAL.CALLOUTS[stepIndex]
        );
        this.#drawCallout(viewModel, guidance, rect, stepIndex);
    }

    /** 안내를 즉시 숨기되 장면이 재사용할 DOM은 유지합니다. */
    clear() {
        this.#backdropView.clear?.();
    }

    /** 장면 종료 시 backdrop DOM을 제거합니다. */
    destroy() {
        this.#backdropView.destroy?.();
    }

    /**
     * 화면 전체 클릭을 다음 안내 명령 하나로 바꿉니다.
     * @param {object} viewModel - 안내 표시 모델입니다.
     * @returns {object[]} 버튼 사양입니다.
     */
    getButtonSpecs(viewModel) {
        if (!viewModel?.layout) {
            return [];
        }
        const guidance = this.#resolveGuidance(viewModel);
        if (!guidance.open || !guidance.interactive) {
            return [];
        }
        const viewport = viewModel.viewport || {};
        return [{
            key: 'battle-guide-advance',
            layer: 'top',
            x: 0,
            y: 0,
            w: Math.max(1, Number(viewport.WW) || 1),
            h: Math.max(1, Number(viewport.WH) || 1),
            label: '',
            tooltip: null,
            drawBackground: false,
            idleColor: viewModel.colors.UI.Primary,
            hoverColor: viewModel.colors.UI.PrimaryHover,
            textColor: viewModel.colors.UI.OnPrimary,
            command: { type: TUTORIAL_COMMANDS.GUIDE_ADVANCE }
        }];
    }

    /** @private */
    #drawCallout(viewModel, guidance, rect, stepIndex) {
        const { colors, copy, fonts } = viewModel;
        const alpha = clampBattleViewNumber(guidance.messageAlpha, 0, 1);
        const paper = this.#config.PAPER;
        const popupDrawn = drawTutorialPixelAsset(this.#renderPort, {
            layer: 'top',
            image: this.#assetPort.getUiAsset?.('tutorialPopupFull'),
            rect,
            alpha,
            mode: 'exact'
        });
        if (!popupDrawn) {
            this.#renderPort.render('top', {
                shape: 'roundRect',
                x: rect.x,
                y: rect.y,
                w: rect.w,
                h: rect.h,
                radius: Math.max(5, rect.w * 0.035),
                fill: colors.UI.Card,
                stroke: colors.UI.Border,
                lineWidth: 1,
                alpha
            });
        }

        const calloutFont = scaleTutorialCalloutFont(
            fonts.SMALL,
            stepIndex === 0
                ? paper.FIRST_MESSAGE_FONT_SCALE
                : paper.MESSAGE_FONT_SCALE
        );
        const fontPx = getBattleViewFontPixelSize(calloutFont, 10);
        const lineHeight = Math.max(8, fontPx * paper.MESSAGE_LINE_HEIGHT_RATIO);
        const contentLeft = rect.x + (rect.w * paper.CONTENT_LEFT_RATIO);
        const contentRight = rect.x + (rect.w * (1 - paper.CONTENT_RIGHT_RATIO));
        const contentTop = rect.y + (rect.h * paper.CONTENT_TOP_RATIO);
        const contentBottom = rect.y + (rect.h * (1 - paper.CONTENT_BOTTOM_RATIO));
        const availableHeight = Math.max(lineHeight, contentBottom - contentTop);
        const maxLines = Math.max(1, Math.floor(availableHeight / lineHeight));
        const lines = wrapBattleViewText(
            this.#renderPort,
            copy.sentences[stepIndex] || '',
            calloutFont,
            Math.max(1, contentRight - contentLeft),
            maxLines
        );
        const totalTextHeight = Math.max(1, lines.length) * lineHeight;
        const firstLineY = contentTop
            + ((availableHeight - totalTextHeight) * 0.5)
            + (lineHeight * 0.5);
        lines.forEach((line, lineIndex) => this.#drawText(
            line,
            (contentLeft + contentRight) * 0.5,
            firstLineY + (lineHeight * lineIndex),
            calloutFont,
            colors.UI.PanelStrong || colors.UI.Text,
            'center',
            alpha
        ));
    }

    /** @param {object} viewModel @param {object} space @returns {object[]} @private */
    #getFocusRects(viewModel, space) {
        const hud = viewModel.layout?.hudRects || {};
        const board = viewModel.layout?.boardRect || {
            x: space.x,
            y: space.y,
            w: space.w,
            h: space.h
        };
        const safe = (rect) => rect || board;
        const achievement = projectTutorialDesignRect(
            space,
            TUTORIAL_UI_LAYOUT_TOKENS.BATTLE.ACHIEVEMENT
        );
        const playerAndItems = unionRects(
            safe(hud.PLAYER_STATUS),
            safe(hud.INVENTORY_CARD)
        );
        const actionControls = unionRects(
            safe(hud.SECONDARY_ACTIONS),
            safe(hud.PRIMARY_ACTION)
        );
        const movementArea = {
            x: board.x + (board.w * 0.2),
            y: board.y + (board.h * 0.25),
            w: board.w * 0.6,
            h: board.h * 0.6
        };
        return [
            safe(hud.STAGE_HEADER),
            playerAndItems,
            achievement,
            safe(hud.LORA_CARD),
            actionControls,
            movementArea
        ].map((rect) => this.#padAndClampFocusRect(rect, viewModel.viewport, space));
    }

    /** @private */
    #padAndClampFocusRect(rect, viewport, space) {
        const padding = Math.max(
            0,
            Number(this.#config.FOCUS_PADDING_DESIGN_PX) * space.scale
        );
        const maxWidth = Math.max(1, Number(viewport?.WW) || space.x + space.w);
        const maxHeight = Math.max(1, Number(viewport?.WH) || space.y + space.h);
        const x = clampBattleViewNumber(rect.x - padding, 0, maxWidth);
        const y = clampBattleViewNumber(rect.y - padding, 0, maxHeight);
        const right = clampBattleViewNumber(rect.x + rect.w + padding, x, maxWidth);
        const bottom = clampBattleViewNumber(rect.y + rect.h + padding, y, maxHeight);
        return { x, y, w: right - x, h: bottom - y };
    }

    /** @param {object} viewModel @returns {object} @private */
    #resolveGuidance(viewModel) {
        const guidance = viewModel.guidance || {};
        const open = guidance.open ?? viewModel.open === true;
        return {
            open,
            interactive: guidance.interactive ?? open,
            stepIndex: Math.max(0, Math.trunc(Number(guidance.stepIndex)) || 0),
            previousStepIndex: Number.isInteger(guidance.previousStepIndex)
                ? guidance.previousStepIndex
                : null,
            stepCount: Math.max(
                1,
                Math.trunc(Number(guidance.stepCount))
                    || viewModel.copy?.sentences?.length
                    || 1
            ),
            messageAlpha: guidance.messageAlpha ?? (open ? 1 : 0),
            blurProgress: guidance.blurProgress ?? (open ? 1 : 0),
            focusProgress: guidance.focusProgress ?? 1
        };
    }

    /** @private */
    #drawText(text, x, y, font, fill, align = 'left', alpha = 1) {
        drawBattleViewText(this.#renderPort, {
            layer: 'top', text, x, y, font, fill, align, alpha
        });
    }
}
