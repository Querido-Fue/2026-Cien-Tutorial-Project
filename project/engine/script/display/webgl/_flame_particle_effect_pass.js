import { getData } from 'data/data_handler.js';
import { colorUtil } from 'util/color_util.js';
import { clamp01 } from 'util/number_util.js';
import {
    compileShader,
    createProgram,
    FLAME_PARTICLE_FRAGMENT_SHADER,
    FULLSCREEN_VERTEX_SHADER
} from './_shader_utils.js';

const FLAME_CONSTANTS = getData('EFFECT_RENDER_CONSTANTS').FLAME;

/**
 * @class FlameParticleEffectPass
 * @description 화면 좌표의 여러 촛불 심지에 국소 WebGL 화염과 상승 불씨를 렌더링합니다.
 */
export class FlameParticleEffectPass {
    /**
     * @param {WebGLRenderingContext} gl - 대상 WebGL 컨텍스트입니다.
     */
    constructor(gl) {
        this.gl = gl;
        this.programInfo = this.#createProgramInfo();
        this.fullscreenBuffer = this.#createFullscreenBuffer();
        this.colorCache = new Map();
    }

    /**
     * 한 명령에 담긴 촛불을 각자의 작은 scissor 영역 안에서 렌더링합니다.
     * @param {object} command - 화염 렌더링 명령입니다.
     * @param {number} width - 현재 surface 너비입니다.
     * @param {number} height - 현재 surface 높이입니다.
     */
    draw(command, width, height) {
        const emitters = Array.isArray(command?.emitters) ? command.emitters : [];
        const emitterCount = Math.min(
            emitters.length,
            FLAME_CONSTANTS.MAX_EMITTERS_PER_COMMAND
        );
        if (emitterCount === 0) {
            return;
        }

        const gl = this.gl;
        const renderWidth = Math.max(1, gl.drawingBufferWidth || width);
        const renderHeight = Math.max(1, gl.drawingBufferHeight || height);
        const alpha = Number.isFinite(Number(command.alpha))
            ? clamp01(Number(command.alpha))
            : 1;

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
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
        gl.uniform1f(
            this.programInfo.uniforms.u_time,
            Number.isFinite(Number(command.time)) ? Number(command.time) : 0
        );
        gl.uniform1f(this.programInfo.uniforms.u_alpha, alpha);
        gl.uniform1f(
            this.programInfo.uniforms.u_pixelSize,
            this.#resolvePixelSize(command.pixelSize)
        );
        gl.uniform3fv(
            this.programInfo.uniforms.u_outerColor,
            this.#resolveColor(command.outerColor, [1, 0.31, 0.055])
        );
        gl.uniform3fv(
            this.programInfo.uniforms.u_coreColor,
            this.#resolveColor(command.coreColor, [1, 0.73, 0.2])
        );
        gl.uniform3fv(
            this.programInfo.uniforms.u_emberColor,
            this.#resolveColor(command.emberColor, [1, 0.94, 0.64])
        );

        for (let emitterIndex = 0; emitterIndex < emitterCount; emitterIndex++) {
            const emitter = emitters[emitterIndex];
            const centerX = Number(emitter?.x);
            const centerY = Number(emitter?.y);
            const rawSize = Number(emitter?.size);
            if (!Number.isFinite(centerX)
                || !Number.isFinite(centerY)
                || !(rawSize > 0)) {
                continue;
            }
            const size = Math.max(
                FLAME_CONSTANTS.MIN_SIZE,
                Math.min(FLAME_CONSTANTS.MAX_SIZE, rawSize)
            );
            const scissorRect = this.#buildScissorRect(
                centerX,
                centerY,
                size,
                renderWidth,
                renderHeight
            );
            if (!scissorRect) {
                continue;
            }
            gl.uniform2f(this.programInfo.uniforms.u_center, centerX, centerY);
            gl.uniform1f(this.programInfo.uniforms.u_size, size);
            gl.uniform1f(
                this.programInfo.uniforms.u_phase,
                Number.isFinite(Number(emitter?.phase)) ? Number(emitter.phase) : 0
            );
            this.#applyScissorRect(scissorRect, renderHeight);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        gl.disable(gl.SCISSOR_TEST);
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

    /** @private */
    #createProgramInfo() {
        const gl = this.gl;
        const vertexShader = compileShader(
            gl,
            FULLSCREEN_VERTEX_SHADER,
            gl.VERTEX_SHADER
        );
        const fragmentShader = compileShader(
            gl,
            FLAME_PARTICLE_FRAGMENT_SHADER,
            gl.FRAGMENT_SHADER
        );
        const program = createProgram(gl, vertexShader, fragmentShader);
        return {
            program,
            uniforms: {
                u_resolution: gl.getUniformLocation(program, 'u_resolution'),
                u_center: gl.getUniformLocation(program, 'u_center'),
                u_size: gl.getUniformLocation(program, 'u_size'),
                u_time: gl.getUniformLocation(program, 'u_time'),
                u_phase: gl.getUniformLocation(program, 'u_phase'),
                u_alpha: gl.getUniformLocation(program, 'u_alpha'),
                u_pixelSize: gl.getUniformLocation(program, 'u_pixelSize'),
                u_outerColor: gl.getUniformLocation(program, 'u_outerColor'),
                u_coreColor: gl.getUniformLocation(program, 'u_coreColor'),
                u_emberColor: gl.getUniformLocation(program, 'u_emberColor')
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

    /**
     * 화염과 외곽광이 존재할 수 있는 영역을 화면 안으로 제한합니다.
     * @private
     */
    #buildScissorRect(centerX, centerY, size, width, height) {
        const left = Math.max(
            0,
            Math.floor(centerX - (size * FLAME_CONSTANTS.BOUNDS_X_SIZE_RATIO))
        );
        const top = Math.max(
            0,
            Math.floor(centerY - (size * FLAME_CONSTANTS.BOUNDS_TOP_SIZE_RATIO))
        );
        const right = Math.min(
            width,
            Math.ceil(centerX + (size * FLAME_CONSTANTS.BOUNDS_X_SIZE_RATIO))
        );
        const bottom = Math.min(
            height,
            Math.ceil(centerY + (size * FLAME_CONSTANTS.BOUNDS_BOTTOM_SIZE_RATIO))
        );
        if (right <= left || bottom <= top) {
            return null;
        }
        return { x: left, y: top, w: right - left, h: bottom - top };
    }

    /** @private */
    #applyScissorRect(rect, renderHeight) {
        const gl = this.gl;
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(
            rect.x,
            Math.max(0, renderHeight - rect.y - rect.h),
            rect.w,
            rect.h
        );
    }

    /** 픽셀 블록 크기를 안전한 화면 픽셀 범위로 제한합니다. @private */
    #resolvePixelSize(pixelSize) {
        const numericSize = Number(pixelSize);
        return Math.max(
            1,
            Math.min(
                8,
                Number.isFinite(numericSize)
                    ? numericSize
                    : FLAME_CONSTANTS.PIXEL_GRID_SIZE
            )
        );
    }

    /**
     * 테마 CSS 색상을 uniform용 RGB로 변환해 재사용합니다.
     * @param {string|undefined} color - 테마 색상입니다.
     * @param {number[]} fallback - 파싱 실패 시 RGB입니다.
     * @returns {Float32Array} 0~1 범위 RGB입니다.
     * @private
     */
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
            resolved = new Float32Array([
                rgb.r / 255,
                rgb.g / 255,
                rgb.b / 255
            ]);
        } catch (_error) {
            resolved = new Float32Array(fallback);
        }
        this.colorCache.set(color, resolved);
        return resolved;
    }
}
