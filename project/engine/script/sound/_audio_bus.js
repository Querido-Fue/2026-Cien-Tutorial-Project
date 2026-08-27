import { clampAudioGain } from './_audio_volume.js';

/**
 * @class AudioBus
 * @description SFX/UI 음성의 cooldown, polyphony, loop, 일시정지와 정리를 담당합니다.
 */
export class AudioBus {
    #name;
    #resolver;
    #audioFactory;
    #now;
    #onPlayBlocked;
    #volume;
    #voices;
    #loops;
    #lastStartedAt;
    #blockedLoops;
    #suspended;
    #destroyed;

    constructor({ name, resolver, audioFactory, now, onPlayBlocked = () => {} } = {}) {
        this.#name = name;
        this.#resolver = resolver;
        this.#audioFactory = audioFactory;
        this.#now = typeof now === 'function' ? now : (() => Date.now() / 1000);
        this.#onPlayBlocked = onPlayBlocked;
        this.#volume = 1;
        this.#voices = new Map();
        this.#loops = new Map();
        this.#lastStartedAt = new Map();
        this.#blockedLoops = new Set();
        this.#suspended = false;
        this.#destroyed = false;
    }

    /**
     * @param {string} cueId - 의미 ID입니다.
     * @param {{restart?:boolean,volumeScale?:number,loop?:boolean}} options
     * @returns {Promise<Readonly<object>>} 재생 결과입니다.
     */
    async play(cueId, options = {}) {
        if (this.#destroyed) {
            return Object.freeze({ ok: false, reason: 'destroyed' });
        }
        const resolved = this.#resolver?.resolve?.(cueId, this.#name);
        if (!resolved) {
            return Object.freeze({ ok: false, reason: 'missing-cue', cueId });
        }
        const loop = options.loop === true || resolved.entry.loop === true;
        if (loop && this.#loops.has(resolved.resolvedId)) {
            return Object.freeze({
                ok: true,
                deduplicated: true,
                audio: this.#loops.get(resolved.resolvedId).audio,
                ...resolved
            });
        }
        if (this.#suspended) {
            if (loop) {
                this.#blockedLoops.add(cueId);
            }
            return Object.freeze({ ok: false, reason: 'suspended', ...resolved });
        }
        if (options.restart === true) {
            this.stop(cueId);
        }
        this.#pruneVoices(resolved.resolvedId);
        const voices = this.#voices.get(resolved.resolvedId) || new Set();
        const now = Number(this.#now()) || 0;
        const previousStart = this.#lastStartedAt.get(resolved.resolvedId);
        if (previousStart !== undefined
            && now - previousStart < resolved.entry.cooldownSeconds) {
            return Object.freeze({ ok: false, reason: 'cooldown', ...resolved });
        }
        if (voices.size >= resolved.entry.polyphony) {
            return Object.freeze({ ok: false, reason: 'polyphony', ...resolved });
        }

        let audio;
        try {
            audio = this.#audioFactory(resolved.entry.runtimePath);
            audio.preload = 'auto';
            audio.loop = loop;
        } catch {
            return Object.freeze({ ok: false, reason: 'audio-create-failed', ...resolved });
        }
        const voice = {
            audio,
            resolution: resolved,
            volumeScale: clampAudioGain(options.volumeScale),
            resumeAfterSuspend: false,
            loop
        };
        audio.volume = this.#voiceVolume(voice);
        audio.onended = () => this.#removeVoice(voice);
        voices.add(voice);
        this.#voices.set(resolved.resolvedId, voices);
        if (loop) {
            this.#loops.set(resolved.resolvedId, voice);
        }
        this.#lastStartedAt.set(resolved.resolvedId, now);
        try {
            await audio.play();
            this.#blockedLoops.delete(cueId);
            return Object.freeze({ ok: true, deduplicated: false, audio, ...resolved });
        } catch {
            this.#removeVoice(voice);
            if (loop) {
                this.#blockedLoops.add(cueId);
                this.#onPlayBlocked({ bus: this.#name, cueId, loop: true });
            }
            return Object.freeze({ ok: false, reason: 'play-blocked', ...resolved });
        }
    }

    /** 완료된 음성을 제거합니다. */
    update() {
        for (const resolvedId of this.#voices.keys()) {
            this.#pruneVoices(resolvedId);
        }
    }

    /** @param {number} volume - 0~1 버스 gain입니다. */
    setVolume(volume) {
        this.#volume = clampAudioGain(volume);
        for (const voices of this.#voices.values()) {
            for (const voice of voices) {
                voice.audio.volume = this.#voiceVolume(voice);
            }
        }
    }

    /** @param {string} cueId - 해당 cue의 모든 음성을 정지합니다. */
    stop(cueId) {
        const resolved = this.#resolver?.resolve?.(cueId, this.#name);
        const resolvedId = resolved?.resolvedId || cueId;
        const voices = this.#voices.get(resolvedId);
        if (!voices) {
            this.#blockedLoops.delete(cueId);
            return;
        }
        for (const voice of [...voices]) {
            this.#stopVoice(voice);
        }
        this.#blockedLoops.delete(cueId);
    }

    /** 모든 음성과 막힌 loop 요청을 제거합니다. */
    stopAll() {
        for (const voices of [...this.#voices.values()]) {
            for (const voice of [...voices]) {
                this.#stopVoice(voice);
            }
        }
        this.#voices.clear();
        this.#loops.clear();
        this.#blockedLoops.clear();
    }

    /** @param {boolean} suspended - 앱 비활성·일시정지 여부입니다. */
    setSuspended(suspended) {
        const next = suspended === true;
        if (next === this.#suspended) {
            return;
        }
        this.#suspended = next;
        if (next) {
            for (const voices of this.#voices.values()) {
                for (const voice of voices) {
                    voice.resumeAfterSuspend = voice.audio.paused === false;
                    voice.audio.pause?.();
                }
            }
            return;
        }
        for (const voices of this.#voices.values()) {
            for (const voice of voices) {
                if (!voice.resumeAfterSuspend) {
                    continue;
                }
                voice.resumeAfterSuspend = false;
                Promise.resolve(voice.audio.play?.()).catch(() => {
                    if (voice.loop) {
                        this.#blockedLoops.add(voice.resolution.requestedId);
                        this.#onPlayBlocked({
                            bus: this.#name,
                            cueId: voice.resolution.requestedId,
                            loop: true
                        });
                    }
                });
            }
        }
        void this.retryBlockedLoops();
    }

