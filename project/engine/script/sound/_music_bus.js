import { clampAudioGain } from './_audio_volume.js';

/** @param {*} value @returns {number} 안전한 경과 초입니다. */
function toDelta(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
}

/**
 * @class MusicBus
 * @description 한 곡 중복 방지, 두 채널 crossfade, BGM 일시정지와 재개를 담당합니다.
 */
export class MusicBus {
    #resolver;
    #audioFactory;
    #onPlayBlocked;
    #crossfadeSeconds;
    #volume;
    #active;
    #fadingOut;
    #desiredCueId;
    #blockedCueId;
    #requestRevision;
    #suspended;
    #resumeAfterSuspend;
    #destroyed;

    constructor({
        resolver,
        audioFactory,
        onPlayBlocked = () => {},
        crossfadeSeconds = 0.55
    } = {}) {
        this.#resolver = resolver;
        this.#audioFactory = audioFactory;
        this.#onPlayBlocked = onPlayBlocked;
        this.#crossfadeSeconds = Math.max(0, Number(crossfadeSeconds) || 0);
        this.#volume = 1;
        this.#active = null;
        this.#fadingOut = [];
        this.#desiredCueId = '';
        this.#blockedCueId = '';
        this.#requestRevision = 0;
        this.#suspended = false;
        this.#resumeAfterSuspend = false;
        this.#destroyed = false;
    }

