const CLOSED_CARD_INDEX = -1;

/**
 * 값이 배열이 아닌 일반 객체인지 확인합니다.
 * @param {unknown} value - 검사할 값입니다.
 * @returns {boolean} 키 기반 객체이면 true입니다.
 */
function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/**
 * 문자열이 비어 있지 않은지 확인하고 앞뒤 공백을 제거합니다.
 * @param {unknown} value - 검사할 값입니다.
 * @param {string} label - 오류 메시지에 사용할 데이터 경로입니다.
 * @returns {string} 정규화된 문자열입니다.
 */
function requireIdentifier(value, label) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new TypeError(`TutorialCutsceneController: ${label}는 비어 있지 않은 문자열이어야 합니다.`);
    }
    return value.trim();
}

/**
 * 필수 표시 문자열을 검증합니다.
 * @param {unknown} value - 검사할 값입니다.
 * @param {string} label - 오류 메시지에 사용할 데이터 경로입니다.
 * @returns {string} 검증된 원본 문자열입니다.
 */
function requireText(value, label) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new TypeError(`TutorialCutsceneController: ${label}는 비어 있지 않은 문자열이어야 합니다.`);
    }
    return value;
}

/**
 * 외부에 전달할 카드 복사본을 생성합니다.
 * @param {{speaker:string,text:string,tone?:string}|null} card - 내부 카드 데이터입니다.
 * @returns {{speaker:string,text:string,tone?:string}|null} 독립된 카드 복사본입니다.
 */
function cloneCard(card) {
    if (!card) {
        return null;
    }

    const copy = {
        speaker: card.speaker,
        text: card.text
    };
    if (card.tone !== undefined) {
        copy.tone = card.tone;
    }
    return copy;
}

/**
 * @class TutorialCutsceneController
 * @description 고정 스크립트 컷씬의 카드 진행 상태만 관리하는 순수 컨트롤러입니다.
 */
export class TutorialCutsceneController {
    #registry;
    #activeCutsceneId;
    #cardIndex;
    #completedCutsceneId;

    /**
     * @param {object} registry - 단일 컷씬 정의 또는 ID를 키로 사용하는 컷씬 레지스트리입니다.
     */
    constructor(registry) {
        this.#registry = this.#normalizeRegistry(registry);
        this.#activeCutsceneId = null;
        this.#cardIndex = CLOSED_CARD_INDEX;
        this.#completedCutsceneId = null;
    }

