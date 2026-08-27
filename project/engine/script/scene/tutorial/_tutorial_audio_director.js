import {
    TUTORIAL_BGM_IDS,
    TUTORIAL_SFX_IDS,
    TUTORIAL_UI_AUDIO_IDS
} from '../../data/sound/tutorial_audio_manifest.js';
import { TUTORIAL_COMMANDS as COMMANDS } from './_tutorial_scene_constants.js';

const CLICK_COMMANDS = new Set([
    COMMANDS.START,
    COMMANDS.OPEN_GALLERY,
    COMMANDS.STARTER_SHIFT,
    COMMANDS.RESTART,
    COMMANDS.GALLERY_PLAY,
    COMMANDS.INVENTORY_PAGE_SHIFT,
    COMMANDS.FOCUS_SHIFT,
    COMMANDS.SELECT_ATTACK,
    COMMANDS.SELECT_CLEANSE,
    COMMANDS.GUIDE_SHOW,
    COMMANDS.GUIDE_DISMISS
]);

/**
 * @class TutorialAudioDirector
 * @description 튜토리얼 상태·명령·presentation cue를 전역 사운드 포트 호출로 변환합니다.
 */
export class TutorialAudioDirector {
    #sound;
    #currentBgmCueId;
    #breathingActive;
    #instabilityThreshold;
    #destroyed;

    /** @param {{soundPort?:object,instabilityThreshold?:number}} options */
    constructor({ soundPort = null, instabilityThreshold = 61 } = {}) {
        this.#sound = soundPort;
        this.#currentBgmCueId = '';
        this.#breathingActive = false;
        this.#instabilityThreshold = Math.max(0, Number(instabilityThreshold) || 61);
        this.#destroyed = false;
    }

    /**
     * 현재 화면·층·결과와 로라 상태에 맞는 지속 오디오를 동기화합니다.
     * @param {object} state - 장면에서 읽은 작은 상태 스냅샷입니다.
     */
    sync(state = {}) {
        if (this.#destroyed) {
            return;
        }
        const bgmCueId = this.#selectBgm(state);
        if (bgmCueId && bgmCueId !== this.#currentBgmCueId) {
            this.#currentBgmCueId = bgmCueId;
            void this.#sound?.playBgm?.(bgmCueId);
        }
        const lora = state.lora || {};
        const shouldBreathe = state.mode === 'battle'
            && state.cutsceneOpen !== true
            && Number(lora.hp) > 0
            && Number(lora.instability) >= this.#instabilityThreshold;
        if (shouldBreathe === this.#breathingActive) {
            return;
        }
        this.#breathingActive = shouldBreathe;
        if (shouldBreathe) {
            void this.#sound?.startLoop?.(TUTORIAL_SFX_IDS.LORA_HEAVY_BREATHING);
        } else {
            this.#sound?.stopCue?.(TUTORIAL_SFX_IDS.LORA_HEAVY_BREATHING);
        }
    }

    /** @param {readonly object[]} cues - feedback queue에서 drain한 오디오 cue입니다. */
    consume(cues = []) {
        if (this.#destroyed) {
            return;
        }
        for (const cue of Array.isArray(cues) ? cues : []) {
            if (typeof cue?.id === 'string') {
                void this.#sound?.playCue?.(cue.id);
            }
        }
    }

    /** 검증된 UI 명령을 클릭·책장·장착 효과로 표현합니다. */
    playCommand(commandType) {
        if (this.#destroyed) {
            return;
        }
        let cueId = '';
        if (commandType === COMMANDS.GALLERY_SHIFT
            || commandType === COMMANDS.CUTSCENE_NEXT) {
            cueId = TUTORIAL_UI_AUDIO_IDS.BOOK_TURN;
        } else if (commandType === COMMANDS.RETURN_MENU
            || commandType === COMMANDS.CUTSCENE_CLOSE) {
            cueId = TUTORIAL_UI_AUDIO_IDS.BOOK_CLOSE;
        } else if (commandType === COMMANDS.CHOOSE_STARTER) {
            cueId = TUTORIAL_SFX_IDS.ITEM_EQUIP;
        } else if (CLICK_COMMANDS.has(commandType)) {
            cueId = TUTORIAL_UI_AUDIO_IDS.CLICK;
        }
        if (cueId) {
            void this.#sound?.playCue?.(cueId);
        }
    }

    /** @param {number} count - 새로 큐에 들어간 업적 수입니다. */
    notifyAchievements(count) {
        if (!this.#destroyed && Number(count) > 0) {
            void this.#sound?.playCue?.(TUTORIAL_UI_AUDIO_IDS.ACHIEVEMENT);
        }
    }

    /** 런 이탈 시 장기 SFX만 명시적으로 종료합니다. */
    resetTransient() {
        if (this.#breathingActive) {
            this.#sound?.stopCue?.(TUTORIAL_SFX_IDS.LORA_HEAVY_BREATHING);
        }
        this.#breathingActive = false;
    }

    /** 장면 수명 종료 시 장면 소유 loop와 포트를 정리합니다. */
    destroy() {
        if (this.#destroyed) {
            return;
        }
        this.resetTransient();
        this.#sound = null;
        this.#destroyed = true;
    }

    /** @param {object} state @returns {string} @private */
    #selectBgm(state) {
        if (state.cutsceneOpen === true) {
            return TUTORIAL_BGM_IDS.OPENING;
        }
        if (state.mode === 'result') {
            return state.result?.endingId === 'true'
                ? TUTORIAL_BGM_IDS.ENDING_STABILIZED
                : TUTORIAL_BGM_IDS.ENDING_SUBDUED;
        }
        if (state.mode === 'battle') {
            return Number(state.floorIndex) >= 1
                ? TUTORIAL_BGM_IDS.BASEMENT
                : TUTORIAL_BGM_IDS.FLOOR_1;
        }
        return TUTORIAL_BGM_IDS.MAIN;
    }
}
