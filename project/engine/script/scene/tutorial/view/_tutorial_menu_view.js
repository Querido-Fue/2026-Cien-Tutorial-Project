import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import {
    createTutorialTextAnchor,
    drawTutorialBackgroundPanel,
    drawTutorialText,
    getTutorialUiCenterX,
    toTutorialUiHeight,
    toTutorialUiWidth
} from './_tutorial_nonbattle_view_helpers.js';

/**
 * @class TutorialMenuView
 * @description 메인 메뉴의 표시와 시작 버튼 사양을 제공합니다.
 */
export class TutorialMenuView {
    #renderPort;

    /** @param {object} renderPort - 주입된 렌더 의존성입니다. */
    constructor(renderPort) {
        this.#renderPort = renderPort;
    }

    /**
     * 메인 메뉴의 순수 레이아웃을 계산합니다.
     * @param {object} viewModel - 메뉴 뷰 모델입니다.
     * @returns {object} 패널·텍스트·버튼 레이아웃입니다.
     */
    getLayout(viewModel) {
        const { viewport } = viewModel;
        const centerX = getTutorialUiCenterX(viewport);
        const panelW = toTutorialUiWidth(viewport, 38);
        const panelH = toTutorialUiHeight(viewport, 12);
        const buttonW = toTutorialUiWidth(viewport, 24);
        const panel = {
            x: centerX - (panelW * 0.5),
            y: toTutorialUiHeight(viewport, 44) - (panelH * 0.5),
            w: panelW,
            h: panelH
        };
        const startButton = {
            x: centerX - (buttonW * 0.5),
            y: toTutorialUiHeight(viewport, 58),
            w: buttonW,
            h: toTutorialUiHeight(viewport, 6)
        };
        return {
            centerX,
            panel,
            contentRects: [
                panel,
                createTutorialTextAnchor(centerX, toTutorialUiHeight(viewport, 24)),
                createTutorialTextAnchor(centerX, toTutorialUiHeight(viewport, 31)),
                createTutorialTextAnchor(centerX, toTutorialUiHeight(viewport, 82))
            ],
            buttons: [startButton]
        };
    }

    /**
     * 메인 메뉴를 그립니다.
     * @param {object} viewModel - 읽기 전용 메뉴 상태입니다.
     */
    draw(viewModel) {
        const layout = this.getLayout(viewModel);
        const { colors, fonts, viewport } = viewModel;
        drawTutorialText(this.#renderPort, {
            text: viewModel.title,
            x: layout.centerX,
            y: toTutorialUiHeight(viewport, 24),
            font: fonts.TITLE,
            fill: colors.UI.Text,
            align: 'center'
        });
        drawTutorialText(this.#renderPort, {
            text: viewModel.subtitle,
            x: layout.centerX,
            y: toTutorialUiHeight(viewport, 31),
            font: fonts.SUBTITLE,
            fill: colors.UI.Muted,
            align: 'center'
        });
        drawTutorialBackgroundPanel(this.#renderPort, layout.panel, colors.UI.Panel, 0.9);
        drawTutorialText(this.#renderPort, {
            text: '플레이 ' + String(viewModel.playCount)
                + '회  ·  최고 점수 ' + String(viewModel.bestScore),
            x: layout.centerX,
            y: toTutorialUiHeight(viewport, 41.5),
            font: fonts.BODY,
            fill: colors.UI.Text,
            align: 'center'
        });
        drawTutorialText(this.#renderPort, {
            text: '이동 4칸 지정 → 행동 → 로라 → 몹 · 총 12회',
            x: layout.centerX,
            y: toTutorialUiHeight(viewport, 47),
            font: fonts.SMALL,
            fill: colors.UI.Muted,
            align: 'center'
        });
        drawTutorialText(this.#renderPort, {
            text: 'Enter 시작',
            x: layout.centerX,
            y: toTutorialUiHeight(viewport, 82),
            font: fonts.SMALL,
            fill: colors.UI.Muted,
            align: 'center'
        });
    }

    /**
     * 시작 명령을 내보내는 버튼 사양을 반환합니다.
     * @param {object} viewModel - 메뉴 뷰 모델입니다.
     * @returns {object[]} 직렬화 가능한 버튼 사양입니다.
     */
    getButtonSpecs(viewModel) {
        const [rect] = this.getLayout(viewModel).buttons;
        return [{
            key: 'menu-start',
            ...rect,
            label: '게임 시작  [Enter]',
            command: { type: TUTORIAL_COMMANDS.START }
        }];
    }
}
