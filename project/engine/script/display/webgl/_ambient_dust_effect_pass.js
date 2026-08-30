import { getData } from 'data/data_handler.js';
import { colorUtil } from 'util/color_util.js';
import { clamp01 } from 'util/number_util.js';
import { compileShader, createProgram } from './_shader_utils.js';

const DUST_CONSTANTS = getData('EFFECT_RENDER_CONSTANTS').AMBIENT_DUST;
const PARTICLE_COMPONENTS = 4;

const AMBIENT_DUST_VERTEX_SHADER = `
    precision highp float;

    attribute vec4 a_particle;

    uniform vec2 u_resolution;
    uniform vec4 u_bounds;
    uniform float u_time;
    uniform float u_alpha;
    uniform float u_pixelSize;
    uniform float u_pointSize;

    varying float v_alpha;
    varying float v_colorMix;

    float hashValue(float value) {
        return fract(sin(value * 91.3458) * 47453.5453);
    }

    void main() {
        float seed = a_particle.w;
        float speed = mix(0.006, 0.014, a_particle.z);
        float progress = fract(a_particle.y - (u_time * speed));
        float sway = sin(
            (u_time * mix(0.16, 0.3, a_particle.z))
            + (seed * 18.8495559)
        ) * mix(0.008, 0.022, hashValue(seed + 2.4));
        float horizontalProgress = fract(
            a_particle.x
            + sway
            + (u_time * mix(0.0007, 0.0022, hashValue(seed + 7.1)))
        );
        vec2 position = u_bounds.xy + vec2(
            horizontalProgress * u_bounds.z,
            progress * u_bounds.w
        );
        float pixelSize = max(1.0, u_pixelSize);
        position = (floor(position / pixelSize) * pixelSize) + (pixelSize * 0.5);

        vec2 zeroToOne = position / max(u_resolution, vec2(1.0));
        vec2 clipSpace = (zeroToOne * 2.0) - 1.0;
        gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);

        float lifeFade = smoothstep(0.0, 0.08, progress)
            * (1.0 - smoothstep(0.88, 1.0, progress));
        float pulse = 0.72 + (0.28 * sin(
            (u_time * mix(0.7, 1.15, a_particle.z))
            + (seed * 31.4159265)
        ));
        float sparkleSeed = hashValue(seed + 13.8);
        float sparkle = step(0.91, sparkleSeed)
            * pow(max(0.0, sin((u_time * 1.7) + (seed * 43.0))), 18.0);
        float baseAlpha = mix(0.14, 0.34, hashValue(seed + 4.6));
        v_alpha = clamp(
            (baseAlpha * pulse) + (sparkle * 0.58),
            0.0,
            0.86
        ) * lifeFade * u_alpha;
        v_colorMix = hashValue(seed + 9.2);
        gl_PointSize = clamp(
            u_pointSize * mix(0.62, 1.0, hashValue(seed + 1.3)),
            1.0,
            2.0
        );
    }
`;

const AMBIENT_DUST_FRAGMENT_SHADER = `
    precision mediump float;

    uniform vec3 u_warmColor;
    uniform vec3 u_coolColor;

    varying float v_alpha;
    varying float v_colorMix;

    void main() {
        if (v_alpha <= 0.002) {
            discard;
        }
        vec3 color = mix(u_coolColor, u_warmColor, smoothstep(0.2, 0.86, v_colorMix));
        gl_FragColor = vec4(color * v_alpha, v_alpha);
    }
`;

/**
 * @class AmbientDustEffectPass
 * @description 전투 맵 위에 희박한 픽셀 먼지를 저비용 WebGL point sprite로 렌더링합니다.
 */
export class AmbientDustEffectPass {
    /** @param {WebGLRenderingContext} gl - 대상 WebGL 컨텍스트입니다. */
    constructor(gl) {
        this.gl = gl;
        this.programInfo = this.#createProgramInfo();
        this.particleBuffer = this.#createParticleBuffer();
        this.colorCache = new Map();
    }

