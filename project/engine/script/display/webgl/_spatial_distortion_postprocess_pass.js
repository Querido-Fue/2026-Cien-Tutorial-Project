import { getData } from 'data/data_handler.js';
import { compileShader, createProgram, FULLSCREEN_VERTEX_SHADER } from './_shader_utils.js';

const DISTORTION_CONSTANTS = getData('EFFECT_RENDER_CONSTANTS').SPATIAL_DISTORTION;
const MAX_COMMANDS = DISTORTION_CONSTANTS.MAX_COMMANDS_PER_FRAME;

const SPATIAL_DISTORTION_FRAGMENT_SHADER = `
    precision highp float;

    varying vec2 v_uv;
    uniform sampler2D u_scene;
    uniform vec2 u_resolution;
    uniform int u_distortionCount;
    uniform vec4 u_distortions[${MAX_COMMANDS}];
    uniform float u_strengths[${MAX_COMMANDS}];

    void main() {
        vec2 screenPoint = vec2(
            v_uv.x * u_resolution.x,
            (1.0 - v_uv.y) * u_resolution.y
        );
        vec2 displacement = vec2(0.0);

        for (int index = 0; index < ${MAX_COMMANDS}; index++) {
            if (index >= u_distortionCount) {
                break;
            }
            vec4 distortion = u_distortions[index];
            vec2 delta = screenPoint - distortion.xy;
            float distanceFromCenter = length(delta);
            float ringWidth = max(1.0, distortion.w);
            float ringDistance = abs(distanceFromCenter - distortion.z);
            float ringMask = 1.0 - smoothstep(0.0, ringWidth, ringDistance);
            float ringWave = cos(min(1.0, ringDistance / ringWidth) * 1.5707963);
            vec2 direction = delta / max(1.0, distanceFromCenter);
            displacement += direction * u_strengths[index] * ringMask * ringWave;
        }

        vec2 uvOffset = vec2(
            displacement.x / u_resolution.x,
            -displacement.y / u_resolution.y
        );
        vec2 halfTexel = 0.5 / u_resolution;
        vec2 sampleUv = clamp(v_uv + uvOffset, halfTexel, vec2(1.0) - halfTexel);
        gl_FragColor = texture2D(u_scene, sampleUv);
    }
`;

/** @param {*} value @param {number} fallback @returns {number} 유한 숫자입니다. */
function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

/** @param {number} value @param {number} minimum @param {number} maximum @returns {number} 제한된 값입니다. */
function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, toFiniteNumber(value)));
}

/**
 * @class SpatialDistortionPostProcessPass
 * @description 월드 텍스처를 공격 지점에서 퍼지는 방사형 링으로 굴절시킵니다.
 */
export class SpatialDistortionPostProcessPass {
    #gl;
    #program;
    #positionLocation;
    #uniforms;
    #quadBuffer;
    #distortionBuffer;
    #strengthBuffer;

