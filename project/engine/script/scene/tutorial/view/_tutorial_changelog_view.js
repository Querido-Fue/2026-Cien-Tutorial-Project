import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import { drawTutorialPixelAsset, fitTutorialAssetRect } from './_tutorial_asset_view_helpers.js';
import {
    drawTutorialBackgroundPanel,
    drawTutorialText,
    toTutorialUiHeight,
    wrapTutorialText
} from './_tutorial_nonbattle_view_helpers.js';
import {
    createTutorialDesignSpace,
    projectTutorialDesignRect
} from './_tutorial_design_space.js';
import { TUTORIAL_UI_LAYOUT_TOKENS } from './_tutorial_ui_layout_tokens.js';

const PAGE_SIDE_ENTRY_COUNT = 4;

/** @param {number} value @param {number} minimum @param {number} maximum @returns {number} */
function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

/** @param {unknown} value @param {string} fallback @returns {string} */
function formatChangelogVersion(value, fallback) {
    const version = String(value || '').trim();
    const match = /^(\d{2})(\d{2})_(\d{2})(\d{2})$/.exec(version);
    if (!match) {
        return version || fallback;
    }
    const [, month, day, hour, minute] = match;
    return `${Number(month)}/${Number(day)} ${hour}:${minute}`;
}

/** @param {string} font @param {object} viewport @returns {number} */
function resolveChangelogSummaryLineHeight(font, viewport) {
    const match = /(\d+(?:\.\d+)?)px/.exec(String(font || ''));
    const fontPixels = Number(match?.[1]);
    const fontBasedHeight = Number.isFinite(fontPixels)
        ? fontPixels * 1.3
        : 0;
    return Math.max(
        toTutorialUiHeight(viewport, 2.2),
        fontBasedHeight
    );
}

/**
 * @class TutorialChangelogView
 * @description 빌드 매니페스트의 한글 Git 변경 기록을 책 형태로 표시합니다.
 */
export class TutorialChangelogView {
    #renderPort;
    #assetPort;