    /**
     * 지정된 화면 영역에 결정론적인 먼지 입자를 렌더링합니다.
     * @param {object} command - 먼지 렌더링 명령입니다.
     * @param {number} width - 현재 surface 너비입니다.
     * @param {number} height - 현재 surface 높이입니다.
     */
    draw(command, width, height) {
        const gl = this.gl;
        const renderWidth = Math.max(1, gl.drawingBufferWidth || width);
        const renderHeight = Math.max(1, gl.drawingBufferHeight || height);
        const bounds = this.#resolveBounds(command?.bounds, renderWidth, renderHeight);
        if (!bounds) {
            return;
        }

        const particleCount = this.#resolveParticleCount(command?.particleCount);
        const alpha = Number.isFinite(Number(command?.alpha))
            ? clamp01(Number(command.alpha))
            : 1;
        if (particleCount === 0 || alpha <= 0) {
            return;
        }

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(this.programInfo.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
        gl.enableVertexAttribArray(this.programInfo.attributes.a_particle);
        gl.vertexAttribPointer(
            this.programInfo.attributes.a_particle,
            PARTICLE_COMPONENTS,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.uniform2f(this.programInfo.uniforms.u_resolution, renderWidth, renderHeight);
        gl.uniform4f(
            this.programInfo.uniforms.u_bounds,
            bounds.x,
            bounds.y,
            bounds.w,
            bounds.h
        );
        gl.uniform1f(
            this.programInfo.uniforms.u_time,
            Number.isFinite(Number(command?.time)) ? Number(command.time) : 0
        );
        gl.uniform1f(this.programInfo.uniforms.u_alpha, alpha);
        gl.uniform1f(
            this.programInfo.uniforms.u_pixelSize,
            this.#resolvePixelSize(command?.pixelSize)
        );
        gl.uniform1f(
            this.programInfo.uniforms.u_pointSize,
            this.#resolvePointSize(command?.pointSize)
        );
        gl.uniform3fv(
            this.programInfo.uniforms.u_warmColor,
            this.#resolveColor(command?.warmColor, [1, 0.86, 0.55])
        );
        gl.uniform3fv(
            this.programInfo.uniforms.u_coolColor,
            this.#resolveColor(command?.coolColor, [0.72, 0.62, 0.68])
        );

        this.#applyScissorRect(bounds, renderHeight);
        gl.drawArrays(gl.POINTS, 0, particleCount);
        gl.disable(gl.SCISSOR_TEST);
    }

    /** GL 리소스를 해제합니다. */
    destroy() {
        if (this.particleBuffer) {
            this.gl.deleteBuffer(this.particleBuffer);
            this.particleBuffer = null;
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
        const vertexShader = compileShader(gl, AMBIENT_DUST_VERTEX_SHADER, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(gl, AMBIENT_DUST_FRAGMENT_SHADER, gl.FRAGMENT_SHADER);
        const program = createProgram(gl, vertexShader, fragmentShader);
        return {
            program,
            uniforms: {
                u_resolution: gl.getUniformLocation(program, 'u_resolution'),
                u_bounds: gl.getUniformLocation(program, 'u_bounds'),
                u_time: gl.getUniformLocation(program, 'u_time'),
                u_alpha: gl.getUniformLocation(program, 'u_alpha'),
                u_pixelSize: gl.getUniformLocation(program, 'u_pixelSize'),
                u_pointSize: gl.getUniformLocation(program, 'u_pointSize'),
                u_warmColor: gl.getUniformLocation(program, 'u_warmColor'),
                u_coolColor: gl.getUniformLocation(program, 'u_coolColor')
            },
            attributes: {
                a_particle: gl.getAttribLocation(program, 'a_particle')
            }
        };
    }

    /** 결정론적 seed를 한 번만 업로드합니다. @returns {WebGLBuffer} @private */
    #createParticleBuffer() {
        const gl = this.gl;
        const particles = new Float32Array(
            DUST_CONSTANTS.MAX_PARTICLES_PER_COMMAND * PARTICLE_COMPONENTS
        );
        for (let index = 0; index < DUST_CONSTANTS.MAX_PARTICLES_PER_COMMAND; index++) {
            const offset = index * PARTICLE_COMPONENTS;
            particles[offset] = this.#hash(index + 1.17);
            particles[offset + 1] = this.#hash(index + 7.43);
            particles[offset + 2] = this.#hash(index + 13.91);
            particles[offset + 3] = this.#hash(index + 29.37);
        }
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, particles, gl.STATIC_DRAW);
        return buffer;
    }

    /** @private */
    #resolveBounds(bounds, renderWidth, renderHeight) {
        const x = Number(bounds?.x);
        const y = Number(bounds?.y);
        const w = Number(bounds?.w);
        const h = Number(bounds?.h);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !(w > 0) || !(h > 0)) {
            return null;
        }
        const left = Math.max(0, Math.floor(x));
        const top = Math.max(0, Math.floor(y));
        const right = Math.min(renderWidth, Math.ceil(x + w));
        const bottom = Math.min(renderHeight, Math.ceil(y + h));
        if (right <= left || bottom <= top) {
            return null;
        }
        return { x: left, y: top, w: right - left, h: bottom - top };
    }

    /** @private */
    #resolveParticleCount(particleCount) {
        const numericCount = Number(particleCount);
        return Math.max(0, Math.min(
            DUST_CONSTANTS.MAX_PARTICLES_PER_COMMAND,
            Number.isFinite(numericCount)
                ? Math.floor(numericCount)
                : DUST_CONSTANTS.DEFAULT_PARTICLE_COUNT
        ));
    }

    /** @private */
    #resolvePixelSize(pixelSize) {
        const numericSize = Number(pixelSize);
        return Math.max(1, Math.min(
            8,
            Number.isFinite(numericSize)
                ? numericSize
                : DUST_CONSTANTS.PIXEL_GRID_SIZE
        ));
    }

    /** @private */
    #resolvePointSize(pointSize) {
        const numericSize = Number(pointSize);
        return Math.max(
            DUST_CONSTANTS.MIN_POINT_SIZE,
            Math.min(
                DUST_CONSTANTS.MAX_POINT_SIZE,
                Number.isFinite(numericSize)
                    ? numericSize
                    : DUST_CONSTANTS.MAX_POINT_SIZE
            )
        );
    }

    /** @private */
    #applyScissorRect(bounds, renderHeight) {
        this.gl.enable(this.gl.SCISSOR_TEST);
        this.gl.scissor(
            bounds.x,
            Math.max(0, renderHeight - bounds.y - bounds.h),
            bounds.w,
            bounds.h
        );
    }

    /** @private */
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

    /** @private */
    #hash(value) {
        const sine = Math.sin(value * 91.3458) * 47453.5453;
        return sine - Math.floor(sine);
    }
}
