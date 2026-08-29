import { TUTORIAL_COMMANDS as COMMANDS } from './_tutorial_scene_constants.js';

/**
 * 로라 턴의 대기·행동 표시·완료 2단계 예약 수명주기를 소유합니다.
 */
export class TutorialLoraTurnController {
    /** @param {object} options - 모델과 장면 경계를 노출하는 작은 포트입니다. */
    constructor(options = {}) {
        this.getModel = options.getModel;
        this.getRevision = options.getRevision;
        this.canApply = options.canApply;
        this.canSchedule = options.canSchedule;
        this.enqueueCommand = options.enqueueCommand;
        this.onModelChange = options.onModelChange;
        this.selection = options.selection;
        this.beforeSeconds = Number(options.beforeSeconds) || 0.22;
        this.showSeconds = Number(options.showSeconds) || 1.15;
        this.reset();
    }

    /** 예약 상태를 모두 지웁니다. */
    reset() {
        this.state = null;
    }

    /** 모델이 로라 턴에 진입했으면 행동 전 대기 단계를 한 번 엽니다. */
    armIfNeeded() {
        const model = this.#getModel();
        if (this.state
            || !model
            || model.turn !== 'lora'
            || !this.#canApply()) {
            return false;
        }
        this.state = {
            stage: 'before',
            seconds: 0,
            queued: false
        };
        return true;
    }

    /** 경과 시간에 맞춰 다음 로라 명령을 한 번만 예약합니다. */
    update(deltaSeconds) {
        if (!this.state
            || this.state.queued
            || !this.#canSchedule()) {
            return;
        }
        this.state.seconds += Math.max(0, Number(deltaSeconds) || 0);
        if (this.state.stage === 'before'
            && this.state.seconds >= this.beforeSeconds) {
            this.#queue(COMMANDS.PERFORM_LORA);
        } else if (this.state.stage === 'show'
            && this.state.seconds >= this.showSeconds) {
            this.#queue(COMMANDS.COMPLETE_LORA);
        }
    }

    /** 예약 세대가 유효할 때 로라 행동을 모델에 적용합니다. */
    applyAction(payload) {
        const model = this.#getModel();
        if (!this.#matchesRevision(payload)
            || !this.#canApply()
            || model?.turn !== 'lora'
            || this.state?.stage !== 'before') {
            return;
        }
        const result = model.performLoraTurn();
        this.state = {
            stage: 'show',
            seconds: 0,
            queued: false
        };
        this.onModelChange(result);
    }

    /** 행동 표시 뒤 몹·다음 플레이어 단계까지 모델 턴을 완료합니다. */
    applyCompletion(payload) {
        const model = this.#getModel();
        if (!this.#matchesRevision(payload)
            || !this.#canApply()
            || model?.turn !== 'lora'
            || this.state?.stage !== 'show') {
            return;
        }
        const result = model.completeLoraTurn();
        this.state = null;
        this.selection.clearActionSelections();
        this.selection.resetPath(model);
        this.onModelChange(result);
    }

    /** 다음 단계 명령과 현재 타임라인 세대를 함께 큐에 넣습니다. */
    #queue(type) {
        this.state.queued = true;
        this.enqueueCommand({
            type,
            payload: { timelineRevision: this.#getRevision() }
        });
    }

    /** @returns {object|null} 현재 모델입니다. */
    #getModel() {
        return typeof this.getModel === 'function' ? this.getModel() : null;
    }

    /** @returns {number} 현재 타임라인 세대입니다. */
    #getRevision() {
        return Number(this.getRevision?.()) || 0;
    }

    /** @returns {boolean} 모델 명령을 지금 적용할 수 있는지 반환합니다. */
    #canApply() {
        return this.canApply?.() === true;
    }

    /** @returns {boolean} 예약 타이머를 지금 진행할 수 있는지 반환합니다. */
    #canSchedule() {
        return this.canSchedule?.() === true;
    }

    /** @returns {boolean} 명령 payload가 현재 타임라인 세대와 같은지 확인합니다. */
    #matchesRevision(payload) {
        return Number(payload?.timelineRevision) === this.#getRevision();
    }
}
