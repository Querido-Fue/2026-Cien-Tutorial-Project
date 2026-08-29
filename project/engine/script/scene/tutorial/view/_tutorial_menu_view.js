import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import {
    drawTutorialText,
} from './_tutorial_nonbattle_view_helpers.js';
import { drawTutorialPixelAsset } from './_tutorial_asset_view_helpers.js';
import {
    createTutorialDesignSpace,
    projectTutorialDesignRect
} from './_tutorial_design_space.js';
import { TUTORIAL_UI_LAYOUT_TOKENS } from './_tutorial_ui_layout_tokens.js';

/**
 * @class TutorialMenuView
 * @description 메인 메뉴의 표시와 시작 버튼 사양을 제공합니다.
 */
export class TutorialMenuView {
    #renderPort;
    #assetPort;

    /** @param {object} renderPort - 주입된 렌더 의존성입니다. @param {object} assetPort - 에셋 읽기 포트입니다. */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
    }

    /**
     * 메인 메뉴의 순수 레이아웃을 계산합니다.
     * @param {object} viewModel - 메뉴 뷰 모델입니다.
     * @returns {object} 패널·텍스트·버튼 레이아웃입니다.
     */
    getLayout(viewModel) {
        const { viewport } = viewModel;
        const space = createTutorialDesignSpace(viewport);
        const tokens = TUTORIAL_UI_LAYOUT_TOKENS.MAIN;
        const logo = projectTutorialDesignRect(space, tokens.LOGO);
        const baseGroup = projectTutorialDesignRect(space, tokens.BUTTON_GROUP);
        const group = {
            x: Math.round(baseGroup.x - (baseGroup.w * (tokens.BUTTON_SCALE - 1) * 0.5)),
            y: Math.round(baseGroup.y - (baseGroup.h * (tokens.BUTTON_SCALE - 1) * 0.5)),
            w: Math.round(baseGroup.w * tokens.BUTTON_SCALE),
            h: Math.round(baseGroup.h * tokens.BUTTON_SCALE)
        };
        const gap = Math.max(
            4,
            Math.round(space.h * tokens.BUTTON_GAP * tokens.BUTTON_SCALE)
        );
        const buttonHeight = Math.max(1, Math.floor((group.h - (gap * 2)) / 3));
        const buttons = Array.from({ length: 3 }, (_, index) => Object.freeze({
            x: group.x,
            y: group.y + (index * (buttonHeight + gap)),
            w: group.w,
            h: buttonHeight
        }));
        return {
            space,
            logo,
            contentRects: [logo],
            buttons
        };
    }

    /**
     * 메인 메뉴를 그립니다.
     * @param {object} viewModel - 읽기 전용 메뉴 상태입니다.
     */
    draw(viewModel) {
        const layout = this.getLayout(viewModel);
        const { colors, fonts } = viewModel;
        const titleDrawn = drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: this.#assetPort.getUiAsset?.('mainTitle'),
            rect: layout.logo
        });
        if (!titleDrawn) {
            drawTutorialText(this.#renderPort, {
                text: viewModel.title,
                x: layout.logo.x + (layout.logo.w * 0.5),
                y: layout.logo.y + (layout.logo.h * 0.5),
                font: fonts.TITLE,
                fill: colors.UI.Text,
                align: 'center'
            });
        }
    }

    /**
     * 시작 명령을 내보내는 버튼 사양을 반환합니다.
     * @param {object} viewModel - 메뉴 뷰 모델입니다.
     * @returns {object[]} 직렬화 가능한 버튼 사양입니다.
     */
    getButtonSpecs(viewModel) {
        const [continueRect, startRect, galleryRect] = this.getLayout(viewModel).buttons;
        return [
            {
                key: 'menu-continue',
                ...continueRect,
                label: '계속하기',
                enabled: viewModel.canContinue === true,
                inspectable: true,
                tooltip: viewModel.canContinue === true
                    ? '중단한 전투를 이어합니다.'
                    : '저장된 전투가 없습니다.',
                backgroundAssetKey: 'mainButton',
                backgroundImageAlpha: 0.95,
                drawSolidBackground: false,
                fitHitToBackground: true
            },
            {
                key: 'menu-start',
                ...startRect,
                label: '새 게임',
                backgroundAssetKey: 'mainButton',
                backgroundImageAlpha: 0.95,
                drawSolidBackground: false,
                fitHitToBackground: true,
                command: { type: TUTORIAL_COMMANDS.START }
            },
            {
                key: 'menu-gallery',
                ...galleryRect,
                label: '갤러리',
                backgroundAssetKey: 'mainButton',
                backgroundImageAlpha: 0.95,
                drawSolidBackground: false,
                fitHitToBackground: true,
                command: { type: TUTORIAL_COMMANDS.OPEN_GALLERY }
            }
        ];
    }
}
