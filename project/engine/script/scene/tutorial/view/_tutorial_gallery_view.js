import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import { fitTutorialAssetRect } from './_tutorial_asset_view_helpers.js';
import { createTutorialTextAnchor } from './_tutorial_nonbattle_view_helpers.js';
import {
    createTutorialDesignSpace,
    projectTutorialDesignRect
} from './_tutorial_design_space.js';
import { TUTORIAL_UI_LAYOUT_TOKENS } from './_tutorial_ui_layout_tokens.js';
import { createTutorialRecordGalleryPresentation } from './_tutorial_record_gallery_presentation.js';
import { TutorialGalleryContentView } from './_tutorial_gallery_content_view.js';

/** @param {object} page @returns {object} 페이지 상단 제목 프레임 영역입니다. */
function createPageTitleRect(page) {
    return {
        x: page.x + (page.w * 0.17),
        y: page.y + (page.h * 0.015),
        w: page.w * 0.66,
        h: page.h * 0.105
    };
}

/** @param {object} page @returns {object} 미디어 카드 프레임 영역입니다. */
function createMediaFrameRect(page) {
    return {
        x: page.x + (page.w * 0.105),
        y: page.y + (page.h * 0.165),
        w: page.w * 0.79,
        h: page.h * 0.59
    };
}

/** @param {object} page @param {number} count @returns {object[]} 일기 목록 행입니다. */
function createDiaryRows(page, count) {
    const startY = page.y + (page.h * 0.31);
    const rowH = page.h * 0.062;
    return Array.from({ length: count }, (_, index) => ({
        x: page.x + (page.w * 0.17),
        y: startY + (rowH * index),
        w: page.w * 0.66,
        h: rowH
    }));
}

/** @param {object} page @returns {object[]} 업적 2행 4열 슬롯입니다. */
function createAchievementSlots(page) {
    const slotW = page.w * 0.16;
    const slotH = page.h * 0.125;
    const gapX = page.w * 0.035;
    const startX = page.x + (page.w * 0.075);
    const startY = page.y + (page.h * 0.055);
    return Array.from({ length: 8 }, (_, index) => ({
        x: startX + ((index % 4) * (slotW + gapX)),
        y: startY + (Math.floor(index / 4) * (slotH + (page.h * 0.018))),
        w: slotW,
        h: slotH
    }));
}

/**
 * @class TutorialGalleryView
 * @description 미디어·일기·업적별 원본 책 템플릿과 갤러리 입력 사양을 제공합니다.
 */
export class TutorialGalleryView {
    #renderPort;
    #assetPort;
    #pageTurnView;
    #contentView;

    /** @param {object} renderPort - 렌더 포트입니다. @param {object} assetPort - 에셋 읽기 포트입니다. @param {object} options - 선택적 페이지 전환 뷰입니다. */
    constructor(renderPort, assetPort = {}, { pageTurnView = null } = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
        this.#pageTurnView = pageTurnView;
        this.#contentView = new TutorialGalleryContentView(assetPort);
    }

