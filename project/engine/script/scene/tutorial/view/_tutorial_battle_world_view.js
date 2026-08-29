import { TutorialBattleLayout } from './_tutorial_battle_layout.js';
import {
    drawBattleViewText,
    toBattleViewList
} from './_tutorial_battle_view_helpers.js';
import { TutorialBattleActorView } from './_tutorial_battle_actor_view.js';

const WALL_FOOTPRINT_SCALE = 1;
const WALL_HEIGHT_TILE_RATIO = 0.34;

/**
 * @class TutorialBattleWorldView
 * @description 읽기 전용 전투 프레임으로 보드, 범위, 오브젝트와 액터를 그립니다.
 */
export class TutorialBattleWorldView {
    #renderPort;
    #assetPort;
    #actorView;
    #frame;

    /**
     * @param {{render:Function,renderGL:Function}} renderPort - 렌더 명령 포트입니다.
     * @param {{getMapArtwork?:Function,getUiAsset?:Function,getItemIcon?:Function,getLoraSprite?:Function}} assetPort - 읽기 전용 에셋 포트입니다.
     */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
        this.#actorView = new TutorialBattleActorView(renderPort, assetPort);
        this.#frame = null;
    }

    /**
     * 전투 월드 전체를 기존 레이어 순서대로 그립니다.
     * @param {object} viewModel - 장면이 조립한 읽기 전용 BattleViewModel입니다.
     */
    draw(viewModel) {
        if (!viewModel?.snapshot || !viewModel?.floor || !viewModel?.layout) {
            return;
        }
        this.#frame = viewModel;
        try {
            const { boardRect } = viewModel.layout;
            const mapArtwork = this.#assetPort.getMapArtwork?.(viewModel.floor.id) || null;
            this.#renderPort.renderGL('background', {
                shape: 'rect',
                x: boardRect.x + (boardRect.w * 0.5),
                y: boardRect.y + (boardRect.h * 0.5),
                w: boardRect.w,
                h: boardRect.h,
                fill: viewModel.colors.BoardFrame,
                alpha: 0.9
            });
            this.#drawMapArtwork(mapArtwork);
            this.#drawQuarterViewBoard(Boolean(mapArtwork));
            this.#drawWorldObjects();
        } finally {
            this.#frame = null;
        }
    }

    /** 원본 맵 레이어를 왜곡 없이 동일 사각형에 겹쳐 그립니다. @param {object|null} artwork @private */
    #drawMapArtwork(artwork) {
        const rect = this.#frame.layout.mapImageRect;
        if (!artwork || !rect) {
            return;
        }
        for (const image of artwork.layers) {
            this.#renderPort.renderGL('background', {
                image,
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                w: Math.round(rect.w),
                h: Math.round(rect.h),
                smoothing: false
            });
        }
    }

    /** 층 타일과 입력 표식을 그립니다. @param {boolean} hasMapArtwork @private */
    #drawQuarterViewBoard(hasMapArtwork) {
        const { colors, layout, snapshot, world } = this.#frame;
        const floorIndex = Number(world.presentation.floorIndex) || 0;
        const baseFill = floorIndex === 0 ? colors.Tile.Low : colors.Tile.High2;
        const boardTiles = [];
        for (let y = 0; y < layout.mapHeight; y++) {
            for (let x = 0; x < layout.mapWidth; x++) {
                boardTiles.push({ x, y });
            }
        }
        boardTiles.sort((left, right) => (
            (left.x + left.y) - (right.x + right.y) || left.x - right.x
        ));
        if (!hasMapArtwork) {
            for (const tile of boardTiles) {
                const alternate = (tile.x + tile.y) % 2 === 0;
                const tileScale = Math.max(
                    0,
                    1 - (layout.tileGap / layout.tileWidth)
                );
                this.#renderTileOverlay(
                    'background',
                    tile,
                    tileScale,
                    floorIndex === 0
                        ? (alternate ? baseFill : colors.Tile.High1)
                        : (alternate ? baseFill : colors.Tile.Side2),
                    0.96
                );
                this.#renderTileOverlay(
                    'background', tile, tileScale * 0.9, baseFill, 0.9
                );
            }
        }

        if (floorIndex !== (Number(snapshot.floorIndex) || 0)) {
            return;
        }

        if (!world.attackSelected && !world.cleanseSelected) {
            this.#drawLoraIntentRange(boardTiles);
        }

        if (snapshot.phase === 'move') {
            for (const extension of world.pathExtensions) {
                extension.forEach((tile, index) => {
                    this.#renderTileOverlay(
                        'background',
                        tile,
                        index === 0 ? 0.76 : 0.58,
                        index === 0 ? colors.Tile.Reachable : colors.Tile.Teleport,
                        index === 0 ? 0.58 : 0.46
                    );
                });
            }
        }
        if (world.attackSelected) {
            if (world.attackWeapon === 'melee') {
                const range = Number(world.config.attackRange) || 2;
                for (const tile of boardTiles) {
                    const distance = Math.abs(tile.x - snapshot.player.x)
                        + Math.abs(tile.y - snapshot.player.y);
                    if (distance > 0 && distance <= range) {
                        this.#renderTileOverlay(
                            'background', tile, 0.7, colors.Tile.Attack, 0.16
                        );
                    }
                }
            }
            world.actionTargets.forEach((target, index) => {
                const selected = index === world.targetIndex;
                const minScale = Number(world.config.selectionMinScale) || 0.72;
                const scale = selected
                    ? minScale + ((1 - minScale) * world.presentation.attackProgress)
                    : 0.82;
                this.#renderTileOverlay(
                    'background',
                    target,
                    scale,
                    colors.Tile.Attack,
                    selected
                        ? 0.36 + (0.3 * world.presentation.attackProgress)
                        : 0.42
                );
            });
        }
        if (world.cleanseSelected) {
            world.cleanseTargets.forEach((target, index) => {
                const selected = index === world.cleanseTargetIndex;
                const scale = selected
                    ? 0.72 + (0.28 * world.presentation.attackProgress)
                    : 0.82;
                this.#renderTileOverlay(
                    'background',
                    target,
                    scale,
                    colors.UI.Success,
                    selected ? 0.64 : 0.38
                );
            });
        }
        if (world.hoveredTile) {
            const minScale = Number(world.config.selectionMinScale) || 0.72;
            const scale = minScale
                + ((0.88 - minScale) * world.presentation.hoverProgress);
            this.#renderTileOverlay(
                'background',
                world.hoveredTile,
                scale,
                colors.Tile.Hover,
                0.24 + (0.34 * world.presentation.hoverProgress)
            );
        }
        let plannedStep = 0;
        world.plannedPath.slice(1).forEach((tile, index) => {
            const previous = world.plannedPath[index];
            const costsMove = Math.abs(tile.x - previous.x)
                + Math.abs(tile.y - previous.y) === 1;
            if (costsMove) {
                plannedStep += 1;
            }
            const point = this.#projectTile(tile.x, tile.y);
            const markerSize = layout.tileSide
                * world.config.pathMarkerRatio
                * (0.72 + (0.28 * world.presentation.pathProgress));
            this.#renderPort.renderGL('object', {
                shape: 'circle',
                x: point.x,
                y: point.y,
                w: markerSize,
                h: markerSize,
                fill: colors.Tile.Path
            });
            this.#drawText(
                'texteffect',
                costsMove ? String(plannedStep) : '↔',
                point.x,
                point.y,
                this.#frame.fonts.SMALL,
                colors.UI.Text,
                'center'
            );
        });
    }

    /**
     * 다음 로라 행동의 근접 타일 또는 전장 전체 범위를 낮은 강조도로 그립니다.
     * @param {{x:number,y:number}[]} boardTiles - 현재 보드 전체 타일입니다.
     * @private
     */
    #drawLoraIntentRange(boardTiles) {
        const { colors, world } = this.#frame;
        const intent = world.readability?.loraIntent;
        if (!intent?.ok || intent.actionType === 'none') {
            return;
        }
        const tiles = intent.affectsAll
            ? boardTiles
            : toBattleViewList(intent.affectedTiles);
        for (const tile of tiles) {
            this.#renderTileOverlay(
                'background',
                tile,
                0.82,
                colors.Tile.Attack,
                intent.affectsAll ? 0.07 : 0.24
            );
        }
    }

    /** 현재 층 오브젝트와 액터를 깊이 순서로 그립니다. @private */
    #drawWorldObjects() {
        const { floor, snapshot, world } = this.#frame;
        const actorView = world.floorActors;
        const presentationMatchesModel = Number(world.presentation.floorIndex) === (
            Number(snapshot.floorIndex) || 0
        );
        const lora = actorView?.lora
            || (presentationMatchesModel ? snapshot.lora : null);
        const player = actorView?.player
            || (presentationMatchesModel ? snapshot.player : null);
        const entries = [];
        const activeWallKeys = new Set();
        for (const wall of toBattleViewList(floor.walls)) {
            if (!wall.destroyed) {
                entries.push({ type: 'wall', value: wall });
                activeWallKeys.add(`${Number(wall.x)}:${Number(wall.y)}`);
            }
        }
        for (const item of toBattleViewList(floor.items)) {
            if (!item.collected && (!item.hidden || item.identified || item.nearbyHint)) {
                entries.push({ type: 'item', value: item });
            }
        }
        for (const record of toBattleViewList(floor.records)) {
            if (!record.collected) {
                entries.push({ type: 'record', value: record });
            }
        }
        for (const eventTile of toBattleViewList(floor.eventTiles)) {
            entries.push({ type: 'event-tile', value: eventTile });
        }
        for (const teleport of toBattleViewList(floor.teleports)) {
            entries.push({ type: 'teleport', value: teleport });
        }
        for (const mob of toBattleViewList(floor.mobs)) {
            const spriteAnimation = world.spriteAnimations?.[mob.id];
            if ((mob.alive !== false && Number(mob.hp) > 0)
                || spriteAnimation?.visible === true) {
                entries.push({ type: 'mob', value: mob });
            }
        }
        if (lora) entries.push({ type: 'lora', value: lora });
        if (player) entries.push({ type: 'player', value: player });
        entries.sort((left, right) => (
            (Number(left.value.x) + Number(left.value.y))
                - (Number(right.value.x) + Number(right.value.y))
            || Number(left.value.x) - Number(right.value.x)
        ));
        for (const entry of entries) {
            if (entry.type === 'wall') this.#drawWall(entry.value, activeWallKeys);
            else if (entry.type === 'item') this.#drawWorldItem(entry.value);
            else if (entry.type === 'record') this.#drawWorldRecord(entry.value);
            else if (entry.type === 'event-tile') this.#drawEventTile(entry.value);
            else if (entry.type === 'teleport') this.#drawTeleport(entry.value);
            else this.#actorView.draw(entry.type, entry.value, this.#frame);
        }
    }

    /**
     * 파괴 가능한 벽의 노출된 바깥 변만 그립니다.
     * @param {object} wall - 벽 상태입니다.
     * @param {Set<string>} activeWallKeys - 현재 층의 파괴되지 않은 벽 좌표입니다.
     * @private
     */
    #drawWall(wall, activeWallKeys) {
        const { colors, layout } = this.#frame;
        const barrier = this.#assetPort.getUiAsset?.('wallBarrier') || null;
        const quad = TutorialBattleLayout.projectTileQuad(
            layout,
            wall.x,
            wall.y,
            WALL_FOOTPRINT_SCALE
        );
        const corners = Array.from({ length: 4 }, (_, index) => ({
            x: quad[index * 2],
            y: quad[(index * 2) + 1]
        }));
        const edges = [
            { points: [corners[0], corners[1]], neighbor: { x: 0, y: -1 } },
            { points: [corners[0], corners[3]], neighbor: { x: -1, y: 0 } },
            { points: [corners[1], corners[2]], neighbor: { x: 1, y: 0 } },
            { points: [corners[3], corners[2]], neighbor: { x: 0, y: 1 } }
        ].filter(({ neighbor }) => !activeWallKeys.has(
            `${Number(wall.x) + neighbor.x}:${Number(wall.y) + neighbor.y}`
        )).map(({ points }) => points).sort((left, right) => (
            ((left[0].y + left[1].y) * 0.5)
            - ((right[0].y + right[1].y) * 0.5)
        ));
        if (barrier) {
            const height = Math.max(4, layout.tileHeight * WALL_HEIGHT_TILE_RATIO);
            for (const [first, second] of edges) {
                const from = first.x <= second.x ? first : second;
                const to = first.x <= second.x ? second : first;
                const vertices = [
                    from.x, from.y - height,
                    to.x, to.y - height,
                    to.x, to.y,
                    from.x, from.y
                ];
                const minX = Math.min(from.x, to.x);
                const minY = Math.min(from.y, to.y) - height;
                const maxX = Math.max(from.x, to.x);
                const maxY = Math.max(from.y, to.y);
                this.#renderPort.renderGL('object', {
                    image: barrier,
                    x: Math.round(minX),
                    y: Math.round(minY),
                    w: Math.max(1, Math.round(maxX - minX)),
                    h: Math.max(1, Math.round(maxY - minY)),
                    vertices,
                    smoothing: false
                });
            }
            return;
        }

        const fallbackHeight = Math.max(2, layout.tileHeight * 0.14);
        for (const [first, second] of edges) {
            this.#renderPort.renderGL('object', {
                shape: 'rect',
                vertices: [
                    first.x, first.y - fallbackHeight,
                    second.x, second.y - fallbackHeight,
                    second.x, second.y,
                    first.x, first.y
                ],
                fill: colors.Entity.Wall
            });
        }
    }

    /** 월드 아이템을 그립니다. @param {object} entry - 아이템 상태입니다. @private */
    #drawWorldItem(entry) {
        const { colors, layout, world } = this.#frame;
        const point = this.#projectTile(entry.x, entry.y);
        const known = Boolean(world.itemMetadata[entry.itemId]) || entry.identified === true;
        const glyph = known ? this.#getItemGlyph(entry.itemId) : '?';
        const itemIconLayout = world.config.itemIcon;
        const icon = known ? this.#assetPort.getItemIcon?.(entry.itemId) : null;
        this.#renderPort.renderGL('object', {
            shape: 'circle',
            x: point.x,
            y: point.y,
            w: layout.tileSide * itemIconLayout.WORLD_HALO_SIZE_TILE_RATIO,
            h: layout.tileSide * itemIconLayout.WORLD_HALO_SIZE_TILE_RATIO,
            fill: colors.Entity.Item,
            alpha: Number(itemIconLayout.WORLD_HALO_ALPHA) || 0.24
        });
        if (icon) {
            const iconSize = layout.tileSide * itemIconLayout.WORLD_ICON_SIZE_TILE_RATIO;
            const configuredCenter = itemIconLayout.VISUAL_CENTERS?.[entry.itemId];
            const centerX = Math.max(0, Math.min(
                1,
                Number.isFinite(Number(configuredCenter?.x))
                    ? Number(configuredCenter.x)
                    : 0.5
            ));
            const centerY = Math.max(0, Math.min(
                1,
                Number.isFinite(Number(configuredCenter?.y))
                    ? Number(configuredCenter.y)
                    : 0.5
            ));
            this.#renderPort.render('texteffect', {
                shape: 'image',
                image: icon,
                x: Math.round(point.x - (iconSize * centerX)),
                y: Math.round(point.y - (iconSize * centerY)),
                w: Math.round(iconSize),
                h: Math.round(iconSize),
                smoothing: false
            });
            return;
        }
        this.#renderPort.renderGL('object', {
            shape: 'rect',
            x: point.x,
            y: point.y,
            w: layout.tileSide * 0.14,
            h: layout.tileSide * 0.14,
            fill: colors.Tile.Item
        });
        this.#drawText(
            'texteffect',
            glyph,
            point.x,
            point.y,
            this.#frame.fonts.SMALL,
            colors.UI.Text,
            'center'
        );
    }

    /** 획득 가능한 일기·개발자 기록을 작은 픽셀 책으로 그립니다. @param {object} entry @private */
    #drawWorldRecord(entry) {
        const { colors, layout, world } = this.#frame;
        const point = this.#projectTile(entry.x, entry.y);
        const config = world.config.recordIcon;
        if (!config) {
            return;
        }
        const haloSize = layout.tileSide * config.WORLD_HALO_SIZE_TILE_RATIO;
        const coverWidth = layout.tileSide * config.WORLD_COVER_WIDTH_TILE_RATIO;
        const coverHeight = layout.tileSide * config.WORLD_COVER_HEIGHT_TILE_RATIO;
        const inset = Math.max(1, coverWidth * config.WORLD_PAGE_INSET_RATIO);
        this.#renderPort.renderGL('object', {
            shape: 'circle',
            x: point.x,
            y: point.y,
            w: haloSize,
            h: haloSize,
            fill: colors.UI.Accent,
            alpha: Number(config.WORLD_HALO_ALPHA) || 0.18
        });
        this.#renderPort.renderGL('object', {
            shape: 'rect',
            x: point.x,
            y: point.y,
            w: coverWidth,
            h: coverHeight,
            fill: colors.UI.Accent,
            alpha: 0.94
        });
        this.#renderPort.renderGL('object', {
            shape: 'rect',
            x: point.x + (inset * 0.35),
            y: point.y,
            w: Math.max(1, coverWidth - (inset * 1.45)),
            h: Math.max(1, coverHeight - (inset * 1.2)),
            fill: colors.UI.Text,
            alpha: 0.96
        });
        this.#renderPort.renderGL('object', {
            shape: 'rect',
            x: point.x - (coverWidth * 0.32),
            y: point.y,
            w: Math.max(1, inset * 0.62),
            h: coverHeight,
            fill: colors.UI.PanelStrong,
            alpha: 0.88
        });
    }

    /** 이벤트 타일을 그립니다. @param {object} eventTile - 타일 상태입니다. @private */
    #drawEventTile(eventTile) {
        const { colors, fonts } = this.#frame;
        const point = this.#projectTile(eventTile.x, eventTile.y);
        const positive = eventTile.type === 'instability-down';
        const glyphs = {
            damage: '-20',
            'move-penalty': '-2',
            'instability-up': '+10',
            'instability-down': '-10'
        };
        this.#renderTileOverlay(
            'object',
            eventTile,
            0.58,
            positive ? colors.UI.Success : colors.Tile.Trap,
            0.78
        );
        this.#drawText(
            'texteffect',
            glyphs[eventTile.type] || '!',
            point.x,
            point.y,
            fonts.SMALL,
            colors.UI.Text,
            'center'
        );
    }

    /** 텔레포트를 그립니다. @param {object} teleport - 텔레포트 상태입니다. @private */
    #drawTeleport(teleport) {
        const { colors, layout, world } = this.#frame;
        const point = this.#projectTile(teleport.x, teleport.y);
        const pulse = 0.88 + (Math.sin(world.elapsedSeconds * 4) * 0.1);
        const marker = this.#assetPort.getUiAsset?.('teleportMarker') || null;
        if (marker) {
            const width = layout.tileSide * 1.08 * pulse;
            const height = width * (32 / 59);
            this.#renderPort.renderGL('object', {
                image: marker,
                x: Math.round(point.x - (width * 0.5)),
                y: Math.round(point.y - (height * 0.5)),
                w: Math.round(width),
                h: Math.round(height),
                alpha: 0.94,
                smoothing: false
            });
            return;
        }
        this.#renderPort.renderGL('object', {
            shape: 'circle', x: point.x, y: point.y,
            w: layout.tileSide * 0.6 * pulse,
            h: layout.tileSide * 0.6 * pulse,
            fill: colors.Entity.Teleport,
            alpha: 0.68
        });
        this.#renderPort.renderGL('object', {
            shape: 'circle', x: point.x, y: point.y,
            w: layout.tileSide * 0.34,
            h: layout.tileSide * 0.34,
            fill: colors.Tile.Teleport
        });
        this.#drawWorldGlyph('전', point.x, point.y, colors.UI.Text);
    }

    /** 월드 오브젝트의 짧은 글리프를 그립니다. @private */
    #drawWorldGlyph(text, x, y, fill) {
        this.#drawText('texteffect', text, x, y, this.#frame.fonts.HEADING, fill, 'center');
    }

    /** 아이템 ID의 기존 placeholder 글리프를 반환합니다. @private */
    #getItemGlyph(itemId) {
        const glyphs = {
            bow: '활',
            'mascot-costume': '탈',
            'old-teddy': '곰',
            'music-box': '음',
            eyeliner: '선',
            'diamond-pickaxe': '곡',
            mirror: '경',
            mushroom: '버',
            ocarina: '오',
            haste: 'H',
            'memory-photo': '사',
            'tile-cleanser': '정'
        };
        return glyphs[itemId] || 'I';
    }

    /**
     * 레이아웃의 두 타일 축에서 계산한 네 꼭짓점으로 투영 오버레이를 그립니다.
     * @param {string} layer - WebGL 대상 레이어입니다.
     * @param {{x:number,y:number}} tile - 모델 타일 좌표입니다.
     * @param {number} scale - 타일 중심 기준 배율입니다.
     * @param {string} fill - 오버레이 색입니다.
     * @param {number} alpha - 오버레이 투명도입니다.
     * @private
     */
    #renderTileOverlay(layer, tile, scale, fill, alpha) {
        const layout = this.#frame.layout;
        const point = this.#projectTile(tile.x, tile.y);
        const numericScale = Number(scale);
        const safeScale = Math.max(
            0,
            Number.isFinite(numericScale) ? numericScale : 1
        );
        this.#renderPort.renderGL(layer, {
            shape: 'rect',
            x: point.x,
            y: point.y,
            w: layout.tileWidth * safeScale,
            h: layout.tileHeight * safeScale,
            vertices: TutorialBattleLayout.projectTileQuad(
                layout,
                tile.x,
                tile.y,
                safeScale
            ),
            fill,
            alpha
        });
    }

    /** 동일 레이아웃 원본으로 타일을 투영합니다. @private */
    #projectTile(x, y) {
        return TutorialBattleLayout.projectTile(this.#frame.layout, x, y);
    }

    /** 공통 텍스트 렌더 명령을 실행합니다. @private */
    #drawText(layer, text, x, y, font, fill, align = 'left', alpha = 1) {
        drawBattleViewText(this.#renderPort, {
            layer, text, x, y, font, fill, align, alpha
        });
    }
}
