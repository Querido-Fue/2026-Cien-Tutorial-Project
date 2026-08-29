/**
 * 키보드의 현재 눌림과 프레임 사이 빠른 탭을 하나의 상승 에지로 정규화합니다.
 */
export class TutorialKeyboardEdgeTracker {
    /**
     * @param {object} options - 감시 키와 입력 조회 포트입니다.
     * @param {readonly string[]} options.watchedCodes - 감시할 KeyboardEvent.code 목록입니다.
     * @param {(code:string)=>boolean} options.getCodeInput - 현재 키 눌림 조회 함수입니다.
     * @param {()=>object|null} options.getSnapshot - 마지막 키 이벤트 조회 함수입니다.
     */
    constructor({ watchedCodes, getCodeInput, getSnapshot }) {
        this.watchedCodes = Object.freeze([...watchedCodes]);
        this.getCodeInput = getCodeInput;
        this.getSnapshot = getSnapshot;
        this.keyboardLatch = new Map();
        this.keyboardPressObserved = new Map();
        this.frameKeyEdges = new Set();
        const initialEventTime = Number(this.getSnapshot()?.lastEvent?.timeStamp);
        this.lastKeyboardEventTimestamp = Number.isFinite(initialEventTime)
            ? initialEventTime
            : -1;

        for (const code of this.watchedCodes) {
            const isDown = this.getCodeInput(code) === true;
            this.keyboardLatch.set(code, isDown);
            this.keyboardPressObserved.set(code, isDown);
        }
    }

    /** 현재 눌림과 프레임 사이 빠른 탭을 이번 프레임 상승 에지로 합칩니다. */
    prepare() {
        this.frameKeyEdges.clear();
        for (const code of this.watchedCodes) {
            const isDown = this.getCodeInput(code) === true;
            if (isDown && this.keyboardLatch.get(code) !== true) {
                this.frameKeyEdges.add(code);
                this.keyboardPressObserved.set(code, true);
            }
        }

        const lastEvent = this.getSnapshot()?.lastEvent;
        const eventTimestamp = Number(lastEvent?.timeStamp);
        const code = lastEvent?.code;
        if (!Number.isFinite(eventTimestamp)
            || eventTimestamp === this.lastKeyboardEventTimestamp
            || !this.watchedCodes.includes(code)) {
            return;
        }
        this.lastKeyboardEventTimestamp = eventTimestamp;
        if (lastEvent.pressed === true) {
            if (this.keyboardLatch.get(code) !== true
                && this.keyboardPressObserved.get(code) !== true) {
                this.frameKeyEdges.add(code);
            }
            this.keyboardPressObserved.set(code, true);
            return;
        }
        if (this.keyboardPressObserved.get(code) !== true) {
            this.frameKeyEdges.add(code);
        }
        this.keyboardPressObserved.set(code, false);
    }

    /** 다음 프레임 비교를 위해 현재 키 상태를 저장합니다. */
    capture() {
        for (const code of this.watchedCodes) {
            this.keyboardLatch.set(code, this.getCodeInput(code) === true);
        }
    }

    /**
     * 키 하나가 이번 프레임에 눌렸는지 반환합니다.
     * @param {string} code - KeyboardEvent.code 값입니다.
     * @returns {boolean} 상승 에지 여부입니다.
     */
    wasPressed(code) {
        return this.frameKeyEdges.has(code);
    }

    /**
     * 후보 중 하나가 이번 프레임에 눌렸는지 반환합니다.
     * @param {readonly string[]} codes - 키 후보 목록입니다.
     * @returns {boolean} 하나 이상의 상승 에지 여부입니다.
     */
    wasAnyPressed(codes) {
        return codes.some((code) => this.wasPressed(code));
    }
}