    /** @param {string} cueId @param {{crossfadeSeconds?:number}} options */
    async play(cueId, options = {}) {
        if (this.#destroyed) {
            return Object.freeze({ ok: false, reason: 'destroyed' });
        }
        const resolved = this.#resolver?.resolve?.(cueId, 'bgm');
        if (!resolved) {
            return Object.freeze({ ok: false, reason: 'missing-cue', cueId });
        }
        this.#desiredCueId = cueId;
        if (this.#suspended) {
            this.#blockedCueId = cueId;
            this.#resumeAfterSuspend = true;
            return Object.freeze({ ok: false, reason: 'suspended', cueId });
        }
        if (this.#active?.resolution.resolvedId === resolved.resolvedId) {
            if (this.#active.audio.paused === false) {
                return Object.freeze({ ok: true, deduplicated: true, ...resolved });
            }
            const resumed = await this.#tryPlay(this.#active.audio, cueId);
            return Object.freeze({
                ok: resumed,
                deduplicated: true,
                reason: resumed ? undefined : 'play-blocked',
                ...resolved
            });
        }

        const revision = ++this.#requestRevision;
        let audio;
        try {
            audio = this.#audioFactory(resolved.entry.runtimePath);
            audio.preload = 'auto';
            audio.loop = resolved.entry.loop === true;
            audio.volume = this.#active ? 0 : this.#targetVolume(resolved.entry);
        } catch {
            return Object.freeze({ ok: false, reason: 'audio-create-failed', ...resolved });
        }
        const played = await this.#tryPlay(audio, cueId);
        if (!played || revision !== this.#requestRevision || this.#destroyed) {
            this.#stopAudio(audio);
            return Object.freeze({
                ok: false,
                reason: played ? 'stale-request' : 'play-blocked',
                ...resolved
            });
        }

        this.#stopFadingOut();
        const previous = this.#active;
        const duration = Math.max(
            0,
            Number.isFinite(Number(options.crossfadeSeconds))
                ? Number(options.crossfadeSeconds)
                : this.#crossfadeSeconds
        );
        this.#active = {
            audio,
            resolution: resolved,
            fadeElapsed: previous && duration > 0 ? 0 : duration,
            fadeDuration: duration
        };
        if (previous && duration > 0) {
            this.#fadingOut.push({
                ...previous,
                startVolume: clampAudioGain(previous.audio.volume),
                fadeElapsed: 0,
                fadeDuration: duration
            });
        } else if (previous) {
            this.#stopAudio(previous.audio);
        }
        this.#blockedCueId = '';
        this.#applyVolumes();
        return Object.freeze({ ok: true, deduplicated: false, ...resolved });
    }

    /** @param {number} deltaSeconds - crossfade 경과 초입니다. */
    update(deltaSeconds) {
        if (this.#destroyed || this.#suspended) {
            return;
        }
        const delta = toDelta(deltaSeconds);
        if (delta <= 0) {
            return;
        }
        if (this.#active && this.#active.fadeElapsed < this.#active.fadeDuration) {
            this.#active.fadeElapsed = Math.min(
                this.#active.fadeDuration,
                this.#active.fadeElapsed + delta
            );
        }
        for (const entry of this.#fadingOut) {
            entry.fadeElapsed = Math.min(entry.fadeDuration, entry.fadeElapsed + delta);
        }
        this.#applyVolumes();
        const completed = this.#fadingOut.filter(
            (entry) => entry.fadeElapsed >= entry.fadeDuration
        );
        completed.forEach((entry) => this.#stopAudio(entry.audio));
        this.#fadingOut = this.#fadingOut.filter(
            (entry) => entry.fadeElapsed < entry.fadeDuration
        );
    }

    /** @param {number} volume - 0~1 버스 gain입니다. */
    setVolume(volume) {
        this.#volume = clampAudioGain(volume);
        this.#applyVolumes();
    }

    /** 현재 곡은 보존한 채 재생만 일시정지합니다. */
    pause() {
        this.#resumeAfterSuspend = Boolean(
            this.#active && this.#active.audio.paused === false
        );
        this.#active?.audio?.pause?.();
        for (const entry of this.#fadingOut) {
            entry.audio?.pause?.();
        }
    }

    /** 현재 의미 곡을 재생합니다. */
    async resume() {
        if (!this.#active) {
            return this.#desiredCueId ? this.play(this.#desiredCueId) : null;
        }
        const played = await this.#tryPlay(this.#active.audio, this.#desiredCueId);
        if (played) {
            for (const entry of this.#fadingOut) {
                void this.#tryPlay(entry.audio, this.#desiredCueId);
            }
        }
        return played;
    }

    /** 곡과 전환 채널을 모두 처음으로 되돌립니다. */
    stop() {
        this.#requestRevision += 1;
        if (this.#active) {
            this.#stopAudio(this.#active.audio);
        }
        this.#active = null;
        this.#stopFadingOut();
        this.#desiredCueId = '';
        this.#blockedCueId = '';
        this.#resumeAfterSuspend = false;
    }

    /** @param {boolean} suspended - 앱 비활성·일시정지 여부입니다. */
    setSuspended(suspended) {
        const next = suspended === true;
        if (next === this.#suspended) {
            return;
        }
        this.#suspended = next;
        if (next) {
            this.pause();
        } else if (this.#resumeAfterSuspend || this.#blockedCueId) {
            this.#resumeAfterSuspend = false;
            void this.retryBlocked();
        }
    }

    /** 자동재생 해제 뒤 막힌 곡을 다시 시도합니다. */
    async retryBlocked() {
        if (this.#suspended) {
            return false;
        }
        if (this.#active && this.#active.audio.paused) {
            const resumed = await this.resume();
            if (resumed) {
                this.#blockedCueId = '';
            }
            return resumed === true;
        }
        const cueId = this.#blockedCueId || this.#desiredCueId;
        if (!cueId) {
            return true;
        }
        const result = await this.play(cueId);
        return result?.ok === true;
    }

    /** @returns {Readonly<object>} 진단·테스트용 상태입니다. */
    getState() {
        return Object.freeze({
            cueId: this.#desiredCueId,
            resolvedId: this.#active?.resolution.resolvedId || '',
            path: this.#active?.resolution.entry.runtimePath || '',
            paused: this.#active ? this.#active.audio.paused !== false : true,
            currentTime: Number(this.#active?.audio.currentTime) || 0,
            volume: Number(this.#active?.audio.volume) || 0,
            fadingCount: this.#fadingOut.length,
            suspended: this.#suspended
        });
    }

    /** @returns {object|null} 기존 진단 코드가 읽을 수 있는 활성 Audio입니다. */
    getAudio() {
        return this.#active?.audio || null;
    }

    /** 소유한 Audio 인스턴스를 모두 정리합니다. */
    destroy() {
        if (this.#destroyed) {
            return;
        }
        this.stop();
        this.#resolver = null;
        this.#audioFactory = () => null;
        this.#onPlayBlocked = () => {};
        this.#destroyed = true;
    }

    /** @param {object} entry @returns {number} @private */
    #targetVolume(entry) {
        return clampAudioGain(this.#volume * clampAudioGain(entry?.defaultVolume));
    }

    /** @private */
    #applyVolumes() {
        if (this.#active) {
            const progress = this.#active.fadeDuration > 0
                ? Math.min(1, this.#active.fadeElapsed / this.#active.fadeDuration)
                : 1;
            this.#active.audio.volume = clampAudioGain(
                this.#targetVolume(this.#active.resolution.entry) * progress
            );
        }
        for (const entry of this.#fadingOut) {
            const progress = entry.fadeDuration > 0
                ? Math.min(1, entry.fadeElapsed / entry.fadeDuration)
                : 1;
            entry.audio.volume = clampAudioGain(entry.startVolume * (1 - progress));
        }
    }

    /** @param {object} audio @param {string} cueId @returns {Promise<boolean>} @private */
    async #tryPlay(audio, cueId) {
        try {
            await audio?.play?.();
            this.#blockedCueId = '';
            return true;
        } catch {
            this.#blockedCueId = cueId;
            this.#onPlayBlocked({ bus: 'bgm', cueId, loop: true });
            return false;
        }
    }

    /** @param {object} audio @private */
    #stopAudio(audio) {
        try {
            audio?.pause?.();
            if (audio && Number.isFinite(Number(audio.currentTime))) {
                audio.currentTime = 0;
            }
        } catch {
            // 제거 중인 브라우저 Audio 오류는 장면 생명주기를 막지 않습니다.
        }
    }

    /** @private */
    #stopFadingOut() {
        this.#fadingOut.forEach((entry) => this.#stopAudio(entry.audio));
        this.#fadingOut = [];
    }
}
