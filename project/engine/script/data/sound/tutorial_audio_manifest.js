import { TUTORIAL_BGM_ENTRIES, TUTORIAL_BGM_IDS } from './_tutorial_bgm_entries.js';
import { TUTORIAL_SFX_ENTRIES, TUTORIAL_SFX_IDS } from './_tutorial_sfx_entries.js';
import {
    TUTORIAL_UI_AUDIO_ENTRIES,
    TUTORIAL_UI_AUDIO_IDS
} from './_tutorial_ui_audio_entries.js';

const ENTRIES = Object.freeze([
    ...TUTORIAL_BGM_ENTRIES,
    ...TUTORIAL_SFX_ENTRIES,
    ...TUTORIAL_UI_AUDIO_ENTRIES
]);

/** 튜토리얼 원본 MP3와 안전한 런타임 복사본 사이의 단일 계약입니다. */
export const TUTORIAL_AUDIO_MANIFEST = Object.freeze({
    VERSION: 1,
    SOURCE_ROOT: 'project/asset',
    RUNTIME_ROOT: 'project/asset/tutorial',
    ENTRIES,
    BGM: TUTORIAL_BGM_IDS,
    SFX: TUTORIAL_SFX_IDS,
    UI: TUTORIAL_UI_AUDIO_IDS
});

export { TUTORIAL_BGM_IDS, TUTORIAL_SFX_IDS, TUTORIAL_UI_AUDIO_IDS };
