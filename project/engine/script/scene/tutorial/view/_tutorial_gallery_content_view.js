import { drawTutorialPixelAsset } from './_tutorial_asset_view_helpers.js';
import {
    drawTutorialBackgroundPanel,
    drawTutorialText,
    toTutorialUiHeight,
    wrapTutorialText
} from './_tutorial_nonbattle_view_helpers.js';

/** @param {object} entry @returns {string} 잠긴 갤러리 항목의 공개 문자열입니다. */
function getPublicTitle(entry) {
    return entry?.unlocked ? String(entry.title || '') : '???';
}

/**
 * @class TutorialGalleryContentView
 * @description 책·글·그림을 같은 렌더 포트에 그려 화면과 페이지 텍스처의 내용을 일치시킵니다.
 */
export class TutorialGalleryContentView {
    #assetPort;

    /** @param {object} assetPort - 갤러리 에셋 읽기 포트입니다. */
    constructor(assetPort = {}) {
        this.#assetPort = assetPort;
    }

    /**
     * 책 프레임과 실제 콘텐츠를 하나의 표시 대상에 그립니다.
     * @param {object} viewModel @param {object} layout @param {object} presentation
     * @param {object} options - 책 프레임과 폴백 방향입니다.
     */
    draw(viewModel, layout, presentation, { frameKey = 'endingBook1', flipBookFrame = false } = {}) {
        const bookDrawn = drawTutorialPixelAsset(presentation.framePort, {
            image: this.#assetPort.getUiAsset?.(frameKey),
            rect: layout.book,
            layer: presentation.targetLayer,
            flipX: flipBookFrame
        });
        if (!bookDrawn) {
            drawTutorialBackgroundPanel(
                presentation.framePort,
                layout.book,
                viewModel.colors.UI.PanelStrong,
                0.98
            );
        }
        if (viewModel.selectedSectionId === 'achievements') {
            this.#drawAchievements(viewModel, layout, presentation.contentPort);
        } else if (
            viewModel.selectedSectionId === 'lora-diary'
            || viewModel.selectedSectionId === 'developer-diary'
        ) {
            this.#drawDiaries(viewModel, layout, presentation.contentPort);
        } else {
            this.#drawMedia(viewModel, layout, presentation.contentPort);
        }
    }

