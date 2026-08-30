import { TutorialBattleLayout } from './_tutorial_battle_layout.js';
import {
    drawBattleViewText,
    getBattleViewFontPixelSize,
    toBattleViewList
} from './_tutorial_battle_view_helpers.js';

/**
 * Canvas 글꼴의 픽셀 크기만 배율에 맞춰 교체합니다.
 * @param {string} font - 원본 Canvas 글꼴입니다.
 * @param {number} scale - 적용할 배율입니다.
 * @returns {string} 크기가 조정된 Canvas 글꼴입니다.
 */
function scalePathNumberFont(font, scale) {
    const source = String(font || '');
    const size = Math.max(1, Math.round(
        getBattleViewFontPixelSize(source, 12) * Math.max(0, Number(scale) || 1)
    ));
    return source.match(/[0-9]+(?:\.[0-9]+)?px/i)
        ? source.replace(/[0-9]+(?:\.[0-9]+)?px/i, `${size}px`)
        : `${size}px sans-serif`;
}

/**
 * @class TutorialPathPreviewView
 * @description 계획 경로의 투영 타일 테두리, 경계 화살표와 순번을 그립니다.
 */
export class TutorialPathPreviewView {
    #renderPort;

    /** @param {{render:Function,renderGL:Function}} renderPort - 렌더 명령 포트입니다. */
    constructor(renderPort) {
        this.#renderPort = renderPort;
    }

