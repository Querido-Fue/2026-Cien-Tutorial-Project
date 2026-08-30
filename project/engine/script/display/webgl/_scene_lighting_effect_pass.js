import { getData } from 'data/data_handler.js';
import { colorUtil } from 'util/color_util.js';
import { clamp01 } from 'util/number_util.js';
import {
    compileShader,
    createProgram,
    FULLSCREEN_VERTEX_SHADER
} from './_shader_utils.js';

const LIGHTING_CONSTANTS = getData('EFFECT_RENDER_CONSTANTS').SCENE_LIGHTING;

const SCENE_LIGHTING_FRAGMENT_SHADER = `
    precision mediump float;

    uniform vec2 u_resolution;
    uniform float u_mode;
    uniform vec3 u_ambientColor;
    uniform float u_ambientAlpha;
    uniform vec2 u_center;
    uniform float u_radius;
    uniform float u_time;
    uniform float u_phase;
    uniform float u_intensity;
    uniform float u_flickerAmount;
    uniform float u_breathAmount;
    uniform float u_breathSpeed;
    uniform float u_emitterIntensityScale;
    uniform vec3 u_lightColor;

    void main() {
        if (u_mode < 0.5) {
            gl_FragColor = vec4(
                u_ambientColor * u_ambientAlpha,
                u_ambientAlpha
            );
            return;
        }

        vec2 fragmentPoint = vec2(
            gl_FragCoord.x,
            u_resolution.y - gl_FragCoord.y
        );
        float distanceFromLight = length(fragmentPoint - u_center)
            / max(1.0, u_radius);
        if (distanceFromLight >= 1.0) {
            discard;
        }

        float radial = 1.0 - smoothstep(0.0, 1.0, distanceFromLight);
        float broadGlow = pow(radial, 2.55);
        float coreGlow = pow(radial, 5.0) * 0.12;
        float phase = u_phase * 6.28318530718;
        float flamePulse = sin(
            (u_time * 7.4)
            + phase
            + sin((u_time * 3.1) + (phase * 1.9))
        );
        float flicker = 1.0 + (flamePulse * u_flickerAmount);
        float breath = 1.0 + (
            sin((u_time * u_breathSpeed) + (phase * 0.35))
            * u_breathAmount
        );
        float strength = (broadGlow + coreGlow)
            * u_intensity
            * u_emitterIntensityScale
            * flicker
            * breath;
        gl_FragColor = vec4(u_lightColor * strength, 0.0);
    }
`;

/**
 * @class SceneLightingEffectPass
 * @description 월드 노출·색온도와 여러 비방향성 점광원 후광을 effect FBO에 합성합니다.
 */
export class SceneLightingEffectPass {
    /** @param {WebGLRenderingContext} gl - 대상 WebGL 컨텍스트입니다. */
    constructor(gl) {
        this.gl = gl;
        this.programInfo = this.#createProgramInfo();
        this.fullscreenBuffer = this.#createFullscreenBuffer();
        this.colorCache = new Map();
    }