    /** @param {object} viewModel @param {object} layout @param {object} renderPort @private */
    #drawMedia(viewModel, layout, renderPort) {
        const entries = viewModel.entries || [];
        const count = Math.max(1, entries.length);
        const pageEntries = [
            viewModel.selectedEntry,
            entries[(viewModel.selectedIndex + 1) % count] || viewModel.selectedEntry
        ];
        pageEntries.forEach((entry, index) => {
            const titleRect = layout.pageTitles[index];
            const frameRect = layout.mediaFrames[index];
            drawTutorialPixelAsset(renderPort, {
                image: this.#assetPort.getUiAsset?.(
                    entry?.unlocked ? 'galleryTitleOn' : 'galleryTitleOff'
                ),
                rect: titleRect,
                alpha: entry?.unlocked ? 1 : 0.78
            });
            drawTutorialText(renderPort, {
                text: getPublicTitle(entry),
                x: titleRect.x + (titleRect.w * 0.5),
                y: titleRect.y + (titleRect.h * 0.5),
                font: viewModel.fonts.SMALL,
                fill: entry?.unlocked
                    ? viewModel.colors.UI.Text
                    : viewModel.colors.UI.Muted,
                align: 'center'
            });
            drawTutorialPixelAsset(renderPort, {
                image: this.#assetPort.getUiAsset?.('galleryAchievementDisplay'),
                rect: frameRect,
                alpha: entry?.unlocked ? 1 : 0.86,
                mode: 'exact'
            });
            const body = entry?.unlocked ? String(entry.body || '') : '???';
            const lines = wrapTutorialText(
                renderPort,
                body,
                viewModel.fonts.SMALL,
                layout.leftPage.w * 0.8,
                2
            );
            lines.forEach((line, lineIndex) => drawTutorialText(renderPort, {
                text: line,
                x: frameRect.x + (frameRect.w * 0.5),
                y: frameRect.y + frameRect.h + (layout.leftPage.h * 0.055)
                    + (lineIndex * toTutorialUiHeight(viewModel.viewport, 2.3)),
                font: viewModel.fonts.SMALL,
                fill: viewModel.colors.UI.Muted,
                align: 'center'
            }));
        });
        drawTutorialPixelAsset(renderPort, {
            image: this.#assetPort.getUiAsset?.('galleryTitleOff'),
            rect: layout.pageIndicator,
            alpha: 0.76
        });
        drawTutorialText(renderPort, {
            text: String(viewModel.selectedIndex + 1) + '/'
                + String(Math.max(1, viewModel.entries.length)),
            x: layout.pageIndicator.x + (layout.pageIndicator.w * 0.5),
            y: layout.pageIndicator.y + (layout.pageIndicator.h * 0.5),
            font: viewModel.fonts.SMALL,
            fill: viewModel.colors.UI.Text,
            align: 'center'
        });
    }

    /** @param {object} viewModel @param {object} layout @param {object} renderPort @private */
    #drawDiaries(viewModel, layout, renderPort) {
        const pageData = [
            {
                id: 'lora-diary',
                title: '로라의 일기',
                count: 7,
                rows: layout.diaryRows.lora
            },
            {
                id: 'developer-diary',
                title: '개발자의 일기',
                count: 3,
                rows: layout.diaryRows.developer
            }
        ];
        pageData.forEach((page, pageIndex) => {
            const titleRect = layout.pageTitles[pageIndex];
            drawTutorialPixelAsset(renderPort, {
                image: this.#assetPort.getUiAsset?.('galleryTitleOn'),
                rect: titleRect
            });
            drawTutorialText(renderPort, {
                text: page.title,
                x: titleRect.x + (titleRect.w * 0.5),
                y: titleRect.y + (titleRect.h * 0.5),
                font: viewModel.fonts.SMALL,
                fill: viewModel.colors.UI.PanelStrong,
                align: 'center'
            });

            const selectedPage = viewModel.selectedSectionId === page.id;
            const catalogEntries = viewModel.diaryEntriesBySection?.[page.id];
            const entries = Array.isArray(catalogEntries)
                ? catalogEntries
                : selectedPage && Array.isArray(viewModel.entries)
                    ? viewModel.entries
                    : null;
            if (entries) {
                const unlockedCount = entries.filter((entry) => entry?.unlocked === true).length;
                const pageRect = pageIndex === 0 ? layout.leftPage : layout.rightPage;
                drawTutorialText(renderPort, {
                    text: `해금 ${unlockedCount}/${entries.length}`,
                    x: pageRect.x + (pageRect.w * 0.5),
                    y: pageRect.y + (pageRect.h * 0.15),
                    font: viewModel.fonts.SMALL,
                    fill: viewModel.colors.UI.Muted,
                    align: 'center'
                });
            }
            let occupiedRows = 0;
            if (selectedPage && viewModel.selectedEntry) {
                const pageRect = pageIndex === 0 ? layout.leftPage : layout.rightPage;
                const bodyLines = wrapTutorialText(
                    renderPort,
                    viewModel.selectedEntry.body,
                    viewModel.fonts.SMALL,
                    pageRect.w * 0.72,
                    8
                );
                const lineHeight = toTutorialUiHeight(viewModel.viewport, 2.5);
                bodyLines.forEach((line, lineIndex) => drawTutorialText(renderPort, {
                    text: line,
                    x: pageRect.x + (pageRect.w * 0.5),
                    y: pageRect.y + (pageRect.h * 0.205) + (lineIndex * lineHeight),
                    font: viewModel.fonts.SMALL,
                    fill: viewModel.colors.UI.PanelStrong,
                    align: 'center'
                }));
                occupiedRows = Math.min(page.count, Math.max(1, Math.ceil(bodyLines.length * 0.82)));
            }
            const selectedEntryConsumesLockedSlot = selectedPage
                && viewModel.selectedEntry?.unlocked !== true;
            const lockedCount = entries
                ? entries.filter((entry) => entry?.unlocked !== true).length
                : 0;
            const remainingLockedCount = Math.max(
                0,
                lockedCount - (selectedEntryConsumesLockedSlot ? 1 : 0)
            );
            page.rows
                .slice(occupiedRows, occupiedRows + remainingLockedCount)
                .forEach((row) => drawTutorialText(renderPort, {
                    text: '???',
                    x: row.x + (row.w * 0.5),
                    y: row.y + (row.h * 0.5),
                    font: viewModel.fonts.SMALL,
                    fill: viewModel.colors.UI.Muted,
                    align: 'center'
                }));
        });
    }

    /** @param {object} viewModel @param {object} layout @param {object} renderPort @private */
    #drawAchievements(viewModel, layout, renderPort) {
        layout.achievementSlots.forEach((slot, index) => {
            const entry = viewModel.entries[index];
            drawTutorialPixelAsset(renderPort, {
                image: this.#assetPort.getUiAsset?.('galleryAchievementLocked'),
                rect: slot,
                alpha: entry?.unlocked ? 1 : 0.82
            });
            if (entry?.unlocked) {
                drawTutorialText(renderPort, {
                    text: '◆',
                    x: slot.x + (slot.w * 0.5),
                    y: slot.y + (slot.h * 0.5),
                    font: viewModel.fonts.SMALL,
                    fill: viewModel.colors.UI.Text,
                    align: 'center'
                });
            }
        });
        renderPort.render('ui', {
            shape: 'roundRect',
            x: layout.achievementRibbon.x,
            y: layout.achievementRibbon.y,
            w: layout.achievementRibbon.w,
            h: layout.achievementRibbon.h,
            radius: Math.max(2, layout.space.scale * 2),
            fill: '#77251f',
            stroke: '#bd7c2d',
            lineWidth: Math.max(2, layout.space.scale * 2)
        });
        const ornamentRadius = Math.max(2, layout.achievementRibbon.w * 0.035);
        [0.27, 0.5, 0.73].forEach((ratio) => renderPort.render('ui', {
            shape: 'circle',
            x: layout.achievementRibbon.x + (layout.achievementRibbon.w * ratio),
            y: layout.achievementRibbon.y + (layout.achievementRibbon.h * 0.08),
            radius: ornamentRadius,
            fill: '#d9a44d'
        }));
        renderPort.render('ui', {
            shape: 'arrow',
            x: layout.achievementRibbon.x + (layout.achievementRibbon.w * 0.5),
            y: layout.achievementRibbon.y + layout.achievementRibbon.h,
            w: layout.achievementRibbon.w * 0.55,
            h: layout.achievementRibbon.h * 0.18,
            rotation: 180,
            fill: '#f4c990'
        });

        const entry = viewModel.selectedEntry;
        if (!entry?.unlocked) {
            return;
        }
        drawTutorialPixelAsset(renderPort, {
            image: this.#assetPort.getUiAsset?.('galleryAchievementDisplay'),
            rect: layout.achievementDetail,
            mode: 'exact'
        });
        drawTutorialText(renderPort, {
            text: entry.title,
            x: layout.achievementDetail.x + (layout.achievementDetail.w * 0.5),
            y: layout.achievementDetail.y + layout.achievementDetail.h
                + (layout.leftPage.h * 0.055),
            font: viewModel.fonts.SMALL,
            fill: viewModel.colors.UI.PanelStrong,
            align: 'center'
        });
        if (entry.secondary) {
            drawTutorialText(renderPort, {
                text: entry.secondary,
                x: layout.achievementDetail.x + (layout.achievementDetail.w * 0.5),
                y: layout.achievementDetail.y + layout.achievementDetail.h
                    + (layout.leftPage.h * 0.105),
                font: viewModel.fonts.SMALL,
                fill: viewModel.colors.UI.Muted,
                align: 'center'
            });
        }
    }

}
