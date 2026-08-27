import { createTutorialAudioEntry } from './_tutorial_audio_entry.js';

export const TUTORIAL_UI_AUDIO_IDS = Object.freeze({
    ACHIEVEMENT: 'ui.achievement',
    CLICK: 'ui.click',
    BOOK_TURN: 'ui.book-turn',
    BOOK_CLOSE: 'ui.book-close'
});

const ui = (id, sourceName, runtimeName, options = {}) => createTutorialAudioEntry({
    id,
    sourceName,
    runtimePath: `../asset/tutorial/audio/ui/${runtimeName}.mp3`,
    bus: 'ui', loop: false, defaultVolume: 0.86, polyphony: 1,
    cooldownSeconds: 0.08, required: true,
    ...options
});

export const TUTORIAL_UI_AUDIO_ENTRIES = Object.freeze([
    ui(TUTORIAL_UI_AUDIO_IDS.ACHIEVEMENT, 'audio/special effects/achievementpopup.mp3', 'achievement', {
        cooldownSeconds: 0.25, defaultVolume: 1
    }),
    ui(TUTORIAL_UI_AUDIO_IDS.CLICK, 'audio/special effects/buttonclick.mp3', 'click'),
    ui(TUTORIAL_UI_AUDIO_IDS.BOOK_TURN, 'audio/special effects/bookturning.mp3', 'book-turn', {
        cooldownSeconds: 0.12
    }),
    ui(TUTORIAL_UI_AUDIO_IDS.BOOK_CLOSE, 'audio/special effects/bookclosing.mp3', 'book-close', {
        cooldownSeconds: 0.15
    })
]);
