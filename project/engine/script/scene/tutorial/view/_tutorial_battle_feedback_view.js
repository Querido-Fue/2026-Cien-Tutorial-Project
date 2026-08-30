import {
    clampBattleViewNumber,
    drawBattleViewText,
    toBattleViewList
} from './_tutorial_battle_view_helpers.js';

/** @param {number} value @returns {number} 0..1 easeOutExpo 보간값입니다. */
function easeOutExpo(value) {
    const ratio = clampBattleViewNumber(value, 0, 1);
    return ratio >= 1 ? 1 : 1 - (2 ** (-10 * ratio));
}

/**
 * @class TutorialBattleFeedbackView
 * @description 전투 중 생성된 입자와 떠오르는 텍스트의 표시만 담당합니다.
 */
export class TutorialBattleFeedbackView {
    #renderPort;

    /** @param {{render:Function,renderGL:Function}} renderPort - 피드백 렌더 포트입니다. */
    constructor(renderPort) {
        this.#renderPort = renderPort;
    }

    /**
     * 현재 논리 층과 표현 층이 같을 때 일시적 피드백을 그립니다.
     * @param {object} viewModel - 장면이 조립한 읽기 전용 BattleViewModel입니다.
     */
    draw(viewModel) {
        if (!viewModel?.snapshot || !viewModel?.feedback) {
            return;
        }
        if (Number(viewModel.world.presentation.floorIndex)
            !== (Number(viewModel.snapshot.floorIndex) || 0)) {
            return;
        }
        for (const particle of viewModel.feedback.particles) {
            const ratio = clampBattleViewNumber(
                particle.seconds / particle.duration,
                0,
                1
            );
            this.#renderPort.renderGL('object', {
                shape: 'circle',
                x: particle.x + (particle.dx * ratio),
                y: particle.y + (particle.dy * ratio),
                w: particle.size * (1 - ratio),
                h: particle.size * (1 - ratio),
                fill: particle.fill || viewModel.colors.Effects.Move,
                alpha: 1 - ratio
            });
        }
        for (const entry of viewModel.feedback.floatingTexts) {
            const ratio = clampBattleViewNumber(
                entry.seconds / entry.duration,
                0,
                1
            );
            drawBattleViewText(this.#renderPort, {
                layer: 'texteffect',
                text: entry.text,
                x: entry.x,
                y: entry.y - (ratio * (viewModel.layout.viewport.WH * 0.03)),
                font: viewModel.fonts.BODY,
                fill: entry.fill,
                align: 'center',
                alpha: 1 - ratio
            });
        }
        for (const notice of toBattleViewList(viewModel.feedback.notices)) {
            this.#drawNotice(viewModel, notice);
        }
    }

    /** 전투 HUD 위에 짧은 입력 거절 안내를 그립니다. @private */
    #drawNotice(viewModel, notice) {
        const viewport = viewModel.layout.viewport;
        const elapsed = Math.max(0, Number(notice.seconds) || 0);
        const duration = Math.max(0.01, Number(notice.duration) || 1.6);
        const fadeIn = easeOutExpo(elapsed / 0.16);
        const fadeOut = easeOutExpo(Math.max(0, duration - elapsed) / 0.24);
        const alpha = Math.min(fadeIn, fadeOut);
        if (alpha <= 0) {
            return;
        }
        const uiWidth = Math.max(1, Number(viewport.UIWW) || Number(viewport.WW) || 1);
        const uiOffsetX = Number(viewport.UIOffsetX) || 0;
        const viewportHeight = Math.max(1, Number(viewport.WH) || 1);
        const width = clampBattleViewNumber(uiWidth * 0.3, 260, 430);
        const height = clampBattleViewNumber(viewportHeight * 0.052, 34, 48);
        const centerX = uiOffsetX + (uiWidth * 0.5);
        const centerY = viewportHeight * 0.82
            + ((1 - fadeIn) * Math.min(10, viewportHeight * 0.014));
        const colors = viewModel.colors.UI;
        this.#renderPort.render('texteffect', {
            shape: 'roundRect',
            x: centerX - (width * 0.5),
            y: centerY - (height * 0.5),
            w: width,
            h: height,
            radius: height * 0.24,
            fill: colors.ButtonIdle || '#18131d',
            stroke: colors.Danger || colors.Border,
            lineWidth: Math.max(1, Math.round(height * 0.045)),
            alpha: alpha * 0.94
        });
        drawBattleViewText(this.#renderPort, {
            layer: 'ui',
            text: notice.message,
            x: centerX,
            y: centerY,
            font: viewModel.fonts.SMALL || viewModel.fonts.BODY,
            fill: colors.Text,
            align: 'center',
            alpha
        });
    }
}