    /**
     * 갤러리 책과 현재 섹션 템플릿의 순수 레이아웃을 계산합니다.
     * @param {object} viewModel - 갤러리 뷰 모델입니다.
     * @returns {object} 갤러리 레이아웃입니다.
     */
    getLayout(viewModel) {
        const space = createTutorialDesignSpace(viewModel.viewport);
        const bookContainer = projectTutorialDesignRect(
            space,
            TUTORIAL_UI_LAYOUT_TOKENS.GALLERY.BOOK
        );
        const book = fitTutorialAssetRect(
            this.#assetPort.getUiAsset?.('endingBook1'),
            bookContainer
        ) || bookContainer;
        const leftPage = {
            x: book.x + (book.w * 0.07),
            y: book.y + (book.h * 0.11),
            w: book.w * 0.39,
            h: book.h * 0.76
        };
        const rightPage = {
            x: book.x + (book.w * 0.54),
            y: book.y + (book.h * 0.11),
            w: book.w * 0.39,
            h: book.h * 0.76
        };
        const bookmarkTokens = [
            ...TUTORIAL_UI_LAYOUT_TOKENS.GALLERY.LEFT_BOOKMARKS,
            ...TUTORIAL_UI_LAYOUT_TOKENS.GALLERY.RIGHT_BOOKMARKS
        ];
        const tabs = viewModel.sections.map((section, index) => ({
            id: section.id,
            ...projectTutorialDesignRect(space, bookmarkTokens[index])
        }));
        const pageTitles = [createPageTitleRect(leftPage), createPageTitleRect(rightPage)];
        const mediaFrames = [createMediaFrameRect(leftPage), createMediaFrameRect(rightPage)];
        const diaryRows = {
            lora: createDiaryRows(leftPage, 7),
            developer: createDiaryRows(rightPage, 3)
        };
        const achievementSlots = createAchievementSlots(leftPage);
        const achievementDetail = {
            x: leftPage.x + (leftPage.w * 0.31),
            y: leftPage.y + (leftPage.h * 0.47),
            w: leftPage.w * 0.38,
            h: leftPage.h * 0.34
        };
        const achievementRibbon = {
            x: rightPage.x + (rightPage.w * 0.57),
            y: rightPage.y - (rightPage.h * 0.07),
            w: rightPage.w * 0.25,
            h: rightPage.h * 0.29
        };
        const pageIndicator = {
            x: rightPage.x + (rightPage.w * 0.32),
            y: rightPage.y + (rightPage.h * 0.825),
            w: rightPage.w * 0.36,
            h: rightPage.h * 0.075
        };
        const rowH = Math.min(
            space.h * 0.052,
            (leftPage.h * 0.7) / Math.max(1, viewModel.entries.length)
        );
        const rows = viewModel.entries.map((entry, index) => ({
            id: entry.id,
            x: leftPage.x + (leftPage.w * 0.04),
            y: leftPage.y + (leftPage.h * 0.15) + (index * rowH),
            w: leftPage.w * 0.92,
            h: rowH * 0.82
        }));
        const buttons = {
            previous: projectTutorialDesignRect(
                space,
                TUTORIAL_UI_LAYOUT_TOKENS.GALLERY.PREVIOUS
            ),
            next: projectTutorialDesignRect(
                space,
                TUTORIAL_UI_LAYOUT_TOKENS.GALLERY.NEXT
            ),
            close: projectTutorialDesignRect(
                space,
                TUTORIAL_UI_LAYOUT_TOKENS.GALLERY.CLOSE
            ),
            play: {
                x: rightPage.x + (rightPage.w * 0.18),
                y: rightPage.y + (rightPage.h * 0.735),
                w: rightPage.w * 0.64,
                h: rightPage.h * 0.12
            }
        };
        return {
            space,
            book,
            leftPage,
            rightPage,
            tabs,
            rows,
            pageTitles,
            mediaFrames,
            diaryRows,
            achievementSlots,
            achievementDetail,
            achievementRibbon,
            pageIndicator,
            contentRects: [
                book,
                leftPage,
                rightPage,
                ...tabs,
                ...pageTitles,
                ...mediaFrames,
                ...achievementSlots,
                achievementDetail,
                achievementRibbon,
                pageIndicator,
                createTutorialTextAnchor(
                    rightPage.x + (rightPage.w * 0.5),
                    rightPage.y + (rightPage.h * 0.12)
                )
            ],
            buttons
        };
    }

