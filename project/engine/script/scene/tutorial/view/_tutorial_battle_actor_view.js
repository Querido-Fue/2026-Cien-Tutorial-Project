import {
    clampBattleViewNumber,
    drawBattleViewText
} from './_tutorial_battle_view_helpers.js';
import { TutorialBattleLayout } from './_tutorial_battle_layout.js';
import { TutorialSpriteFrameRenderer } from './_tutorial_sprite_frame_renderer.js';

/**
 * @class TutorialBattleActorView
 * @description 플레이어·로라·슬라임의 스프라이트 프레임과 도형 폴백만 그립니다.
 */
export class TutorialBattleActorView {
    #renderPort;
    #assetPort;
    #spriteFrameRenderer;

    /** @param {object} renderPort - 렌더 명령 포트입니다. @param {object} assetPort - 이미지 조회 포트입니다. */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
        this.#spriteFrameRenderer = new TutorialSpriteFrameRenderer(
            renderPort,
            assetPort
        );
    }

    /**
     * @param {'player'|'lora'|'mob'} type - 화면 배우 종류입니다.
     * @param {object} actor - 논리 배우 상태입니다.
     * @param {object} frame - 같은 프레임의 BattleViewModel입니다.
     */
    draw(type, actor, frame) {
        if (type === 'player') {
            this.#drawPlayer(actor, frame);
        } else if (type === 'lora') {
            this.#drawLora(actor, frame);
        } else if (type === 'mob') {
            this.#drawMob(actor, frame);
        }
    }

    /** @param {object} player @param {object} frame @private */
    #drawPlayer(player, frame) {
        const { colors, layout, world } = frame;
        const presentation = world.presentation;
        const point = this.#projectTile(
            layout,
            presentation.playerX,
            presentation.playerY
        );
        const alpha = clampBattleViewNumber(presentation.playerAlpha, 0, 1);
        const animation = world.spriteAnimations?.player || null;
        if (animation?.visible === false) {
            return;
        }
        const actionScale = presentation.playerScale
            * (1 + (presentation.actionPulse * world.config.actionPlayerScale));
        const size = layout.tileSide * 0.56 * actionScale;
        const hpY = this.#resolveWorldHpY(
            point,
            animation,
            actionScale,
            point.y - (size * 0.68),
            size,
            frame
        );
        this.#drawShadow(point, animation, actionScale, size, alpha, frame);
        const spriteDrawn = this.#drawSprite(point, animation, actionScale, alpha, frame);
        if (!spriteDrawn) {
            this.#renderPort.renderGL('object', {
                shape: 'circle', x: point.x, y: point.y, w: size, h: size,
                fill: colors.Entity.PlayerDark, alpha
            });
            this.#renderPort.renderGL('object', {
                shape: 'circle', x: point.x, y: point.y, w: size * 0.78, h: size * 0.78,
                fill: colors.Entity.Player, alpha
            });
            this.#drawText('P', point.x, point.y, frame.fonts.HEADING, colors.Entity.PlayerAccent, alpha);
        }
        this.#drawWorldHp(
            point.x,
            hpY,
            presentation.playerHp,
            player.maxHp || 100,
            size,
            alpha,
            world.readability?.playerPreview?.available
                ? world.readability.playerPreview.expected?.playerHp
                : null,
            frame
        );
    }

    /** @param {object} lora @param {object} frame @private */
    #drawLora(lora, frame) {
        const { colors, layout, world } = frame;
        const point = this.#projectTile(layout, lora.x, lora.y);
        const spriteLayout = world.config.loraSprite;
        const animation = world.spriteAnimations?.lora || null;
        const floatState = this.#resolveLoraSpriteState(
            point,
            animation,
            layout,
            spriteLayout
        );
        const spritePoint = floatState.point;
        const actionScale = 1 + (
            world.presentation.actionPulse * world.config.actionLoraScale
        );
        const size = layout.tileSide * spriteLayout.BASE_SIZE_TILE_RATIO * actionScale;
        const hpWidth = size * 1.08;
        const hpY = this.#resolveWorldHpY(
            spritePoint,
            animation,
            actionScale,
            spritePoint.y - (size * 0.76),
            hpWidth,
            frame
        );
        const alive = lora.alive !== false && Number(lora.hp) > 0;
        const alpha = alive ? 1 : 0.56;
        if (animation?.visible === false) {
            return;
        }
        this.#drawShadow(
            point,
            animation,
            actionScale,
            size,
            alive ? 1 : 0.5,
            frame,
            {
                spritePoint,
                liftPixels: floatState.liftPixels,
                liftRatio: floatState.liftRatio
            }
        );
        if (world.feedback.flashSeconds > 0) {
            this.#renderPort.renderGL('object', {
                shape: 'circle',
                x: spritePoint.x,
                y: spritePoint.y,
                w: size * spriteLayout.FLASH_GLOW_SIZE_RATIO,
                h: size * spriteLayout.FLASH_GLOW_SIZE_RATIO,
                fill: colors.Entity.LoraAccent,
                alpha: spriteLayout.FLASH_GLOW_ALPHA * alpha
            });
        }
        const spriteDrawn = this.#drawSprite(
            spritePoint,
            animation,
            actionScale,
            alpha,
            frame
        );
        if (!spriteDrawn) {
            this.#renderPort.renderGL('object', {
                shape: 'circle', x: spritePoint.x, y: spritePoint.y, w: size, h: size,
                fill: colors.Entity.LoraDark, alpha
            });
            this.#renderPort.renderGL('object', {
                shape: 'circle', x: spritePoint.x, y: spritePoint.y,
                w: size * 0.8, h: size * 0.8,
                fill: world.feedback.flashSeconds > 0
                    ? colors.Entity.LoraAccent
                    : colors.Entity.Lora,
                alpha
            });
            this.#renderPort.renderGL('object', {
                shape: 'rect',
                x: spritePoint.x,
                y: spritePoint.y - (size * 0.23),
                w: size * 0.56, h: size * 0.22,
                fill: colors.Entity.LoraHair
            });
            this.#drawText(
                'L',
                spritePoint.x,
                spritePoint.y,
                frame.fonts.HEADING,
                colors.Entity.LoraAccent,
                alpha
            );
        }
        if (world.feedback.stabilizeSeconds > 0) {
            this.#renderPort.renderGL('object', {
                shape: 'circle',
                x: spritePoint.x,
                y: spritePoint.y,
                w: size * (1.12 + (world.feedback.stabilizeSeconds * 0.2)),
                h: size * (1.12 + (world.feedback.stabilizeSeconds * 0.2)),
                fill: colors.Effects.Stabilize,
                alpha: clampBattleViewNumber(world.feedback.stabilizeSeconds, 0, 1) * 0.38
            });
        }
        this.#drawWorldHp(
            spritePoint.x,
            hpY,
            world.presentation.loraHp,
            lora.maxHp || 100,
            hpWidth,
            1,
            world.readability?.playerPreview?.available
                ? world.readability.playerPreview.expected?.loraHp
                : null,
            frame
        );
    }

    /**
     * 불안정 대기 폴백을 원래 크기의 느린 상하 부유 위치로 변환합니다.
     * @param {{x:number,y:number}} point - 타일 위 발 위치입니다.
     * @param {object|null} animation - 현재 로라 스프라이트 애니메이션입니다.
     * @param {object} layout - 전투 보드 레이아웃입니다.
     * @param {object} spriteLayout - 로라 스프라이트 표시 규격입니다.
     * @returns {{point:{x:number,y:number},liftPixels:number,liftRatio:number}} 부유 표시 상태입니다.
     * @private
     */
    #resolveLoraSpriteState(point, animation, layout, spriteLayout) {
        if (animation?.fallbackEffect !== 'breathing') {
            return { point, liftPixels: 0, liftRatio: 0 };
        }
        const amplitude = Math.max(
            0,
            Number(spriteLayout.FLOAT_AMPLITUDE_TILE_RATIO) || 0
        ) * Math.max(0, Number(layout.tileSide) || 0);
        const progress = clampBattleViewNumber(animation.progress, 0, 1);
        const liftRatio = 0.5 + (Math.sin(progress * Math.PI * 2) * 0.5);
        const liftPixels = Math.round(amplitude * liftRatio);
        return {
            point: {
                x: point.x,
                y: point.y - liftPixels
            },
            liftPixels,
            liftRatio
        };
    }

    /** @param {object} mob @param {object} frame @private */
    #drawMob(mob, frame) {
        const { colors, layout, world } = frame;
        const animation = world.spriteAnimations?.[mob.id] || null;
        if (animation?.visible === false) {
            return;
        }
        const point = this.#projectTile(layout, mob.x, mob.y);
        const size = layout.tileSide * 0.5;
        const hpY = this.#resolveWorldHpY(
            point,
            animation,
            1,
            point.y - (size * 0.7),
            size,
            frame
        );
        this.#drawShadow(point, animation, 1, size, 1, frame);
        const spriteDrawn = this.#drawSprite(point, animation, 1, 1, frame);
        if (!spriteDrawn) {
            this.#renderPort.renderGL('object', {
                shape: 'circle', x: point.x, y: point.y, w: size, h: size,
                fill: colors.Entity.MobDark
            });
            this.#renderPort.renderGL('object', {
                shape: 'circle', x: point.x, y: point.y, w: size * 0.78, h: size * 0.78,
                fill: colors.Entity.Mob
            });
            this.#drawText('M', point.x, point.y, frame.fonts.HEADING, colors.UI.Text, 1);
        }
        if (Number(mob.hp) > 0) {
            this.#drawWorldHp(
                point.x,
                hpY,
                mob.hp,
                mob.maxHp || 100,
                size,
                1,
                null,
                frame
            );
        }
    }

    /** @param {{x:number,y:number}} point @param {object|null} animation @param {number} baseScale @param {number} alpha @param {object} frame @returns {boolean} @private */
    #drawSprite(point, animation, baseScale, alpha, frame) {
        const geometry = this.#resolveSpriteGeometry(point, animation, baseScale, frame);
        if (!geometry) {
            return false;
        }
        return this.#spriteFrameRenderer.draw({
            animation,
            geometry,
            alpha,
            effectAlpha: this.#getFallbackEffectAlpha(animation)
        });
    }

    /**
     * 스프라이트의 논리 크기와 발 앵커를 실제 월드 사각형으로 변환합니다.
     * @param {{x:number,y:number}} point - 타일 위 발 위치입니다.
     * @param {object|null} animation - 현재 스프라이트 애니메이션입니다.
     * @param {number} baseScale - 배우 행동 스케일입니다.
     * @param {object} frame - 같은 프레임의 BattleViewModel입니다.
     * @returns {{x:number,y:number,width:number,height:number}|null} 스프라이트 사각형입니다.
     * @private
     */
    #resolveSpriteGeometry(point, animation, baseScale, frame) {
        if (!animation) {
            return null;
        }
        const effectScale = this.#getFallbackEffectScale(animation);
        const logicalWidth = Math.max(1, Number(animation.logicalSize?.width) || 32);
        const logicalHeight = Math.max(1, Number(animation.logicalSize?.height) || 32);
        const scaleTileRatio = Math.max(0.01, Number(animation.scaleTileRatio) || 1);
        const width = Math.max(
            1,
            Math.round(frame.layout.tileSide * scaleTileRatio * baseScale * effectScale)
        );
        const height = Math.max(1, Math.round(width * (logicalHeight / logicalWidth)));
        const anchorX = clampBattleViewNumber(animation.anchor?.x, 0, 1);
        const anchorY = clampBattleViewNumber(animation.anchor?.y, 0, 1);
        return {
            x: Math.round(point.x - (width * anchorX)),
            y: Math.round(point.y - (height * anchorY)),
            width,
            height
        };
    }

    /**
     * 캐릭터별 실제 머리 경계 위에 월드 HP 바 중심을 배치합니다.
     * @param {{x:number,y:number}} point - 타일 위 발 위치입니다.
     * @param {object|null} animation - 현재 스프라이트 애니메이션입니다.
     * @param {number} baseScale - 배우 행동 스케일입니다.
     * @param {number} fallbackY - 스프라이트가 없을 때 사용할 기존 위치입니다.
     * @param {number} width - HP 바 너비입니다.
     * @param {object} frame - 같은 프레임의 BattleViewModel입니다.
     * @returns {number} HP 바 중심 Y 좌표입니다.
     * @private
     */
    #resolveWorldHpY(point, animation, baseScale, fallbackY, width, frame) {
        const geometry = this.#resolveSpriteGeometry(point, animation, baseScale, frame);
        if (!geometry) {
            return fallbackY;
        }
        const visualTopInsetRatio = clampBattleViewNumber(
            animation.visualTopInsetRatio,
            0,
            0.95
        );
        const visualTopY = geometry.y + (geometry.height * visualTopInsetRatio);
        return visualTopY - this.#getWorldHpHeight(width);
    }

    /** @param {object} animation @returns {number} 누락 시트의 의미 동작 스케일입니다. @private */
    #getFallbackEffectScale(animation) {
        const pulse = Math.sin(Math.PI * clampBattleViewNumber(animation.progress, 0, 1));
        const effects = {
            attack: 1 + (pulse * 0.12),
            ranged: 1 + (pulse * 0.08),
            area: 1 + (pulse * 0.18),
            breathing: 1,
            collapse: 1 + (Math.sin(animation.progress * Math.PI * 4) * 0.075),
            hit: 1 + (pulse * 0.08),
            death: 1 - (clampBattleViewNumber(animation.progress, 0, 1) * 0.16)
        };
        return effects[animation.fallbackEffect] || 1;
    }

    /** @param {object} animation @returns {number} 누락 피격·사망의 명도 펄스용 알파입니다. @private */
    #getFallbackEffectAlpha(animation) {
        if (animation.fallbackEffect === 'hit') {
            return Math.floor(animation.progress * 8) % 2 === 0 ? 1 : 0.5;
        }
        if (animation.fallbackEffect === 'death') {
            return 1 - (clampBattleViewNumber(animation.progress, 0, 1) * 0.42);
        }
        return 1;
    }

    /**
     * 현재 스프라이트 알파를 실제 바닥 축에 눕혀 광원 투영형 그림자로 그립니다.
     * @param {{x:number,y:number}} point - 배우의 발 위치입니다.
     * @param {object|null} animation - 현재 스프라이트 애니메이션입니다.
     * @param {number} baseScale - 배우 행동 스케일입니다.
     * @param {number} size - 도형 폴백 기준 크기입니다.
     * @param {number} alpha - 배우 표시 알파입니다.
     * @param {object} frame - 같은 프레임의 BattleViewModel입니다.
     * @param {object} [physics={}] - 스프라이트 기준점과 부유 높이입니다.
     * @private
     */
    #drawShadow(point, animation, baseScale, size, alpha, frame, physics = {}) {
        const config = frame.world.config.shadowProjection || {};
        const axes = this.#resolveShadowProjectionAxes(frame.layout, config);
        const actorAlpha = clampBattleViewNumber(alpha, 0, 1);
        const spritePoint = physics.spritePoint || point;
        const liftPixels = Math.max(0, Number(physics.liftPixels) || 0);
        const liftRatio = clampBattleViewNumber(physics.liftRatio, 0, 1);
        const geometry = this.#resolveSpriteGeometry(
            spritePoint,
            animation,
            baseScale,
            frame
        );
        const image = animation?.assetId
            ? this.#assetPort.getImage?.(animation.assetId) || null
            : null;
        const layers = Array.isArray(animation?.layers) ? animation.layers : [];
        const shadowLayers = layers.filter((layer) => layer?.castsShadow !== false);
        const shadowFootAnchors = this.#resolveShadowFootAnchors(animation);

        if (geometry && image && shadowLayers.length > 0) {
            if (shadowFootAnchors.length === 2) {
                this.#drawFootAnchoredSpriteProjectionShadow({
                    animation,
                    geometry,
                    image,
                    sourceRect: shadowLayers[0],
                    shadowFootAnchors,
                    axes,
                    config,
                    alpha: actorAlpha,
                    liftPixels,
                    liftRatio,
                    frame
                });
            } else {
                this.#drawSpriteProjectionShadow({
                    point,
                    animation,
                    geometry,
                    image,
                    layers: shadowLayers,
                    axes,
                    config,
                    alpha: actorAlpha,
                    frame
                });
            }
        } else {
            this.#drawFallbackProjectionShadow(
                point,
                size,
                axes,
                config,
                actorAlpha,
                frame
            );
        }
        if (geometry && shadowFootAnchors.length === 2) {
            this.#drawFootContactShadows({
                geometry,
                shadowFootAnchors,
                axes,
                config,
                alpha: actorAlpha,
                liftPixels,
                liftRatio,
                frame
            });
        } else {
            this.#drawContactShadow(point, size, axes, config, actorAlpha, frame);
        }
    }

    /**
     * 실측한 좌·우 발 접점을 기준으로 스프라이트 실루엣을 두 메시로 나눠 투영합니다.
     * 부유 중에는 높이에 비례한 이동·감쇠와 픽셀 반그림자 한 겹을 추가합니다.
     * @param {object} options - 투영 입력입니다.
     * @private
     */
    #drawFootAnchoredSpriteProjectionShadow({
        animation,
        geometry,
        image,
        sourceRect,
        shadowFootAnchors,
        axes,
        config,
        alpha,
        liftPixels,
        liftRatio,
        frame
    }) {
        const bandCount = Math.round(clampBattleViewNumber(
            Number(config.BAND_COUNT) || 4,
            1,
            8
        ));
        const farAlpha = clampBattleViewNumber(
            Number(config.FAR_ALPHA) || 0.32,
            0,
            1
        );
        const nearAlpha = clampBattleViewNumber(
            Number(config.NEAR_ALPHA) || 0.9,
            0,
            1
        );
        const fadeRatio = clampBattleViewNumber(
            Number(config.FLOAT_SHADOW_ALPHA_FADE_RATIO) || 0,
            0,
            1
        );
        const coreAlpha = alpha
            * this.#getFallbackEffectAlpha(animation)
            * (1 - (liftRatio * fadeRatio));
        const divider = (shadowFootAnchors[0].x + shadowFootAnchors[1].x) * 0.5;
        const horizontalRanges = [
            { start: 0, end: divider, foot: shadowFootAnchors[0] },
            { start: divider, end: 1, foot: shadowFootAnchors[1] }
        ];
        const passes = [];
        const penumbraAlpha = clampBattleViewNumber(
            Number(config.FLOAT_PENUMBRA_ALPHA) || 0,
            0,
            1
        ) * liftRatio;
        if (penumbraAlpha > 0.001) {
            passes.push({
                alphaScale: penumbraAlpha,
                lateralScale: 1 + (
                    liftRatio * Math.max(
                        0,
                        Number(config.FLOAT_PENUMBRA_EXPANSION_RATIO) || 0
                    )
                ),
                lengthScale: 1 + (
                    liftRatio * Math.max(
                        0,
                        Number(config.FLOAT_PENUMBRA_LENGTH_RATIO) || 0
                    )
                )
            });
        }
        passes.push({ alphaScale: 1, lateralScale: 1, lengthScale: 1 });

        for (const pass of passes) {
            for (const range of horizontalRanges) {
                for (let bandIndex = 0; bandIndex < bandCount; bandIndex++) {
                    const startUnit = bandIndex / bandCount;
                    const endUnit = (bandIndex + 1) / bandCount;
                    const startY = range.foot.y * startUnit;
                    const endY = range.foot.y * endUnit;
                    const midpoint = (startUnit + endUnit) * 0.5;
                    const bandAlpha = farAlpha
                        + ((nearAlpha - farAlpha) * midpoint);
                    const sourceHorizontalRange = animation.flipX === true
                        ? [1 - range.end, 1 - range.start] : [range.start, range.end];
                    const slicedSourceRect = this.#sliceShadowSourceRegion(
                        sourceRect, ...sourceHorizontalRange, startY, endY
                    );
                    if (!slicedSourceRect) {
                        continue;
                    }
                    this.#renderPort.renderGL('object', {
                        image,
                        sourceRect: slicedSourceRect,
                        flipX: animation.flipX === true,
                        vertices: this.#createFootShadowBandVertices({
                            geometry,
                            foot: range.foot,
                            axes,
                            config,
                            liftPixels,
                            horizontalStart: range.start,
                            horizontalEnd: range.end,
                            verticalStart: startY,
                            verticalEnd: endY,
                            lateralScale: pass.lateralScale,
                            lengthScale: pass.lengthScale
                        }),
                        fill: frame.colors.Entity.Shadow,
                        alpha: coreAlpha * bandAlpha * pass.alphaScale,
                        smoothing: false
                    });
                }
            }
        }
    }

    /**
     * 스프라이트를 세로 밴드로 나눠 발밑에서 먼 끝으로 갈수록 옅어지는 그림자를 그립니다.
     * @param {object} options - 투영 입력입니다.
     * @private
     */
    #drawSpriteProjectionShadow({
        point,
        animation,
        geometry,
        image,
        layers,
        axes,
        config,
        alpha,
        frame
    }) {
        const bandCount = Math.round(clampBattleViewNumber(
            Number(config.BAND_COUNT) || 4,
            1,
            8
        ));
        const farAlpha = clampBattleViewNumber(
            Number(config.FAR_ALPHA) || 0.32,
            0,
            1
        );
        const nearAlpha = clampBattleViewNumber(
            Number(config.NEAR_ALPHA) || 0.9,
            0,
            1
        );
        const effectAlpha = this.#getFallbackEffectAlpha(animation);

        for (let bandIndex = 0; bandIndex < bandCount; bandIndex++) {
            const startRatio = bandIndex / bandCount;
            const endRatio = (bandIndex + 1) / bandCount;
            const midpoint = (startRatio + endRatio) * 0.5;
            const bandAlpha = farAlpha + ((nearAlpha - farAlpha) * midpoint);
            const vertices = this.#createShadowBandVertices(
                point,
                geometry,
                animation,
                axes,
                config,
                startRatio,
                endRatio
            );
            for (const layer of layers) {
                const sourceRect = this.#sliceShadowSourceRect(
                    layer,
                    startRatio,
                    endRatio
                );
                if (!sourceRect) {
                    continue;
                }
                this.#renderPort.renderGL('object', {
                    image,
                    sourceRect,
                    flipX: animation.flipX === true,
                    vertices,
                    fill: frame.colors.Entity.Shadow,
                    alpha: alpha * effectAlpha * bandAlpha,
                    smoothing: false
                });
            }
        }
    }

    /**
     * 스프라이트가 준비되지 않았을 때도 같은 광원 방향의 완만한 투영을 유지합니다.
     * @private
     */
    #drawFallbackProjectionShadow(point, size, axes, config, alpha, frame) {
        const geometry = {
            width: size * 0.72,
            height: size,
            anchorX: 0.5,
            anchorY: 0.78
        };
        const vertices = this.#createShadowBandVertices(
            point,
            geometry,
            geometry,
            axes,
            config,
            0,
            1
        );
        const farAlpha = clampBattleViewNumber(
            Number(config.FAR_ALPHA) || 0.32,
            0,
            1
        );
        const nearAlpha = clampBattleViewNumber(
            Number(config.NEAR_ALPHA) || 0.9,
            0,
            1
        );
        this.#renderPort.renderGL('object', {
            shape: 'circle',
            vertices,
            fill: frame.colors.Entity.Shadow,
            alpha: alpha * ((farAlpha + nearAlpha) * 0.5)
        });
    }

    /** 실제 발 위치에는 작고 진한 접지 그림자만 남깁니다. @private */
    #drawContactShadow(point, size, axes, config, alpha, frame) {
        const width = size * (
            Number(config.CONTACT_WIDTH_SIZE_RATIO) || 0.42
        );
        const height = size * (
            Number(config.CONTACT_HEIGHT_SIZE_RATIO) || 0.12
        );
        const offset = size * (
            Number(config.CONTACT_OFFSET_SIZE_RATIO) || 0.03
        );
        const center = {
            x: point.x + (axes.direction.x * offset),
            y: point.y + (axes.direction.y * offset)
        };
        const halfWidth = width * 0.5;
        const halfHeight = height * 0.5;
        const vertices = [
            center.x - (axes.cross.x * halfWidth) - (axes.direction.x * halfHeight),
            center.y - (axes.cross.y * halfWidth) - (axes.direction.y * halfHeight),
            center.x + (axes.cross.x * halfWidth) - (axes.direction.x * halfHeight),
            center.y + (axes.cross.y * halfWidth) - (axes.direction.y * halfHeight),
            center.x + (axes.cross.x * halfWidth) + (axes.direction.x * halfHeight),
            center.y + (axes.cross.y * halfWidth) + (axes.direction.y * halfHeight),
            center.x - (axes.cross.x * halfWidth) + (axes.direction.x * halfHeight),
            center.y - (axes.cross.y * halfWidth) + (axes.direction.y * halfHeight)
        ].map(Math.round);
        this.#renderPort.renderGL('object', {
            shape: 'circle',
            vertices,
            fill: frame.colors.Entity.Shadow,
            alpha: alpha * clampBattleViewNumber(
                Number(config.CONTACT_ALPHA) || 0.78,
                0,
                1
            )
        });
    }

    /**
     * 프레임 스냅샷의 발 접점을 좌→우 순서로 검증합니다.
     * @param {object|null} animation - 현재 스프라이트 애니메이션입니다.
     * @returns {readonly {x:number,y:number}[]} 유효한 양발 접점입니다.
     * @private
     */
    #resolveShadowFootAnchors(animation) {
        if (!Array.isArray(animation?.shadowFootAnchors)
            || animation.shadowFootAnchors.length !== 2) {
            return [];
        }
        const feet = animation.shadowFootAnchors.map((foot) => ({
            x: clampBattleViewNumber(foot?.x, 0, 1),
            y: clampBattleViewNumber(foot?.y, 0, 1)
        }));
        return feet.sort((left, right) => left.x - right.x);
    }

    /**
     * 접지 상태에서는 두 발 바로 아래에 작은 접촉 그림자를 두고,
     * 부유 높이가 생기면 빠르게 옅어지면서 투영 실루엣 쪽으로 이동시킵니다.
     * @param {object} options - 접촉 그림자 입력입니다.
     * @private
     */
    #drawFootContactShadows({
        geometry,
        shadowFootAnchors,
        axes,
        config,
        alpha,
        liftPixels,
        liftRatio,
        frame
    }) {
        const contactFade = (1 - liftRatio) ** 2;
        if (contactFade <= 0.001) {
            return;
        }
        const width = Math.max(
            2,
            geometry.width * Math.max(
                0,
                Number(config.FOOT_CONTACT_WIDTH_SPRITE_RATIO) || 0.1
            )
        );
        const height = Math.max(
            1,
            geometry.height * Math.max(
                0,
                Number(config.FOOT_CONTACT_HEIGHT_SPRITE_RATIO) || 0.04
            )
        );
        const contactAlpha = alpha * contactFade * clampBattleViewNumber(
            Number(config.CONTACT_ALPHA) || 0.78,
            0,
            1
        );
        for (const foot of shadowFootAnchors) {
            const contact = this.#resolveGroundFootPoint(
                geometry,
                foot,
                axes,
                config,
                liftPixels
            );
            const center = {
                x: contact.x + (axes.direction.x * height * 0.5),
                y: contact.y + (axes.direction.y * height * 0.5)
            };
            this.#renderPort.renderGL('object', {
                shape: 'circle',
                vertices: this.#createGroundEllipseVertices(
                    center,
                    width,
                    height,
                    axes
                ),
                fill: frame.colors.Entity.Shadow,
                alpha: contactAlpha
            });
        }
    }

    /**
     * 스프라이트 발 접점을 지면으로 내리고 부유 높이만큼 동남쪽으로 이동시킵니다.
     * @param {object} geometry - 현재 스프라이트 사각형입니다.
     * @param {{x:number,y:number}} foot - 정규화된 발 접점입니다.
     * @param {object} axes - 지면 투영 축입니다.
     * @param {object} config - 그림자 물리 설정입니다.
     * @param {number} liftPixels - 스프라이트 부유 높이입니다.
     * @returns {{x:number,y:number}} 지면의 발 그림자 기준점입니다.
     * @private
     */
    #resolveGroundFootPoint(geometry, foot, axes, config, liftPixels) {
        const shift = liftPixels * Math.max(
            0,
            Number(config.FLOAT_SHADOW_SHIFT_RATIO) || 0
        );
        return {
            x: geometry.x
                + (geometry.width * foot.x)
                + (axes.direction.x * shift),
            y: geometry.y
                + (geometry.height * foot.y)
                + liftPixels
                + (axes.direction.y * shift)
        };
    }

    /**
     * 한쪽 발이 담당하는 이미지 조각을 발 접점부터 광원 반대 방향으로 평면 투영합니다.
     * @param {object} options - 밴드 투영 입력입니다.
     * @returns {number[]} WebGL 사각형 꼭짓점입니다.
     * @private
     */
    #createFootShadowBandVertices({
        geometry,
        foot,
        axes,
        config,
        liftPixels,
        horizontalStart,
        horizontalEnd,
        verticalStart,
        verticalEnd,
        lateralScale,
        lengthScale
    }) {
        const footPoint = this.#resolveGroundFootPoint(
            geometry,
            foot,
            axes,
            config,
            liftPixels
        );
        const projectionLength = Math.max(
            0,
            Number(config.LENGTH_SPRITE_HEIGHT_RATIO) || 0.92
        ) * lengthScale;
        const project = (horizontal, vertical) => {
            const height = Math.max(0, foot.y - vertical) * geometry.height;
            const lateral = (horizontal - foot.x)
                * geometry.width
                * lateralScale;
            return {
                x: footPoint.x
                    + (axes.direction.x * height * projectionLength)
                    + (axes.cross.x * lateral),
                y: footPoint.y
                    + (axes.direction.y * height * projectionLength)
                    + (axes.cross.y * lateral)
            };
        };
        const topLeft = project(horizontalStart, verticalStart);
        const topRight = project(horizontalEnd, verticalStart);
        const bottomRight = project(horizontalEnd, verticalEnd);
        const bottomLeft = project(horizontalStart, verticalEnd);
        return [
            topLeft.x,
            topLeft.y,
            topRight.x,
            topRight.y,
            bottomRight.x,
            bottomRight.y,
            bottomLeft.x,
            bottomLeft.y
        ].map(Math.round);
    }

    /**
     * 지면의 두 직교축을 따르는 픽셀 타원을 만듭니다.
     * @param {{x:number,y:number}} center - 타원 중심입니다.
     * @param {number} width - 지면 폭입니다.
     * @param {number} height - 투영 방향 높이입니다.
     * @param {object} axes - 지면 투영 축입니다.
     * @returns {number[]} WebGL 사각형 꼭짓점입니다.
     * @private
     */
    #createGroundEllipseVertices(center, width, height, axes) {
        const halfWidth = width * 0.5;
        const halfHeight = height * 0.5;
        return [
            center.x - (axes.cross.x * halfWidth) - (axes.direction.x * halfHeight),
            center.y - (axes.cross.y * halfWidth) - (axes.direction.y * halfHeight),
            center.x + (axes.cross.x * halfWidth) - (axes.direction.x * halfHeight),
            center.y + (axes.cross.y * halfWidth) - (axes.direction.y * halfHeight),
            center.x + (axes.cross.x * halfWidth) + (axes.direction.x * halfHeight),
            center.y + (axes.cross.y * halfWidth) + (axes.direction.y * halfHeight),
            center.x - (axes.cross.x * halfWidth) + (axes.direction.x * halfHeight),
            center.y - (axes.cross.y * halfWidth) + (axes.direction.y * halfHeight)
        ].map(Math.round);
    }

    /**
     * 이미지 세로 구간 하나를 바닥 평면의 사다리꼴 네 꼭짓점으로 변환합니다.
     * @private
     */
    #createShadowBandVertices(
        point,
        geometry,
        animation,
        axes,
        config,
        startRatio,
        endRatio
    ) {
        const anchorX = clampBattleViewNumber(
            animation.anchor?.x ?? animation.anchorX,
            0,
            1
        );
        const anchorY = clampBattleViewNumber(
            animation.anchor?.y ?? animation.anchorY,
            0,
            1
        );
        const lengthRatio = Math.max(
            0,
            Number(config.LENGTH_SPRITE_HEIGHT_RATIO) || 0.92
        );
        const nearWidthRatio = Math.max(
            0,
            Number(config.NEAR_WIDTH_SPRITE_RATIO) || 0.68
        );
        const farWidthRatio = Math.max(
            0,
            Number(config.FAR_WIDTH_SPRITE_RATIO) || 0.88
        );
        const resolveEdge = (ratio) => {
            const distance = geometry.height * (anchorY - ratio) * lengthRatio;
            const widthRatio = farWidthRatio
                + ((nearWidthRatio - farWidthRatio) * ratio);
            const center = {
                x: point.x + (axes.direction.x * distance),
                y: point.y + (axes.direction.y * distance)
            };
            return {
                left: {
                    x: center.x - (axes.cross.x * geometry.width * anchorX * widthRatio),
                    y: center.y - (axes.cross.y * geometry.width * anchorX * widthRatio)
                },
                right: {
                    x: center.x
                        + (axes.cross.x * geometry.width * (1 - anchorX) * widthRatio),
                    y: center.y
                        + (axes.cross.y * geometry.width * (1 - anchorX) * widthRatio)
                }
            };
        };
        const start = resolveEdge(startRatio);
        const end = resolveEdge(endRatio);
        return [
            start.left.x,
            start.left.y,
            start.right.x,
            start.right.y,
            end.right.x,
            end.right.y,
            end.left.x,
            end.left.y
        ].map(Math.round);
    }

    /** 스프라이트 프레임을 그림자 감쇠 밴드에 맞는 세로 source rect로 자릅니다. @private */
    #sliceShadowSourceRect(sourceRect, startRatio, endRatio) {
        const x = Number(sourceRect?.x);
        const y = Number(sourceRect?.y);
        const width = Number(sourceRect?.w);
        const height = Number(sourceRect?.h);
        if (![x, y, width, height].every(Number.isFinite)
            || width <= 0
            || height <= 0) {
            return null;
        }
        return {
            x,
            y: y + (height * startRatio),
            w: width,
            h: height * (endRatio - startRatio)
        };
    }

    /**
     * 스프라이트 원본을 발별 가로 구간과 높이 밴드로 함께 자릅니다.
     * @param {object} sourceRect - 원본 프레임 사각형입니다.
     * @param {number} horizontalStart - 정규화된 왼쪽입니다.
     * @param {number} horizontalEnd - 정규화된 오른쪽입니다.
     * @param {number} verticalStart - 정규화된 위쪽입니다.
     * @param {number} verticalEnd - 정규화된 아래쪽입니다.
     * @returns {object|null} 잘린 원본 사각형입니다.
     * @private
     */
    #sliceShadowSourceRegion(
        sourceRect,
        horizontalStart,
        horizontalEnd,
        verticalStart,
        verticalEnd
    ) {
        const x = Number(sourceRect?.x);
        const y = Number(sourceRect?.y);
        const width = Number(sourceRect?.w);
        const height = Number(sourceRect?.h);
        if (![x, y, width, height].every(Number.isFinite)
            || width <= 0
            || height <= 0
            || horizontalEnd <= horizontalStart
            || verticalEnd <= verticalStart) {
            return null;
        }
        return {
            x: x + (width * horizontalStart),
            y: y + (height * verticalStart),
            w: width * (horizontalEnd - horizontalStart),
            h: height * (verticalEnd - verticalStart)
        };
    }

    /** 맵의 두 실제 격자 축으로 광원 반대 방향과 바닥 폭 방향을 계산합니다. @private */
    #resolveShadowProjectionAxes(layout, config) {
        const axisX = layout.gridAxisX || {
            x: Number(layout.tileWidth) * 0.5,
            y: Number(layout.tileHeight) * 0.5
        };
        const axisY = layout.gridAxisY || {
            x: Number(layout.tileWidth) * -0.5,
            y: Number(layout.tileHeight) * 0.5
        };
        const weightX = Number.isFinite(Number(config.GRID_AXIS_X_WEIGHT))
            ? Number(config.GRID_AXIS_X_WEIGHT)
            : 1;
        const weightY = Number.isFinite(Number(config.GRID_AXIS_Y_WEIGHT))
            ? Number(config.GRID_AXIS_Y_WEIGHT)
            : 0;
        const direction = this.#normalizeShadowVector({
            x: (Number(axisX.x) * weightX) + (Number(axisY.x) * weightY),
            y: (Number(axisX.y) * weightX) + (Number(axisY.y) * weightY)
        }, { x: 1, y: 0.5 });
        const cross = this.#normalizeShadowVector({
            x: (Number(axisX.x) * weightY) - (Number(axisY.x) * weightX),
            y: (Number(axisX.y) * weightY) - (Number(axisY.y) * weightX)
        }, { x: 1, y: -0.5 });
        return { direction, cross };
    }

    /** @param {{x:number,y:number}} vector @param {{x:number,y:number}} fallback @returns {{x:number,y:number}} @private */
    #normalizeShadowVector(vector, fallback) {
        const length = Math.hypot(Number(vector.x), Number(vector.y));
        if (!Number.isFinite(length) || length <= 0.0001) {
            const fallbackLength = Math.max(0.0001, Math.hypot(fallback.x, fallback.y));
            return {
                x: fallback.x / fallbackLength,
                y: fallback.y / fallbackLength
            };
        }
        return {
            x: Number(vector.x) / length,
            y: Number(vector.y) / length
        };
    }

    /** @private */
    #drawWorldHp(x, y, hp, maxHp, width, alpha, pendingHp, frame) {
        const colors = frame.colors;
        const ratio = clampBattleViewNumber(Number(hp) / Math.max(1, Number(maxHp)), 0, 1);
        const pendingRatio = pendingHp !== null
            && pendingHp !== undefined
            && Number.isFinite(Number(pendingHp))
            ? clampBattleViewNumber(Number(pendingHp) / Math.max(1, Number(maxHp)), 0, 1)
            : ratio;
        const height = this.#getWorldHpHeight(width);
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

    /** @param {number} width @returns {number} 월드 HP 바 높이입니다. @private */
    #getWorldHpHeight(width) {
        return Math.max(2, width * 0.09);
    }

    /** @private */
    #drawText(text, x, y, font, fill, alpha) {
        drawBattleViewText(this.#renderPort, {
            layer: 'texteffect', text, x, y, font, fill, align: 'center', alpha
        });
    }

    /** @returns {{x:number,y:number}} @private */
    #projectTile(layout, x, y) {
        return TutorialBattleLayout.projectTile(layout, x, y);
    }
}
