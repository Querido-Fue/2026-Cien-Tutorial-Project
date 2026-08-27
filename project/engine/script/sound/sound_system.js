import { getSetting } from 'save/save_system.js';
import { getData } from 'data/data_handler.js';
import { AudioBus } from './_audio_bus.js';
import { AudioManifestResolver } from './_audio_manifest_resolver.js';
import { AudioUnlockGate } from './_audio_unlock_gate.js';
import { MusicBus } from './_music_bus.js';
import { normalizeAudioVolume, sanitizeAudioVolume } from './_audio_volume.js';

const SOUND_CONSTANTS = getData('SOUND_CONSTANTS');
const DEFAULT_AUDIO_MANIFEST = getData('TUTORIAL_AUDIO_MANIFEST');

let soundSystemInstance = null;

/**
 * @class SoundSystem
 * @description 음악·효과·UI 버스와 저장 설정을 조립하는 호환 사운드 파사드입니다.
 */
export class SoundSystem {
    #getSettingValue;
    #resolver;
    #musicBus;
    #sfxBus;
    #uiBus;
    #unlockGate;
    #lastVolumes;
    #runtimeSuspended;
    #diagnosticVolume;
    #destroyed;

    constructor(options = {}) {
        soundSystemInstance = this;
        const audioFactory = options.audioFactory || ((source) => new Audio(source));
        const now = options.now || (() => (
            typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000
        ));
        const windowTarget = options.windowTarget
            ?? (typeof window !== 'undefined' ? window : null);
        this.#getSettingValue = options.getSettingValue || getSetting;
        this.#resolver = new AudioManifestResolver(
            options.manifest || DEFAULT_AUDIO_MANIFEST
        );
        const onPlayBlocked = () => this.#unlockGate?.arm();
        this.#musicBus = new MusicBus({
            resolver: this.#resolver,
            audioFactory,
            onPlayBlocked,
            crossfadeSeconds: SOUND_CONSTANTS.BGM.CROSSFADE_SECONDS
        });
        this.#sfxBus = new AudioBus({
            name: 'sfx', resolver: this.#resolver, audioFactory, now, onPlayBlocked
        });
        this.#uiBus = new AudioBus({
            name: 'ui', resolver: this.#resolver, audioFactory, now, onPlayBlocked
        });
        this.#unlockGate = new AudioUnlockGate({
            target: windowTarget,
            events: SOUND_CONSTANTS.BGM.UNLOCK_EVENTS,
            onUnlock: () => this.#retryBlockedPlayback()
        });
        this.#lastVolumes = { bgm: null, sfx: null, ui: null };
        this.#runtimeSuspended = false;
        this.#diagnosticVolume = SOUND_CONSTANTS.DIAGNOSTIC_SAMPLE.DEFAULT_VOLUME;
        this.#destroyed = false;
    }

    /** 저장된 세 버스 볼륨을 반영하고 선택적 기본 BGM을 시작합니다. */
    async init() {
        this.#syncVolumes();
        if (SOUND_CONSTANTS.BGM.AUTO_PLAY !== false) {
            await this.playBgm();
        }
    }

    /** @param {number} deltaSeconds - crossfade 경과 초입니다. */
    update(deltaSeconds) {
        if (this.#destroyed) {
            return;
        }
        this.#syncVolumes();
        this.#musicBus.update(deltaSeconds);
        this.#sfxBus.update();
        this.#uiBus.update();
    }

    draw() {
    }

    /** @param {string} cueId @param {object} options @returns {Promise<object>} */
    playBgm(cueId = SOUND_CONSTANTS.BGM.DEFAULT_CUE_ID, options = {}) {
        return this.#musicBus.play(cueId, options);
    }

    pauseBgm() {
        this.#musicBus.pause();
    }

    stopBgm() {
        this.#musicBus.stop();
    }

    /** 의미 ID에 선언된 버스로 one-shot 또는 BGM을 재생합니다. */
    playCue(cueId, options = {}) {
        const entry = this.#resolver.getEntry(cueId);
        if (entry?.bus === 'bgm') {
            return this.playBgm(cueId, options);
        }
        if (entry?.bus === 'ui') {
            return this.#uiBus.play(cueId, options);
        }
        if (entry?.bus === 'sfx') {
            return this.#sfxBus.play(cueId, options);
        }
        return Promise.resolve(Object.freeze({ ok: false, reason: 'missing-cue', cueId }));
    }

    /** loop cue를 중복 없이 시작합니다. */
    startLoop(cueId, options = {}) {
        return this.playCue(cueId, { ...options, loop: true });
    }

    /** 의미 ID에 대응하는 SFX/UI loop 또는 음성을 정지합니다. */
    stopCue(cueId) {
        const entry = this.#resolver.getEntry(cueId);
        if (entry?.bus === 'bgm') {
            this.stopBgm();
        } else if (entry?.bus === 'ui') {
            this.#uiBus.stop(cueId);
        } else {
            this.#sfxBus.stop(cueId);
        }
    }

    /** @param {boolean} isSuspended - blur/일시정지 상태입니다. */
    setRuntimeSuspended(isSuspended) {
        const next = isSuspended === true;
        if (next === this.#runtimeSuspended) {
            return;
        }
        this.#runtimeSuspended = next;
        this.#musicBus.setSuspended(next);
        this.#sfxBus.setSuspended(next);
        this.#uiBus.setSuspended(next);
    }

    setBgmVolume(volume) {
        this.#setBusVolume('bgm', volume);
    }

    setSfxVolume(volume) {
        this.#setBusVolume('sfx', volume);
    }

    setUiVolume(volume) {
        this.#setBusVolume('ui', volume);
    }

    /** 기존 진단 샘플 API를 의미 cue 위에 보존합니다. */
    async playDiagnosticSample(options = {}) {
        if (options.volume !== undefined) {
            this.setDiagnosticSampleVolume(options.volume);
        }
        return this.#sfxBus.play(SOUND_CONSTANTS.DIAGNOSTIC_SAMPLE.CUE_ID, {
            restart: options.restart !== false,
            volumeScale: normalizeAudioVolume(this.#diagnosticVolume)
        });
    }

    pauseDiagnosticSample() {
        this.#sfxBus.getAudio(SOUND_CONSTANTS.DIAGNOSTIC_SAMPLE.CUE_ID)?.pause?.();
    }

    stopDiagnosticSample() {
        this.#sfxBus.stop(SOUND_CONSTANTS.DIAGNOSTIC_SAMPLE.CUE_ID);
    }

    setDiagnosticSampleVolume(volume) {
        this.#diagnosticVolume = sanitizeAudioVolume(
            volume,
            SOUND_CONSTANTS.DIAGNOSTIC_SAMPLE.DEFAULT_VOLUME
        );
        const audio = this.#sfxBus.getAudio(SOUND_CONSTANTS.DIAGNOSTIC_SAMPLE.CUE_ID);
        if (audio) {
            audio.volume = normalizeAudioVolume(this.#diagnosticVolume)
                * normalizeAudioVolume(this.#lastVolumes.sfx);
        }
    }

    getDiagnosticSampleState() {
        const cueId = SOUND_CONSTANTS.DIAGNOSTIC_SAMPLE.CUE_ID;
        const audio = this.#sfxBus.getAudio(cueId);
        return {
            path: this.#resolver.resolve(cueId, 'sfx')?.entry.runtimePath || '',
            paused: audio ? audio.paused !== false : true,
            currentTime: Number(audio?.currentTime) || 0,
            duration: Number(audio?.duration) || 0,
            volume: Math.round((Number(audio?.volume) || 0) * 100)
        };
    }

    /** @returns {Readonly<object>} 현재 BGM 진단 상태입니다. */
    getBgmState() {
        return this.#musicBus.getState();
    }

    /** @returns {object|null} 기존 인스턴스 필드 호환용 활성 BGM Audio입니다. */
    get bgmAudio() {
        return this.#musicBus.getAudio();
    }

    /** @returns {object|null} 기존 인스턴스 필드 호환용 진단 Audio입니다. */
    get diagnosticSampleAudio() {
        return this.#sfxBus.getAudio(SOUND_CONSTANTS.DIAGNOSTIC_SAMPLE.CUE_ID);
    }

    /** 모든 리스너와 Audio 인스턴스를 정리합니다. */
    destroy() {
        if (this.#destroyed) {
            return;
        }
        this.#unlockGate.destroy();
        this.#musicBus.destroy();
        this.#sfxBus.destroy();
        this.#uiBus.destroy();
        this.#destroyed = true;
        if (soundSystemInstance === this) {
            soundSystemInstance = null;
        }
    }

    /** @param {'bgm'|'sfx'|'ui'} bus @param {*} value @private */
    #setBusVolume(bus, value) {
        const fallback = SOUND_CONSTANTS[bus.toUpperCase()]?.DEFAULT_VOLUME ?? 100;
        const sanitized = sanitizeAudioVolume(value, fallback);
        this.#lastVolumes[bus] = sanitized;
        const normalized = normalizeAudioVolume(sanitized, fallback);
        if (bus === 'bgm') this.#musicBus.setVolume(normalized);
        if (bus === 'sfx') this.#sfxBus.setVolume(normalized);
        if (bus === 'ui') this.#uiBus.setVolume(normalized);
    }

    /** @private */
    #syncVolumes() {
        const values = {
            bgm: this.#getSettingValue('bgmVolume'),
            sfx: this.#getSettingValue('sfxVolume'),
            ui: this.#getSettingValue('uiVolume')
        };
        for (const [bus, value] of Object.entries(values)) {
            const fallback = SOUND_CONSTANTS[bus.toUpperCase()]?.DEFAULT_VOLUME ?? 100;
            const sanitized = sanitizeAudioVolume(value, fallback);
            if (this.#lastVolumes[bus] !== sanitized) {
                this.#setBusVolume(bus, sanitized);
            }
        }
    }

    /** @returns {Promise<boolean>} @private */
    async #retryBlockedPlayback() {
        const results = await Promise.all([
            this.#musicBus.retryBlocked(),
            this.#sfxBus.retryBlockedLoops(),
            this.#uiBus.retryBlockedLoops()
        ]);
        return results.every((result) => result !== false);
    }
}

export const getSoundSystemInstance = () => soundSystemInstance;
export const playBgm = (cueId, options) => soundSystemInstance?.playBgm(cueId, options);
export const stopBgm = () => soundSystemInstance?.stopBgm();
export const setBgmVolume = (volume) => soundSystemInstance?.setBgmVolume(volume);
export const setSfxVolume = (volume) => soundSystemInstance?.setSfxVolume(volume);
export const setUiVolume = (volume) => soundSystemInstance?.setUiVolume(volume);
export const playCue = (cueId, options) => soundSystemInstance?.playCue(cueId, options);
export const startLoop = (cueId, options) => soundSystemInstance?.startLoop(cueId, options);
export const stopCue = (cueId) => soundSystemInstance?.stopCue(cueId);
export const playDiagnosticSample = (options = {}) => soundSystemInstance?.playDiagnosticSample(options);
export const pauseDiagnosticSample = () => soundSystemInstance?.pauseDiagnosticSample();
export const stopDiagnosticSample = () => soundSystemInstance?.stopDiagnosticSample();
export const setDiagnosticSampleVolume = (volume) => soundSystemInstance?.setDiagnosticSampleVolume(volume);
export const getDiagnosticSampleState = () => soundSystemInstance?.getDiagnosticSampleState();
