import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import {
    drawTutorialBackgroundPanel,
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
            drawTutorialBackgroundPanel(
                this.#renderPort,
                scaledRect,
                selected ? colors.UI.Accent : colors.UI.Panel,
                selected ? 0.42 : 0.22
            );
            drawTutorialPixelAsset(this.#renderPort, {
                layer: 'ui',
                image: this.#assetPort.getUiAsset?.('starterCard'),
                rect: scaledRect,
                alpha: selected ? 1 : 0.76
            });
            const iconSize = Math.min(card.w * 0.42, card.h * 0.24);
            drawTutorialPixelAsset(this.#renderPort, {
                layer: 'ui',
                image: this.#assetPort.getItemIcon?.(choice.id),
                rect: {
                    x: card.x + ((card.w - iconSize) * 0.5),
                    y: card.y + (card.h * 0.29),
                    w: iconSize,
                    h: iconSize
                },
                alpha: selected ? 1 : 0.76
            });
            drawTutorialText(this.#renderPort, {
                text: (selected ? '◆ ' : '') + choice.label,
                x: card.x + (card.w * 0.5),
                y: card.y + (card.h * 0.17),
                font: fonts.BODY,
                fill: colors.UI.PanelStrong,
                align: 'center'
            });
            const lines = wrapTutorialText(
                this.#renderPort,
                choice.description,
                fonts.SMALL,
                card.w * 0.72,
                4
            );
            lines.forEach((line, lineIndex) => {
                drawTutorialText(this.#renderPort, {
                    text: line,
                    x: card.x + (card.w * 0.5),
                    y: card.y + (card.h * 0.66)
                        + (lineIndex * Math.max(15, card.h * 0.07)),
                    font: fonts.SMALL,
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
