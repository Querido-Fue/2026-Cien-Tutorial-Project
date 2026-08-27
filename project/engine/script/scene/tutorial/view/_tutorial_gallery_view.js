import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import {
    createTutorialTextAnchor,
    drawTutorialBackgroundPanel,
    drawTutorialText,
    getTutorialUiCenterX,
    toTutorialUiHeight,
    toTutorialUiWidth
} from './_tutorial_nonbattle_view_helpers.js';

/**
 * @class TutorialGalleryView
 * @description 컷씬 갤러리의 잠금 표시와 탐색 버튼 사양을 제공합니다.
 */
export class TutorialGalleryView {
    #renderPort;

    /** @param {object} renderPort - 주입된 렌더 의존성입니다. */
    constructor(renderPort) {
        this.#renderPort = renderPort;
    }

    /**
     * 갤러리 화면의 순수 레이아웃을 계산합니다.
     * @param {object} viewModel - 갤러리 뷰 모델입니다.
     * @returns {object} 목록·카드·버튼 레이아웃입니다.
     */
    getLayout(viewModel) {
        const { viewport, entries } = viewModel;
        const centerX = getTutorialUiCenterX(viewport);
        const listX = Number(viewport.UIOffsetX) + toTutorialUiWidth(viewport, 12);
        const listY = toTutorialUiHeight(viewport, 23);
        const rowH = toTutorialUiHeight(viewport, 5.7);
        const rows = entries.map((entry, index) => ({
            id: entry.id,
            x: listX,
            y: listY + (index * rowH) - ((rowH * 0.82) * 0.5),
            w: toTutorialUiWidth(viewport, 34),
            h: rowH * 0.82
        }));
        const card = {
            x: Number(viewport.UIOffsetX) + toTutorialUiWidth(viewport, 55),
            y: toTutorialUiHeight(viewport, 25),
            w: toTutorialUiWidth(viewport, 32),
            h: toTutorialUiHeight(viewport, 38)
        };
        const buttonY = toTutorialUiHeight(viewport, 78);
        const buttonH = toTutorialUiHeight(viewport, 5);
        const buttons = [
            {
                x: centerX - toTutorialUiWidth(viewport, 31),
                y: buttonY,
                w: toTutorialUiWidth(viewport, 14),
                h: buttonH
            },
            {
                x: centerX - toTutorialUiWidth(viewport, 8),
                y: buttonY,
                w: toTutorialUiWidth(viewport, 16),
                h: buttonH
            },
            {
                x: centerX + toTutorialUiWidth(viewport, 17),
                y: buttonY,
                w: toTutorialUiWidth(viewport, 14),
                h: buttonH
            },
            {
                x: Number(viewport.UIOffsetX) + toTutorialUiWidth(viewport, 4),
                y: toTutorialUiHeight(viewport, 88),
                w: toTutorialUiWidth(viewport, 14),
                h: buttonH
            }
        ];
        return {
            centerX,
            listX,
            listY,
            rowH,
            rows,
            card,
            contentRects: [
                createTutorialTextAnchor(centerX, toTutorialUiHeight(viewport, 12)),
                createTutorialTextAnchor(centerX, toTutorialUiHeight(viewport, 70)),
                card,
                ...rows
            ],
            buttons
        };
    }

