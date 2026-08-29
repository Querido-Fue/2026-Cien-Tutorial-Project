import {
    TUTORIAL_COMMANDS as COMMANDS,
    TUTORIAL_MODES as MODES
} from './_tutorial_scene_constants.js';

/**
 * 비전투 화면과 전투 안내가 소비할 직렬화 가능한 뷰 모델을 조립합니다.
 */
export class TutorialNonbattleViewModelFactory {
    /** @param {object} data 튜토리얼 정적 데이터입니다. */
    constructor(data) {
        this.data = data;
    }

    /** @param {object} frame 공통 표시 프레임입니다. @returns {object} */
    createLoading(frame) {
        return Object.freeze({ ...frame, message: '진행도 불러오는 중…' });
    }

    /** @param {object} frame @param {object} options @returns {object} */
    createMenu(frame, { meta, releaseVersion }) {
        return Object.freeze({
            ...frame,
            title: this.data.TEXT.TITLE,
            subtitle: this.data.TEXT.SUBTITLE,
            playCount: Number(meta?.playCount) || 0,
            canContinue: false,
            releaseVersion
        });
    }

    /** @param {object} frame @param {object} options @returns {object} */
    createChangelog(frame, { releaseInfo, page }) {
        return Object.freeze({
            ...frame,
            version: releaseInfo.version,
            entries: releaseInfo.changelog,
            page
        });
    }

    /** @param {object} frame @param {object} options @returns {object} */
    createStarter(frame, { selectedIndex, selectionProgress }) {
        return Object.freeze({
            ...frame,
            choices: Object.freeze(this.data.STARTER_CHOICES.map((choice) => Object.freeze({
                id: choice.id,
                label: choice.label,
                description: choice.description
            }))),
            selectedIndex,
            selectionProgress: Number(selectionProgress) || 0,
            selectionMinScale: Number(this.data.ANIMATION.SELECTION_MIN_SCALE) || 0.72
        });
    }

    /** @param {object} frame @param {number} selectedIndex @returns {object} */
    createPause(frame, selectedIndex) {
        return Object.freeze({ ...frame, selectedIndex });
    }

    /** @param {object} frame @param {object} options @returns {object} */
    createGallery(frame, { gallery, mode, selectionProgress }) {
        return Object.freeze({
            ...frame,
            ...gallery,
            closeCommandType: mode === MODES.RECORD
                ? COMMANDS.CLOSE_RECORD
                : COMMANDS.RETURN_MENU,
            recordPopup: mode === MODES.RECORD,
            selectionProgress: Number(selectionProgress) || 0,
            selectionMinScale: Number(this.data.ANIMATION.SELECTION_MIN_SCALE) || 0.72
        });
    }

    /** @param {object} frame @param {object} options @returns {object} */
    createResult(frame, { result, presentationLocked }) {
        return Object.freeze({
            ...frame,
            result: Object.freeze({ ...(result || {}) }),
            presentationLocked
        });
    }

    /** @param {object} frame @param {object} options @returns {object} */
    createCutscene(frame, { state, card, presentationLocked }) {
        return Object.freeze({
            ...frame,
            state: Object.freeze({ ...state }),
            card: Object.freeze({ ...(card || {}) }),
            presentationLocked
        });
    }

    /** @param {object|null} battleViewModel @param {boolean} open @returns {object|null} */
    createBattleTutorial(battleViewModel, open) {
        if (!battleViewModel) {
            return null;
        }
        const copy = this.data.TEXT.TUTORIAL_GUIDE;
        return Object.freeze({
            open,
            viewport: battleViewModel.viewport,
            layout: battleViewModel.layout,
            fonts: battleViewModel.fonts,
            colors: battleViewModel.colors,
            modal: Object.freeze({ ...this.data.LAYOUT.MODAL }),
            copy: Object.freeze({
                title: copy.TITLE,
                sentences: Object.freeze([...copy.SENTENCES]),
                replay: copy.REPLAY
            })
        });
    }
}