    /**
     * 지정한 컷씬을 첫 카드부터 엽니다.
     * @param {string} cutsceneId - 열 컷씬 ID입니다.
     * @returns {object} 전환 결과와 현재 상태입니다.
     */
    open(cutsceneId) {
        if (typeof cutsceneId !== 'string' || cutsceneId.trim().length === 0) {
            return this.#createTransitionResult({
                ok: false,
                reason: 'invalid-cutscene-id'
            });
        }

        const normalizedId = cutsceneId.trim();
        if (!this.#registry.has(normalizedId)) {
            return this.#createTransitionResult({
                ok: false,
                reason: 'unknown-cutscene-id'
            });
        }

        this.#activeCutsceneId = normalizedId;
        this.#cardIndex = 0;
        this.#completedCutsceneId = null;
        return this.#createTransitionResult({
            ok: true,
            opened: true
        });
    }

    /**
     * 다음 카드로 이동하고 마지막 카드 이후에는 컷씬을 완료 상태로 닫습니다.
     * @returns {object} 진행 여부, 닫힘 여부와 완료된 컷씬 ID입니다.
     */
    next() {
        if (!this.isOpen()) {
            return this.#createTransitionResult({
                ok: false,
                closed: true,
                reason: 'cutscene-not-open',
                completedCutsceneId: null
            });
        }

        const activeCutscene = this.#registry.get(this.#activeCutsceneId);
        if (this.#cardIndex < activeCutscene.cards.length - 1) {
            this.#cardIndex += 1;
            return this.#createTransitionResult({
                ok: true,
                advanced: true
            });
        }

        const completedCutsceneId = this.#activeCutsceneId;
        this.#activeCutsceneId = null;
        this.#cardIndex = CLOSED_CARD_INDEX;
        this.#completedCutsceneId = completedCutsceneId;
        return this.#createTransitionResult({
            ok: true,
            advanced: true,
            closed: true,
            completedCutsceneId
        });
    }

    /**
     * 현재 컷씬을 완료 처리 없이 닫습니다.
     * @returns {object} 닫힘 결과와 초기화된 현재 상태입니다.
     */
    close() {
        this.#activeCutsceneId = null;
        this.#cardIndex = CLOSED_CARD_INDEX;
        this.#completedCutsceneId = null;
        return this.#createTransitionResult({
            ok: true,
            closed: true,
            completedCutsceneId: null
        });
    }

    /**
     * 현재 컷씬이 열려 있는지 확인합니다.
     * @returns {boolean} 유효한 활성 카드가 있으면 true입니다.
     */
    isOpen() {
        const activeCutscene = this.#registry.get(this.#activeCutsceneId);
        return Boolean(activeCutscene
            && this.#cardIndex >= 0
            && this.#cardIndex < activeCutscene.cards.length);
    }

    /**
     * 현재 표시할 카드의 독립된 복사본을 반환합니다.
     * @returns {{speaker:string,text:string,tone?:string}|null} 현재 카드 또는 닫힌 상태의 null입니다.
     */
    getCurrentCard() {
        if (!this.isOpen()) {
            return null;
        }
        return cloneCard(this.#registry.get(this.#activeCutsceneId).cards[this.#cardIndex]);
    }

    /**
     * 렌더러와 입력 계층에서 사용할 현재 진행 상태를 반환합니다.
     * @returns {{open:boolean,cutsceneId:string|null,title:string,cardIndex:number,cardCount:number,hasNextCard:boolean,completedCutsceneId:string|null}} 현재 상태입니다.
     */
    getState() {
        const activeCutscene = this.isOpen()
            ? this.#registry.get(this.#activeCutsceneId)
            : null;
        return {
            open: Boolean(activeCutscene),
            cutsceneId: activeCutscene ? activeCutscene.id : null,
            title: activeCutscene ? activeCutscene.title : '',
            cardIndex: activeCutscene ? this.#cardIndex : CLOSED_CARD_INDEX,
            cardCount: activeCutscene ? activeCutscene.cards.length : 0,
            hasNextCard: Boolean(activeCutscene && this.#cardIndex < activeCutscene.cards.length - 1),
            completedCutsceneId: this.#completedCutsceneId
        };
    }

    /**
     * 단일 정의 또는 키 기반 레지스트리를 검증하고 내부 불변 복사본으로 변환합니다.
     * @param {object} registry - 정규화할 원본 레지스트리입니다.
     * @returns {Map<string,object>} ID로 조회할 내부 컷씬 지도입니다.
     * @private
     */
    #normalizeRegistry(registry) {
        if (!isRecord(registry)) {
            throw new TypeError('TutorialCutsceneController: 컷씬 레지스트리 객체가 필요합니다.');
        }

        const isSingleDefinition = Object.prototype.hasOwnProperty.call(registry, 'id')
            || Object.prototype.hasOwnProperty.call(registry, 'cards');
        const entries = isSingleDefinition
            ? [[null, registry]]
            : Object.entries(registry);
        if (entries.length === 0) {
            throw new TypeError('TutorialCutsceneController: 컷씬 레지스트리가 비어 있습니다.');
        }

        const normalizedRegistry = new Map();
        entries.forEach(([registryKey, definition], index) => {
            const normalized = this.#normalizeCutscene(
                definition,
                registryKey,
                `registry[${index}]`
            );
            if (normalizedRegistry.has(normalized.id)) {
                throw new RangeError(`TutorialCutsceneController: 컷씬 ID '${normalized.id}'가 중복되었습니다.`);
            }
            normalizedRegistry.set(normalized.id, normalized);
        });
        return normalizedRegistry;
    }

    /**
     * 컷씬 정의 하나를 검증하고 복제합니다.
     * @param {object} definition - 원본 컷씬 정의입니다.
     * @param {string|null} fallbackId - 정의에 ID가 없을 때 사용할 레지스트리 키입니다.
     * @param {string} label - 오류 메시지용 데이터 경로입니다.
     * @returns {{id:string,title:string,cards:ReadonlyArray<object>}} 정규화된 컷씬입니다.
     * @private
     */
    #normalizeCutscene(definition, fallbackId, label) {
        if (!isRecord(definition)) {
            throw new TypeError(`TutorialCutsceneController: ${label}는 컷씬 객체여야 합니다.`);
        }

        const idSource = definition.id === undefined ? fallbackId : definition.id;
        const id = requireIdentifier(idSource, `${label}.id`);
        const title = requireText(definition.title, `${label}.title`);
        if (!Array.isArray(definition.cards) || definition.cards.length === 0) {
            throw new TypeError(`TutorialCutsceneController: ${label}.cards는 하나 이상의 카드를 가져야 합니다.`);
        }

        const cards = definition.cards.map((card, cardIndex) => (
            this.#normalizeCard(card, `${label}.cards[${cardIndex}]`)
        ));
        return Object.freeze({
            id,
            title,
            cards: Object.freeze(cards)
        });
    }

    /**
     * 카드 정의를 검증하고 내부 불변 복사본으로 변환합니다.
     * @param {object} card - 원본 카드 정의입니다.
     * @param {string} label - 오류 메시지용 데이터 경로입니다.
     * @returns {{speaker:string,text:string,tone?:string}} 정규화된 카드입니다.
     * @private
     */
    #normalizeCard(card, label) {
        if (!isRecord(card)) {
            throw new TypeError(`TutorialCutsceneController: ${label}는 카드 객체여야 합니다.`);
        }

        const normalized = {
            speaker: requireText(card.speaker, `${label}.speaker`),
            text: requireText(card.text, `${label}.text`)
        };
        if (card.tone !== undefined) {
            if (typeof card.tone !== 'string') {
                throw new TypeError(`TutorialCutsceneController: ${label}.tone은 문자열이어야 합니다.`);
            }
            normalized.tone = card.tone;
        }
        return Object.freeze(normalized);
    }

    /**
     * 모든 공개 전환 메서드가 공유하는 결과 객체를 생성합니다.
     * @param {object} options - 전환 결과 플래그입니다.
     * @returns {object} 현재 카드와 상태 스냅샷을 포함한 결과입니다.
     * @private
     */
    #createTransitionResult(options) {
        const result = {
            ok: options.ok === true,
            opened: options.opened === true,
            advanced: options.advanced === true,
            closed: options.closed === true,
            completedCutsceneId: options.completedCutsceneId ?? null,
            currentCard: this.getCurrentCard(),
            state: this.getState()
        };
        if (typeof options.reason === 'string') {
            result.reason = options.reason;
        }
        return result;
    }
}
