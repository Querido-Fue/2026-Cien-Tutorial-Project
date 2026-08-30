import { TUTORIAL_MODES as MODES } from './_tutorial_scene_constants.js';
import { TutorialGalleryController } from './_tutorial_gallery_controller.js';
import { TutorialGalleryPageTurnController } from './_tutorial_gallery_page_turn_controller.js';

/**
 * @class TutorialGalleryNavigationController
 * @description 갤러리 선택 변경과 페이지 전환 시작을 하나의 입력 경계에서 조율합니다.
 */
export class TutorialGalleryNavigationController {
    #gallery;
    #pageTurns;
    #getMode;
    #getMeta;
    #isCutsceneOpen;

    /** @param {object} options - 콘텐츠·표현 포트와 현재 장면 조회 함수입니다. */
    constructor({
        content,
        cutscenes,
        animationPort,
        surfacePort,
        config,
        getMode = () => MODES.MENU,
        getMeta = () => ({}),
        isCutsceneOpen = () => false,
        onChange = () => {}
    } = {}) {
        this.#gallery = new TutorialGalleryController({ content, cutscenes });
        this.#pageTurns = new TutorialGalleryPageTurnController({
            animationPort,
            surfacePort,
            config,
            onChange
        });
        this.#getMode = getMode;
        this.#getMeta = getMeta;
        this.#isCutsceneOpen = isCutsceneOpen;
    }

    /** @param {object} payload - 섹션 ID 또는 이동량입니다. @returns {boolean} 변경 여부입니다. */
    shiftSection(payload = {}) {
        if (!this.#canNavigate()) {
            return false;
        }
        const meta = this.#getMeta();
        const before = this.#gallery.getSnapshot(meta);
        let direction = Math.sign(Number(payload?.delta) || 0);
        if (typeof payload?.sectionId === 'string') {
            const targetIndex = before.sections.findIndex(
                ({ id }) => id === payload.sectionId
            );
            if (targetIndex < 0 || targetIndex === before.selectedSectionIndex) {
                return false;
            }
            direction = Math.sign(targetIndex - before.selectedSectionIndex);
            this.#gallery.selectSection(payload.sectionId);
        } else {
            if (direction === 0) {
                return false;
            }
            this.#gallery.shiftSection(direction);
        }
        const after = this.#gallery.getSnapshot(meta);
        if (after.selectedSectionId === before.selectedSectionId) {
            return false;
        }
        return this.#startPageTurn(before, direction);
    }

    /** @param {object} payload - 항목 이동량입니다. @returns {boolean} 변경 여부입니다. */
    shiftEntry(payload = {}) {
        if (!this.#canNavigate()) {
            return false;
        }
        const direction = Math.sign(Number(payload?.delta) || 0);
        if (direction === 0) {
            return false;
        }
        const meta = this.#getMeta();
        const before = this.#gallery.getSnapshot(meta);
        this.#gallery.shiftEntry(direction, meta);
        const after = this.#gallery.getSnapshot(meta);
        if (after.selectedIndex === before.selectedIndex) {
            return false;
        }
        return this.#startPageTurn(before, direction);
    }

    /** @param {string} entryId @param {object} [meta] @returns {boolean} 선택 여부입니다. */
    selectEntry(entryId, meta = this.#getMeta()) {
        this.#pageTurns.cancel();
        return this.#gallery.selectEntry(entryId, meta);
    }

    /** @param {object} [meta] @returns {Readonly<object>} 갤러리 상태입니다. */
    getSnapshot(meta = this.#getMeta()) {
        return this.#gallery.getSnapshot(meta);
    }

    /** @param {object} [meta] @returns {Readonly<object>|null} 현재 항목입니다. */
    getSelectedEntry(meta = this.#getMeta()) {
        return this.#gallery.getSelectedEntry(meta);
    }

    /** @returns {Readonly<object>} 전체 해금 ID 카탈로그입니다. */
    getUnlockCatalog() {
        return this.#gallery.getUnlockCatalog();
    }

    /** @returns {Readonly<object>} 페이지 전환 상태입니다. */
    getPageTurnSnapshot() {
        return this.#pageTurns.getSnapshot();
    }

    /** @param {object} command @returns {boolean} WebGL 페이지 명령 제출 여부입니다. */
    renderPageTurn(command) {
        return this.#pageTurns.renderPageTurn(command);
    }

    /** @returns {boolean} 페이지 전환 입력 잠금 여부입니다. */
    isTransitioning() {
        return this.#pageTurns.isActive();
    }

    /** 페이지 전환만 취소합니다. */
    cancelPageTurn() {
        this.#pageTurns.cancel();
    }

    /** 선택과 페이지 전환을 첫 상태로 초기화합니다. */
    reset() {
        this.#pageTurns.cancel();
        this.#gallery.reset();
    }

    /** 갤러리 표현 리소스를 해제합니다. */
    destroy() {
        this.#pageTurns.destroy();
    }

    /** @returns {boolean} 현재 모드에서 새 페이지 입력을 받을 수 있는지 여부입니다. @private */
    #canNavigate() {
        const mode = this.#getMode();
        return (mode === MODES.GALLERY || mode === MODES.RECORD)
            && !this.#isCutsceneOpen()
            && !this.#pageTurns.isActive();
    }

    /** @param {object} previousGallery @param {number} direction @returns {boolean} @private */
    #startPageTurn(previousGallery, direction) {
        return this.#pageTurns.start({
            previousGallery,
            direction,
            useWebGL: this.#getMode() === MODES.GALLERY
        });
    }
}
