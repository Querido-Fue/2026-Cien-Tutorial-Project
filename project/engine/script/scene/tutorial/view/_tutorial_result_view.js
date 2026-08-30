import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import { drawTutorialPixelAsset, fitTutorialAssetRect } from './_tutorial_asset_view_helpers.js';
import {
    createTutorialTextAnchor,
    drawTutorialBackgroundPanel,
    drawTutorialText,
    wrapTutorialText
} from './_tutorial_nonbattle_view_helpers.js';
import {
    createTutorialDesignSpace,
    projectTutorialDesignRect
} from './_tutorial_design_space.js';
import { TUTORIAL_UI_LAYOUT_TOKENS } from './_tutorial_ui_layout_tokens.js';

/**
 * @class TutorialResultView
 * @description 내부 엔딩 ID와 분리된 표시명으로 책 기반 결과 화면을 제공합니다.
 */
export class TutorialResultView {
    #renderPort;
    #assetPort;

    /** @param {object} renderPort - 렌더 포트입니다. @param {object} assetPort - 에셋 읽기 포트입니다. */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
    }

    /**
     * 결과 책과 버튼의 순수 레이아웃을 계산합니다.
     * @param {object} viewModel - 결과 뷰 모델입니다.
     * @returns {object} 결과 레이아웃입니다.
     */
    getLayout(viewModel) {
        const { viewport } = viewModel;
        const space = createTutorialDesignSpace(viewport);
        const centerX = space.x + (space.w * 0.5);
        const container = projectTutorialDesignRect(
            space,
            TUTORIAL_UI_LAYOUT_TOKENS.RESULT.BOOK
        );
        const book = fitTutorialAssetRect(
            this.#assetPort.getUiAsset?.('endingBook1'),
            container
        ) || container;
        const leftPage = {
            x: book.x + (book.w * 0.07),
            y: book.y + (book.h * 0.12),
            w: book.w * 0.39,
            h: book.h * 0.75
        };
        const rightPage = {
            x: book.x + (book.w * 0.54),
            y: book.y + (book.h * 0.12),
            w: book.w * 0.39,
            h: book.h * 0.75
        };
        const projectedButtonGroup = projectTutorialDesignRect(
            space,
            TUTORIAL_UI_LAYOUT_TOKENS.RESULT.BUTTON_GROUP
        );
        const buttonGroup = {
            ...projectedButtonGroup,
            x: Math.round(
                rightPage.x + ((rightPage.w - projectedButtonGroup.w) * 0.5)
            )
        };
        const buttonGap = Math.max(5, space.h * 0.012);
        const buttonH = (buttonGroup.h - buttonGap) * 0.5;
        const buttons = [
            {
                x: buttonGroup.x,
                y: buttonGroup.y,
                w: buttonGroup.w,
                h: buttonH
            },
            {
                x: buttonGroup.x,
                y: buttonGroup.y + buttonH + buttonGap,
                w: buttonGroup.w,
                h: buttonH
            }
        ];
        return {
            space,
            centerX,
            book,
            leftPage,
            rightPage,
            contentRects: [
                book,
                leftPage,
                rightPage,
                createTutorialTextAnchor(
                    rightPage.x + (rightPage.w * 0.5),
                    rightPage.y + (rightPage.h * 0.18)
                )
            ],
            buttons
        };
    }

    /** @param {object} viewModel - 읽기 전용 결과 상태입니다. */
    draw(viewModel) {
        const layout = this.getLayout(viewModel);
        const { colors } = viewModel;
        const artwork = this.#assetPort.getMapArtwork?.('basement') || null;
        const mapTarget = projectTutorialDesignRect(
            layout.space,
            TUTORIAL_UI_LAYOUT_TOKENS.BATTLE.MAP
        );
        const mapRect = fitTutorialAssetRect(artwork?.layers?.[0], mapTarget)
            || mapTarget;
        for (const image of artwork?.layers || []) {
            this.#renderPort.render('ui', {
                shape: 'image',
                image,
                ...mapRect,
                alpha: 0.58,
                smoothing: false
            });
        }
        this.#renderPort.render('ui', {
            shape: 'rect',
            x: layout.space.x,
            y: layout.space.y,
            w: layout.space.w,
            h: layout.space.h,
            fill: colors.UI.PanelStrong,
            alpha: 0.24
        });
        const bookDrawn = drawTutorialPixelAsset(this.#renderPort, {
            image: this.#assetPort.getUiAsset?.('endingBook1'),
            rect: layout.book
        });
        if (!bookDrawn) {
            drawTutorialBackgroundPanel(this.#renderPort, layout.book, colors.UI.PanelStrong, 0.98);
        }
        drawTutorialPixelAsset(this.#renderPort, {
            image: this.#assetPort.getUiAsset?.('endingLetters'),
            rect: {
                x: layout.leftPage.x + (layout.leftPage.w * 0.08),
                y: layout.leftPage.y + (layout.leftPage.h * 0.27),
                w: layout.leftPage.w * 0.84,
                h: layout.leftPage.h * 0.36
            }
        });
        const endingName = viewModel.result?.displayName
            || 'happily ever after..?';
        const nameLines = wrapTutorialText(
            this.#renderPort,
            endingName,
            viewModel.fonts.HEADING,
            layout.rightPage.w * 0.78,
            2
        );
        const lineHeight = Math.max(18, layout.rightPage.h * 0.065);
        const firstLineY = layout.rightPage.y + (layout.rightPage.h * 0.28)
            - (((nameLines.length - 1) * lineHeight) * 0.5);
        nameLines.forEach((line, index) => drawTutorialText(this.#renderPort, {
            text: line,
            x: layout.rightPage.x + (layout.rightPage.w * 0.5),
            y: firstLineY + (index * lineHeight),
            font: viewModel.fonts.HEADING,
            fill: colors.UI.PanelStrong,
            align: 'center'
        }));

    }

    /**
     * 스타터 복귀와 메뉴 복귀 버튼 사양을 반환합니다.
     * @param {object} viewModel - 결과 뷰 모델입니다.
     * @returns {object[]} 직렬화 가능한 버튼 사양입니다.
     */
    getButtonSpecs(viewModel) {
        const layout = this.getLayout(viewModel);
        const result = viewModel.result || {};
        const summary = [
            result.displayName || '결과',
            result.neutralized ? '로라 무력화 성공' : '로라 무력화 실패',
            '로라 행동 ' + String(result.loraActionsCompleted || 0) + '/12',
            '최종 불안정도 ' + String(result.instability || 0)
        ].join(' · ');
        return [
            {
                key: 'result-retry',
                ...layout.buttons[0],
                label: '재시작하기',
                backgroundAssetKey: 'mainButton',
                backgroundImageAlpha: 0.9,
                fitHitToBackground: true,
                tooltip: summary,
                enabled: !viewModel.presentationLocked,
                command: { type: TUTORIAL_COMMANDS.RESTART }
            },
            {
                key: 'result-menu',
                ...layout.buttons[1],
                label: '나가기',
                backgroundAssetKey: 'mainButton',
                backgroundImageAlpha: 0.9,
                fitHitToBackground: true,
                tooltip: summary,
                enabled: !viewModel.presentationLocked,
                command: { type: TUTORIAL_COMMANDS.RETURN_MENU }
            }
        ];
    }
}
