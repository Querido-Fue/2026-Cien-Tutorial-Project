export const TUTORIAL_TITLE_PHASES = Object.freeze({
    IDLE: 'idle',
    MENU_EXIT: 'menu-exit',
    STARTER_ENTER: 'starter-enter',
    STARTER_MORPH: 'starter-morph',
    BATTLE_REVEAL: 'battle-reveal'
});

/** @param {number} value @returns {number} 0~1 범위 진행도입니다. */
function clampProgress(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

/**
 * @class TutorialTitleFlowController
 * @description 타이틀 버튼 퇴장, 스타터 선택, 아이콘 모핑과 전투 공개 순서를 소유합니다.
 */
export class TutorialTitleFlowController {
    #animationPort;
    #choices;
    #config;
    #onChange;
    #onSelectionChange;
    #state;
    #selectedIndex;
    #generation;
    #ownedAnimationIds;
    #destroyed;

    /**
     * @param {object} options - 선택지, 애니메이션 포트와 변경 알림입니다.
     */
    constructor({
        animationPort = {},
        choices = [],
        config = {},
        initialItemId = null,
        onChange = () => {},
        onSelectionChange = () => {}
    } = {}) {
        this.#animationPort = animationPort;
        this.#choices = Object.freeze([...(Array.isArray(choices) ? choices : [])]);
        this.#config = Object.freeze({ ...config });
        this.#onChange = onChange;
        this.#onSelectionChange = onSelectionChange;
        this.#selectedIndex = Math.max(
            0,
            this.#choices.findIndex((choice) => choice?.id === initialItemId)
        );
        this.#state = {
            phase: TUTORIAL_TITLE_PHASES.IDLE,
            progress: 1,
            selectedItemId: null,
            revision: 0
        };
        this.#generation = 0;
        this.#ownedAnimationIds = new Set();
        this.#destroyed = false;
    }

    /** @returns {Readonly<object>} 현재 선택과 전환 표시 snapshot입니다. */
    getSnapshot() {
        return Object.freeze({
            phase: this.#state.phase,
            progress: clampProgress(this.#state.progress),
            selectedItemId: this.#state.selectedItemId,
            selectedIndex: this.#selectedIndex,
            revision: this.#state.revision
        });
    }

    /** @returns {number} 현재 스타터 선택 인덱스입니다. */
    getSelectedIndex() {
        return this.#selectedIndex;
    }

    /** @returns {string|null} 현재 선택한 스타터 ID입니다. */
    getSelectedItemId() {
        return this.#choices[this.#selectedIndex]?.id || null;
    }

    /** @returns {boolean} 타이틀 전환 중 입력 잠금 여부입니다. */
    isLocked() {
        return this.#state.phase !== TUTORIAL_TITLE_PHASES.IDLE;
    }

    /**
     * 현재 전환 단계에 맞는 버튼 투명도와 상호작용 상태를 계산합니다.
     * @returns {{alpha:number,interactive:boolean}} 버튼 표시 상태입니다.
     */
    getButtonPresentation() {
        const progress = clampProgress(this.#state.progress);
        let alpha = 1;
        if (this.#state.phase === TUTORIAL_TITLE_PHASES.MENU_EXIT
            || this.#state.phase === TUTORIAL_TITLE_PHASES.STARTER_MORPH) {
            alpha = 1 - progress;
        } else if (this.#state.phase === TUTORIAL_TITLE_PHASES.STARTER_ENTER
            || this.#state.phase === TUTORIAL_TITLE_PHASES.BATTLE_REVEAL) {
            alpha = progress;
        }
        return Object.freeze({ alpha, interactive: !this.isLocked() });
    }

    /**
     * 메뉴 버튼을 퇴장시킨 뒤 같은 타이틀 무대에 스타터 카드를 진입시킵니다.
     * @param {object} options - 중간 화면 교체 callback입니다.
     * @returns {boolean} 전환 시작 여부입니다.
     */
    openStarter({ onSwap = () => {} } = {}) {
        if (this.#destroyed || this.isLocked() || this.#choices.length <= 0) {
            return false;
        }
        const generation = ++this.#generation;
        void this.#runStarterEntry(generation, onSwap).catch(
            (error) => this.#handleTransitionError(generation, error)
        );
        return true;
    }

    /**
     * 현재 선택을 순환합니다.
     * @param {number} delta - 이동량입니다.
     * @returns {boolean} 선택 변경 여부입니다.
     */
    shift(delta) {
        if (this.#destroyed || this.isLocked() || this.#choices.length <= 0) {
            return false;
        }
        const step = Math.sign(Number(delta) || 0);
        if (step === 0) {
            return false;
        }
        const next = (
            this.#selectedIndex + step + this.#choices.length
        ) % this.#choices.length;
        return this.#selectIndex(next);
    }

    /**
     * 포인터가 가리킨 스타터를 현재 선택으로 맞춥니다.
     * @param {string} itemId - 스타터 ID입니다.
     * @returns {boolean} 선택 변경 여부입니다.
     */
    focus(itemId) {
        if (this.#destroyed || this.isLocked()) {
            return false;
        }
        return this.#selectIndex(this.#findChoiceIndex(itemId));
    }

    /**
     * 선택 아이콘을 HUD 슬롯으로 이동시킨 뒤 전투 화면을 공개합니다.
     * @param {string|null} itemId - 요청한 스타터 ID입니다.
     * @param {object} options - 전투 준비와 공개 완료 callback입니다.
     * @returns {boolean} 전환 시작 여부입니다.
     */
    choose(itemId, {
        onBattleReady = () => null,
        onRevealComplete = () => {}
    } = {}) {
        if (this.#destroyed || this.isLocked()) {
            return false;
        }
        const requestedIndex = itemId
            ? this.#findChoiceIndex(itemId)
            : this.#selectedIndex;
        if (requestedIndex < 0 || !this.#choices[requestedIndex]) {
            return false;
        }
        this.#selectIndex(requestedIndex);
        const selectedItemId = this.#choices[requestedIndex].id;
        const generation = ++this.#generation;
        void this.#runBattleTransition({
            generation,
            selectedItemId,
            onBattleReady,
            onRevealComplete
        }).catch((error) => this.#handleTransitionError(generation, error));
        return true;
    }

    /** 진행 중인 타이틀 전환과 stale callback을 취소합니다. */
    cancel() {
        this.#generation += 1;
        for (const animationId of this.#ownedAnimationIds) {
            this.#animationPort.remove?.(animationId);
        }
        this.#ownedAnimationIds.clear();
        this.#setPhase(TUTORIAL_TITLE_PHASES.IDLE, 1, null);
    }

    /** 소유 애니메이션과 callback을 정리합니다. */
    destroy() {
        this.cancel();
        this.#destroyed = true;
        this.#onChange = () => {};
        this.#onSelectionChange = () => {};
    }

    /** @param {number} generation @param {Function} onSwap @returns {Promise<void>} @private */
    async #runStarterEntry(generation, onSwap) {
        this.#setPhase(TUTORIAL_TITLE_PHASES.MENU_EXIT, 0, null);
        await this.#animateProgress(this.#config.TITLE_MENU_EXIT_SECONDS);
        if (!this.#isCurrent(generation)) {
            return;
        }
        onSwap();
        this.#setPhase(TUTORIAL_TITLE_PHASES.STARTER_ENTER, 0, null);
        await this.#animateProgress(this.#config.TITLE_STARTER_ENTER_SECONDS);
        if (this.#isCurrent(generation)) {
            this.#setPhase(TUTORIAL_TITLE_PHASES.IDLE, 1, null);
        }
    }

    /** @param {object} options @returns {Promise<void>} @private */
    async #runBattleTransition({
        generation,
        selectedItemId,
        onBattleReady,
        onRevealComplete
    }) {
        this.#setPhase(TUTORIAL_TITLE_PHASES.STARTER_MORPH, 0, selectedItemId);
        await this.#animateProgress(this.#config.TITLE_STARTER_MORPH_SECONDS);
        if (!this.#isCurrent(generation)) {
            return;
        }
        const battleContext = onBattleReady(selectedItemId);
        this.#setPhase(TUTORIAL_TITLE_PHASES.BATTLE_REVEAL, 0, selectedItemId);
        await this.#animateProgress(this.#config.TITLE_BATTLE_REVEAL_SECONDS);
        if (!this.#isCurrent(generation)) {
            return;
        }
        this.#setPhase(TUTORIAL_TITLE_PHASES.IDLE, 1, null);
        onRevealComplete(battleContext);
    }

    /** @param {number} index @returns {boolean} @private */
    #selectIndex(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.#choices.length
            || index === this.#selectedIndex) {
            return false;
        }
        this.#selectedIndex = index;
        this.#onSelectionChange(this.getSnapshot());
        this.#onChange(this.getSnapshot());
        return true;
    }

    /** @param {string} itemId @returns {number} @private */
    #findChoiceIndex(itemId) {
        return this.#choices.findIndex((choice) => choice?.id === itemId);
    }

    /** @param {string} phase @param {number} progress @param {string|null} selectedItemId @private */
    #setPhase(phase, progress, selectedItemId) {
        const changed = this.#state.phase !== phase
            || this.#state.selectedItemId !== selectedItemId;
        this.#state.phase = phase;
        this.#state.progress = clampProgress(progress);
        this.#state.selectedItemId = selectedItemId;
        if (changed) {
            this.#state.revision += 1;
        }
        this.#onChange(this.getSnapshot());
    }

    /** @param {number} duration @returns {Promise<void>} @private */
    #animateProgress(duration) {
        const seconds = Math.max(0, Number(duration) || 0);
        if (seconds <= 0) {
            this.#state.progress = 1;
            return Promise.resolve();
        }
        let animation = null;
        try {
            animation = this.#animationPort.animate?.(this.#state, {
                variable: 'progress',
                startValue: 0,
                endValue: 1,
                duration: seconds,
                type: this.#config.EASING || 'easeOutExpo'
            });
        } catch (error) {
            animation = null;
        }
        if (!animation || !Number.isInteger(animation.id) || animation.id < 0) {
            this.#state.progress = 1;
            return Promise.resolve();
        }
        this.#ownedAnimationIds.add(animation.id);
        return Promise.resolve(animation.promise).finally(() => {
            this.#ownedAnimationIds.delete(animation.id);
        });
    }

    /** @param {number} generation @returns {boolean} @private */
    #isCurrent(generation) {
        return !this.#destroyed && generation === this.#generation;
    }

    /** @param {number} generation @param {*} error @private */
    #handleTransitionError(generation, error) {
        if (!this.#isCurrent(generation)) {
            return;
        }
        console.error('타이틀 전환 오류:', error);
        this.cancel();
    }
}
