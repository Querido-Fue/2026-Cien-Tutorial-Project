import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import {
    drawTutorialText,
    wrapTutorialText
} from './_tutorial_nonbattle_view_helpers.js';
import {
    drawTutorialPixelAsset,
    fitTutorialAssetRect
} from './_tutorial_asset_view_helpers.js';
import {
    createTutorialDesignSpace,
    projectTutorialDesignRect
} from './_tutorial_design_space.js';
import { TUTORIAL_UI_LAYOUT_TOKENS } from './_tutorial_ui_layout_tokens.js';

/**
 * 카드 프레임 안의 정규화된 영역을 실제 화면 좌표로 변환합니다.
 * @param {object} cardRect - 화면에 배치된 카드 프레임 영역입니다.
 * @param {object} region - 카드 기준 정규화 영역입니다.
 * @returns {object} 화면 좌표로 변환된 영역입니다.
 */
function projectStarterCardRegion(cardRect, region) {
    return {
        x: cardRect.x + (cardRect.w * region.x),
        y: cardRect.y + (cardRect.h * region.y),
        w: cardRect.w * region.w,
        h: cardRect.h * region.h
    };
}

/**
 * 카드 중심을 유지한 채 내부 사각형을 같은 배율로 변환합니다.
 * @param {object} rect - 기본 크기에서 계산한 사각형입니다.
 * @param {{x:number,y:number}} center - 카드 변환 중심입니다.
 * @param {number} scale - 카드 전체 표시 배율입니다.
 * @returns {object} 카드와 함께 변환된 사각형입니다.
 */
function scaleStarterRectAround(rect, center, scale) {
    return {
        x: center.x + ((rect.x - center.x) * scale),
        y: center.y + ((rect.y - center.y) * scale),
        w: rect.w * scale,
        h: rect.h * scale
    };
}

/**
 * 카드 중심을 기준으로 내부 점을 같은 배율로 변환합니다.
 * @param {{x:number,y:number}} point - 기본 크기의 내부 좌표입니다.
 * @param {{x:number,y:number}} center - 카드 변환 중심입니다.
 * @param {number} scale - 카드 전체 표시 배율입니다.
 * @returns {{x:number,y:number}} 카드와 함께 변환된 좌표입니다.
 */
function scaleStarterPointAround(point, center, scale) {
    return {
        x: center.x + ((point.x - center.x) * scale),
        y: center.y + ((point.y - center.y) * scale)
    };
}

/**
 * 카드 설명처럼 제한된 영역에서 사용할 글꼴 크기만 비례 축소합니다.
 * @param {string} font - Canvas 글꼴 문자열입니다.
 * @param {number} scale - 글꼴 크기 배율입니다.
 * @returns {string} 크기가 조정된 Canvas 글꼴 문자열입니다.
 */
function scaleStarterFont(font, scale) {
    return String(font).replace(
        /(\d+(?:\.\d+)?)px/,
        (_, size) => `${Number(size) * scale}px`
    );
}

/**
 * @class TutorialStarterView
 * @description 스타터 선택 카드의 표시와 선택 버튼 사양을 제공합니다.
 */
export class TutorialStarterView {
    #renderPort;
    #assetPort;

