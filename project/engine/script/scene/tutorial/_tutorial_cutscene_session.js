import { TutorialCutsceneController } from './_tutorial_cutscene_controller.js';

/** @param {unknown} value @returns {string|null} */
function normalizeIdentifier(value) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return null;
    }
    return value.trim();
}

/** @param {object} registry @returns {Set<string>} */
function collectRegisteredIds(registry) {
    const singleDefinition = registry
        && typeof registry === 'object'
        && (Object.prototype.hasOwnProperty.call(registry, 'id')
            || Object.prototype.hasOwnProperty.call(registry, 'cards'));
    const entries = singleDefinition ? [[null, registry]] : Object.entries(registry || {});
    return new Set(entries.map(([key, definition]) => (
        normalizeIdentifier(definition?.id ?? key)
    )).filter(Boolean));
}

/** @param {unknown} value @param {string} fallback @returns {string} */
function normalizeReturnMode(value, fallback) {
    return normalizeIdentifier(value) || fallback;
}

/**
 * @class TutorialCutsceneSession
 * @description 컷씬 재생기의 런 중복, 대기열과 닫힘 뒤 복귀 모드를 한 수명주기로 관리합니다.
 */
export class TutorialCutsceneSession {
    #controller;
    #enabled;
    #knownIds;
    #pending;
    #returnMode;
    #runCutsceneIds;

    /**
     * @param {object} options - 컷씬 레지스트리와 런 초기 상태입니다.
     * @param {object} options.registry - 컷씬 정의 레지스트리입니다.
     * @param {boolean} [options.enabled=true] - 컷씬 기능 활성 여부입니다.
     * @param {string} options.initialReturnMode - 모든 컷씬이 닫힌 뒤 복귀할 초기 모드입니다.
     */
    constructor({ registry, enabled = true, initialReturnMode } = {}) {
        const returnMode = normalizeIdentifier(initialReturnMode);
        if (!returnMode) {
            throw new TypeError('TutorialCutsceneSession: initialReturnMode 문자열이 필요합니다.');
        }
        this.#controller = new TutorialCutsceneController(registry);
        this.#enabled = enabled === true;
        this.#knownIds = collectRegisteredIds(registry);
        this.#pending = [];
        this.#returnMode = returnMode;
        this.#runCutsceneIds = new Set();
    }

    /** @returns {boolean} 현재 컷씬 카드가 열려 있으면 true입니다. */
    isOpen() {
        return this.#controller.isOpen();
    }

    /** @returns {object} 현재 컷씬 카드 진행 상태입니다. */
    getState() {
        return this.#controller.getState();
    }

    /** @returns {object|null} 현재 표시할 카드입니다. */
    getCurrentCard() {
        return this.#controller.getCurrentCard();
    }

    /** @returns {boolean} 현재 컷씬 뒤에 열 대기 항목이 있으면 true입니다. */
    hasPending() {
        return this.#pending.length > 0;
    }

    /**
     * 컷씬을 즉시 열거나 현재 컷씬 뒤에 한 번만 예약합니다.
     * @param {string} id - 컷씬 ID입니다.
     * @param {string} returnMode - 이 컷씬이 마지막일 때 복귀할 모드입니다.
     * @param {{repeat?:boolean}} [options={}] - 같은 런의 명시적 반복 허용 여부입니다.
     * @returns {object} 열림 또는 예약 결과입니다.
     */
    open(id, returnMode, { repeat = false } = {}) {
        const normalizedId = normalizeIdentifier(id);
        if (!normalizedId) {
            return this.#createRejectedResult('invalid-cutscene-id');
        }
        if (!this.#enabled) {
            return this.#createRejectedResult('cutscenes-disabled');
        }
        if (!this.#knownIds.has(normalizedId)) {
            return this.#createRejectedResult('unknown-cutscene-id');
        }
        if (!repeat && this.#runCutsceneIds.has(normalizedId)) {
            return this.#createRejectedResult('duplicate-cutscene');
        }

        const normalizedReturnMode = normalizeReturnMode(returnMode, this.#returnMode);
        if (this.isOpen()) {
            const state = this.getState();
            if (state.cutsceneId === normalizedId) {
                return this.#createRejectedResult('cutscene-already-open');
            }
            if (this.#pending.some((entry) => entry.id === normalizedId)) {
                return this.#createRejectedResult('cutscene-already-queued');
            }
            this.#runCutsceneIds.add(normalizedId);
            this.#pending.push(Object.freeze({
                id: normalizedId,
                returnMode: normalizedReturnMode
            }));
            return Object.freeze({
                ok: true,
                opened: false,
                queued: true,
                cutsceneId: normalizedId,
                state: this.getState()
            });
        }

        const transition = this.#controller.open(normalizedId);
        if (transition.ok) {
            this.#runCutsceneIds.add(normalizedId);
            this.#returnMode = normalizedReturnMode;
        }
        return Object.freeze({ ...transition, queued: false });
    }

    /**
     * 다음 카드로 진행하고 닫혔다면 다음 예약 또는 복귀 모드를 결정합니다.
     * @returns {object} 카드 진행과 세션 복귀 결과입니다.
     */
    advance() {
        const transition = this.#controller.next();
        if (!transition.ok || !transition.closed) {
            return Object.freeze({
                ...transition,
                openedCutsceneId: null,
                resumeMode: null
            });
        }
        return this.#resolveClosedTransition(transition);
    }

    /**
     * 현재 컷씬을 본 것으로 반환하면서 닫고 다음 예약 또는 복귀 모드를 결정합니다.
     * @returns {object} 닫힘과 세션 복귀 결과입니다.
     */
    skip() {
        if (!this.isOpen()) {
            return this.#createRejectedResult('cutscene-not-open');
        }
        const completedCutsceneId = this.getState().cutsceneId;
        const transition = this.#controller.close();
        return this.#resolveClosedTransition({
            ...transition,
            completedCutsceneId
        });
    }

    /**
     * 열린 카드와 런 한정 중복·대기 상태를 초기화합니다.
     * @param {{returnMode?:string}} [options={}] - 초기화 뒤 기본 복귀 모드입니다.
     */
    reset({ returnMode } = {}) {
        this.#controller.close();
        this.#pending = [];
        this.#runCutsceneIds.clear();
        this.#returnMode = normalizeReturnMode(returnMode, this.#returnMode);
    }

    /** @param {object} transition @returns {object} @private */
    #resolveClosedTransition(transition) {
        const next = this.#pending.shift() || null;
        if (next) {
            this.#returnMode = next.returnMode;
            const opened = this.#controller.open(next.id);
            return Object.freeze({
                ...transition,
                openedCutsceneId: opened.ok ? next.id : null,
                resumeMode: null
            });
        }
        return Object.freeze({
            ...transition,
            openedCutsceneId: null,
            resumeMode: this.#returnMode
        });
    }

    /** @param {string} reason @returns {object} @private */
    #createRejectedResult(reason) {
        return Object.freeze({
            ok: false,
            opened: false,
            queued: false,
            closed: !this.isOpen(),
            reason,
            openedCutsceneId: null,
            resumeMode: null,
            state: this.getState()
        });
    }
}
