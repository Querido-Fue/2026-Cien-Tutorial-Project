/**
 * @class FakeAudio
 * @description 브라우저 Audio의 재생·정지·종료·실패 경계를 결정론적으로 흉내 냅니다.
 */
export class FakeAudio {
    constructor(source, options = {}) {
        this.src = source;
        this.preload = '';
        this.loop = false;
        this.volume = 1;
        this.currentTime = 0;
        this.duration = Number(options.duration) || 1;
        this.paused = true;
        this.ended = false;
        this.onended = null;
        this.playCount = 0;
        this.pauseCount = 0;
        this.rejectPlayCount = Number(options.rejectPlayCount) || 0;
    }

    async play() {
        this.playCount += 1;
        if (this.rejectPlayCount > 0) {
            this.rejectPlayCount -= 1;
            throw new Error('autoplay-blocked');
        }
        this.paused = false;
        this.ended = false;
    }

    pause() {
        this.pauseCount += 1;
        this.paused = true;
    }

    finish() {
        this.ended = true;
        this.paused = true;
        this.onended?.();
    }
}
