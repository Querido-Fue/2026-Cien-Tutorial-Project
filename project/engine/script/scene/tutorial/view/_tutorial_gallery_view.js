import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import { drawTutorialPixelAsset, fitTutorialAssetRect } from './_tutorial_asset_view_helpers.js';
import {
    createTutorialTextAnchor,
    drawTutorialBackgroundPanel,
    drawTutorialText,
    getTutorialUiCenterX,
    toTutorialUiHeight,
    toTutorialUiWidth,
    wrapTutorialText
} from './_tutorial_nonbattle_view_helpers.js';

/**
 * @class TutorialGalleryView
 * @description 책 기반 갤러리의 섹션·항목·본문 표시와 직렬화 가능한 버튼을 제공합니다.
 */
export class TutorialGalleryView {
    #renderPort;
    #assetPort;

    /** @param {object} renderPort - 렌더 포트입니다. @param {object} assetPort - 에셋 읽기 포트입니다. */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
    }

    /**
     * 갤러리 책과 섹션·항목·버튼 레이아웃을 계산합니다.
     * @param {object} viewModel - 갤러리 뷰 모델입니다.
     * @returns {object} 갤러리 레이아웃입니다.
     */
    getLayout(viewModel) {
        const { viewport } = viewModel;
        const centerX = getTutorialUiCenterX(viewport);
        const bookContainer = {
            x: centerX - toTutorialUiWidth(viewport, 38),
            y: toTutorialUiHeight(viewport, 14),
            w: toTutorialUiWidth(viewport, 76),
            h: toTutorialUiHeight(viewport, 67)
        };
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
        const tabGap = toTutorialUiWidth(viewport, 0.7);
        const tabW = Math.min(
            toTutorialUiWidth(viewport, 16),
            (toTutorialUiWidth(viewport, 88) - (tabGap * 4)) / 5
        );
        const tabsTotalW = (tabW * viewModel.sections.length)
            + (tabGap * Math.max(0, viewModel.sections.length - 1));
        const tabs = viewModel.sections.map((section, index) => ({
            id: section.id,
            x: centerX - (tabsTotalW * 0.5) + (index * (tabW + tabGap)),
            y: toTutorialUiHeight(viewport, 5.5),
            w: tabW,
            h: toTutorialUiHeight(viewport, 5.6)
        }));
        const rowH = Math.min(toTutorialUiHeight(viewport, 6.2), leftPage.h / 7.5);
        const rows = viewModel.entries.map((entry, index) => ({
            id: entry.id,
            x: leftPage.x + (leftPage.w * 0.04),
            y: leftPage.y + (leftPage.h * 0.12) + (index * rowH),
            w: leftPage.w * 0.92,
            h: rowH * 0.82
        }));
        const buttonY = toTutorialUiHeight(viewport, 86);
        const buttonH = toTutorialUiHeight(viewport, 5.4);
        const buttons = [
            {
                x: centerX - toTutorialUiWidth(viewport, 31),
                y: buttonY,
                w: toTutorialUiWidth(viewport, 12),
                h: buttonH
            },
            {
                x: centerX - toTutorialUiWidth(viewport, 8),
                y: buttonY,
                w: toTutorialUiWidth(viewport, 16),
                h: buttonH
            },
            {
                x: centerX + toTutorialUiWidth(viewport, 19),
                y: buttonY,
                w: toTutorialUiWidth(viewport, 12),
                h: buttonH
            },
            {
                x: Number(viewport.UIOffsetX) + toTutorialUiWidth(viewport, 3),
                y: toTutorialUiHeight(viewport, 91),
                w: toTutorialUiWidth(viewport, 12),
                h: buttonH
            }
        ];
        return {
            centerX,
            book,
            leftPage,
            rightPage,
            tabs,
            rows,
            contentRects: [
                book,
                leftPage,
                rightPage,
                ...tabs,
                ...rows,
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
        const layout = this.getLayout(viewModel);
        const { colors, fonts, viewport } = viewModel;
        const frameKeys = ['endingBook4', 'endingBook3', 'endingBook2', 'endingBook1'];
        const progress = Math.max(0, Math.min(1, Number(viewModel.selectionProgress) || 0));
        const frameKey = frameKeys[Math.min(
            frameKeys.length - 1,
            Math.floor(progress * frameKeys.length)
        )];
        const bookDrawn = drawTutorialPixelAsset(this.#renderPort, {
            image: this.#assetPort.getUiAsset?.(frameKey),
            rect: layout.book,
            layer: 'ui'
        });
        if (!bookDrawn) {
            drawTutorialBackgroundPanel(this.#renderPort, layout.book, colors.UI.PanelStrong, 0.98);
        }

        drawTutorialPixelAsset(this.#renderPort, {
            image: this.#assetPort.getUiAsset?.('galleryTitleOn'),
            rect: {
                x: layout.leftPage.x + (layout.leftPage.w * 0.17),
                y: layout.leftPage.y,
                w: layout.leftPage.w * 0.66,
                h: layout.leftPage.h * 0.12
            }
        });
        drawTutorialText(this.#renderPort, {
            text: viewModel.selectedSectionTitle,
            x: layout.leftPage.x + (layout.leftPage.w * 0.5),
            y: layout.leftPage.y + (layout.leftPage.h * 0.07),
            font: fonts.HEADING,
            fill: colors.UI.Text,
            align: 'center'
        });

        viewModel.entries.forEach((entry, index) => {
            const row = layout.rows[index];
            const selected = index === viewModel.selectedIndex;
            drawTutorialBackgroundPanel(
                this.#renderPort,
                row,
                selected ? colors.UI.PanelStrong : colors.UI.Panel,
                selected ? 0.78 : 0.34
            );
            const hideLockedTitle = !entry.unlocked
                && (entry.kind === 'ending' || entry.kind === 'cutscene');
            drawTutorialText(this.#renderPort, {
                text: (entry.unlocked ? '◆ ' : '◇ ')
                    + (hideLockedTitle ? '잠긴 기록' : entry.title),
                x: row.x + toTutorialUiWidth(viewport, 0.7),
                y: row.y + (row.h * 0.62),
                font: fonts.SMALL,
                fill: entry.unlocked ? colors.UI.Text : colors.UI.Muted
            });
        });

        const entry = viewModel.selectedEntry;
        if (entry?.kind === 'achievement') {
            drawTutorialPixelAsset(this.#renderPort, {
                image: this.#assetPort.getUiAsset?.(
                    entry.unlocked ? 'galleryAchievementDisplay' : 'galleryAchievementLocked'
                ),
                rect: {
                    x: layout.rightPage.x + (layout.rightPage.w * 0.27),
                    y: layout.rightPage.y + (layout.rightPage.h * 0.08),
                    w: layout.rightPage.w * 0.46,
                    h: layout.rightPage.h * 0.35
                }
            });
        }
        drawTutorialText(this.#renderPort, {
            text: entry?.title || '기록 없음',
            x: layout.rightPage.x + (layout.rightPage.w * 0.5),
            y: layout.rightPage.y + (layout.rightPage.h * 0.46),
            font: fonts.HEADING,
            fill: entry?.unlocked ? colors.UI.Text : colors.UI.Muted,
            align: 'center'
        });
        if (entry?.secondary) {
            drawTutorialText(this.#renderPort, {
                text: entry.secondary,
                x: layout.rightPage.x + (layout.rightPage.w * 0.5),
                y: layout.rightPage.y + (layout.rightPage.h * 0.54),
                font: fonts.SMALL,
                fill: colors.UI.Muted,
                align: 'center'
            });
        }
        const bodyLines = wrapTutorialText(
            this.#renderPort,
            entry?.body || '',
            fonts.BODY,
            layout.rightPage.w * 0.88,
            7
        );
        bodyLines.forEach((line, index) => drawTutorialText(this.#renderPort, {
            text: line,
            x: layout.rightPage.x + (layout.rightPage.w * 0.06),
            y: layout.rightPage.y + (layout.rightPage.h * 0.64)
                + (index * toTutorialUiHeight(viewport, 3.1)),
            font: fonts.SMALL,
            fill: colors.UI.Text
        }));

        drawTutorialPixelAsset(this.#renderPort, {
            image: this.#assetPort.getUiAsset?.('galleryTitleOff'),
            rect: {
                x: layout.rightPage.x + (layout.rightPage.w * 0.33),
                y: layout.rightPage.y + (layout.rightPage.h * 0.89),
                w: layout.rightPage.w * 0.34,
                h: layout.rightPage.h * 0.08
            },
            alpha: 0.72
        });
        drawTutorialText(this.#renderPort, {
            text: String(viewModel.selectedIndex + 1)
                + ' / ' + String(Math.max(1, viewModel.entries.length)),
            x: layout.rightPage.x + (layout.rightPage.w * 0.5),
            y: layout.rightPage.y + (layout.rightPage.h * 0.94),
            font: fonts.MONO,
            fill: colors.UI.Muted,
            align: 'center'
        });
    }

    /**
     * 섹션·항목 탐색, 컷씬 재생과 복귀 버튼 사양을 반환합니다.
     * @param {object} viewModel - 갤러리 뷰 모델입니다.
     * @returns {object[]} 직렬화 가능한 버튼 사양입니다.
     */
    getButtonSpecs(viewModel) {
        const layout = this.getLayout(viewModel);
        const sectionButtons = viewModel.sections.map((section, index) => ({
            key: 'gallery-section-' + section.id,
            ...layout.tabs[index],
            label: section.title,
            active: section.selected,
            backgroundAssetKey: section.bookmarkAssetKey,
            backgroundImageAlpha: section.selected ? 1 : 0.62,
            command: {
                type: TUTORIAL_COMMANDS.GALLERY_SECTION_SHIFT,
                payload: { sectionId: section.id }
            }
        }));
        const playable = viewModel.selectedEntry?.playable === true;
        return [
            ...sectionButtons,
            {
                key: 'gallery-prev',
                ...layout.buttons[0],
                label: '◀ 이전',
                backgroundAssetKey: 'galleryTurnButton',
                command: {
                    type: TUTORIAL_COMMANDS.GALLERY_SHIFT,
                    payload: { delta: -1 }
                }
            },
            {
                key: 'gallery-play',
                ...layout.buttons[1],
                label: playable ? '재생  [Enter]' : '열람 중',
                enabled: playable,
                command: { type: TUTORIAL_COMMANDS.GALLERY_PLAY }
            },
            {
                key: 'gallery-next',
                ...layout.buttons[2],
                label: '다음 ▶',
                backgroundAssetKey: 'galleryTurnButton',
                command: {
                    type: TUTORIAL_COMMANDS.GALLERY_SHIFT,
                    payload: { delta: 1 }
                }
            },
            {
                key: 'gallery-back',
                ...layout.buttons[3],
                label: '메뉴  [Esc]',
                backgroundAssetKey: 'galleryExitButton',
                command: { type: TUTORIAL_COMMANDS.RETURN_MENU }
            }
        ];
    }
}
