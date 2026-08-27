import {
    clampBattleViewNumber,
    drawBattleViewText
} from './_tutorial_battle_view_helpers.js';

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
    }
}
