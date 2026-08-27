import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import {
    createTutorialTextAnchor,
    drawTutorialBackgroundPanel,
    drawTutorialText,
    getTutorialUiCenterX,
    toTutorialUiHeight,
    toTutorialUiWidth,
    wrapTutorialText
} from './_tutorial_nonbattle_view_helpers.js';

/**
 * @class TutorialStarterView
 * @description 스타터 선택 카드의 표시와 선택 버튼 사양을 제공합니다.
 */
export class TutorialStarterView {
    #renderPort;

    /** @param {object} renderPort - 주입된 렌더 의존성입니다. */
    constructor(renderPort) {
        this.#renderPort = renderPort;
    }

    /**
     * 스타터 선택 화면의 순수 레이아웃을 계산합니다.
     * @param {object} viewModel - 스타터 뷰 모델입니다.
     * @returns {object} 카드·텍스트·버튼 레이아웃입니다.
     */
    getLayout(viewModel) {
        const { viewport, choices } = viewModel;
        const centerX = getTutorialUiCenterX(viewport);
        const cardW = toTutorialUiWidth(viewport, 27);
        const gap = toTutorialUiWidth(viewport, 3);
        const count = Math.max(1, choices.length);
        const startX = Number(viewport.UIOffsetX)
            + ((Number(viewport.UIWW) - ((cardW * count) + (gap * (count - 1)))) * 0.5);
        const cards = choices.map((choice, index) => ({
            id: choice.id,
            x: startX + (index * (cardW + gap)),
            y: toTutorialUiHeight(viewport, 31),
            w: cardW,
            h: toTutorialUiHeight(viewport, 22)
        }));
        const choiceButtons = cards.map((card) => ({
            x: card.x,
            y: toTutorialUiHeight(viewport, 55),
            w: card.w,
            h: toTutorialUiHeight(viewport, 11)
        }));
        const backButton = {
            x: Number(viewport.UIOffsetX) + toTutorialUiWidth(viewport, 4),
            y: toTutorialUiHeight(viewport, 88),
            w: toTutorialUiWidth(viewport, 14),
            h: toTutorialUiHeight(viewport, 5)
        };
        return {
            centerX,
            cards,
            contentRects: [
                createTutorialTextAnchor(centerX, toTutorialUiHeight(viewport, 18)),
                createTutorialTextAnchor(centerX, toTutorialUiHeight(viewport, 25)),
                createTutorialTextAnchor(centerX, toTutorialUiHeight(viewport, 73)),
                ...cards
            ],
            buttons: [...choiceButtons, backButton]
        };
    }

    /**
     * 스타터 선택 화면을 그립니다.
     * @param {object} viewModel - 읽기 전용 스타터 상태입니다.
     */
    draw(viewModel) {
        const layout = this.getLayout(viewModel);
        const { colors, fonts, viewport } = viewModel;
        drawTutorialText(this.#renderPort, {
            text: '출발 장비 선택',
            x: layout.centerX,
            y: toTutorialUiHeight(viewport, 18),
            font: fonts.TITLE,
            fill: colors.UI.Text,
            align: 'center'
        });
        drawTutorialText(this.#renderPort, {
            text: '매 턴 이동 경로를 먼저 확정한 뒤 행동합니다. 출발 장비를 고르세요.',
            x: layout.centerX,
            y: toTutorialUiHeight(viewport, 25),
            font: fonts.BODY,
            fill: colors.UI.Muted,
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
                selected ? colors.UI.PanelStrong : colors.UI.Panel,
                0.95
            );
            drawTutorialText(this.#renderPort, {
                text: choice.label,
                x: card.x + (card.w * 0.5),
                y: toTutorialUiHeight(viewport, 36),
                font: fonts.HEADING,
                fill: colors.UI.Text,
                align: 'center'
            });
            const lines = wrapTutorialText(
                this.#renderPort,
                choice.description,
                fonts.SMALL,
                card.w * 0.8,
                3
            );
            lines.forEach((line, lineIndex) => {
                drawTutorialText(this.#renderPort, {
                    text: line,
                    x: card.x + (card.w * 0.5),
                    y: toTutorialUiHeight(viewport, 42)
                        + (lineIndex * toTutorialUiHeight(viewport, 2.7)),
                    font: fonts.SMALL,
                    fill: colors.UI.Muted,
                    align: 'center'
                });
            });
        });
        drawTutorialText(this.#renderPort, {
            text: '방향키/WASD 선택 · Enter 확정',
            x: layout.centerX,
            y: toTutorialUiHeight(viewport, 73),
            font: fonts.SMALL,
            fill: colors.UI.Muted,
            align: 'center'
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
            label: (index === viewModel.selectedIndex ? '◆ ' : '') + choice.label,
            active: index === viewModel.selectedIndex,
            command: {
                type: TUTORIAL_COMMANDS.CHOOSE_STARTER,
                payload: { itemId: choice.id }
            }
        }));
        return [...choiceSpecs, {
            key: 'starter-back',
            ...layout.buttons[layout.buttons.length - 1],
            label: '메뉴  [Esc]',
            command: { type: TUTORIAL_COMMANDS.RETURN_MENU }
        }];
    }
}
