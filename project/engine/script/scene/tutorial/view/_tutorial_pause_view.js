import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import { drawTutorialText } from './_tutorial_nonbattle_view_helpers.js';
import { drawTutorialPixelAsset } from './_tutorial_asset_view_helpers.js';
import {
    createTutorialDesignSpace,
    projectTutorialDesignRect
} from './_tutorial_design_space.js';
import { TUTORIAL_UI_LAYOUT_TOKENS } from './_tutorial_ui_layout_tokens.js';

/**
 * @class TutorialPauseView
 * @description 보존된 전투 위에 dim과 세로 Pause 메뉴를 표시합니다.
 */
export class TutorialPauseView {
    #renderPort;
    #assetPort;

    /** @param {object} renderPort @param {object} assetPort */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
    }

    /** @param {object} viewModel @returns {object} */
    getLayout(viewModel) {
        const space = createTutorialDesignSpace(viewModel.viewport);
        const tokens = TUTORIAL_UI_LAYOUT_TOKENS.PAUSE;
        const panel = projectTutorialDesignRect(space, tokens.PANEL);
        const group = projectTutorialDesignRect(space, tokens.BUTTON_GROUP);
        const gap = Math.max(4, Math.round(space.scale * 5));
        const buttonHeight = Math.max(1, Math.floor((group.h - (gap * 2)) / 3));
        const buttons = Array.from({ length: 3 }, (_, index) => Object.freeze({
            x: group.x,
            y: group.y + (index * (buttonHeight + gap)),
            w: group.w,
            h: buttonHeight
        }));
        return {
            space,
            panel,
            contentRects: [panel],
            buttons
        };
    }

    /** @param {object} viewModel */
    draw(viewModel) {
        const layout = this.getLayout(viewModel);
        this.#renderPort.render('ui', {
            shape: 'rect',
            x: layout.space.x,
            y: layout.space.y,
            w: layout.space.w,
            h: layout.space.h,
            fill: viewModel.colors.UI.OverlayDim,
            alpha: 0.64
        });
        drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: this.#assetPort.getUiAsset?.('pausePanel'),
            rect: layout.panel,
            alpha: 1
        });
        drawTutorialText(this.#renderPort, {
            text: '일시정지',
            x: layout.panel.x + (layout.panel.w * 0.5),
            y: layout.panel.y + (layout.panel.h * 0.18),
            font: viewModel.fonts.HEADING,
            fill: viewModel.colors.UI.Text,
            align: 'center'
        });
    }

    /** @param {object} viewModel @returns {object[]} */
    getButtonSpecs(viewModel) {
        const layout = this.getLayout(viewModel);
        const entries = [
            ['pause-resume', '계속하기', TUTORIAL_COMMANDS.RESUME],
            ['pause-restart', '재시작하기', TUTORIAL_COMMANDS.RESTART],
            ['pause-exit', '나가기', TUTORIAL_COMMANDS.RETURN_MENU]
        ];
        return entries.map(([key, label, type], index) => ({
            key,
            ...layout.buttons[index],
            label,
            active: index === viewModel.selectedIndex,
            backgroundAssetKey: 'mainButton',
            backgroundImageAlpha: 0.94,
            fitHitToBackground: true,
            command: { type }
        }));
    }
}