    /** 자동재생 해제 뒤 막힌 loop만 재시도합니다. */
    async retryBlockedLoops() {
        if (this.#suspended) {
            return false;
        }
        const pending = [...this.#blockedLoops];
        this.#blockedLoops.clear();
        let succeeded = true;
        for (const cueId of pending) {
            const result = await this.play(cueId, { loop: true });
            succeeded = result?.ok === true && succeeded;
        }
        return succeeded;
    }

    /** @param {string} cueId @returns {object|null} 활성 Audio입니다. */
    getAudio(cueId) {
        const resolved = this.#resolver?.resolve?.(cueId, this.#name);
        const voices = this.#voices.get(resolved?.resolvedId || cueId);
        return voices ? [...voices][voices.size - 1]?.audio || null : null;
    }

    /** @returns {Readonly<object>} 진단·테스트용 상태입니다. */
    getState() {
        let voiceCount = 0;
        for (const voices of this.#voices.values()) {
            voiceCount += voices.size;
        }
        return Object.freeze({
            name: this.#name,
            volume: this.#volume,
            voiceCount,
            loopIds: Object.freeze([...this.#loops.keys()]),
            suspended: this.#suspended
        });
    }

    /** 소유한 모든 음성을 정리합니다. */
    destroy() {
        if (this.#destroyed) {
            return;
        }
        this.stopAll();
        this.#resolver = null;
        this.#audioFactory = () => null;
        this.#onPlayBlocked = () => {};
        this.#destroyed = true;
    }

    /** @param {object} voice @returns {number} @private */
    #voiceVolume(voice) {
        return clampAudioGain(
            this.#volume
            * clampAudioGain(voice.resolution.entry.defaultVolume)
            * voice.volumeScale
        );
    }

    /** @param {string} resolvedId @private */
    #pruneVoices(resolvedId) {
        const voices = this.#voices.get(resolvedId);
        if (!voices) {
            return;
        }
        for (const voice of [...voices]) {
            if (voice.audio?.ended === true) {
                this.#removeVoice(voice);
            }
        }
    }

    /** @param {object} voice @private */
    #removeVoice(voice) {
        const resolvedId = voice.resolution.resolvedId;
        const voices = this.#voices.get(resolvedId);
        voices?.delete(voice);
        if (voices?.size === 0) {
            this.#voices.delete(resolvedId);
        }
        if (this.#loops.get(resolvedId) === voice) {
            this.#loops.delete(resolvedId);
        }
        if (voice.audio) {
            voice.audio.onended = null;
        }
    }

    /** @param {object} voice @private */
    #stopVoice(voice) {
        try {
            voice.audio?.pause?.();
            if (voice.audio && Number.isFinite(Number(voice.audio.currentTime))) {
                voice.audio.currentTime = 0;
            }
        } catch {
            // 정리 경계의 브라우저 오류는 무시합니다.
        }
        this.#removeVoice(voice);
    }
}
