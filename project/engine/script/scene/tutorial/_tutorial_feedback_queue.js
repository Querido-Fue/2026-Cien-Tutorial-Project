import { TUTORIAL_PRESENTATION_CUE_TYPES as CUE_TYPES } from './_tutorial_presentation_contract.js';

/** @param {*} value @param {number} fallback @returns {number} 유한 숫자입니다. */
function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

/** @param {*} value @returns {{x:number,y:number}|null} 유효 좌표입니다. */
function toTile(value) {
    const x = Number(value?.x);
    const y = Number(value?.y);
    return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : null;
}

/**
 * @class TutorialFeedbackQueue
 * @description 표현 cue 순서, 로그, 일시적 피드백 수명과 향후 오디오 대기열을 소유합니다.
 */
export class TutorialFeedbackQueue {
    #config;
    #sequence;
    #eventLog;
    #floatingTexts;
    #notices;
    #particles;
    #audioCues;
    #delayedCues;
    #screenShakeSeconds;
    #stabilizeSeconds;
    #flashSeconds;

    /** @param {object} config - 로그와 입자 기본 수명 설정입니다. */
    constructor(config = {}) {
        this.#config = Object.freeze({
            eventLogLimit: Math.max(1, Math.floor(toFiniteNumber(config.eventLogLimit, 80))),
            particleCount: Math.max(1, Math.floor(toFiniteNumber(config.particleCount, 12))),
            particleSeconds: Math.max(0.01, toFiniteNumber(config.particleSeconds, 0.48))
        });
        this.#sequence = 0;
        this.#eventLog = [];
        this.#floatingTexts = [];
        this.#notices = [];
        this.#particles = [];
        this.#audioCues = [];
        this.#delayedCues = [];
        this.#screenShakeSeconds = 0;
        this.#stabilizeSeconds = 0;
        this.#flashSeconds = 0;
    }

    /**
     * cue를 입력 순서대로 번호 매기고 현재 소비자가 필요한 상태에 반영합니다.
     * @param {readonly object[]} cues - 프레젠터가 생성한 cue입니다.
     * @param {object} context - 타일 투영, actor 위치와 색상입니다.
     * @returns {readonly object[]} 번호가 부여된 같은 순서의 cue입니다.
     */
    enqueue(cues, context = {}) {
        const ordered = [];
        for (const cue of Array.isArray(cues) ? cues : []) {
            if (!cue || typeof cue.type !== 'string') {
                continue;
            }
            const queued = Object.freeze({
                ...cue,
                sequence: this.#sequence++
            });
            ordered.push(queued);
            const delaySeconds = Math.max(0, toFiniteNumber(queued.delaySeconds));
            if (delaySeconds > 0) {
                this.#delayedCues.push({
                    cue: queued,
                    context,
                    remaining: delaySeconds
                });
            } else {
                this.#applyCue(queued, context);
            }
        }
        return Object.freeze(ordered);
    }

    /**
     * 장면 흐름 자체에서 발생한 로그를 모델 이벤트 로그와 같은 제한으로 추가합니다.
     * @param {string} message - 표시할 메시지입니다.
     */
    appendLog(message) {
        if (!message || this.#eventLog[this.#eventLog.length - 1] === message) {
            return;
        }
        this.#eventLog.push(String(message));
        if (this.#eventLog.length > this.#config.eventLogLimit) {
            this.#eventLog.splice(0, this.#eventLog.length - this.#config.eventLogLimit);
        }
    }

    /** @returns {number} 레이아웃 흔들림에 사용할 남은 시간입니다. */
    getScreenShakeSeconds() {
        return this.#screenShakeSeconds;
    }

    /** @returns {readonly string[]} 현재 이벤트 로그 복제본입니다. */
    getEventLog() {
        return Object.freeze([...this.#eventLog]);
    }

    /**
     * 향후 오디오 시스템이 순서대로 소비할 cue를 비웁니다.
     * @returns {readonly object[]} 오디오 cue입니다.
     */
    drainAudioCues() {
        const cues = Object.freeze(this.#audioCues.map((cue) => Object.freeze({ ...cue })));
        this.#audioCues = [];
        return cues;
    }

    /**
     * 가변 프레임 시간으로 일시적 피드백 수명을 전진시킵니다.
     * @param {number} deltaSeconds - 경과 초입니다.
     */
    update(deltaSeconds) {
        const delta = Math.max(0, toFiniteNumber(deltaSeconds));
        this.#screenShakeSeconds = Math.max(0, this.#screenShakeSeconds - delta);
        this.#stabilizeSeconds = Math.max(0, this.#stabilizeSeconds - delta);
        this.#flashSeconds = Math.max(0, this.#flashSeconds - delta);
        for (const entry of this.#floatingTexts) {
            entry.seconds += delta;
        }
        for (const notice of this.#notices) {
            notice.seconds += delta;
        }
        for (const particle of this.#particles) {
            particle.seconds += delta;
        }
        this.#floatingTexts = this.#floatingTexts.filter(
            (entry) => entry.seconds < entry.duration
        );
        this.#notices = this.#notices.filter(
            (entry) => entry.seconds < entry.duration
        );
        this.#particles = this.#particles.filter(
            (entry) => entry.seconds < entry.duration
        );
        if (delta > 0 && this.#delayedCues.length > 0) {
            const pending = [];
            for (const delayed of this.#delayedCues) {
                delayed.remaining -= delta;
                if (delayed.remaining <= 0) {
                    this.#applyCue(delayed.cue, delayed.context);
                } else {
                    pending.push(delayed);
                }
            }
            this.#delayedCues = pending;
        }
    }

    /** @returns {object} 렌더 뷰가 소비할 방어 복제된 피드백 상태입니다. */
    getSnapshot() {
        return Object.freeze({
            eventLog: Object.freeze([...this.#eventLog]),
            floatingTexts: Object.freeze(this.#floatingTexts.map(
                (entry) => Object.freeze({ ...entry })
            )),
            notices: Object.freeze(this.#notices.map(
                (entry) => Object.freeze({ ...entry })
            )),
            particles: Object.freeze(this.#particles.map(
                (entry) => Object.freeze({ ...entry })
            )),
            delayedCueCount: this.#delayedCues.length,
            screenShakeSeconds: this.#screenShakeSeconds,
            stabilizeSeconds: this.#stabilizeSeconds,
            flashSeconds: this.#flashSeconds
        });
    }

    /** resize에서 화면 좌표에 묶인 피드백만 제거합니다. */
    clearTransient() {
        this.#floatingTexts = [];
        this.#notices = [];
        this.#particles = [];
        this.#screenShakeSeconds = 0;
        this.#stabilizeSeconds = 0;
        this.#flashSeconds = 0;
        this.#delayedCues = [];
    }

    /** 새 런이나 장면 이탈 시 모든 cue 상태를 초기화합니다. */
    clear() {
        this.clearTransient();
        this.#eventLog = [];
        this.#audioCues = [];
    }

    /** 소유 상태를 정리합니다. */
    destroy() {
        this.clear();
    }

    /** @param {object} cue @param {object} context @private */
    #applyCue(cue, context) {
        switch (cue.type) {
        case CUE_TYPES.EVENT_LOG:
            this.appendLog(cue.message);
            break;
        case CUE_TYPES.FLOATING_TEXT:
            this.#enqueueFloatingText(cue, context);
            break;
        case CUE_TYPES.HUD_NOTICE:
            this.#enqueueNotice(cue);
            break;
        case CUE_TYPES.SCREEN_SHAKE:
            this.#screenShakeSeconds = Math.max(
                this.#screenShakeSeconds,
                Math.max(0, toFiniteNumber(cue.duration))
            );
            break;
        case CUE_TYPES.FLASH:
            this.#flashSeconds = Math.max(
                this.#flashSeconds,
                Math.max(0, toFiniteNumber(cue.duration))
            );
            break;
        case CUE_TYPES.STABILIZE:
            this.#stabilizeSeconds = Math.max(
                this.#stabilizeSeconds,
                Math.max(0, toFiniteNumber(cue.duration))
            );
            break;
        case CUE_TYPES.PATH_PARTICLES:
            this.#enqueuePathParticles(cue, context);
            break;
        case CUE_TYPES.AUDIO:
            this.#audioCues.push(cue);
            if (this.#audioCues.length > this.#config.eventLogLimit) {
                this.#audioCues.splice(0, this.#audioCues.length - this.#config.eventLogLimit);
            }
            break;
        default:
            break;
        }
    }

    /** @param {object} cue @param {object} context @private */
    #enqueueFloatingText(cue, context) {
        const tile = toTile(cue.tile) || toTile(context.actors?.[cue.actorId]);
        if (!tile || typeof context.projectTile !== 'function') {
            return;
        }
        const point = context.projectTile(tile);
        if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
            return;
        }
        const tileSide = Math.max(1, toFiniteNumber(context.tileSide, 1));
        const tones = context.colors || {};
        this.#floatingTexts.push({
            sequence: cue.sequence,
            text: String(cue.text ?? ''),
            x: point.x,
            y: point.y - (tileSide * 0.42),
            fill: tones[cue.tone] || tones.accent,
            seconds: 0,
            duration: Math.max(0.01, toFiniteNumber(cue.duration, 0.62))
        });
    }

    /** 같은 목적의 짧은 HUD 안내는 중첩하지 않고 가장 최근 입력으로 교체합니다. @private */
    #enqueueNotice(cue) {
        const message = String(cue.message ?? '').trim();
        if (!message) {
            return;
        }
        this.#notices = [{
            sequence: cue.sequence,
            message,
            tone: cue.tone || 'accent',
            seconds: 0,
            duration: Math.max(0.01, toFiniteNumber(cue.duration, 1.6))
        }];
    }

    /** @param {object} cue @param {object} context @private */
    #enqueuePathParticles(cue, context) {
        const path = (Array.isArray(cue.path) ? cue.path : []).map(toTile).filter(Boolean);
        const steps = path.slice(1);
        if (steps.length === 0 || typeof context.projectTile !== 'function') {
            return;
        }
        const count = Math.max(
            1,
            Math.floor(toFiniteNumber(cue.count, this.#config.particleCount))
        );
        const duration = Math.max(
            0.01,
            toFiniteNumber(cue.duration, this.#config.particleSeconds)
        );
        const tileSide = Math.max(1, toFiniteNumber(context.tileSide, 1));
        for (let index = 0; index < count; index++) {
            const tile = steps[index % steps.length];
            const point = context.projectTile(tile);
            if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
                continue;
            }
            const horizontalSeed = ((index + 1) * 37 + tile.x * 17 + tile.y * 29) % 101;
            const verticalSeed = (horizontalSeed * 53 + index * 11) % 101;
            this.#particles.push({
                sequence: cue.sequence,
                x: point.x,
                y: point.y,
                dx: ((horizontalSeed / 100) - 0.5) * tileSide,
                dy: -tileSide * (0.2 + ((verticalSeed / 100) * 0.5)),
                size: tileSide * 0.12,
                fill: context.colors?.move,
                seconds: 0,
                duration
            });
        }
    }
}
