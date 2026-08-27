import { createTutorialAudioEntry } from './_tutorial_audio_entry.js';

export const TUTORIAL_BGM_IDS = Object.freeze({
    MAIN: 'bgm.main',
    OPENING: 'bgm.opening',
    FLOOR_1: 'bgm.floor1',
    BASEMENT: 'bgm.basement',
    ENDING_STABILIZED: 'bgm.ending.stabilized',
    ENDING_SUBDUED: 'bgm.ending.subdued'
});

export const TUTORIAL_BGM_ENTRIES = Object.freeze([
    createTutorialAudioEntry({
        id: TUTORIAL_BGM_IDS.MAIN,
        sourceName: 'audio/background music/mainpage_backgroundmusic.mp3',
        runtimePath: '../asset/tutorial/audio/bgm/main.mp3',
        bus: 'bgm', loop: true, defaultVolume: 0.72, polyphony: 1,
        cooldownSeconds: 0, required: true
    }),
    createTutorialAudioEntry({
        id: TUTORIAL_BGM_IDS.OPENING,
        sourceName: 'audio/background music/opening_scene.mp3',
        runtimePath: '../asset/tutorial/audio/bgm/opening.mp3',
        bus: 'bgm', loop: true, defaultVolume: 0.78, polyphony: 1,
        cooldownSeconds: 0, required: true
    }),
    createTutorialAudioEntry({
        id: TUTORIAL_BGM_IDS.FLOOR_1,
        sourceName: 'audio/background music/ingame_floor1.mp3',
        runtimePath: '../asset/tutorial/audio/bgm/floor-1.mp3',
        bus: 'bgm', loop: true, defaultVolume: 0.74, polyphony: 1,
        cooldownSeconds: 0, required: true
    }),
    createTutorialAudioEntry({
        id: TUTORIAL_BGM_IDS.BASEMENT,
        sourceName: 'audio/background music/ingame_basement.mp3',
        runtimePath: '../asset/tutorial/audio/bgm/basement.mp3',
        bus: 'bgm', loop: true, defaultVolume: 0.74, polyphony: 1,
        cooldownSeconds: 0, required: false, available: false,
        fallback: TUTORIAL_BGM_IDS.FLOOR_1
    }),
    createTutorialAudioEntry({
        id: TUTORIAL_BGM_IDS.ENDING_STABILIZED,
        sourceName: 'audio/background music/안정화엔딩.mp3',
        runtimePath: '../asset/tutorial/audio/bgm/ending-stabilized.mp3',
        bus: 'bgm', loop: true, defaultVolume: 0.78, polyphony: 1,
        cooldownSeconds: 0, required: true
    }),
    createTutorialAudioEntry({
        id: TUTORIAL_BGM_IDS.ENDING_SUBDUED,
        sourceName: 'audio/background music/무력화엔딩.mp3',
        runtimePath: '../asset/tutorial/audio/bgm/ending-subdued.mp3',
        bus: 'bgm', loop: true, defaultVolume: 0.78, polyphony: 1,
        cooldownSeconds: 0, required: true
    })
]);
