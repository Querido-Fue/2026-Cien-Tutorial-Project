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
 * @class TutorialResultView
 * @description 작전 결과 요약의 표시와 이탈 버튼 사양을 제공합니다.
 */
export class TutorialResultView {
    #renderPort;

    /** @param {object} renderPort - 주입된 렌더 의존성입니다. */
    constructor(renderPort) {
        this.#renderPort = renderPort;
    }

    /**
     * 결과 화면의 순수 레이아웃을 계산합니다.
     * @param {object} viewModel - 결과 뷰 모델입니다.
     * @returns {object} 패널·텍스트·버튼 레이아웃입니다.
     */
    getLayout(viewModel) {
        const { viewport } = viewModel;
        const centerX = getTutorialUiCenterX(viewport);
        const panel = {
            x: centerX - toTutorialUiWidth(viewport, 22),
            y: toTutorialUiHeight(viewport, 20),
            w: toTutorialUiWidth(viewport, 44),
            h: toTutorialUiHeight(viewport, 58)
        };
        const buttonW = toTutorialUiWidth(viewport, 18);
        const buttonH = toTutorialUiHeight(viewport, 5.5);
        const gap = toTutorialUiWidth(viewport, 2);
        const buttons = [
            {
                x: centerX - buttonW - (gap * 0.5),
                y: toTutorialUiHeight(viewport, 72),
                w: buttonW,
                h: buttonH
            },
            {
                x: centerX + (gap * 0.5),
                y: toTutorialUiHeight(viewport, 72),
                w: buttonW,
                h: buttonH
            }
        ];
        return {
            centerX,
            panel,
            contentRects: [
                panel,
                createTutorialTextAnchor(centerX, panel.y + toTutorialUiHeight(viewport, 8)),
                createTutorialTextAnchor(centerX, panel.y + toTutorialUiHeight(viewport, 46))
            ],
            buttons
        };
    }

    /**
     * 결과 요약을 그립니다.
     * @param {object} viewModel - 읽기 전용 결과 상태입니다.
     */
    draw(viewModel) {
        const layout = this.getLayout(viewModel);
        const { colors, fonts, viewport, result } = viewModel;
        drawTutorialBackgroundPanel(
            this.#renderPort,
            layout.panel,
            colors.UI.PanelStrong,
            0.98
        );
        const drawCentered = (text, y, font, fill) => drawTutorialText(this.#renderPort, {
            text,
            x: layout.centerX,
            y,
            font,
            fill,
            align: 'center'
        });
        drawCentered(
            '작전 결과',
            layout.panel.y + toTutorialUiHeight(viewport, 8),
            fonts.TITLE,
            colors.UI.Text
        );
        drawCentered(
            result.label || '작전 종료',
            layout.panel.y + toTutorialUiHeight(viewport, 19),
            fonts.HEADING,
            colors.UI.Accent
        );
        drawCentered(
            result.neutralized ? '로라 무력화 성공' : '로라 무력화 실패',
            layout.panel.y + toTutorialUiHeight(viewport, 26),
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
            layout.panel.y + toTutorialUiHeight(viewport, 32),
            fonts.BODY,
            colors.UI.Muted
        );
        drawCentered(
            '로라 행동  ' + String(result.loraActionsCompleted || 0)
                + '/12  ·  최종 불안정도  ' + String(result.instability || 0),
            layout.panel.y + toTutorialUiHeight(viewport, 38),
            fonts.BODY,
            colors.UI.Muted
        );
        drawCentered(
            '점수  ' + String(result.score || 0)
                + '  ·  최고 ' + String(viewModel.bestScore),
            layout.panel.y + toTutorialUiHeight(viewport, 46),
            fonts.HEADING,
            colors.UI.Text
        );
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
                label: '스타터 선택  [R]',
                enabled: !viewModel.presentationLocked,
                command: { type: TUTORIAL_COMMANDS.RESTART }
            },
            {
                key: 'result-menu',
                ...layout.buttons[1],
                label: '메뉴  [Esc]',
                enabled: !viewModel.presentationLocked,
                command: { type: TUTORIAL_COMMANDS.RETURN_MENU }
            }
        ];
    }
}
