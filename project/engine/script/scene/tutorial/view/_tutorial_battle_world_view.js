import { TutorialBattleLayout } from './_tutorial_battle_layout.js';
import {
    clampBattleViewNumber,
    drawBattleViewText,
    toBattleViewList
} from './_tutorial_battle_view_helpers.js';

/**
 * @class TutorialBattleWorldView
 * @description 읽기 전용 전투 프레임으로 보드, 범위, 오브젝트와 액터를 그립니다.
 */
export class TutorialBattleWorldView {
    #renderPort;
    #assetPort;
    #frame;

    /**
     * @param {{render:Function,renderGL:Function}} renderPort - 렌더 명령 포트입니다.
     * @param {{getMapArtwork?:Function,getItemIcon?:Function,getLoraSprite?:Function}} assetPort - 읽기 전용 에셋 포트입니다.
     */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
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
                const point = this.#projectTile(tile.x, tile.y);
                const alternate = (tile.x + tile.y) % 2 === 0;
                this.#renderPort.renderGL('background', {
                    shape: 'diamond',
                    x: point.x,
                    y: point.y,
                    w: layout.tileWidth - layout.tileGap,
                    h: layout.tileHeight - (layout.tileGap * 0.5),
                    fill: floorIndex === 0
                        ? (alternate ? baseFill : colors.Tile.High1)
                        : (alternate ? baseFill : colors.Tile.Side2),
                    alpha: 0.96
                });
                this.#renderPort.renderGL('background', {
                    shape: 'diamond',
                    x: point.x,
                    y: point.y,
                    w: (layout.tileWidth - layout.tileGap) * 0.9,
                    h: (layout.tileHeight - (layout.tileGap * 0.5)) * 0.9,
                    fill: baseFill,
                    alpha: 0.9
                });
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
                    const point = this.#projectTile(tile.x, tile.y);
                    this.#renderPort.renderGL('background', {
                        shape: 'diamond',
                        x: point.x,
                        y: point.y,
                        w: layout.tileWidth * (index === 0 ? 0.76 : 0.58),
                        h: layout.tileHeight * (index === 0 ? 0.76 : 0.58),
                        fill: index === 0 ? colors.Tile.Reachable : colors.Tile.Teleport,
                        alpha: index === 0 ? 0.58 : 0.46
                    });
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
                        const point = this.#projectTile(tile.x, tile.y);
                        this.#renderPort.renderGL('background', {
                            shape: 'diamond',
                            x: point.x,
                            y: point.y,
                            w: layout.tileWidth * 0.7,
                            h: layout.tileHeight * 0.7,
                            fill: colors.Tile.Attack,
                            alpha: 0.16
                        });
                    }
                }
            }
            world.actionTargets.forEach((target, index) => {
                const point = this.#projectTile(target.x, target.y);
                const selected = index === world.targetIndex;
                const minScale = Number(world.config.selectionMinScale) || 0.72;
                const scale = selected
                    ? minScale + ((1 - minScale) * world.presentation.attackProgress)
                    : 0.82;
                this.#renderPort.renderGL('background', {
                    shape: 'diamond',
                    x: point.x,
                    y: point.y,
                    w: layout.tileWidth * scale,
                    h: layout.tileHeight * scale,
                    fill: colors.Tile.Attack,
                    alpha: selected
                        ? 0.36 + (0.3 * world.presentation.attackProgress)
                        : 0.42
                });
            });
        }
        if (world.cleanseSelected) {
            world.cleanseTargets.forEach((target, index) => {
                const point = this.#projectTile(target.x, target.y);
                const selected = index === world.cleanseTargetIndex;
                const scale = selected
                    ? 0.72 + (0.28 * world.presentation.attackProgress)
                    : 0.82;
                this.#renderPort.renderGL('background', {
                    shape: 'diamond',
                    x: point.x,
                    y: point.y,
                    w: layout.tileWidth * scale,
                    h: layout.tileHeight * scale,
                    fill: colors.UI.Success,
                    alpha: selected ? 0.64 : 0.38
                });
            });
        }
        if (world.hoveredTile) {
            const point = this.#projectTile(world.hoveredTile.x, world.hoveredTile.y);
            const minScale = Number(world.config.selectionMinScale) || 0.72;
            const scale = minScale
                + ((0.88 - minScale) * world.presentation.hoverProgress);
            this.#renderPort.renderGL('background', {
                shape: 'diamond',
                x: point.x,
                y: point.y,
                w: layout.tileWidth * scale,
                h: layout.tileHeight * scale,
                fill: colors.Tile.Hover,
                alpha: 0.24 + (0.34 * world.presentation.hoverProgress)
            });
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
        const { colors, layout, world } = this.#frame;
        const intent = world.readability?.loraIntent;
        if (!intent?.ok || intent.actionType === 'none') {
            return;
        }
        const tiles = intent.affectsAll
            ? boardTiles
            : toBattleViewList(intent.affectedTiles);
        for (const tile of tiles) {
            const point = this.#projectTile(tile.x, tile.y);
            this.#renderPort.renderGL('background', {
                shape: 'diamond',
                x: point.x,
                y: point.y,
                w: layout.tileWidth * 0.82,
                h: layout.tileHeight * 0.82,
                fill: colors.Tile.Attack,
                alpha: intent.affectsAll ? 0.07 : 0.24
            });
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
        for (const wall of toBattleViewList(floor.walls)) {
            if (!wall.destroyed) entries.push({ type: 'wall', value: wall });
        }
        for (const item of toBattleViewList(floor.items)) {
            if (!item.collected && (!item.hidden || item.identified || item.nearbyHint)) {
                entries.push({ type: 'item', value: item });
            }
        }
        for (const eventTile of toBattleViewList(floor.eventTiles)) {
            entries.push({ type: 'event-tile', value: eventTile });
        }
        for (const teleport of toBattleViewList(floor.teleports)) {
            entries.push({ type: 'teleport', value: teleport });
        }
        for (const mob of toBattleViewList(floor.mobs)) {
            if (mob.alive !== false && Number(mob.hp) > 0) {
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
            if (entry.type === 'wall') this.#drawWall(entry.value);
            else if (entry.type === 'item') this.#drawWorldItem(entry.value);
            else if (entry.type === 'event-tile') this.#drawEventTile(entry.value);
            else if (entry.type === 'teleport') this.#drawTeleport(entry.value);
            else if (entry.type === 'mob') this.#drawMob(entry.value);
            else if (entry.type === 'lora') this.#drawLora(entry.value);
            else this.#drawPlayer(entry.value);
        }
    }

    /** 파괴 가능한 벽을 그립니다. @param {object} wall - 벽 상태입니다. @private */
    #drawWall(wall) {
        const { colors, layout } = this.#frame;
        const point = this.#projectTile(wall.x, wall.y);
        const size = layout.tileSide * 0.58;
        this.#renderPort.renderGL('object', {
            shape: 'rect', x: point.x, y: point.y, w: size, h: size,
            fill: colors.Entity.Wall
        });
        this.#renderPort.renderGL('object', {
            shape: 'rect', x: point.x, y: point.y, w: size * 0.88, h: size * 0.14,
            fill: colors.Tile.Wall
        });
        this.#drawWorldGlyph('벽', point.x, point.y, colors.UI.Text);
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
            fill: colors.Entity.Item
        });
        if (icon) {
            const iconSize = layout.tileSide * itemIconLayout.WORLD_ICON_SIZE_TILE_RATIO;
            this.#renderPort.render('texteffect', {
                shape: 'image',
                image: icon,
                x: Math.round(point.x - (iconSize * 0.5)),
                y: Math.round(point.y - (iconSize * 0.5)),
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
            w: layout.tileSide * 0.28,
            h: layout.tileSide * 0.28,
            fill: colors.Tile.Item
        });
        this.#drawWorldGlyph(glyph, point.x, point.y, colors.UI.Text);
    }

    /** 이벤트 타일을 그립니다. @param {object} eventTile - 타일 상태입니다. @private */
    #drawEventTile(eventTile) {
        const { colors, fonts, layout } = this.#frame;
        const point = this.#projectTile(eventTile.x, eventTile.y);
        const positive = eventTile.type === 'instability-down';
        const glyphs = {
            damage: '-20',
            'move-penalty': '-2',
            'instability-up': '+10',
            'instability-down': '-10'
        };
        this.#renderPort.renderGL('object', {
            shape: 'diamond',
            x: point.x,
            y: point.y,
            w: layout.tileWidth * 0.58,
            h: layout.tileHeight * 0.58,
            fill: positive ? colors.UI.Success : colors.Tile.Trap,
            alpha: 0.78
        });
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

    /** 일반 몹을 그립니다. @param {object} mob - 몹 상태입니다. @private */
    #drawMob(mob) {
        const { colors, layout } = this.#frame;
        const point = this.#projectTile(mob.x, mob.y);
        const size = layout.tileSide * 0.5;
        this.#drawShadow(point.x, point.y, size);
        this.#renderPort.renderGL('object', {
            shape: 'circle', x: point.x, y: point.y, w: size, h: size,
            fill: colors.Entity.MobDark
        });
        this.#renderPort.renderGL('object', {
            shape: 'circle', x: point.x, y: point.y, w: size * 0.78, h: size * 0.78,
            fill: colors.Entity.Mob
        });
        this.#drawWorldGlyph('M', point.x, point.y, colors.UI.Text);
        this.#drawWorldHp(point.x, point.y - (size * 0.62), mob.hp, mob.maxHp || 100, size);
    }

    /** 플레이어 말을 그립니다. @param {object} player - 플레이어 상태입니다. @private */
    #drawPlayer(player) {
        const { colors, fonts, layout, world } = this.#frame;
        const presentation = world.presentation;
        const point = this.#projectTile(presentation.playerX, presentation.playerY);
        const alpha = clampBattleViewNumber(presentation.playerAlpha, 0, 1);
        const size = layout.tileSide * 0.56
            * presentation.playerScale
            * (1 + (presentation.actionPulse * world.config.actionPlayerScale));
        this.#drawShadow(point.x, point.y, size, alpha);
        this.#renderPort.renderGL('object', {
            shape: 'circle', x: point.x, y: point.y, w: size, h: size,
            fill: colors.Entity.PlayerDark, alpha
        });
        this.#renderPort.renderGL('object', {
            shape: 'circle', x: point.x, y: point.y, w: size * 0.78, h: size * 0.78,
            fill: colors.Entity.Player, alpha
        });
        this.#drawText(
            'texteffect', 'P', point.x, point.y, fonts.HEADING,
            colors.Entity.PlayerAccent, 'center', alpha
        );
        this.#drawWorldHp(
            point.x,
            point.y - (size * 0.62),
            presentation.playerHp,
            player.maxHp || 100,
            size,
            alpha,
            world.readability?.playerPreview?.available
                ? world.readability.playerPreview.expected?.playerHp
                : null
        );
    }

    /** 로라를 스프라이트 또는 도형 fallback으로 그립니다. @param {object} lora - 로라 상태입니다. @private */
    #drawLora(lora) {
        const { colors, layout, world } = this.#frame;
        const point = this.#projectTile(lora.x, lora.y);
        const spriteLayout = world.config.loraSprite;
        const actionScale = 1 + (
            world.presentation.actionPulse * world.config.actionLoraScale
        );
        const size = layout.tileSide * spriteLayout.BASE_SIZE_TILE_RATIO * actionScale;
        const spriteSize = layout.tileSide * spriteLayout.SPRITE_SIZE_TILE_RATIO * actionScale;
        const alive = lora.alive !== false && Number(lora.hp) > 0;
        const alpha = alive ? 1 : 0.56;
        const sprite = this.#assetPort.getLoraSprite?.() || null;
        this.#drawShadow(point.x, point.y, size, alive ? 1 : 0.5);
        if (sprite) {
            if (world.feedback.flashSeconds > 0) {
                this.#renderPort.renderGL('object', {
                    shape: 'circle',
                    x: point.x,
                    y: point.y,
                    w: size * spriteLayout.FLASH_GLOW_SIZE_RATIO,
                    h: size * spriteLayout.FLASH_GLOW_SIZE_RATIO,
                    fill: colors.Entity.LoraAccent,
                    alpha: spriteLayout.FLASH_GLOW_ALPHA * alpha
                });
            }
            this.#renderPort.renderGL('object', {
                image: sprite,
                x: Math.round(point.x - (spriteSize * 0.5)),
                y: Math.round(point.y - (spriteSize * 0.5)
                    + (layout.tileSide * spriteLayout.OFFSET_Y_TILE_RATIO)),
                w: Math.round(spriteSize),
                h: Math.round(spriteSize),
                alpha,
                smoothing: false
            });
        } else {
            this.#renderPort.renderGL('object', {
                shape: 'circle', x: point.x, y: point.y, w: size, h: size,
                fill: colors.Entity.LoraDark, alpha
            });
            this.#renderPort.renderGL('object', {
                shape: 'circle', x: point.x, y: point.y, w: size * 0.8, h: size * 0.8,
                fill: world.feedback.flashSeconds > 0
                    ? colors.Entity.LoraAccent
                    : colors.Entity.Lora,
                alpha
            });
            this.#renderPort.renderGL('object', {
                shape: 'rect', x: point.x, y: point.y - (size * 0.23),
                w: size * 0.56, h: size * 0.22,
                fill: colors.Entity.LoraHair
            });
        }
        if (world.feedback.stabilizeSeconds > 0) {
            this.#renderPort.renderGL('object', {
                shape: 'circle',
                x: point.x,
                y: point.y,
                w: size * (1.12 + (world.feedback.stabilizeSeconds * 0.2)),
                h: size * (1.12 + (world.feedback.stabilizeSeconds * 0.2)),
                fill: colors.Effects.Stabilize,
                alpha: clampBattleViewNumber(world.feedback.stabilizeSeconds, 0, 1) * 0.38
            });
        }
        if (!sprite) {
            this.#drawWorldGlyph('L', point.x, point.y, colors.Entity.LoraAccent);
        }
        this.#drawWorldHp(
            point.x,
            point.y - (size * 0.68),
            world.presentation.loraHp,
            lora.maxHp || 100,
            size * 1.08,
            1,
            world.readability?.playerPreview?.available
                ? world.readability.playerPreview.expected?.loraHp
                : null
        );
    }

    /** 액터 그림자를 그립니다. @private */
    #drawShadow(x, y, size, alpha = 1) {
        const { colors, world } = this.#frame;
        const offset = Number(world.config.shadowOffsetRatio) || 0.08;
        this.#renderPort.renderGL('object', {
            shape: 'circle',
            x,
            y: y + (size * offset),
            w: size,
            h: size * 0.36,
            fill: colors.Entity.Shadow,
            alpha
        });
    }

    /** 월드 HP 막대를 그립니다. @private */
    #drawWorldHp(x, y, hp, maxHp, width, alpha = 1, pendingHp = null) {
        const colors = this.#frame.colors;
        const ratio = clampBattleViewNumber(Number(hp) / Math.max(1, Number(maxHp)), 0, 1);
        const pendingRatio = pendingHp !== null
            && pendingHp !== undefined
            && Number.isFinite(Number(pendingHp))
            ? clampBattleViewNumber(
                Number(pendingHp) / Math.max(1, Number(maxHp)),
                0,
                1
            )
            : ratio;
        const height = Math.max(2, width * 0.09);
        this.#renderPort.renderGL('object', {
            shape: 'rect', x, y, w: width, h: height,
            fill: colors.UI.HpEmpty, alpha
        });
        if (ratio > 0) {
            this.#renderPort.renderGL('object', {
                shape: 'rect',
                x: x - (width * 0.5) + ((width * ratio) * 0.5),
                y,
                w: width * ratio,
                h: height,
                fill: colors.UI.HpFull,
                alpha
            });
        }
        if (Math.abs(pendingRatio - ratio) > 0.0001) {
            const startRatio = Math.min(ratio, pendingRatio);
            const segmentRatio = Math.abs(pendingRatio - ratio);
            this.#renderPort.renderGL('object', {
                shape: 'rect',
                x: x - (width * 0.5)
                    + (width * startRatio)
                    + ((width * segmentRatio) * 0.5),
                y,
                w: width * segmentRatio,
                h: height,
                fill: pendingRatio > ratio ? colors.UI.Success : colors.UI.Danger,
                alpha
            });
        }
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