    /** @param {WebGLRenderingContext} gl - 후처리 출력 컨텍스트입니다. */
    constructor(gl) {
        this.#gl = gl;
        this.#distortionBuffer = new Float32Array(MAX_COMMANDS * 4);
        this.#strengthBuffer = new Float32Array(MAX_COMMANDS);
        this.#program = this.#createProgram();
        this.#positionLocation = gl.getAttribLocation(this.#program, 'a_position');
        this.#uniforms = Object.freeze({
            scene: gl.getUniformLocation(this.#program, 'u_scene'),
            resolution: gl.getUniformLocation(this.#program, 'u_resolution'),
            count: gl.getUniformLocation(this.#program, 'u_distortionCount'),
            distortions: gl.getUniformLocation(this.#program, 'u_distortions[0]'),
            strengths: gl.getUniformLocation(this.#program, 'u_strengths[0]')
        });
        this.#quadBuffer = this.#createFullscreenBuffer();
    }

    /**
     * 유효 명령이 있을 때만 별도 full-resolution 타깃에 굴절 결과를 씁니다.
     * @param {object} input - 원본 텍스처, 출력 FBO와 화면 크기입니다.
     * @returns {boolean} 패스를 실제로 실행했는지 여부입니다.
     */
    draw({ sourceTexture, targetFramebuffer, width, height, commands = [] } = {}) {
        const count = this.#writeCommands(commands, width, height);
        if (!sourceTexture || !targetFramebuffer || count <= 0) {
            return false;
        }

        const gl = this.#gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
        gl.viewport(0, 0, width, height);
        gl.disable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.SCISSOR_TEST);
        gl.useProgram(this.#program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.#quadBuffer);
        gl.enableVertexAttribArray(this.#positionLocation);
        gl.vertexAttribPointer(this.#positionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
        gl.uniform1i(this.#uniforms.scene, 0);
        gl.uniform2f(this.#uniforms.resolution, width, height);
        gl.uniform1i(this.#uniforms.count, count);
        gl.uniform4fv(this.#uniforms.distortions, this.#distortionBuffer);
        gl.uniform1fv(this.#uniforms.strengths, this.#strengthBuffer);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        return true;
    }

    /** WebGL 프로그램과 버퍼를 해제합니다. */
    destroy() {
        if (this.#quadBuffer) {
            this.#gl.deleteBuffer(this.#quadBuffer);
            this.#quadBuffer = null;
        }
        if (this.#program) {
            this.#gl.deleteProgram(this.#program);
            this.#program = null;
        }
    }

    /** @param {readonly object[]} commands @param {number} width @param {number} height @returns {number} @private */
    #writeCommands(commands, width, height) {
        this.#distortionBuffer.fill(0);
        this.#strengthBuffer.fill(0);
        let count = 0;
        for (const command of Array.isArray(commands) ? commands : []) {
            if (count >= MAX_COMMANDS) {
                break;
            }
            const centerX = Number(command?.centerX);
            const centerY = Number(command?.centerY);
            const strength = Number(command?.strength);
            if (!Number.isFinite(centerX)
                || !Number.isFinite(centerY)
                || !Number.isFinite(strength)
                || strength <= 0) {
                continue;
            }
            const offset = count * 4;
            this.#distortionBuffer[offset] = clamp(centerX, 0, width);
            this.#distortionBuffer[offset + 1] = clamp(centerY, 0, height);
            this.#distortionBuffer[offset + 2] = clamp(
                command.radius,
                DISTORTION_CONSTANTS.MIN_RADIUS,
                DISTORTION_CONSTANTS.MAX_RADIUS
            );
            this.#distortionBuffer[offset + 3] = clamp(
                command.ringWidth,
                DISTORTION_CONSTANTS.MIN_RING_WIDTH,
                DISTORTION_CONSTANTS.MAX_RING_WIDTH
            );
            this.#strengthBuffer[count] = clamp(
                strength,
                0,
                DISTORTION_CONSTANTS.MAX_STRENGTH
            );
            count += 1;
        }
        return count;
    }

    /** @returns {WebGLProgram} @private */
    #createProgram() {
        const gl = this.#gl;
        const vertexShader = compileShader(gl, FULLSCREEN_VERTEX_SHADER, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(
            gl,
            SPATIAL_DISTORTION_FRAGMENT_SHADER,
            gl.FRAGMENT_SHADER
        );
        if (!vertexShader || !fragmentShader) {
            throw new Error('Spatial distortion shader compilation failed.');
        }
        const program = createProgram(gl, vertexShader, fragmentShader);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        if (!program) {
            throw new Error('Spatial distortion shader link failed.');
        }
        return program;
    }

    /** @returns {WebGLBuffer} @private */
    #createFullscreenBuffer() {
        const gl = this.#gl;
        const buffer = gl.createBuffer();
        if (!buffer) {
            throw new Error('Spatial distortion fullscreen buffer allocation failed.');
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            1, 1
        ]), gl.STATIC_DRAW);
        return buffer;
    }
}