    /** @param {object} renderPort - 주입된 렌더 의존성입니다. @param {object} assetPort - 에셋 읽기 포트입니다. */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
    }

    /**
     * 스타터 선택 화면의 순수 레이아웃을 계산합니다.
     * @param {object} viewModel - 스타터 뷰 모델입니다.
     * @returns {object} 카드·텍스트·버튼 레이아웃입니다.
     */
    getLayout(viewModel) {
        const { viewport, choices } = viewModel;
        const space = createTutorialDesignSpace(viewport);
        const tokens = TUTORIAL_UI_LAYOUT_TOKENS.STARTER;
        const cardTokens = [tokens.LEFT_CARD, tokens.RIGHT_CARD];
        const cards = choices.map((choice, index) => ({
            id: choice.id,
            ...projectTutorialDesignRect(space, cardTokens[index] || cardTokens[0])
        }));
        return {
            space,
            cards,
            contentRects: [...cards],
            buttons: [...cards]
        };
    }

    /**
     * 스타터 선택 화면을 그립니다.
     * @param {object} viewModel - 읽기 전용 스타터 상태입니다.
     */
    draw(viewModel) {
        const layout = this.getLayout(viewModel);
        const { colors, fonts } = viewModel;
        viewModel.choices.forEach((choice, index) => {
            const presentation = this.#resolveCardPresentation(viewModel, layout, index);
            const { alpha, center, rect: scaledRect, scale } = presentation;
            const cardImage = this.#assetPort.getUiAsset?.('starterCard');
            const baseFrameRect = fitTutorialAssetRect(cardImage, presentation.baseRect)
                || presentation.baseRect;
            const baseIconBackground = projectStarterCardRegion(
                baseFrameRect,
                TUTORIAL_UI_LAYOUT_TOKENS.STARTER.CARD_ICON_BACKGROUND
            );
            const iconBackground = scaleStarterRectAround(
                baseIconBackground,
                center,
                scale
            );
            this.#renderPort.render('ui', {
                shape: 'rect',
                x: iconBackground.x,
                y: iconBackground.y,
                w: iconBackground.w,
                h: iconBackground.h,
                fill: colors.UI.CardIconBackground,
                alpha
            });
            drawTutorialPixelAsset(this.#renderPort, {
                layer: 'ui',
                image: cardImage,
                rect: scaledRect,
                alpha
            });
            if (!(viewModel.titleTransition?.phase === 'starter-morph'
                && viewModel.titleTransition?.selectedItemId === choice.id)) {
                const baseIconRect = this.#resolveChoiceIconRect(
                    baseFrameRect,
                    choice.id
                );
                drawTutorialPixelAsset(this.#renderPort, {
                    layer: 'ui',
                    image: this.#assetPort.getItemIcon?.(choice.id),
                    rect: scaleStarterRectAround(baseIconRect, center, scale),
                    mode: 'exact',
                    alpha
                });
            }
            const titlePoint = scaleStarterPointAround({
                x: baseFrameRect.x + (baseFrameRect.w * 0.5),
                y: baseFrameRect.y + (
                    baseFrameRect.h
                    * TUTORIAL_UI_LAYOUT_TOKENS.STARTER.CARD_TITLE_CENTER_Y
                )
            }, center, scale);
            drawTutorialText(this.#renderPort, {
                text: choice.label,
                x: titlePoint.x,
                y: titlePoint.y,
                font: scaleStarterFont(fonts.BODY, scale),
                fill: colors.UI.PanelStrong,
                align: 'center',
                alpha
            });
            const baseDescriptionRect = projectStarterCardRegion(
                baseFrameRect,
                TUTORIAL_UI_LAYOUT_TOKENS.STARTER.CARD_DESCRIPTION
            );
            const baseDescriptionFont = scaleStarterFont(
                fonts.SMALL,
                TUTORIAL_UI_LAYOUT_TOKENS.STARTER.CARD_DESCRIPTION_FONT_SCALE
            );
            const lines = wrapTutorialText(
                this.#renderPort,
                choice.description,
                baseDescriptionFont,
                baseDescriptionRect.w,
                TUTORIAL_UI_LAYOUT_TOKENS.STARTER.CARD_DESCRIPTION_MAX_LINES
            );
            const baseLineHeight = Math.max(
                15,
                baseFrameRect.h
                    * TUTORIAL_UI_LAYOUT_TOKENS.STARTER.CARD_DESCRIPTION_LINE_HEIGHT
            );
            const baseFirstLineY = baseDescriptionRect.y
                + (baseDescriptionRect.h * 0.5)
                - (((lines.length - 1) * baseLineHeight) * 0.5);
            lines.forEach((line, lineIndex) => {
                const linePoint = scaleStarterPointAround({
                    x: baseDescriptionRect.x + (baseDescriptionRect.w * 0.5),
                    y: baseFirstLineY + (lineIndex * baseLineHeight)
                }, center, scale);
                drawTutorialText(this.#renderPort, {
                    text: line,
                    x: linePoint.x,
                    y: linePoint.y,
                    font: scaleStarterFont(baseDescriptionFont, scale),
                    fill: colors.UI.PanelStrong,
                    align: 'center',
                    alpha
                });
            });
        });
    }

    /**
     * 지정 스타터 카드 안에서 실제로 그려지는 아이콘 사각형을 반환합니다.
     * @param {object} viewModel - 스타터 뷰 모델입니다.
     * @param {string} itemId - 스타터 아이템 ID입니다.
     * @returns {object|null} 아이콘 렌더 사각형입니다.
     */
    getChoiceIconRect(viewModel, itemId) {
        const index = viewModel?.choices?.findIndex((choice) => choice.id === itemId) ?? -1;
        if (index < 0) {
            return null;
        }
        const layout = this.getLayout(viewModel);
        const presentation = this.#resolveCardPresentation(viewModel, layout, index);
        const cardImage = this.#assetPort.getUiAsset?.('starterCard');
        const baseFrameRect = fitTutorialAssetRect(cardImage, presentation.baseRect)
            || presentation.baseRect;
        return scaleStarterRectAround(
            this.#resolveChoiceIconRect(baseFrameRect, itemId),
            presentation.center,
            presentation.scale
        );
    }

    /**
     * 스타터 선택과 메뉴 복귀 명령 버튼을 반환합니다.
     * @param {object} viewModel - 스타터 뷰 모델입니다.
     * @returns {object[]} 직렬화 가능한 버튼 사양입니다.
     */
    getButtonSpecs(viewModel) {
        const layout = this.getLayout(viewModel);
        const choiceSpecs = viewModel.choices.map((choice, index) => ({
            key: 'starter-' + choice.id,
            ...layout.buttons[index],
            label: '',
            tooltip: `${choice.label}: ${choice.description}`,
            drawBackground: false,
            hoverScale: TUTORIAL_UI_LAYOUT_TOKENS.STARTER.CARD_HOVER_SCALE,
            active: index === viewModel.selectedIndex,
            command: {
                type: TUTORIAL_COMMANDS.CHOOSE_STARTER,
                payload: { itemId: choice.id }
            }
        }));
        return choiceSpecs;
    }

    /** @param {object} viewModel @param {object} layout @param {number} index @returns {object} @private */
    #resolveCardPresentation(viewModel, layout, index) {
        const transition = viewModel.titleTransition || {};
        const progress = Math.max(0, Math.min(1, Number(transition.progress) || 0));
        const entryProgress = transition.phase === 'starter-enter' ? progress : 1;
        const morphProgress = transition.phase === 'starter-morph' ? progress : 0;
        const selected = index === viewModel.selectedIndex;
        const selectionProgress = Math.max(
            0,
            Math.min(1, Number(viewModel.selectionProgress) || 0)
        );
        const selectionScale = selected
            ? viewModel.selectionMinScale
                + ((1 - viewModel.selectionMinScale) * selectionProgress)
            : 1;
        const entryScale = TUTORIAL_UI_LAYOUT_TOKENS.STARTER.ENTRY_MIN_SCALE
            + ((1 - TUTORIAL_UI_LAYOUT_TOKENS.STARTER.ENTRY_MIN_SCALE) * entryProgress);
        const choiceId = viewModel.choices[index]?.id;
        const requestedHoverScale = Number(viewModel.cardHoverScales?.[choiceId]);
        const hoverScale = Number.isFinite(requestedHoverScale)
            ? Math.max(1, Math.min(2, requestedHoverScale))
            : 1;
        const scale = selectionScale * entryScale * hoverScale;
        const card = layout.cards[index];
        const offsetY = layout.space.h
            * TUTORIAL_UI_LAYOUT_TOKENS.STARTER.ENTRY_OFFSET_Y
            * (1 - entryProgress);
        const baseRect = Object.freeze({
            x: card.x,
            y: card.y + offsetY,
            w: card.w,
            h: card.h
        });
        const center = Object.freeze({
            x: baseRect.x + (baseRect.w * 0.5),
            y: baseRect.y + (baseRect.h * 0.5)
        });
        return Object.freeze({
            alpha: entryProgress * (1 - morphProgress),
            baseRect,
            center,
            scale,
            rect: Object.freeze(scaleStarterRectAround(baseRect, center, scale))
        });
    }

    /** @param {object} frameRect @param {string} itemId @returns {object} @private */
    #resolveChoiceIconRect(frameRect, itemId) {
        const iconBackground = projectStarterCardRegion(
            frameRect,
            TUTORIAL_UI_LAYOUT_TOKENS.STARTER.CARD_ICON_BACKGROUND
        );
        const iconSize = Math.min(frameRect.w * 0.42, frameRect.h * 0.24);
        const container = {
            x: iconBackground.x + ((iconBackground.w - iconSize) * 0.5),
            y: iconBackground.y + ((iconBackground.h - iconSize) * 0.5),
            w: iconSize,
            h: iconSize
        };
        return fitTutorialAssetRect(this.#assetPort.getItemIcon?.(itemId), container)
            || container;
    }
}
