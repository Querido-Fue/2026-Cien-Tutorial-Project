/**
 * @class TutorialGuidanceController
 * @description 전투 안내의 단일 단계, 페이드, 포커스 전환 수명을 소유합니다.
 */
export class TutorialGuidanceController {
    #open;
    #stepCount;
    #stepIndex;
    #previousStepIndex;
    #phase;
    #elapsedSeconds;
    #transitionSeconds;
    #revision;
    #onComplete;

    /** @param {{stepCount?:number,transitionSeconds?:number,onComplete?:Function}} options */
    constructor({
        stepCount = 1,
        transitionSeconds = 0.5,
        onComplete = () => {}
    } = {}) {
        this.#open = false;
        this.#stepCount = Math.max(1, Math.trunc(Number(stepCount)) || 1);
        this.#stepIndex = 0;
        this.#previousStepIndex = null;
        this.#phase = 'closed';
        this.#elapsedSeconds = 0;
        this.#transitionSeconds = Math.max(
            0.01,
            Number(transitionSeconds) || 0.5
        );
        this.#revision = 0;
        this.#onComplete = onComplete;
    }

    /**
     * 새 전투에서 메타 진행도에 따라 안내 표시 여부를 정합니다.
     * @param {{seen?:boolean}} policy - 저장된 안내 확인 정책입니다.
     */
    beginRun(policy = {}) {
        this.reset();
        if (policy.seen !== true) {
            this.show();
        }
    }

    /** 사용자가 요청한 단계 안내를 첫 메시지부터 엽니다. @returns {boolean} */
    show() {
        if (this.#open && this.#phase !== 'closing') {
            return false;
        }
        this.#open = true;
        this.#stepIndex = 0;
        this.#previousStepIndex = null;
        this.#phase = 'opening';
        this.#elapsedSeconds = 0;
        this.#revision += 1;
        return true;
    }

    /**
     * 현재 안내를 다음 단계로 넘기고 마지막 단계 뒤에는 닫기 전환을 시작합니다.
     * @returns {boolean} 단계 또는 닫기 상태가 바뀌었는지 여부입니다.
     */
    advance() {
        if (!this.#open || this.#phase !== 'idle') {
            return false;
        }
        if (this.#stepIndex >= this.#stepCount - 1) {
            return this.dismiss();
        }
        this.#previousStepIndex = this.#stepIndex;
        this.#stepIndex += 1;
        this.#phase = 'step';
        this.#elapsedSeconds = 0;
        this.#revision += 1;
        return true;
    }

    /**
     * 현재 안내를 닫습니다.
     * @returns {boolean} 열린 안내가 닫혔는지 여부입니다.
     */
    dismiss() {
        if (!this.#open || this.#phase === 'closing') {
            return false;
        }
        this.#phase = 'closing';
        this.#elapsedSeconds = 0;
        this.#revision += 1;
        this.#onComplete();
        return true;
    }

    /**
     * 진행 중인 easeOutExpo 전환을 갱신합니다.
     * @param {number} deltaSeconds - 가변 프레임 델타입니다.
     * @returns {boolean} 버튼 구성을 다시 만들 상태 경계를 통과했는지 여부입니다.
     */
    update(deltaSeconds) {
        if (!this.#open || this.#phase === 'idle' || this.#phase === 'closed') {
            return false;
        }
        this.#elapsedSeconds = Math.min(
            this.#transitionSeconds,
            this.#elapsedSeconds + Math.max(0, Number(deltaSeconds) || 0)
        );
        if (this.#elapsedSeconds < this.#transitionSeconds) {
            return false;
        }
        if (this.#phase === 'closing') {
            this.#open = false;
            this.#phase = 'closed';
            this.#previousStepIndex = null;
        } else {
            this.#phase = 'idle';
            this.#previousStepIndex = null;
        }
        this.#revision += 1;
        return true;
    }

    /** @returns {Readonly<object>} 렌더러가 소비할 불변 표현 상태입니다. */
    getSnapshot() {
        const linearProgress = this.#phase === 'idle'
            ? 1
            : Math.min(1, this.#elapsedSeconds / this.#transitionSeconds);
        const easedProgress = this.#easeOutExpo(linearProgress);
        const closing = this.#phase === 'closing';
        const blurProgress = this.#phase === 'opening'
            ? easedProgress
            : (closing ? 1 - easedProgress : (this.#open ? 1 : 0));
        return Object.freeze({
            open: this.#open,
            interactive: this.#open && this.#phase === 'idle',
            stepIndex: this.#stepIndex,
            previousStepIndex: this.#previousStepIndex,
            stepCount: this.#stepCount,
            phase: this.#phase,
            messageAlpha: closing ? 1 - easedProgress : easedProgress,
            blurProgress,
            focusProgress: this.#phase === 'step' ? easedProgress : 1,
            revision: this.#revision
        });
    }

    /** @returns {Readonly<object>} 키보드 매퍼용 최소 입력 상태입니다. */
    createKeyboardState() {
        const snapshot = this.getSnapshot();
        return Object.freeze({
            guidanceOpen: snapshot.open,
            guidanceInteractive: snapshot.interactive
        });
    }

    /** @returns {boolean} 안내가 열려 있는지 여부입니다. */
    isOpen() {
        return this.#open;
    }

    /** 런 이탈 시 표시 상태를 비웁니다. */
    reset() {
        this.#open = false;
        this.#stepIndex = 0;
        this.#previousStepIndex = null;
        this.#phase = 'closed';
        this.#elapsedSeconds = 0;
        this.#revision += 1;
    }

    /** @param {number} progress @returns {number} @private */
    #easeOutExpo(progress) {
        if (progress <= 0) {
            return 0;
        }
        if (progress >= 1) {
            return 1;
        }
        return 1 - Math.pow(2, -10 * progress);
    }
}
