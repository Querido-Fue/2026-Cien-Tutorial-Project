import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import { drawTutorialPixelAsset, fitTutorialAssetRect } from './_tutorial_asset_view_helpers.js';
import {
    createTutorialTextAnchor,
    drawTutorialBackgroundPanel,
    drawTutorialText,
    getTutorialUiCenterX,
    toTutorialUiHeight,
    toTutorialUiWidth
} from './_tutorial_nonbattle_view_helpers.js';

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
        const centerX = getTutorialUiCenterX(viewport);
        const container = {
            x: centerX - toTutorialUiWidth(viewport, 38),
            y: toTutorialUiHeight(viewport, 9),
            w: toTutorialUiWidth(viewport, 76),
            h: toTutorialUiHeight(viewport, 72)
        };
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
        const buttonW = toTutorialUiWidth(viewport, 18);
        const buttonH = toTutorialUiHeight(viewport, 5.5);
        const gap = toTutorialUiWidth(viewport, 2);
        const buttons = [
            {
                x: centerX - buttonW - (gap * 0.5),
                y: toTutorialUiHeight(viewport, 86),
                w: buttonW,
                h: buttonH
            },
            {
                x: centerX + (gap * 0.5),
                y: toTutorialUiHeight(viewport, 86),
                w: buttonW,
                h: buttonH
            }
        ];
        return {
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
        const { colors, fonts, viewport, result } = viewModel;
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

        const drawCentered = (text, ratioY, font, fill) => drawTutorialText(
            this.#renderPort,
            {
                text,
                x: layout.rightPage.x + (layout.rightPage.w * 0.5),
                y: layout.rightPage.y + (layout.rightPage.h * ratioY),
                font,
                fill,
                align: 'center'
            }
        );
        drawCentered('the end', 0.11, fonts.SUBTITLE, colors.UI.Muted);
        drawCentered(
            result.displayName || 'happily ever after..?',
            0.24,
            fonts.HEADING,
            colors.UI.Accent
        );
        drawCentered(
            result.neutralized ? '로라 무력화 성공' : '로라 무력화 실패',
            0.38,
            fonts.BODY,
            result.neutralized ? colors.UI.Success : colors.UI.Danger
        );
        const reasonLabels = {
            'lora-neutralized': '종료 사유 · 로라 HP 0',
            'player-defeated': '종료 사유 · 플레이어 HP 0',
            'turn-limit': '종료 사유 · 로라 행동 12회 완료'
        };
        drawCentered(
            reasonLabels[result.reason] || '종료 사유 · 작전 판정',
            0.49,
            fonts.SMALL,
            colors.UI.Muted
        );
        drawCentered(
            '로라 행동  ' + String(result.loraActionsCompleted || 0) + '/12',
            0.61,
            fonts.BODY,
            colors.UI.Text
        );
        drawCentered(
            '최종 불안정도  ' + String(result.instability || 0),
            0.72,
            fonts.BODY,
            colors.UI.Text
        );
        drawTutorialText(this.#renderPort, {
            text: 'R 재시작 · Esc 나가기',
            x: layout.centerX,
            y: toTutorialUiHeight(viewport, 96),
            font: fonts.SMALL,
            fill: colors.UI.Muted,
            align: 'center'
        });
    }

    /**
     * 스타터 복귀와 메뉴 복귀 버튼 사양을 반환합니다.
     * @param {object} viewModel - 결과 뷰 모델입니다.
     * @returns {object[]} 직렬화 가능한 버튼 사양입니다.
     */
    getButtonSpecs(viewModel) {
        const layout = this.getLayout(viewModel);
        return [
            {
                key: 'result-retry',
                ...layout.buttons[0],
                label: '재시작하기  [R]',
                enabled: !viewModel.presentationLocked,
                command: { type: TUTORIAL_COMMANDS.RESTART }
            },
            {
                key: 'result-menu',
                ...layout.buttons[1],
                label: '나가기  [Esc]',
                enabled: !viewModel.presentationLocked,
                command: { type: TUTORIAL_COMMANDS.RETURN_MENU }
            }
        ];
    }
}
