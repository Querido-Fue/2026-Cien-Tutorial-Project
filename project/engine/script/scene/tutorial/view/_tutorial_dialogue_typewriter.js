/** @returns {Intl.Segmenter|null} 사용할 수 있는 grapheme 분할기입니다. */
function createGraphemeSegmenter() {
    if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') {
        return null;
    }
    try {
        return new Intl.Segmenter('ko', { granularity: 'grapheme' });
    } catch (error) {
        return null;
    }
}

/**
 * 문자열을 사용자에게 보이는 글자 단위로 나눕니다.
 * @param {string} text - 분할할 문자열입니다.
 * @param {Intl.Segmenter|null} segmenter - 선택적 grapheme 분할기입니다.
 * @returns {string[]} 글자 배열입니다.
 */
function splitDialogueCharacters(text, segmenter) {
    if (segmenter) {
        return Array.from(segmenter.segment(text), ({ segment }) => segment);
    }
    return Array.from(text);
}

/**
 * @class TutorialDialogueTypewriter
 * @description 현재 대화 카드의 grapheme 단위 타이핑 진행도만 관리합니다.
 */
export class TutorialDialogueTypewriter {
    #characterIntervalSeconds;
    #segmenter;
    #key;
    #text;
    #characters;
    #visibleCount;
    #accumulatedSeconds;

    /**
     * @param {object} options - 글자 간격과 선택적 분할기입니다.
     * @param {number} options.characterIntervalSeconds - 한 글자를 공개하는 간격입니다.
     * @param {Intl.Segmenter|null} [options.segmenter] - 테스트 가능한 grapheme 분할기입니다.
     */
    constructor({
        characterIntervalSeconds,
        segmenter = createGraphemeSegmenter()
    } = {}) {
        const interval = Number(characterIntervalSeconds);
        if (!(interval > 0)) {
            throw new RangeError('TutorialDialogueTypewriter: 글자 간격은 0보다 커야 합니다.');
        }
        this.#characterIntervalSeconds = interval;
        this.#segmenter = segmenter;
        this.reset();
    }

    /**
     * 현재 카드와 타이핑 대상을 맞춥니다.
     * @param {{key:string,text:string}|null} dialogue - 카드 식별자와 전체 문장입니다.
     * @returns {Readonly<object>} 현재 표시 스냅샷입니다.
     */
    sync(dialogue) {
        if (!dialogue) {
            this.reset();
            return this.getSnapshot();
        }
        const key = String(dialogue.key ?? '');
        const text = String(dialogue.text ?? '');
        if (key !== this.#key || text !== this.#text) {
            this.#key = key;
            this.#text = text;
            this.#characters = splitDialogueCharacters(text, this.#segmenter);
            this.#visibleCount = 0;
            this.#accumulatedSeconds = 0;
        }
        return this.getSnapshot();
    }

    /**
     * 가변 프레임 델타만큼 현재 문장의 공개 글자 수를 진행합니다.
     * @param {{key:string,text:string}|null} dialogue - 카드 식별자와 전체 문장입니다.
     * @param {number} deltaSeconds - 경과 시간입니다.
     * @returns {Readonly<object>} 갱신된 표시 스냅샷입니다.
     */
    update(dialogue, deltaSeconds) {
        this.sync(dialogue);
        if (!dialogue || this.#visibleCount >= this.#characters.length) {
            return this.getSnapshot();
        }
        const delta = Math.max(0, Number(deltaSeconds) || 0);
        this.#accumulatedSeconds += delta;
        const revealCount = Math.floor(
            (this.#accumulatedSeconds + Number.EPSILON)
            / this.#characterIntervalSeconds
        );
        if (revealCount > 0) {
            this.#visibleCount = Math.min(
                this.#characters.length,
                this.#visibleCount + revealCount
            );
            this.#accumulatedSeconds -= revealCount * this.#characterIntervalSeconds;
            if (this.#visibleCount >= this.#characters.length) {
                this.#accumulatedSeconds = 0;
            }
        }
        return this.getSnapshot();
    }

    /**
     * 아직 타이핑 중인 현재 문장을 즉시 전부 공개합니다.
     * @param {{key:string,text:string}|null} dialogue - 카드 식별자와 전체 문장입니다.
     * @returns {boolean} 새로 공개한 글자가 있으면 true입니다.
     */
    revealAll(dialogue) {
        this.sync(dialogue);
        if (!dialogue || this.#visibleCount >= this.#characters.length) {
            return false;
        }
        this.#visibleCount = this.#characters.length;
        this.#accumulatedSeconds = 0;
        return true;
    }

    /** @returns {Readonly<object>} 현재 타이핑 표시 상태입니다. */
    getSnapshot() {
        return Object.freeze({
            visibleText: this.#characters.slice(0, this.#visibleCount).join(''),
            visibleCharacterCount: this.#visibleCount,
            characterCount: this.#characters.length,
            complete: this.#visibleCount >= this.#characters.length
        });
    }

    /** 현재 카드와 누적 시간을 비웁니다. */
    reset() {
        this.#key = null;
        this.#text = '';
        this.#characters = [];
        this.#visibleCount = 0;
        this.#accumulatedSeconds = 0;
    }
}