    /**
     * 갤러리 목록과 현재 항목 카드를 그립니다.
     * @param {object} viewModel - 읽기 전용 갤러리 상태입니다.
     */
    draw(viewModel) {
        const layout = this.getLayout(viewModel);
        const { colors, fonts, viewport } = viewModel;
        drawTutorialText(this.#renderPort, {
            text: '컷씬 갤러리',
            x: layout.centerX,
            y: toTutorialUiHeight(viewport, 12),
            font: fonts.TITLE,
            fill: colors.UI.Text,
            align: 'center'
        });
        viewModel.entries.forEach((entry, index) => {
            const row = layout.rows[index];
            const selected = index === viewModel.selectedIndex;
            const scale = selected
                ? viewModel.selectionMinScale
                    + ((1 - viewModel.selectionMinScale) * viewModel.selectionProgress)
                : 1;
            const scaled = {
                x: row.x + ((row.w - (row.w * scale)) * 0.5),
                y: row.y + ((row.h - (row.h * scale)) * 0.5),
                w: row.w * scale,
                h: row.h * scale
            };
            drawTutorialBackgroundPanel(
                this.#renderPort,
                scaled,
                selected ? colors.UI.PanelStrong : colors.UI.Panel,
                selected ? 1 : 0.72
            );
            drawTutorialText(this.#renderPort, {
                text: (entry.unlocked ? '◆ ' : '◇ ')
                    + (entry.unlocked ? entry.title : '잠긴 기록'),
                x: layout.listX + toTutorialUiWidth(viewport, 1.2),
                y: layout.listY + (index * layout.rowH),
                font: fonts.BODY,
                fill: entry.unlocked ? colors.UI.Text : colors.UI.Muted
            });
        });
        const entry = viewModel.entries[viewModel.selectedIndex];
        drawTutorialBackgroundPanel(this.#renderPort, layout.card, colors.UI.Panel, 0.96);
        drawTutorialText(this.#renderPort, {
            text: entry?.unlocked ? entry.title : '잠긴 컷씬',
            x: layout.card.x + (layout.card.w * 0.5),
            y: toTutorialUiHeight(viewport, 34),
            font: fonts.HEADING,
            fill: entry?.unlocked ? colors.UI.Text : colors.UI.Muted,
            align: 'center'
        });
        drawTutorialText(this.#renderPort, {
            text: entry?.unlocked
                ? String(entry.cardCount) + '장 · Enter로 재생'
                : '플레이 중 조건을 달성하고 마지막 카드까지 확인하세요.',
            x: layout.card.x + (layout.card.w * 0.5),
            y: toTutorialUiHeight(viewport, 46),
            font: fonts.BODY,
            fill: colors.UI.Muted,
            align: 'center'
        });
        drawTutorialText(this.#renderPort, {
            text: String(viewModel.selectedIndex + 1)
                + ' / ' + String(viewModel.entries.length),
            x: layout.centerX,
            y: toTutorialUiHeight(viewport, 70),
            font: fonts.MONO,
            fill: colors.UI.Muted,
            align: 'center'
        });
    }

    /**
     * 갤러리 탐색·재생·복귀 버튼 사양을 반환합니다.
     * @param {object} viewModel - 갤러리 뷰 모델입니다.
     * @returns {object[]} 직렬화 가능한 버튼 사양입니다.
     */
    getButtonSpecs(viewModel) {
        const layout = this.getLayout(viewModel);
        const entry = viewModel.entries[viewModel.selectedIndex];
        const unlocked = entry?.unlocked === true;
        return [
            {
                key: 'gallery-prev',
                ...layout.buttons[0],
                label: '◀ 이전',
                command: {
                    type: TUTORIAL_COMMANDS.GALLERY_SHIFT,
                    payload: { delta: -1 }
                }
            },
            {
                key: 'gallery-play',
                ...layout.buttons[1],
                label: unlocked ? '재생  [Enter]' : '잠김',
                enabled: unlocked,
                command: { type: TUTORIAL_COMMANDS.GALLERY_PLAY }
            },
            {
                key: 'gallery-next',
                ...layout.buttons[2],
                label: '다음 ▶',
                command: {
                    type: TUTORIAL_COMMANDS.GALLERY_SHIFT,
                    payload: { delta: 1 }
                }
            },
            {
                key: 'gallery-back',
                ...layout.buttons[3],
                label: '메뉴  [Esc]',
                command: { type: TUTORIAL_COMMANDS.RETURN_MENU }
            }
        ];
    }
}
