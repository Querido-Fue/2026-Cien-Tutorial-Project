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
        const map = projectTutorialDesignRect(space, tokens.MAP);
        const title = projectTutorialDesignRect(space, tokens.TITLE);
        const cardTokens = [tokens.LEFT_CARD, tokens.RIGHT_CARD];
        const cards = choices.map((choice, index) => ({
            id: choice.id,
            ...projectTutorialDesignRect(space, cardTokens[index] || cardTokens[0])
        }));
        return {
            space,
            map,
            title,
            cards,
            contentRects: [map, title, ...cards],
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
        const artwork = this.#assetPort.getMapArtwork?.('first-floor');
        const mapRect = fitTutorialAssetRect(artwork?.layers?.[0], layout.map)
            || layout.map;
        for (const image of artwork?.layers || []) {
            this.#renderPort.renderGL('background', {
                image,
                x: mapRect.x,
                y: mapRect.y,
                w: mapRect.w,
                h: mapRect.h,
                smoothing: false
            });
        }
        drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: this.#assetPort.getUiAsset?.('turnFrame'),
            rect: layout.title,
            alpha: 0.98
        });
        drawTutorialText(this.#renderPort, {
            text: '아이템 선택',
            x: layout.title.x + (layout.title.w * 0.5),
            y: layout.title.y + (layout.title.h * 0.5),
            font: fonts.HEADING,
            fill: colors.UI.Text,
            align: 'center'
        });
        viewModel.choices.forEach((choice, index) => {
            const card = layout.cards[index];
            const selected = index === viewModel.selectedIndex;
            const selectedScale = selected
                ? viewModel.selectionMinScale
                    + ((1 - viewModel.selectionMinScale) * viewModel.selectionProgress)
                : 1;
            const scaledRect = {
                x: card.x + ((card.w - (card.w * selectedScale)) * 0.5),
                y: card.y + ((card.h - (card.h * selectedScale)) * 0.5),
                w: card.w * selectedScale,
                h: card.h * selectedScale
            };
            const cardImage = this.#assetPort.getUiAsset?.('starterCard');
            const frameRect = fitTutorialAssetRect(cardImage, scaledRect)
                || scaledRect;
            const iconBackground = projectStarterCardRegion(
                frameRect,
                TUTORIAL_UI_LAYOUT_TOKENS.STARTER.CARD_ICON_BACKGROUND
            );
            this.#renderPort.render('ui', {
                shape: 'rect',
                x: iconBackground.x,
                y: iconBackground.y,
                w: iconBackground.w,
                h: iconBackground.h,
                fill: colors.UI.CardIconBackground,
                alpha: 1
            });
            drawTutorialPixelAsset(this.#renderPort, {
                layer: 'ui',
                image: cardImage,
                rect: scaledRect,
                alpha: 1
            });
            const iconSize = Math.min(frameRect.w * 0.42, frameRect.h * 0.24);
            drawTutorialPixelAsset(this.#renderPort, {
                layer: 'ui',
                image: this.#assetPort.getItemIcon?.(choice.id),
                rect: {
                    x: iconBackground.x + ((iconBackground.w - iconSize) * 0.5),
                    y: iconBackground.y + ((iconBackground.h - iconSize) * 0.5),
                    w: iconSize,
                    h: iconSize
                },
                alpha: 1
            });
            drawTutorialText(this.#renderPort, {
                text: (selected ? '◆ ' : '') + choice.label,
                x: frameRect.x + (frameRect.w * 0.5),
                y: frameRect.y + (
                    frameRect.h
                    * TUTORIAL_UI_LAYOUT_TOKENS.STARTER.CARD_TITLE_CENTER_Y
                ),
                font: fonts.BODY,
                fill: colors.UI.PanelStrong,
                align: 'center'
            });
            const descriptionRect = projectStarterCardRegion(
                frameRect,
                TUTORIAL_UI_LAYOUT_TOKENS.STARTER.CARD_DESCRIPTION
            );
            const descriptionFont = scaleStarterFont(
                fonts.SMALL,
                TUTORIAL_UI_LAYOUT_TOKENS.STARTER.CARD_DESCRIPTION_FONT_SCALE
            );
            const lines = wrapTutorialText(
                this.#renderPort,
                choice.description,
                descriptionFont,
                descriptionRect.w,
                TUTORIAL_UI_LAYOUT_TOKENS.STARTER.CARD_DESCRIPTION_MAX_LINES
            );
            const lineHeight = Math.max(
                15,
                frameRect.h
                    * TUTORIAL_UI_LAYOUT_TOKENS.STARTER.CARD_DESCRIPTION_LINE_HEIGHT
            );
            const firstLineY = descriptionRect.y
                + (descriptionRect.h * 0.5)
                - (((lines.length - 1) * lineHeight) * 0.5);
            lines.forEach((line, lineIndex) => {
                drawTutorialText(this.#renderPort, {
                    text: line,
                    x: descriptionRect.x + (descriptionRect.w * 0.5),
                    y: firstLineY + (lineIndex * lineHeight),
                    font: descriptionFont,
                    fill: colors.UI.PanelStrong,
                    align: 'center'
                });
            });
        });
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
            active: index === viewModel.selectedIndex,
            command: {
                type: TUTORIAL_COMMANDS.CHOOSE_STARTER,
                payload: { itemId: choice.id }
            }
        }));
        return choiceSpecs;
    }
}