    /** @param {object} renderPort - 렌더 포트입니다. @param {object} assetPort - 에셋 읽기 포트입니다. */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
    }

    /** @param {object} viewModel @returns {number} 현재 기록 수에 필요한 페이지 수입니다. */
    getPageCount(viewModel) {
        const entryCount = Array.isArray(viewModel?.entries)
            ? viewModel.entries.length
            : 0;
        return Math.max(1, Math.ceil(
            entryCount / TUTORIAL_UI_LAYOUT_TOKENS.CHANGELOG.ENTRIES_PER_PAGE
        ));
    }

    /**
     * 현재 화면의 책·페이지·행과 버튼 영역을 계산합니다.
     * @param {object} viewModel - 릴리스 정보와 현재 페이지입니다.
     * @returns {object} 순수 체인지로그 레이아웃입니다.
     */
    getLayout(viewModel) {
        const space = createTutorialDesignSpace(viewModel.viewport);
        const tokens = TUTORIAL_UI_LAYOUT_TOKENS.CHANGELOG;
        const bookContainer = projectTutorialDesignRect(space, tokens.BOOK);
        const book = fitTutorialAssetRect(
            this.#assetPort.getUiAsset?.('endingBook1'),
            bookContainer
        ) || bookContainer;
        const pages = [
            {
                x: book.x + (book.w * 0.07),
                y: book.y + (book.h * 0.105),
                w: book.w * 0.39,
                h: book.h * 0.77
            },
            {
                x: book.x + (book.w * 0.54),
                y: book.y + (book.h * 0.105),
                w: book.w * 0.39,
                h: book.h * 0.77
            }
        ];
        const rows = pages.map((page) => Array.from(
            { length: PAGE_SIDE_ENTRY_COUNT },
            (_, index) => ({
                x: page.x + (page.w * 0.075),
                y: page.y + (page.h * 0.16) + (index * page.h * 0.19),
                w: page.w * 0.85,
                h: page.h * 0.17
            })
        ));
        return {
            space,
            book,
            pages,
            rows,
            pageIndicator: {
                x: book.x + (book.w * 0.4),
                y: book.y + (book.h * 0.89),
                w: book.w * 0.2,
                h: book.h * 0.055
            },
            contentRects: [book, ...pages, ...rows.flat()],
            buttons: {
                previous: projectTutorialDesignRect(space, tokens.PREVIOUS),
                next: projectTutorialDesignRect(space, tokens.NEXT),
                close: projectTutorialDesignRect(space, tokens.CLOSE)
            }
        };
    }

    /** @param {object} viewModel - 읽기 전용 체인지로그 상태입니다. */
    draw(viewModel) {
        const layout = this.getLayout(viewModel);
        const entries = Array.isArray(viewModel.entries) ? viewModel.entries : [];
        const entriesPerPage = TUTORIAL_UI_LAYOUT_TOKENS.CHANGELOG.ENTRIES_PER_PAGE;
        const pageCount = this.getPageCount(viewModel);
        const page = clamp(viewModel.page, 0, pageCount - 1);
        const visibleEntries = entries.slice(
            page * entriesPerPage,
            (page + 1) * entriesPerPage
        );
        const bookDrawn = drawTutorialPixelAsset(this.#renderPort, {
            image: this.#assetPort.getUiAsset?.('endingBook1'),
            rect: layout.book,
            layer: 'ui'
        });
        if (!bookDrawn) {
            drawTutorialBackgroundPanel(
                this.#renderPort,
                layout.book,
                viewModel.colors.UI.PanelStrong,
                0.98
            );
        }

        const titles = [
            '변경 내역',
            `현재 ver ${formatChangelogVersion(viewModel.version, 'dev')}`
        ];
        layout.pages.forEach((pageRect, index) => drawTutorialText(this.#renderPort, {
            text: titles[index],
            x: pageRect.x + (pageRect.w * 0.5),
            y: pageRect.y + (pageRect.h * 0.07),
            font: viewModel.fonts.HEADING,
            fill: viewModel.colors.UI.PanelStrong,
            align: 'center'
        }));

        if (visibleEntries.length === 0) {
            drawTutorialText(this.#renderPort, {
                text: '표시할 변경 기록이 없습니다.',
                x: layout.book.x + (layout.book.w * 0.5),
                y: layout.book.y + (layout.book.h * 0.5),
                font: viewModel.fonts.BODY,
                fill: viewModel.colors.UI.Muted,
                align: 'center'
            });
        }
        visibleEntries.forEach((entry, index) => {
            const sideIndex = Math.floor(index / PAGE_SIDE_ENTRY_COUNT);
            const rowIndex = index % PAGE_SIDE_ENTRY_COUNT;
            const row = layout.rows[sideIndex][rowIndex];
            drawTutorialText(this.#renderPort, {
                text: `ver ${formatChangelogVersion(entry.version, '기록')} · ${entry.commit || '-------'}`,
                x: row.x,
                y: row.y + (row.h * 0.18),
                font: viewModel.fonts.MONO,
                fill: viewModel.colors.UI.Muted,
                align: 'left'
            });
            const summaryLines = wrapTutorialText(
                this.#renderPort,
                entry.summary,
                viewModel.fonts.SMALL,
                row.w,
                2
            );
            const lineHeight = resolveChangelogSummaryLineHeight(
                viewModel.fonts.SMALL,
                viewModel.viewport
            );
            summaryLines.forEach((line, lineIndex) => drawTutorialText(this.#renderPort, {
                text: line,
                x: row.x,
                y: row.y + (row.h * 0.53) + (lineIndex * lineHeight),
                font: viewModel.fonts.SMALL,
                fill: viewModel.colors.UI.PanelStrong,
                align: 'left'
            }));
            this.#renderPort.render('ui', {
                shape: 'rect',
                x: row.x,
                y: row.y + row.h,
                w: row.w,
                h: Math.max(1, Math.round(layout.space.scale)),
                fill: viewModel.colors.UI.Muted,
                alpha: 0.28
            });
        });

        drawTutorialText(this.#renderPort, {
            text: `${page + 1}/${pageCount}`,
            x: layout.pageIndicator.x + (layout.pageIndicator.w * 0.5),
            y: layout.pageIndicator.y + (layout.pageIndicator.h * 0.5),
            font: viewModel.fonts.SMALL,
            fill: viewModel.colors.UI.PanelStrong,
            align: 'center'
        });
    }

    /**
     * 페이지 이동과 메뉴 복귀 버튼을 반환합니다.
     * @param {object} viewModel - 현재 페이지 정보입니다.
     * @returns {object[]} 직렬화 가능한 버튼 사양입니다.
     */
    getButtonSpecs(viewModel) {
        const layout = this.getLayout(viewModel);
        return [
            {
                key: 'changelog-prev',
                ...layout.buttons.previous,
                label: '',
                backgroundAssetKey: 'galleryTurnButton',
                backgroundImageFlipX: true,
                command: {
                    type: TUTORIAL_COMMANDS.CHANGELOG_SHIFT,
                    payload: { delta: -1 }
                }
            },
            {
                key: 'changelog-next',
                ...layout.buttons.next,
                label: '',
                backgroundAssetKey: 'galleryTurnButton',
                command: {
                    type: TUTORIAL_COMMANDS.CHANGELOG_SHIFT,
                    payload: { delta: 1 }
                }
            },
            {
                key: 'changelog-back',
                ...layout.buttons.close,
                label: '',
                backgroundAssetKey: 'galleryExitButton',
                fitHitToBackground: true,
                command: { type: TUTORIAL_COMMANDS.RETURN_MENU }
            }
        ];
    }
}