    /**
     * 선택된 이동 경로를 타일 평면에 맞춰 그립니다.
     * @param {object} frame - 현재 레이아웃·월드·색상·글꼴 프레임입니다.
     */
    draw(frame) {
        const { layout, world, colors, fonts } = frame || {};
        const path = toBattleViewList(world?.plannedPath);
        const style = world?.config?.pathPreview;
        const pathColor = colors?.Tile?.Path;
        if (!layout || path.length < 2 || !style || !pathColor) {
            return;
        }

        const progress = Math.min(1, Math.max(
            0,
            Number(world.presentation?.pathProgress) || 0
        ));
        const revealMinScale = Math.min(1, Math.max(
            0,
            Number(style.REVEAL_MIN_SCALE) || 0
        ));
        const revealScale = revealMinScale + ((1 - revealMinScale) * progress);
        const selectedTiles = path.slice(1);

        selectedTiles.forEach((tile, index) => {
            this.#drawTileBorder({
                layout,
                tile,
                pathColor,
                style,
                step: index + 1,
                alpha: (Number(style.BORDER_ALPHA) || 1) * revealScale
            });
        });
        selectedTiles.forEach((tile, index) => {
            this.#drawBoundaryArrow({
                layout,
                previous: path[index],
                tile,
                pathColor,
                style,
                revealScale,
                step: index + 1
            });
        });
        selectedTiles.forEach((tile, index) => {
            this.#drawStepNumber({
                layout,
                tile,
                text: String(index + 1),
                font: scalePathNumberFont(
                    fonts?.SMALL,
                    (Number(style.NUMBER_FONT_SCALE) || 1) * revealScale
                ),
                fill: colors?.UI?.Text || pathColor,
                shadowFill: colors?.UI?.PanelStrong || colors?.BoardFrame || pathColor,
                shadowOffset: Math.max(0, Number(style.NUMBER_SHADOW_OFFSET_PX) || 0),
                alpha: revealScale
            });
        });
    }

    /** 타일의 바깥·안쪽 투영 사각형 사이를 네 개의 얇은 면으로 채웁니다. @private */
    #drawTileBorder({ layout, tile, pathColor, style, step, alpha }) {
        const outerScale = Math.max(0, Number(style.BORDER_OUTER_SCALE) || 0);
        const innerScale = Math.min(
            outerScale,
            Math.max(0, Number(style.BORDER_INNER_SCALE) || 0)
        );
        if (!(outerScale > innerScale)) {
            return;
        }
        const outer = TutorialBattleLayout.projectTileQuad(
            layout,
            tile.x,
            tile.y,
            outerScale
        );
        const inner = TutorialBattleLayout.projectTileQuad(
            layout,
            tile.x,
            tile.y,
            innerScale
        );
        for (let edgeIndex = 0; edgeIndex < 4; edgeIndex++) {
            const nextIndex = (edgeIndex + 1) % 4;
            this.#renderPort.renderGL('object', {
                shape: 'rect',
                vertices: [
                    outer[edgeIndex * 2], outer[(edgeIndex * 2) + 1],
                    outer[nextIndex * 2], outer[(nextIndex * 2) + 1],
                    inner[nextIndex * 2], inner[(nextIndex * 2) + 1],
                    inner[edgeIndex * 2], inner[(edgeIndex * 2) + 1]
                ],
                fill: pathColor,
                alpha,
                role: 'path-tile-border',
                pathStep: step,
                edgeIndex
            });
        }
    }

    /** 인접한 두 칸의 공유 경계에 타일 축으로 왜곡한 화살표를 그립니다. @private */
    #drawBoundaryArrow({
        layout,
        previous,
        tile,
        pathColor,
        style,
        revealScale,
        step
    }) {
        const dx = Number(tile?.x) - Number(previous?.x);
        const dy = Number(tile?.y) - Number(previous?.y);
        if (Math.abs(dx) + Math.abs(dy) !== 1) {
            return;
        }
        const from = TutorialBattleLayout.projectTile(layout, previous.x, previous.y);
        const to = TutorialBattleLayout.projectTile(layout, tile.x, tile.y);
        const forward = { x: to.x - from.x, y: to.y - from.y };
        const fallbackAxisX = {
            x: Number(layout.tileWidth) * 0.5,
            y: Number(layout.tileHeight) * 0.5
        };
        const fallbackAxisY = {
            x: Number(layout.tileWidth) * -0.5,
            y: Number(layout.tileHeight) * 0.5
        };
        const side = dx !== 0
            ? (layout.gridAxisY || fallbackAxisY)
            : (layout.gridAxisX || fallbackAxisX);
        const halfLength = (Number(style.ARROW_LENGTH_TILE_RATIO) || 0)
            * revealScale * 0.5;
        const halfWidth = (Number(style.ARROW_WIDTH_TILE_RATIO) || 0)
            * revealScale * 0.5;
        if (!(halfLength > 0) || !(halfWidth > 0)) {
            return;
        }
        const center = {
            x: (from.x + to.x) * 0.5,
            y: (from.y + to.y) * 0.5
        };
        const fx = forward.x * halfLength;
        const fy = forward.y * halfLength;
        const sx = Number(side.x) * halfWidth;
        const sy = Number(side.y) * halfWidth;
        this.#renderPort.renderGL('object', {
            shape: 'arrow',
            vertices: [
                center.x + fx - sx, center.y + fy - sy,
                center.x + fx + sx, center.y + fy + sy,
                center.x - fx + sx, center.y - fy + sy,
                center.x - fx - sx, center.y - fy - sy
            ],
            fill: pathColor,
            alpha: (Number(style.ARROW_ALPHA) || 1) * revealScale,
            role: 'path-boundary-arrow',
            pathStep: step
        });
    }

    /** 타일 정중앙에 큰 순번과 한 픽셀 그림자를 그립니다. @private */
    #drawStepNumber({
        layout,
        tile,
        text,
        font,
        fill,
        shadowFill,
        shadowOffset,
        alpha
    }) {
        const point = TutorialBattleLayout.projectTile(layout, tile.x, tile.y);
        if (shadowOffset > 0) {
            drawBattleViewText(this.#renderPort, {
                layer: 'texteffect',
                text,
                x: point.x + shadowOffset,
                y: point.y + shadowOffset,
                font,
                fill: shadowFill,
                align: 'center',
                alpha: alpha * 0.82
            });
        }
        drawBattleViewText(this.#renderPort, {
            layer: 'texteffect',
            text,
            x: point.x,
            y: point.y,
            font,
            fill,
            align: 'center',
            alpha
        });
    }
}