    /**
     * 월드 감광을 한 번 적용한 뒤 각 점광원을 제한된 scissor 영역에 더합니다.
     * @param {object} command - 장면 조명 명령입니다.
     * @param {number} width - 현재 surface 너비입니다.
     * @param {number} height - 현재 surface 높이입니다.
     */
    draw(command, width, height) {
        const gl = this.gl;
        const renderWidth = Math.max(1, gl.drawingBufferWidth || width);
        const renderHeight = Math.max(1, gl.drawingBufferHeight || height);
        const exposure = this.#resolveExposure(command?.exposure);
        const ambientAlpha = 1 - exposure;

        gl.enable(gl.BLEND);
        gl.useProgram(this.programInfo.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.fullscreenBuffer);
        gl.enableVertexAttribArray(this.programInfo.attributes.a_position);
        gl.vertexAttribPointer(
            this.programInfo.attributes.a_position,
            2,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.uniform2f(this.programInfo.uniforms.u_resolution, renderWidth, renderHeight);

        if (ambientAlpha > 0.001) {
            gl.disable(gl.SCISSOR_TEST);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.uniform1f(this.programInfo.uniforms.u_mode, 0);
            gl.uniform1f(this.programInfo.uniforms.u_ambientAlpha, ambientAlpha);
            gl.uniform3fv(
                this.programInfo.uniforms.u_ambientColor,
                this.#resolveColor(command?.ambientColor, [0, 0, 0])
            );
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        const emitters = Array.isArray(command?.emitters) ? command.emitters : [];
        const emitterCount = Math.min(
            emitters.length,
            LIGHTING_CONSTANTS.MAX_EMITTERS_PER_COMMAND
        );
        if (emitterCount > 0) {
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
            gl.uniform1f(this.programInfo.uniforms.u_mode, 1);
            gl.uniform1f(
                this.programInfo.uniforms.u_time,
                Number.isFinite(Number(command?.time)) ? Number(command.time) : 0
            );
            gl.uniform1f(
                this.programInfo.uniforms.u_intensity,
                Math.max(0, Number(command?.intensity) || 0)
            );
            gl.uniform1f(
                this.programInfo.uniforms.u_flickerAmount,
                clamp01(Number(command?.flickerAmount) || 0)
            );
            gl.uniform1f(
                this.programInfo.uniforms.u_breathAmount,
                clamp01(Number(command?.breathAmount) || 0)
            );
            gl.uniform1f(
                this.programInfo.uniforms.u_breathSpeed,
                Math.max(0, Number(command?.breathSpeed) || 0)
            );
            gl.uniform3fv(
                this.programInfo.uniforms.u_lightColor,
                this.#resolveColor(command?.lightColor, [1, 0.65, 0.2])
            );
            for (let index = 0; index < emitterCount; index++) {
                this.#drawEmitter(emitters[index], renderWidth, renderHeight);
            }
        }

        gl.disable(gl.SCISSOR_TEST);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    /** GL 리소스를 해제합니다. */
    destroy() {
        if (this.fullscreenBuffer) {
            this.gl.deleteBuffer(this.fullscreenBuffer);
            this.fullscreenBuffer = null;
        }
        if (this.programInfo?.program) {
            this.gl.deleteProgram(this.programInfo.program);
            this.programInfo = null;
        }
        this.colorCache.clear();
    }

    /** 점광원 하나를 현재 화면 안의 작은 영역에만 그립니다. @private */
    #drawEmitter(emitter, renderWidth, renderHeight) {
        const centerX = Number(emitter?.x);
        const centerY = Number(emitter?.y);
        const radius = this.#resolveRadius(emitter?.radius);
        if (!Number.isFinite(centerX) || !Number.isFinite(centerY) || radius <= 0) {
            return;
        }
        const rect = this.#createScissorRect(
            centerX,
            centerY,
            radius,
            renderWidth,
            renderHeight
        );
        if (!rect) {
            return;
        }
        const gl = this.gl;
        gl.uniform2f(this.programInfo.uniforms.u_center, centerX, centerY);
        gl.uniform1f(this.programInfo.uniforms.u_radius, radius);
        gl.uniform1f(
            this.programInfo.uniforms.u_phase,
            Number.isFinite(Number(emitter?.phase)) ? Number(emitter.phase) : 0
        );
        const intensityScale = Number(emitter?.intensityScale);
        gl.uniform1f(
            this.programInfo.uniforms.u_emitterIntensityScale,
            Number.isFinite(intensityScale) ? Math.max(0, intensityScale) : 1
        );
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(
            rect.x,
            Math.max(0, renderHeight - rect.y - rect.h),
            rect.w,
            rect.h
        );
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /** @private */
    #createProgramInfo() {
        const gl = this.gl;
        const vertexShader = compileShader(gl, FULLSCREEN_VERTEX_SHADER, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(
            gl,
            SCENE_LIGHTING_FRAGMENT_SHADER,
            gl.FRAGMENT_SHADER
        );
        const program = createProgram(gl, vertexShader, fragmentShader);
        return {
            program,
            uniforms: {
                u_resolution: gl.getUniformLocation(program, 'u_resolution'),
                u_mode: gl.getUniformLocation(program, 'u_mode'),
                u_ambientColor: gl.getUniformLocation(program, 'u_ambientColor'),
                u_ambientAlpha: gl.getUniformLocation(program, 'u_ambientAlpha'),
                u_center: gl.getUniformLocation(program, 'u_center'),
                u_radius: gl.getUniformLocation(program, 'u_radius'),
                u_time: gl.getUniformLocation(program, 'u_time'),
                u_phase: gl.getUniformLocation(program, 'u_phase'),
                u_intensity: gl.getUniformLocation(program, 'u_intensity'),
                u_flickerAmount: gl.getUniformLocation(program, 'u_flickerAmount'),
                u_breathAmount: gl.getUniformLocation(program, 'u_breathAmount'),
                u_breathSpeed: gl.getUniformLocation(program, 'u_breathSpeed'),
                u_emitterIntensityScale: gl.getUniformLocation(
                    program,
                    'u_emitterIntensityScale'
                ),
                u_lightColor: gl.getUniformLocation(program, 'u_lightColor')
            },
            attributes: {
                a_position: gl.getAttribLocation(program, 'a_position')
            }
        };
    }

    /** @returns {WebGLBuffer} 풀스크린 쿼드 버퍼입니다. @private */
    #createFullscreenBuffer() {
        const gl = this.gl;
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            1, 1
        ]), gl.STATIC_DRAW);
        return buffer;
    }

    /** @private */
    #createScissorRect(centerX, centerY, radius, width, height) {
        const left = Math.max(0, Math.floor(centerX - radius));
        const top = Math.max(0, Math.floor(centerY - radius));
        const right = Math.min(width, Math.ceil(centerX + radius));
        const bottom = Math.min(height, Math.ceil(centerY + radius));
        if (right <= left || bottom <= top) {
            return null;
        }
        return { x: left, y: top, w: right - left, h: bottom - top };
    }

    /** @private */
    #resolveExposure(exposure) {
        const numericExposure = Number(exposure);
        return Math.max(
            LIGHTING_CONSTANTS.MIN_EXPOSURE,
            Math.min(1, Number.isFinite(numericExposure) ? numericExposure : 1)
        );
    }

    /** @private */
    #resolveRadius(radius) {
        const numericRadius = Number(radius);
        if (!(numericRadius > 0)) {
            return 0;
        }
        return Math.max(
            LIGHTING_CONSTANTS.MIN_RADIUS,
            Math.min(LIGHTING_CONSTANTS.MAX_RADIUS, numericRadius)
        );
    }

    /** 테마 CSS 색상을 uniform RGB로 변환해 재사용합니다. @private */
    #resolveColor(color, fallback) {
        if (typeof color !== 'string' || color.length === 0) {
            return new Float32Array(fallback);
        }
        const cached = this.colorCache.get(color);
        if (cached) {
            return cached;
        }
        let resolved;
        try {
            const rgb = colorUtil().cssToRgb(color);
            resolved = new Float32Array([rgb.r / 255, rgb.g / 255, rgb.b / 255]);
        } catch (_error) {
            resolved = new Float32Array(fallback);
        }
        this.colorCache.set(color, resolved);
        return resolved;
    }
}
