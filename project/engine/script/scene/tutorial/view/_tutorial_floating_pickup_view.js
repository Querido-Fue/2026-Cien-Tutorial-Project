/**
 * @class TutorialFloatingPickupView
 * @description 아이템과 기록 페이지의 픽셀 부유 및 바닥 투영 그림자를 그립니다.
 */
export class TutorialFloatingPickupView {
    #renderPort;

    /** @param {{renderGL:Function}} renderPort - WebGL 렌더 명령 포트입니다. */
    constructor(renderPort) {
        this.#renderPort = renderPort;
    }

    /**
     * 픽업 하나의 동적 그림자와 원본 크기 픽셀 이미지를 순서대로 그립니다.
     * @param {object} options - 픽업 표시 입력입니다.
     * @returns {{drawn:boolean,center:{x:number,y:number},liftPixels:number,liftRatio:number}}
     */
    draw(options) {
        const size = Math.max(1, Math.round(Number(options.size) || 1));
        const state = this.#resolveFloatState({
            point: options.point,
            size,
            elapsedSeconds: options.elapsedSeconds,
            seed: options.seed,
            config: options.config,
            tileSide: options.layout?.tileSide,
            visualCenter: options.visualCenter
        });
        this.#drawShadow({
            image: options.image,
            point: options.point,
            size,
            liftPixels: state.liftPixels,
            liftRatio: state.liftRatio,
            layout: options.layout,
            config: options.config,
            shadowProjection: options.shadowProjection,
            fill: options.shadowFill
        });
        if (!options.image) {
            return { ...state, drawn: false };
        }
        this.#renderPort.renderGL('object', {
            role: 'pickup-sprite',
            image: options.image,
            x: state.x,
            y: state.y,
            w: size,
            h: size,
            smoothing: false
        });
        return { ...state, drawn: true };
    }

    /** @param {object} options @returns {object} 부유한 픽업의 정수 픽셀 상태입니다. @private */
    #resolveFloatState({
        point,
        size,
        elapsedSeconds,
        seed,
        config,
        tileSide,
        visualCenter
    }) {
        const safeConfig = config || {};
        const amplitude = Math.max(
            0,
            Number(safeConfig.FLOAT_AMPLITUDE_TILE_RATIO) || 0
        ) * Math.max(0, Number(tileSide) || 0);
        const period = Math.max(
            0.1,
            Number(safeConfig.FLOAT_PERIOD_SECONDS) || 3.6
        );
        const time = Number.isFinite(Number(elapsedSeconds))
            ? Number(elapsedSeconds)
            : 0;
        const phase = ((time / period) * Math.PI * 2) + this.#hashPhase(seed);
        const liftRatio = 0.5 + (Math.sin(phase) * 0.5);
        const liftPixels = Math.round(amplitude * liftRatio);
        const centerX = this.#clamp(Number(visualCenter?.x), 0, 1, 0.5);
        const centerY = this.#clamp(Number(visualCenter?.y), 0, 1, 0.5);
        const x = Math.round(Number(point.x) - (size * centerX));
        const visualCenterY = Number(point.y) - (size * 0.5) - liftPixels;
        const y = Math.round(visualCenterY - (size * centerY));
        return {
            x,
            y,
            center: {
                x: x + (size * centerX),
                y: y + (size * centerY)
            },
            liftPixels,
            liftRatio
        };
    }

    /** 실제 픽업 알파를 타일의 동남쪽 축에 눕혀 높이에 따라 이동·확산시킵니다. @private */
    #drawShadow({
        image,
        point,
        size,
        liftPixels,
        liftRatio,
        layout,
        config,
        shadowProjection,
        fill
    }) {
        const axes = this.#resolveProjectionAxes(layout, shadowProjection || {});
        const safeConfig = config || {};
        const shiftRatio = Number.isFinite(Number(
            shadowProjection?.FLOAT_SHADOW_SHIFT_RATIO
        )) ? Number(shadowProjection.FLOAT_SHADOW_SHIFT_RATIO) : 0.72;
        const alphaFade = this.#clamp(Number(
            shadowProjection?.FLOAT_SHADOW_ALPHA_FADE_RATIO
        ), 0, 1, 0.34);
        const heightScale = 1 + (
            (Number(safeConfig.SHADOW_FLOAT_EXPANSION_RATIO) || 0.16) * liftRatio
        );
        const shadowAlpha = this.#clamp(
            (Number(safeConfig.SHADOW_ALPHA) || 0.46)
                * (1 - (alphaFade * liftRatio)),
            0,
            1,
            0.32
        );
        const nearPoint = {
            x: Number(point.x) + (axes.direction.x * liftPixels * shiftRatio),
            y: Number(point.y) + (axes.direction.y * liftPixels * shiftRatio)
        };
        const geometry = {
            length: size * (Number(safeConfig.SHADOW_LENGTH_ICON_RATIO) || 0.62)
                * heightScale,
            nearWidth: size * (Number(safeConfig.SHADOW_NEAR_WIDTH_ICON_RATIO) || 0.42)
                * heightScale,
            farWidth: size * (Number(safeConfig.SHADOW_FAR_WIDTH_ICON_RATIO) || 0.66)
                * heightScale
        };
        const penumbraScale = Math.max(
            1,
            Number(safeConfig.SHADOW_PENUMBRA_SCALE) || 1.16
        );
        const penumbraAlpha = this.#clamp(
            Number(safeConfig.SHADOW_PENUMBRA_ALPHA),
            0,
            1,
            0.18
        ) * (1 - (alphaFade * liftRatio));

        if (image) {
            this.#drawProjectedImage({
                image,
                nearPoint,
                axes,
                geometry: {
                    length: geometry.length * penumbraScale,
                    nearWidth: geometry.nearWidth * penumbraScale,
                    farWidth: geometry.farWidth * penumbraScale
                },
                fill,
                alpha: penumbraAlpha,
                role: 'pickup-shadow-penumbra'
            });
            this.#drawProjectedImage({
                image,
                nearPoint,
                axes,
                geometry,
                fill,
                alpha: shadowAlpha,
                role: 'pickup-shadow'
            });
        } else {
            const center = {
                x: nearPoint.x + (axes.direction.x * geometry.length * 0.42),
                y: nearPoint.y + (axes.direction.y * geometry.length * 0.42)
            };
            this.#renderPort.renderGL('object', {
                role: 'pickup-shadow',
                shape: 'circle',
                x: Math.round(center.x),
                y: Math.round(center.y),
                w: Math.max(1, Math.round(geometry.farWidth)),
                h: Math.max(1, Math.round(size * 0.16 * heightScale)),
                fill,
                alpha: shadowAlpha
            });
        }

        const contactAlpha = this.#clamp(
            Number(safeConfig.SHADOW_CONTACT_ALPHA),
            0,
            1,
            0.36
        ) * (1 - (liftRatio * 0.72));
        this.#renderPort.renderGL('object', {
            role: 'pickup-contact-shadow',
            shape: 'circle',
            x: Math.round(nearPoint.x),
            y: Math.round(nearPoint.y),
            w: Math.max(1, Math.round(
                size * (Number(safeConfig.SHADOW_CONTACT_WIDTH_ICON_RATIO) || 0.34)
            )),
            h: Math.max(1, Math.round(
                size * (Number(safeConfig.SHADOW_CONTACT_HEIGHT_ICON_RATIO) || 0.1)
            )),
            fill,
            alpha: contactAlpha
        });
    }

    /** @param {object} options @private */
    #drawProjectedImage({ image, nearPoint, axes, geometry, fill, alpha, role }) {
        const farPoint = {
            x: nearPoint.x + (axes.direction.x * geometry.length),
            y: nearPoint.y + (axes.direction.y * geometry.length)
        };
        const farHalf = geometry.farWidth * 0.5;
        const nearHalf = geometry.nearWidth * 0.5;
        this.#renderPort.renderGL('object', {
            role,
            image,
            vertices: [
                farPoint.x - (axes.cross.x * farHalf),
                farPoint.y - (axes.cross.y * farHalf),
                farPoint.x + (axes.cross.x * farHalf),
                farPoint.y + (axes.cross.y * farHalf),
                nearPoint.x + (axes.cross.x * nearHalf),
                nearPoint.y + (axes.cross.y * nearHalf),
                nearPoint.x - (axes.cross.x * nearHalf),
                nearPoint.y - (axes.cross.y * nearHalf)
            ],
            fill,
            alpha,
            smoothing: false
        });
    }

    /** 맵의 두 격자 축으로 타일 기준 동남쪽 투영축을 계산합니다. @private */
    #resolveProjectionAxes(layout, config) {
        const axisX = layout?.gridAxisX || {
            x: Number(layout?.tileWidth) * 0.5,
            y: Number(layout?.tileHeight) * 0.5
        };
        const axisY = layout?.gridAxisY || {
            x: Number(layout?.tileWidth) * -0.5,
            y: Number(layout?.tileHeight) * 0.5
        };
        const weightX = Number.isFinite(Number(config.GRID_AXIS_X_WEIGHT))
            ? Number(config.GRID_AXIS_X_WEIGHT)
            : 1;
        const weightY = Number.isFinite(Number(config.GRID_AXIS_Y_WEIGHT))
            ? Number(config.GRID_AXIS_Y_WEIGHT)
            : 1;
        return {
            direction: this.#normalize({
                x: (Number(axisX.x) * weightX) + (Number(axisY.x) * weightY),
                y: (Number(axisX.y) * weightX) + (Number(axisY.y) * weightY)
            }, { x: 0, y: 1 }),
            cross: this.#normalize({
                x: (Number(axisX.x) * weightY) - (Number(axisY.x) * weightX),
                y: (Number(axisX.y) * weightY) - (Number(axisY.y) * weightX)
            }, { x: 1, y: 0 })
        };
    }

    /** @param {{x:number,y:number}} vector @param {{x:number,y:number}} fallback @returns {{x:number,y:number}} @private */
    #normalize(vector, fallback) {
        const length = Math.hypot(Number(vector.x), Number(vector.y));
        if (!Number.isFinite(length) || length <= 0.0001) {
            return fallback;
        }
        return {
            x: Number(vector.x) / length,
            y: Number(vector.y) / length
        };
    }

    /** 문자열 ID마다 부유 주기를 엇갈리게 합니다. @private */
    #hashPhase(seed) {
        let hash = 0;
        for (const character of String(seed || 'pickup')) {
            hash = ((hash * 31) + character.codePointAt(0)) >>> 0;
        }
        return ((hash % 360) / 360) * Math.PI * 2;
    }

    /** @private */
    #clamp(value, min, max, fallback) {
        const numeric = Number(value);
        return Math.min(max, Math.max(min, Number.isFinite(numeric) ? numeric : fallback));
    }
}
