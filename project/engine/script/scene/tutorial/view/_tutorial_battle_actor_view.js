import {
    clampBattleViewNumber,
    drawBattleViewText
} from './_tutorial_battle_view_helpers.js';
import { TutorialBattleLayout } from './_tutorial_battle_layout.js';

/**
 * @class TutorialBattleActorView
 * @description 플레이어·로라·슬라임의 스프라이트 프레임과 도형 폴백만 그립니다.
 */
export class TutorialBattleActorView {
    #renderPort;
    #assetPort;

    /** @param {object} renderPort - 렌더 명령 포트입니다. @param {object} assetPort - 이미지 조회 포트입니다. */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
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
        this.#drawShadow(point, size, alpha, frame);
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
            point.y - (size * 0.68),
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
        const actionScale = 1 + (
            world.presentation.actionPulse * world.config.actionLoraScale
        );
        const size = layout.tileSide * spriteLayout.BASE_SIZE_TILE_RATIO * actionScale;
        const alive = lora.alive !== false && Number(lora.hp) > 0;
        const alpha = alive ? 1 : 0.56;
        const animation = world.spriteAnimations?.lora || null;
        if (animation?.visible === false) {
            return;
        }
        this.#drawShadow(point, size, alive ? 1 : 0.5, frame);
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
        const spriteDrawn = this.#drawSprite(point, animation, actionScale, alpha, frame);
        if (!spriteDrawn) {
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
            this.#drawText('L', point.x, point.y, frame.fonts.HEADING, colors.Entity.LoraAccent, alpha);
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
        this.#drawWorldHp(
            point.x,
            point.y - (size * 0.76),
            world.presentation.loraHp,
            lora.maxHp || 100,
            size * 1.08,
            1,
            world.readability?.playerPreview?.available
                ? world.readability.playerPreview.expected?.loraHp
                : null,
            frame
        );
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
        this.#drawShadow(point, size, 1, frame);
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
                point.y - (size * 0.7),
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
        if (!animation?.assetId || !Array.isArray(animation.layers) || animation.layers.length === 0) {
            return false;
        }
        const image = this.#assetPort.getImage?.(animation.assetId) || null;
        if (!image) {
            return false;
        }
        const effectScale = this.#getFallbackEffectScale(animation);
        const logicalWidth = Math.max(1, Number(animation.logicalSize?.width) || 32);
        const logicalHeight = Math.max(1, Number(animation.logicalSize?.height) || 32);
        const width = Math.max(
            1,
            Math.round(frame.layout.tileSide * animation.scaleTileRatio * baseScale * effectScale)
        );
        const height = Math.max(1, Math.round(width * (logicalHeight / logicalWidth)));
        const anchorX = clampBattleViewNumber(animation.anchor?.x, 0, 1);
        const anchorY = clampBattleViewNumber(animation.anchor?.y, 0, 1);
        const effectAlpha = this.#getFallbackEffectAlpha(animation);
        for (const sourceRect of animation.layers) {
            this.#renderPort.renderGL('object', {
                image,
                sourceRect,
                flipX: animation.flipX === true,
                x: Math.round(point.x - (width * anchorX)),
                y: Math.round(point.y - (height * anchorY)),
                w: width,
                h: height,
                alpha: alpha * effectAlpha,
                smoothing: false
            });
        }
        return true;
    }

    /** @param {object} animation @returns {number} 누락 시트의 의미 동작 스케일입니다. @private */
    #getFallbackEffectScale(animation) {
        const pulse = Math.sin(Math.PI * clampBattleViewNumber(animation.progress, 0, 1));
        const effects = {
            attack: 1 + (pulse * 0.12),
            ranged: 1 + (pulse * 0.08),
            area: 1 + (pulse * 0.18),
            breathing: 1 + (Math.sin(animation.progress * Math.PI * 2) * 0.045),
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

    /** @param {{x:number,y:number}} point @param {number} size @param {number} alpha @param {object} frame @private */
    #drawShadow(point, size, alpha, frame) {
        const offset = Number(frame.world.config.shadowOffsetRatio) || 0.08;
        this.#renderPort.renderGL('object', {
            shape: 'circle',
            x: point.x,
            y: point.y + (size * offset),
            w: size,
            h: size * 0.36,
            fill: frame.colors.Entity.Shadow,
            alpha
        });
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
