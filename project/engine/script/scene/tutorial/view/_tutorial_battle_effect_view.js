import { TutorialBattleLayout } from './_tutorial_battle_layout.js';
import { EFFECT_RENDER_CONSTANTS } from '../../../data/display/effect_render_constants.js';

const EFFECT_TYPES = EFFECT_RENDER_CONSTANTS.TYPES;

/** @param {*} value @param {number} minimum @param {number} maximum @returns {number} 제한된 숫자입니다. */
function clamp(value, minimum, maximum) {
    const number = Number(value);
    return Math.max(minimum, Math.min(maximum, Number.isFinite(number) ? number : 0));
}

/**
 * @class TutorialBattleEffectView
 * @description 화살·공격 왜곡은 WebGL world에, 대형 폭발 프레임은 2D texteffect에 렌더합니다.
 */
export class TutorialBattleEffectView {
    #renderPort;
    #assetPort;

    /** @param {object} renderPort - 2D/WebGL 렌더 포트입니다. @param {object} assetPort - 이미지 조회 포트입니다. */
    constructor(renderPort, assetPort) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
    }

    /** @param {object} frame - 같은 프레임의 BattleViewModel입니다. */
    draw(frame) {
        for (const effect of frame?.world?.battleEffects || []) {
            if (!effect?.visible) {
                continue;
            }
            if (effect.type === 'arrow') {
                this.#drawArrow(effect, frame);
            } else if (effect.type === 'area-explosion') {
                this.#drawAreaExplosion(effect, frame);
            } else if (effect.type === 'spatial-distortion') {
                this.#drawSpatialDistortion(effect, frame);
            }
        }
    }

    /** @param {object} effect @param {object} frame @private */
    #drawArrow(effect, frame) {
        const image = this.#assetPort.getImage?.(effect.assetId) || null;
        if (!image || !effect.sourceRect) {
            return;
        }
        const from = TutorialBattleLayout.projectTile(
            frame.layout,
            effect.from.x,
            effect.from.y
        );
        const to = TutorialBattleLayout.projectTile(
            frame.layout,
            effect.to.x,
            effect.to.y
        );
        const progress = clamp(effect.progress, 0, 1);
        const arc = Math.sin(progress * Math.PI)
            * frame.layout.tileSide
            * Math.max(0, Number(effect.arcHeightTileRatio) || 0);
        const center = {
            x: from.x + ((to.x - from.x) * progress),
            y: from.y + ((to.y - from.y) * progress) - arc
        };
        const width = Math.max(
            1,
            Math.round(frame.layout.tileSide * Math.max(
                0.01,
                Number(effect.sizeTileRatio) || 0.72
            ))
        );
        const height = Math.max(
            1,
            Math.round(width * (effect.sourceRect.h / effect.sourceRect.w))
        );
        this.#renderPort.renderGL(effect.layer || 'effect', {
            image,
            sourceRect: effect.sourceRect,
            x: Math.round(center.x - (width * 0.5)),
            y: Math.round(center.y - (height * 0.5)),
            w: width,
            h: height,
            alpha: clamp(effect.alpha, 0, 1),
            smoothing: false
        });
    }

    /** @param {object} effect @param {object} frame @private */
    #drawAreaExplosion(effect, frame) {
        const image = this.#assetPort.getImage?.(effect.assetId) || null;
        const rect = frame.layout.mapImageRect || frame.layout.boardRect;
        if (!image || !effect.sourceRect || !rect) {
            return;
        }
        this.#renderPort.render(effect.layer || 'texteffect', {
            shape: 'image',
            image,
            sourceRect: effect.sourceRect,
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            w: Math.round(rect.w),
            h: Math.round(rect.h),
            alpha: clamp(effect.alpha, 0, 1),
            smoothing: false
        });
    }

    /** @param {object} effect @param {object} frame @private */
    #drawSpatialDistortion(effect, frame) {
        const tile = this.#resolveTargetTile(effect, frame);
        if (!tile) {
            return;
        }
        const progress = clamp(effect.radiusProgress ?? effect.progress, 0, 1);
        const intensity = clamp(effect.intensity, 0, 1) * clamp(effect.alpha, 0, 1);
        const tileSide = Math.max(1, Number(frame.layout.tileSide) || 1);
        const minimumRadius = Math.max(0, Number(effect.minRadiusTileRatio) || 0);
        const maximumRadius = Math.max(minimumRadius, Number(
            effect.maxRadiusTileRatio
        ) || minimumRadius);
        const point = TutorialBattleLayout.projectTile(frame.layout, tile.x, tile.y);
        const strength = tileSide
            * Math.max(0, Number(effect.strengthTileRatio) || 0)
            * intensity;
        if (strength <= 0.001) {
            return;
        }
        this.#renderPort.renderGL(effect.layer || 'effect', {
            effectType: EFFECT_TYPES.SPATIAL_DISTORTION,
            centerX: point.x,
            centerY: point.y + (tileSide * (
                Number(effect.centerYOffsetTileRatio) || 0
            )),
            radius: tileSide * (
                minimumRadius + ((maximumRadius - minimumRadius) * progress)
            ),
            ringWidth: tileSide * Math.max(
                0.01,
                Number(effect.ringWidthTileRatio) || 0.01
            ),
            strength
        });
    }

    /** @param {object} effect @param {object} frame @returns {{x:number,y:number}|null} @private */
    #resolveTargetTile(effect, frame) {
        if (Number.isFinite(Number(effect.tile?.x))
            && Number.isFinite(Number(effect.tile?.y))) {
            return effect.tile;
        }
        if (effect.targetActorId === 'lora') {
            return frame.world.floorActors?.lora || frame.snapshot?.lora || null;
        }
        if (effect.targetActorId === 'player') {
            return frame.world.floorActors?.player || frame.snapshot?.player || null;
        }
        return (Array.isArray(frame.floor?.mobs) ? frame.floor.mobs : []).find(
            (mob) => mob?.id === effect.targetActorId
        ) || null;
    }
}
