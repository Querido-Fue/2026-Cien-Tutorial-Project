import { EFFECT_RENDER_CONSTANTS } from '../../../data/display/effect_render_constants.js';
import {
    TUTORIAL_BATTLE_LIGHTING_DATA
} from '../../../data/game/tutorial_battle_lighting_data.js';

const EFFECT_TYPES = EFFECT_RENDER_CONSTANTS.TYPES;
const LIGHTING_PROFILES = TUTORIAL_BATTLE_LIGHTING_DATA.PROFILES;

/**
 * @class TutorialBattleLightingView
 * @description 층별 월드 감광, 비방향성 양초 후광, 화염과 부유 입자 명령을 조립합니다.
 */
export class TutorialBattleLightingView {
    #renderPort;

    /** @param {{renderGL:Function}} renderPort - WebGL 렌더 명령 포트입니다. */
    constructor(renderPort) {
        this.#renderPort = renderPort;
    }

    /**
     * 장면 조명 명령을 후처리 입력 순서에 맞춰 effect 레이어에 전달합니다.
     * @param {object} viewModel - 읽기 전용 BattleViewModel입니다.
     * @param {boolean} hasMapArtwork - 현재 맵 아트 표시 여부입니다.
     */
    draw(viewModel, hasMapArtwork) {
        const profile = LIGHTING_PROFILES[viewModel?.floor?.id];
        if (!profile) {
            return;
        }
        this.#drawSceneLighting(viewModel, profile, hasMapArtwork);
        this.#drawAmbientDust(viewModel, profile);
        this.#drawAmbientFire(viewModel, hasMapArtwork);
    }

    /** 월드 노출과 양초 점광원 명령을 그립니다. @private */
    #drawSceneLighting(viewModel, profile, hasMapArtwork) {
        const { colors, layout, world } = viewModel;
        const candle = profile.CANDLE;
        const emitters = candle && hasMapArtwork
            ? this.#createCandleLightEmitters(
                layout.ambientFire?.emitters,
                layout.mapImageRect,
                candle
            )
            : [];
        this.#renderPort.renderGL('effect', {
            effectType: EFFECT_TYPES.SCENE_LIGHTING,
            exposure: profile.EXPOSURE,
            ambientColor: colors.Effects?.[profile.AMBIENT_COLOR_KEY],
            emitters,
            time: Number(world.elapsedSeconds) || 0,
            intensity: Number(candle?.INTENSITY) || 0,
            flickerAmount: Number(candle?.FLICKER_AMOUNT) || 0,
            breathAmount: Number(candle?.BREATH_AMOUNT) || 0,
            breathSpeed: Number(candle?.BREATH_SPEED) || 0,
            lightColor: colors.Effects?.[candle?.LIGHT_COLOR_KEY]
        });
    }

    /** 실제 심지와 반대편 벽의 점대칭 가상 심지를 점광원 목록으로 만듭니다. @private */
    #createCandleLightEmitters(source, mapImageRect, candle) {
        const visibleEmitters = Array.isArray(source) ? source : [];
        const radiusRatio = Math.max(1, Number(candle.RADIUS_SIZE_RATIO) || 1);
        const fixtureSize = Math.max(
            1,
            Math.floor(Number(candle.LIGHTS_PER_FIXTURE) || 1)
        );
        const lightEmitters = [];
        for (let index = 0; index < visibleEmitters.length; index += fixtureSize) {
            const fixture = visibleEmitters.slice(index, index + fixtureSize);
            const divisor = Math.max(1, fixture.length);
            lightEmitters.push(Object.freeze({
                x: fixture.reduce((sum, emitter) => sum + Number(emitter.x), 0)
                    / divisor,
                y: fixture.reduce((sum, emitter) => sum + Number(emitter.y), 0)
                    / divisor,
                radius: Math.max(
                    1,
                    fixture.reduce((sum, emitter) => sum + Number(emitter.size), 0)
                        / divisor
                        * radiusRatio
                ),
                phase: fixture.reduce(
                    (sum, emitter) => sum + (Number(emitter.phase) || 0),
                    0
                ) / divisor,
                intensityScale: 1
            }));
        }
        if (!candle.MIRROR_OPPOSITE_WALLS || !mapImageRect) {
            return Object.freeze(lightEmitters);
        }
        const centerX = Number(mapImageRect.x) + (Number(mapImageRect.w) * 0.5);
        const centerY = Number(mapImageRect.y) + (Number(mapImageRect.h) * 0.5);
        for (const emitter of lightEmitters.slice()) {
            lightEmitters.push(Object.freeze({
                x: Math.round((centerX * 2) - emitter.x),
                y: Math.round((centerY * 2) - emitter.y),
                radius: emitter.radius,
                phase: (emitter.phase + 0.5) % 1,
                intensityScale: Math.max(
                    0,
                    Number(candle.MIRRORED_INTENSITY_SCALE) || 0
                )
            }));
        }
        return Object.freeze(lightEmitters);
    }

    /** 층별 밀도와 색온도로 희박한 부유 입자를 그립니다. @private */
    #drawAmbientDust(viewModel, profile) {
        const { colors, layout, world } = viewModel;
        const bounds = layout.mapImageRect || layout.boardRect;
        const particles = profile.PARTICLES;
        if (!bounds || !(bounds.w > 0) || !(bounds.h > 0) || !particles) {
            return;
        }
        const particleCount = Math.max(
            particles.MIN_COUNT,
            Math.min(
                particles.MAX_COUNT,
                Math.round((bounds.w * bounds.h) / particles.AREA_DIVISOR)
            )
        );
        this.#renderPort.renderGL('effect', {
            effectType: EFFECT_TYPES.AMBIENT_DUST,
            bounds,
            particleCount,
            time: Number(world.elapsedSeconds) || 0,
            alpha: particles.ALPHA,
            pixelSize: 2,
            pointSize: 2,
            warmColor: colors.Effects?.[particles.WARM_COLOR_KEY],
            coolColor: colors.Effects?.[particles.COOL_COLOR_KEY]
        });
    }

    /** 원본 맵의 실제 심지에만 난류 화염과 불씨를 그립니다. @private */
    #drawAmbientFire(viewModel, hasMapArtwork) {
        const { colors, layout, world } = viewModel;
        const ambientFire = layout.ambientFire;
        if (!hasMapArtwork || !ambientFire || ambientFire.emitters.length === 0) {
            return;
        }
        this.#renderPort.renderGL('effect', {
            effectType: EFFECT_TYPES.FLAME_PARTICLES,
            emitters: ambientFire.emitters,
            time: Number(world.elapsedSeconds) || 0,
            alpha: ambientFire.alpha,
            outerColor: colors.Effects?.FlameOuter,
            coreColor: colors.Effects?.FlameCore,
            emberColor: colors.Effects?.FlameEmber
        });
    }
}