    /** @param {object} viewModel - 읽기 전용 갤러리 상태입니다. */
    draw(viewModel) {
        const presentation = createTutorialRecordGalleryPresentation(
            viewModel,
            this.getLayout(viewModel),
            this.#renderPort
        );
        const layout = presentation.layout;
        const drawSpread = (snapshot, renderPort) => {
            const contentPort = {
                ...renderPort,
                wrapText: (...args) => this.#renderPort.wrapText(...args)
            };
            this.#contentView.draw(snapshot, layout, {
                framePort: contentPort,
                contentPort,
                targetLayer: 'ui'
            });
        };
        if (this.#pageTurnView?.draw(viewModel, layout, drawSpread) === true) {
            return;
        }
        const pageTurn = this.#pageTurnView?.createPresentation(viewModel) || {
            contentViewModel: viewModel,
            frameKey: null,
            flipBookFrame: false
        };
        const frameKeys = ['endingBook4', 'endingBook3', 'endingBook2', 'endingBook1'];
        const legacyFrameKey = frameKeys[Math.min(
            frameKeys.length - 1,
            Math.floor(presentation.pageProgress * frameKeys.length)
        )];
        this.#contentView.draw(pageTurn.contentViewModel, layout, presentation, {
            frameKey: pageTurn.frameKey || legacyFrameKey,
            flipBookFrame: pageTurn.flipBookFrame
        });
    }

    /**
     * 섹션·항목 탐색, 컷씬 재생과 복귀 버튼 사양을 반환합니다.
     * @param {object} viewModel - 갤러리 뷰 모델입니다.
     * @returns {object[]} 직렬화 가능한 버튼 사양입니다.
     */
    getButtonSpecs(viewModel) {
        const layout = this.getLayout(viewModel);
        const layer = viewModel.recordPopup === true ? 'top' : 'ui';
        const transitionLocked = viewModel.pageTurn?.active === true;
        const sectionButtons = viewModel.sections.map((section, index) => ({
            key: 'gallery-section-' + section.id,
            ...layout.tabs[index],
            layer,
            label: section.title,
            tooltip: false,
            fontScale: 0.76,
            active: section.selected,
            backgroundAssetKey: section.bookmarkAssetKey,
            backgroundImageAlpha: section.selected ? 1 : 0.72,
            fitHitToBackground: true,
            enabled: !transitionLocked,
            command: {
                type: TUTORIAL_COMMANDS.GALLERY_SECTION_SHIFT,
                payload: { sectionId: section.id }
            }
        }));
        const playable = viewModel.selectedEntry?.playable === true;
        const buttons = [
            ...sectionButtons,
            {
                key: 'gallery-prev',
                ...layout.buttons.previous,
                layer,
                label: '',
                backgroundAssetKey: 'galleryTurnButton',
                backgroundImageAlpha: 1,
                backgroundImageFlipX: true,
                enabled: !transitionLocked,
                command: {
                    type: TUTORIAL_COMMANDS.GALLERY_SHIFT,
                    payload: { delta: -1 }
                }
            },
            {
                key: 'gallery-next',
                ...layout.buttons.next,
                layer,
                label: '',
                backgroundAssetKey: 'galleryTurnButton',
                backgroundImageAlpha: 1,
                enabled: !transitionLocked,
                command: {
                    type: TUTORIAL_COMMANDS.GALLERY_SHIFT,
                    payload: { delta: 1 }
                }
            },
            {
                key: 'gallery-back',
                ...layout.buttons.close,
                layer,
                label: '',
                backgroundAssetKey: 'galleryExitButton',
                backgroundImageAlpha: 1,
                fitHitToBackground: true,
                command: {
                    type: viewModel.closeCommandType || TUTORIAL_COMMANDS.RETURN_MENU
                },
                ...(viewModel.recordPopup === true ? {} : {
                    longPressSeconds: viewModel.unlockAllHoldSeconds,
                    longPressCommand: {
                        type: TUTORIAL_COMMANDS.GALLERY_UNLOCK_ALL
                    }
                })
            }
        ];
        if (playable) {
            buttons.splice(sectionButtons.length + 1, 0, {
                key: 'gallery-play',
                ...layout.buttons.play,
                layer,
                label: '재생 [Enter]',
                backgroundAssetKey: 'mainButton',
                backgroundImageAlpha: 0.94,
                fitHitToBackground: true,
                enabled: !transitionLocked,
                command: { type: TUTORIAL_COMMANDS.GALLERY_PLAY }
            });
        }
        return buttons;
    }
}
