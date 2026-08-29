/** @param {*} value @returns {string[]} 문자열 ID 목록입니다. */
function toIdList(value) {
    return Array.isArray(value)
        ? value.filter((candidate) => typeof candidate === 'string')
        : [];
}

/**
 * @class TutorialGalleryController
 * @description 갤러리 섹션·항목 선택과 메타 기반 열람 스냅샷만 관리합니다.
 */
export class TutorialGalleryController {
    #content;
    #cutscenes;
    #sectionIndex;
    #entryIndices;

    /** @param {{content:object,cutscenes:object}} options - 콘텐츠 데이터와 컷씬 레지스트리입니다. */
    constructor({ content, cutscenes } = {}) {
        if (!Array.isArray(content?.GALLERY?.sections) || !content.GALLERY.sections.length) {
            throw new TypeError('TutorialGalleryController: 갤러리 섹션 데이터가 필요합니다.');
        }
        if (!cutscenes || typeof cutscenes !== 'object') {
            throw new TypeError('TutorialGalleryController: 컷씬 레지스트리가 필요합니다.');
        }
        this.#content = content;
        this.#cutscenes = cutscenes;
        this.#sectionIndex = 0;
        this.#entryIndices = new Map();
    }

    /** @param {number} delta - 이동할 섹션 수입니다. */
    shiftSection(delta) {
        const count = this.#content.GALLERY.sections.length;
        if (count <= 0 || Number(delta) === 0) {
            return;
        }
        this.#sectionIndex = (
            this.#sectionIndex + Math.sign(Number(delta)) + count
        ) % count;
    }

    /** @param {string} sectionId - 선택할 섹션 ID입니다. */
    selectSection(sectionId) {
        const index = this.#content.GALLERY.sections.findIndex(
            (section) => section.id === sectionId
        );
        if (index >= 0) {
            this.#sectionIndex = index;
        }
    }

    /**
     * 안정 ID로 특정 갤러리 항목을 찾아 해당 섹션과 페이지를 선택합니다.
     * @param {string} entryId - 선택할 항목 ID입니다.
     * @param {object} meta - 현재 메타 진행도입니다.
     * @returns {boolean} 항목을 찾아 선택했는지 여부입니다.
     */
    selectEntry(entryId, meta = {}) {
        if (typeof entryId !== 'string' || !entryId) {
            return false;
        }
        for (let sectionIndex = 0;
            sectionIndex < this.#content.GALLERY.sections.length;
            sectionIndex++) {
            const section = this.#content.GALLERY.sections[sectionIndex];
            const entries = this.#createEntries(section, meta);
            const entryIndex = entries.findIndex((entry) => entry.id === entryId);
            if (entryIndex < 0) {
                continue;
            }
            this.#sectionIndex = sectionIndex;
            this.#entryIndices.set(section.id, entryIndex);
            return true;
        }
        return false;
    }

    /**
     * 현재 섹션의 항목을 순환합니다.
     * @param {number} delta - 이동할 항목 수입니다.
     * @param {object} meta - 현재 메타 진행도입니다.
     */
    shiftEntry(delta, meta = {}) {
        const section = this.#content.GALLERY.sections[this.#sectionIndex];
        const entries = this.#createEntries(section, meta);
        if (!section || entries.length <= 0 || Number(delta) === 0) {
            return;
        }
        const currentIndex = this.#getEntryIndex(section.id, entries.length);
        this.#entryIndices.set(
            section.id,
            (currentIndex + Math.sign(Number(delta)) + entries.length) % entries.length
        );
    }

    /** @returns {void} 첫 섹션과 첫 항목으로 선택을 초기화합니다. */
    reset() {
        this.#sectionIndex = 0;
        this.#entryIndices.clear();
    }

    /**
     * 뷰와 버튼이 함께 사용할 읽기 전용 갤러리 상태를 만듭니다.
     * @param {object} meta - 현재 메타 진행도입니다.
     * @returns {Readonly<object>} 섹션·항목·선택 상태입니다.
     */
    getSnapshot(meta = {}) {
        const sections = this.#content.GALLERY.sections.map((section, index) => Object.freeze({
            id: section.id,
            title: section.title,
            bookmarkAssetKey: section.bookmarkAssetKey,
            selected: index === this.#sectionIndex
        }));
        const selectedSection = this.#content.GALLERY.sections[this.#sectionIndex];
        const entries = this.#createEntries(selectedSection, meta);
        const selectedIndex = this.#getEntryIndex(selectedSection.id, entries.length);
        return Object.freeze({
            sections: Object.freeze(sections),
            selectedSectionIndex: this.#sectionIndex,
            selectedSectionId: selectedSection.id,
            selectedSectionTitle: selectedSection.title,
            entries: Object.freeze(entries),
            selectedIndex,
            selectedEntry: entries[selectedIndex] || null
        });
    }

    /** @param {object} meta - 현재 메타 진행도입니다. @returns {Readonly<object>|null} 현재 항목입니다. */
    getSelectedEntry(meta = {}) {
        return this.getSnapshot(meta).selectedEntry;
    }

    /** @param {string} sectionId @param {number} count @returns {number} 유효한 선택 인덱스입니다. @private */
    #getEntryIndex(sectionId, count) {
        if (count <= 0) {
            this.#entryIndices.set(sectionId, 0);
            return 0;
        }
        const current = Number(this.#entryIndices.get(sectionId)) || 0;
        const index = Math.max(0, Math.min(count - 1, current));
        this.#entryIndices.set(sectionId, index);
        return index;
    }

    /** @param {object} section @param {object} meta @returns {Readonly<object>[]} 섹션 항목입니다. @private */
    #createEntries(section, meta) {
        if (section.source === 'achievements') {
            return this.#content.ACHIEVEMENTS.map((achievement) => {
                const unlocked = toIdList(meta.unlockedAchievementIds).includes(achievement.id);
                return Object.freeze({
                    id: achievement.id,
                    kind: 'achievement',
                    title: achievement.title,
                    secondary: achievement.englishTitle,
                    body: achievement.description || '간단 설명 미확정',
                    unlocked,
                    playable: false,
                    replayCutsceneId: null
                });
            });
        }
        if (section.source === 'lora-diary') {
            return this.#createDiaryEntries(
                this.#content.RECORDS.LORA,
                this.#content.DIARIES.LORA,
                meta
            );
        }
        if (section.source === 'developer-diary') {
            return this.#createDiaryEntries(
                this.#content.RECORDS.DEVELOPER,
                this.#content.DIARIES.DEVELOPER,
                meta
            );
        }
        if (section.source === 'endings') {
            const endingIds = toIdList(meta.endingIds);
            const cutsceneIds = toIdList(meta.unlockedCutsceneIds);
            return this.#content.ENDINGS.map((ending) => {
                const unlocked = endingIds.includes(ending.id);
                const replayCutsceneId = ending.cutsceneId;
                return Object.freeze({
                    id: 'ending:' + ending.id,
                    internalId: ending.id,
                    kind: 'ending',
                    title: ending.displayName,
                    secondary: unlocked ? '해금된 엔딩' : '잠긴 엔딩',
                    body: ending.displayNameStatus === 'unconfirmed'
                        ? '엔딩 표시명 미확정'
                        : unlocked
                            ? '확인한 엔딩'
                            : '플레이 결과에서 해금됩니다.',
                    unlocked,
                    playable: Boolean(
                        unlocked && replayCutsceneId && cutsceneIds.includes(replayCutsceneId)
                    ),
                    replayCutsceneId
                });
            });
        }
        if (section.source === 'cutscenes') {
            const cutsceneIds = toIdList(meta.unlockedCutsceneIds);
            return this.#content.GALLERY.cutsceneIds.map((cutsceneId) => {
                const definition = this.#findCutscene(cutsceneId);
                const unlocked = cutsceneIds.includes(cutsceneId)
                    || (cutsceneId === 'opening' && meta.openingWatched === true);
                return Object.freeze({
                    id: 'cutscene:' + cutsceneId,
                    internalId: cutsceneId,
                    kind: 'cutscene',
                    title: definition.title,
                    secondary: String(definition.cards.length) + '장',
                    body: unlocked
                        ? 'Enter 또는 재생 버튼으로 다시 볼 수 있습니다.'
                        : '플레이 중 해당 장면을 확인하면 해금됩니다.',
                    unlocked,
                    playable: unlocked,
                    replayCutsceneId: cutsceneId
                });
            });
        }
        return [];
    }

    /**
     * @param {readonly object[]} records - 안정 ID 기록 정보입니다.
     * @param {readonly string[]} bodies - 문서 순서를 보존한 본문입니다.
     * @param {object} meta - 현재 메타 진행도입니다.
     * @returns {Readonly<object>[]} 해금 상태가 적용된 일기 항목입니다.
     * @private
     */
    #createDiaryEntries(records, bodies, meta) {
        const unlockedIds = toIdList(meta.unlockedRecordIds);
        return records.map((record, index) => {
            const unlocked = unlockedIds.includes(record.id);
            return Object.freeze({
                id: record.id,
                kind: 'diary',
                title: record.title || ('기록 ' + String(index + 1)),
                secondary: '',
                body: unlocked ? String(bodies[index] || '') : '???',
                unlocked,
                playable: false,
                replayCutsceneId: null
            });
        });
    }

    /** @param {string} id @returns {{id:string,title:string,cards:readonly object[]}} 컷씬 정의입니다. @private */
    #findCutscene(id) {
        const definition = Object.values(this.#cutscenes).find((entry) => entry?.id === id);
        if (!definition || typeof definition.title !== 'string' || !Array.isArray(definition.cards)) {
            throw new TypeError(`TutorialGalleryController: 컷씬 '${id}' 정의가 없습니다.`);
        }
        return definition;
    }
}
