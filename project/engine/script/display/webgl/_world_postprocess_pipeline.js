import { getData } from 'data/data_handler.js';
import { resolveWorldPostProcessQuality } from 'data/display/world_postprocess_constants.js';
import { EffectRenderer } from './_effect_renderer.js';
import { compileShader, createProgram, FULLSCREEN_VERTEX_SHADER } from './_shader_utils.js';
import { SpatialDistortionPostProcessPass } from './_spatial_distortion_postprocess_pass.js';
import { WebGLBatch } from './_webgl_batch.js';

const POSTPROCESS_CONSTANTS = getData('WORLD_POSTPROCESS_CONSTANTS');
const WORLD_LAYER_IDS = POSTPROCESS_CONSTANTS.SOURCE_LAYER_IDS;
const SPATIAL_DISTORTION_TYPE = getData('EFFECT_RENDER_CONSTANTS')
    .TYPES.SPATIAL_DISTORTION;
const MIN_TARGET_SIZE = 1;

const BLOOM_EXTRACT_FRAGMENT_SHADER = `
    precision highp float;

    varying vec2 v_uv;
    uniform sampler2D u_scene;
    uniform float u_threshold;
    uniform float u_softKnee;

    void main() {
        vec3 color = texture2D(u_scene, v_uv).rgb;
        float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
        float peak = max(max(color.r, color.g), color.b);
        float brightness = max(luminance, peak * 0.86);
        float mask = smoothstep(u_threshold, u_threshold + u_softKnee, brightness);
        gl_FragColor = vec4(color * mask, 1.0);
    }
`;

const BLOOM_BLUR_FRAGMENT_SHADER = `
    precision highp float;

    varying vec2 v_uv;
    uniform sampler2D u_texture;
    uniform vec2 u_texelSize;
    uniform vec2 u_direction;
    uniform float u_radius;

    void main() {
        vec2 offset = u_texelSize * u_direction * u_radius;
        vec3 color = texture2D(u_texture, v_uv).rgb * 0.227027;
        color += texture2D(u_texture, v_uv + (offset * 1.384615)).rgb * 0.316216;
        color += texture2D(u_texture, v_uv - (offset * 1.384615)).rgb * 0.316216;
        color += texture2D(u_texture, v_uv + (offset * 3.230769)).rgb * 0.070270;
        color += texture2D(u_texture, v_uv - (offset * 3.230769)).rgb * 0.070270;
        gl_FragColor = vec4(color, 1.0);
    }
`;

const FINAL_COMPOSITE_FRAGMENT_SHADER = `
    precision highp float;

    varying vec2 v_uv;
    uniform sampler2D u_scene;
    uniform sampler2D u_bloom;
    uniform vec2 u_resolution;
    uniform float u_frameIndex;
    uniform float u_bloomIntensity;
    uniform float u_contrast;
    uniform float u_saturation;
    uniform float u_shadowTint;
    uniform float u_highlightTint;
    uniform float u_grainStrength;
    uniform vec3 u_vignetteColor;
    uniform float u_vignetteAlpha;
    uniform float u_vignetteEdgeWidth;
    uniform float u_vignetteCornerRadius;

    float luminanceOf(vec3 color) {
        return dot(color, vec3(0.2126, 0.7152, 0.0722));
    }

    float roundedRectDistance(vec2 point, vec2 halfSize, float radius) {
        vec2 q = abs(point) - max(vec2(0.0), halfSize - vec2(radius));
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
    }

    float orderedDither(vec2 pixel) {
        vec2 cell = mod(floor(pixel), 4.0);
        float row0 = mix(mix(0.0, 8.0, step(1.0, cell.x)), mix(2.0, 10.0, step(3.0, cell.x)), step(2.0, cell.x));
        float row1 = mix(mix(12.0, 4.0, step(1.0, cell.x)), mix(14.0, 6.0, step(3.0, cell.x)), step(2.0, cell.x));
        float row2 = mix(mix(3.0, 11.0, step(1.0, cell.x)), mix(1.0, 9.0, step(3.0, cell.x)), step(2.0, cell.x));
        float row3 = mix(mix(15.0, 7.0, step(1.0, cell.x)), mix(13.0, 5.0, step(3.0, cell.x)), step(2.0, cell.x));
        float top = mix(row0, row1, step(1.0, cell.y));
        float bottom = mix(row2, row3, step(3.0, cell.y));
        return mix(top, bottom, step(2.0, cell.y)) / 15.0;
    }

    float filmGrain(vec2 pixel, float frameIndex) {
        float seed = dot(floor(pixel), vec2(12.9898, 78.233)) + mod(frameIndex, 8.0) * 19.19;
        return fract(sin(seed) * 43758.5453);
    }

    void main() {
        vec3 source = texture2D(u_scene, v_uv).rgb;
        vec3 bloom = texture2D(u_bloom, v_uv).rgb;
        float sourceLuma = luminanceOf(source);

        float shadowMask = 1.0 - smoothstep(0.08, 0.48, sourceLuma);
        float highlightMask = smoothstep(0.58, 0.94, sourceLuma);
        vec3 purpleShadow = source * vec3(0.88, 0.79, 1.03) + vec3(0.018, 0.004, 0.026);
        vec3 goldenHighlight = source * vec3(1.04, 0.985, 0.88) + vec3(0.026, 0.014, 0.002);
        vec3 color = mix(source, purpleShadow, shadowMask * u_shadowTint);
        color = mix(color, goldenHighlight, highlightMask * u_highlightTint);

        float gradedLuma = luminanceOf(color);
        color = mix(vec3(gradedLuma), color, u_saturation);
        color = ((color - vec3(0.45)) * u_contrast) + vec3(0.45);
        color = 1.0 - ((1.0 - clamp(color, 0.0, 1.0)) * (1.0 - clamp(bloom * u_bloomIntensity, 0.0, 0.72)));

        vec2 pixel = v_uv * u_resolution;
        vec2 center = u_resolution * 0.5;
        float roundedDistance = roundedRectDistance(
            pixel - center,
            center,
            min(u_vignetteCornerRadius, min(center.x, center.y))
        );
        float insideDistance = max(0.0, -roundedDistance);
        float vignetteMask = 1.0 - smoothstep(0.0, max(1.0, u_vignetteEdgeWidth), insideDistance);
        color = mix(color, u_vignetteColor, vignetteMask * u_vignetteAlpha);

        float dither = orderedDither(gl_FragCoord.xy) - 0.5;
        float grain = filmGrain(gl_FragCoord.xy, u_frameIndex) - 0.5;
        color += (dither * 0.62 + grain * 0.38) * u_grainStrength;
        gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
`;

/**
 * @class WorldPostProcessPipeline
 * @description 월드 전용 렌더러를 하나의 FBO로 합성한 뒤 Bloom과 색보정을 출력합니다.
 */
export class WorldPostProcessPipeline {
    /**
     * @param {WebGLRenderingContext} gl - 최종 출력 canvas의 WebGL 컨텍스트입니다.
     * @param {{quality?: string, onFailure?: Function}} [options] - 파이프라인 옵션입니다.
     */
    constructor(gl, options = {}) {
        if (!gl) {
            throw new Error('World postprocess WebGL context is unavailable.');
        }

        this.gl = gl;
        this.onFailure = typeof options.onFailure === 'function' ? options.onFailure : null;
        this.quality = this.#resolveQuality(options.quality);
        this.width = 0;
        this.height = 0;
        this.bloomWidth = 0;
        this.bloomHeight = 0;
        this.frameIndex = 0;
        this.frameDirty = false;
        this.lastFrameCpuMs = 0;
        this.rollingFrameCpuMs = 0;
        this.frameSampleCount = 0;
        this.vignetteColor = new Float32Array(POSTPROCESS_CONSTANTS.VIGNETTE.DEFAULT_COLOR);
        this.vignetteAlpha = POSTPROCESS_CONSTANTS.VIGNETTE.BASE_ALPHA
            * POSTPROCESS_CONSTANTS.VIGNETTE.DEFAULT_ALPHA_MULTIPLIER;
        this.sceneTarget = null;
        this.distortionTarget = null;
        this.bloomTargets = [];
        this.distortionCommands = [];

        this.#validateCapabilities();
        this.quadBuffer = this.#createFullscreenBuffer();
        this.extractProgram = this.#createProgramInfo(BLOOM_EXTRACT_FRAGMENT_SHADER, [
            'u_scene', 'u_threshold', 'u_softKnee'
        ]);
        this.blurProgram = this.#createProgramInfo(BLOOM_BLUR_FRAGMENT_SHADER, [
            'u_texture', 'u_texelSize', 'u_direction', 'u_radius'
        ]);
        this.compositeProgram = this.#createProgramInfo(FINAL_COMPOSITE_FRAGMENT_SHADER, [
            'u_scene', 'u_bloom', 'u_resolution', 'u_frameIndex',
            'u_bloomIntensity', 'u_contrast', 'u_saturation',
            'u_shadowTint', 'u_highlightTint', 'u_grainStrength',
            'u_vignetteColor', 'u_vignetteAlpha', 'u_vignetteEdgeWidth',
            'u_vignetteCornerRadius'
        ]);
        this.distortionPass = new SpatialDistortionPostProcessPass(gl);

        const renderTargetOptions = { getFramebuffer: () => this.sceneTarget?.framebuffer || null };
        this.renderers = new Map([
            ['background', new WebGLBatch(gl, renderTargetOptions)],
            ['object', new WebGLBatch(gl, renderTargetOptions)],
            ['effect', new EffectRenderer(gl, renderTargetOptions)]
        ]);
        this.commandQueues = new Map(
            WORLD_LAYER_IDS.map((layerName) => [layerName, []])
        );

        this.contextLostHandler = (event) => {
            event.preventDefault();
            this.#reportFailure(new Error('WebGL context lost.'));
        };
        this.gl.canvas?.addEventListener('webglcontextlost', this.contextLostHandler, false);
        this.#syncCanvasDiagnostics(true);
    }

    /** @param {number} width @param {number} height */
    resize(width, height) {
        const nextWidth = Math.max(MIN_TARGET_SIZE, Math.floor(width || MIN_TARGET_SIZE));
        const nextHeight = Math.max(MIN_TARGET_SIZE, Math.floor(height || MIN_TARGET_SIZE));
        const nextBloomWidth = Math.max(1, Math.ceil(nextWidth * POSTPROCESS_CONSTANTS.BLOOM_SCALE));
        const nextBloomHeight = Math.max(1, Math.ceil(nextHeight * POSTPROCESS_CONSTANTS.BLOOM_SCALE));
        if (this.width === nextWidth
            && this.height === nextHeight
            && this.bloomWidth === nextBloomWidth
            && this.bloomHeight === nextBloomHeight) {
            return;
        }

        const maxTextureSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
        if (nextWidth > maxTextureSize || nextHeight > maxTextureSize) {
            throw new Error(`World postprocess target exceeds MAX_TEXTURE_SIZE (${maxTextureSize}).`);
        }

        this.width = nextWidth;
        this.height = nextHeight;
        this.bloomWidth = nextBloomWidth;
        this.bloomHeight = nextBloomHeight;
        this.#destroyTargets();
        this.sceneTarget = this.#createRenderTarget(nextWidth, nextHeight, this.gl.NEAREST);
        this.distortionTarget = this.#createRenderTarget(
            nextWidth,
            nextHeight,
            this.gl.NEAREST
        );
        this.bloomTargets = [
            this.#createRenderTarget(nextBloomWidth, nextBloomHeight, this.gl.LINEAR),
            this.#createRenderTarget(nextBloomWidth, nextBloomHeight, this.gl.LINEAR)
        ];
        this.#syncCanvasDiagnostics(true);

        for (const renderer of this.renderers.values()) {
            if (typeof renderer.resize === 'function') {
                renderer.resize(nextWidth, nextHeight);
            }
        }
    }

    /** @param {number[]} backgroundColor */
    beginFrame(backgroundColor) {
        if (this.gl.isContextLost()) {
            throw new Error('World postprocess context is lost.');
        }
        this.#discardStaleGlErrors();
        this.resize(this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneTarget.framebuffer);
        gl.viewport(0, 0, this.width, this.height);
        gl.disable(gl.SCISSOR_TEST);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(
            backgroundColor?.[0] || 0,
            backgroundColor?.[1] || 0,
            backgroundColor?.[2] || 0,
            1
        );
        gl.clear(gl.COLOR_BUFFER_BIT);

        for (const queue of this.commandQueues.values()) {
            queue.length = 0;
        }
        this.distortionCommands.length = 0;
        this.frameDirty = true;
        this.frameIndex = (this.frameIndex + 1) % 4096;
    }

    /** @param {string} layerName @param {object} command */
    render(layerName, command) {
        if (layerName === 'effect'
            && (command?.effectType || command?.shape) === SPATIAL_DISTORTION_TYPE) {
            this.distortionCommands.push(command);
            this.frameDirty = true;
            return;
        }
        const queue = this.commandQueues.get(layerName);
        if (!queue || !command) {
            return;
        }
        queue.push(command);
        this.frameDirty = true;
    }

    /** 월드 큐를 합성하고 최종 canvas로 출력합니다. */
    flush() {
        if (!this.frameDirty) {
            return;
        }
        const startedAt = this.#now();
        const gl = this.gl;
        this.#flushWorldLayersInOrder();
        const sceneTexture = this.#drawSpatialDistortion();

        const quality = POSTPROCESS_CONSTANTS.QUALITY_TIERS[this.quality];
        this.#drawBloomExtract(quality, sceneTexture);
        const bloomTarget = this.#drawBloomBlur(quality);
        this.#drawFinalComposite(quality, bloomTarget.texture, sceneTexture);
        this.#throwOnGlError('frame composite');
        this.frameDirty = false;

        this.lastFrameCpuMs = Math.max(0, this.#now() - startedAt);
        this.frameSampleCount += 1;
        const smoothing = this.frameSampleCount <= 1 ? 1 : 0.08;
        this.rollingFrameCpuMs += (this.lastFrameCpuMs - this.rollingFrameCpuMs) * smoothing;
        this.#syncCanvasDiagnostics(this.frameSampleCount % 30 === 0);
    }

    /** @param {string} quality */
    setQuality(quality) {
        this.quality = this.#resolveQuality(quality);
        this.#syncCanvasDiagnostics(true);
    }

    /** @param {{rgb?: number[], alphaMultiplier?: number}} style */
    setVignetteStyle(style = {}) {
        const rgb = Array.isArray(style.rgb) ? style.rgb : POSTPROCESS_CONSTANTS.VIGNETTE.DEFAULT_COLOR;
        this.vignetteColor[0] = Math.max(0, Math.min(1, Number(rgb[0] || 0) / 255));
        this.vignetteColor[1] = Math.max(0, Math.min(1, Number(rgb[1] || 0) / 255));
        this.vignetteColor[2] = Math.max(0, Math.min(1, Number(rgb[2] || 0) / 255));
        const multiplier = Number(style.alphaMultiplier);
        this.vignetteAlpha = Math.max(0, Math.min(
            0.98,
            POSTPROCESS_CONSTANTS.VIGNETTE.BASE_ALPHA
                * (Number.isFinite(multiplier)
                    ? multiplier
                    : POSTPROCESS_CONSTANTS.VIGNETTE.DEFAULT_ALPHA_MULTIPLIER)
        ));
    }

    /** @returns {object} 런타임 진단 값입니다. */
    getDiagnostics() {
        return {
            active: true,
            quality: this.quality,
            width: this.width,
            height: this.height,
            bloomWidth: this.bloomWidth,
            bloomHeight: this.bloomHeight,
            bloomScale: POSTPROCESS_CONSTANTS.BLOOM_SCALE,
            lastFrameCpuMs: Number(this.lastFrameCpuMs.toFixed(3)),
            rollingFrameCpuMs: Number(this.rollingFrameCpuMs.toFixed(3)),
            frameSampleCount: this.frameSampleCount
        };
    }

    /** GL 리소스를 해제합니다. */
    destroy() {
        this.gl.canvas?.removeEventListener('webglcontextlost', this.contextLostHandler, false);
        for (const renderer of this.renderers.values()) {
            if (typeof renderer.destroy === 'function') {
                renderer.destroy();
            }
        }
        this.renderers.clear();
        this.distortionPass?.destroy();
        this.distortionPass = null;
        this.distortionCommands.length = 0;
        for (const queue of this.commandQueues.values()) {
            queue.length = 0;
        }
        this.commandQueues.clear();
        this.#destroyTargets();
        for (const programInfo of [this.extractProgram, this.blurProgram, this.compositeProgram]) {
            if (programInfo?.program) {
                this.gl.deleteProgram(programInfo.program);
            }
        }
        if (this.quadBuffer) {
            this.gl.deleteBuffer(this.quadBuffer);
            this.quadBuffer = null;
        }
    }

    /** @private */
    #drawBloomExtract(quality, sceneTexture) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomTargets[0].framebuffer);
        gl.viewport(0, 0, this.bloomWidth, this.bloomHeight);
        gl.disable(gl.BLEND);
        this.#bindFullscreenProgram(this.extractProgram);
        this.#bindTexture(sceneTexture, 0, this.extractProgram.uniforms.u_scene);
        gl.uniform1f(this.extractProgram.uniforms.u_threshold, quality.bloomThreshold);
        gl.uniform1f(this.extractProgram.uniforms.u_softKnee, quality.bloomSoftKnee);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /**
     * 배치 내부의 텍스처 전환 flush가 레이어 순서를 앞지르지 않도록 명령을 순차 실행합니다.
     * @private
     */
    #flushWorldLayersInOrder() {
        for (const layerName of WORLD_LAYER_IDS) {
            const renderer = this.renderers.get(layerName);
            const queue = this.commandQueues.get(layerName) || [];
            if (layerName === 'effect') {
                renderer.beginFrame(this.width, this.height);
            } else {
                renderer.begin(this.width, this.height);
            }
            for (const command of queue) {
                renderer.render(command);
            }
            renderer.flush();
            queue.length = 0;
        }
    }

    /** @returns {WebGLTexture} 왜곡 적용 여부에 따른 현재 월드 텍스처입니다. @private */
    #drawSpatialDistortion() {
        const applied = this.distortionPass.draw({
            sourceTexture: this.sceneTarget.texture,
            targetFramebuffer: this.distortionTarget.framebuffer,
            width: this.width,
            height: this.height,
            commands: this.distortionCommands
        });
        this.distortionCommands.length = 0;
        return applied ? this.distortionTarget.texture : this.sceneTarget.texture;
    }

    /** @private */
    #drawBloomBlur(quality) {
        const gl = this.gl;
        let sourceIndex = 0;
        let targetIndex = 1;
        for (let passIndex = 0; passIndex < quality.bloomPasses; passIndex++) {
            for (let axisIndex = 0; axisIndex < 2; axisIndex++) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomTargets[targetIndex].framebuffer);
                gl.viewport(0, 0, this.bloomWidth, this.bloomHeight);
                this.#bindFullscreenProgram(this.blurProgram);
                this.#bindTexture(
                    this.bloomTargets[sourceIndex].texture,
                    0,
                    this.blurProgram.uniforms.u_texture
                );
                gl.uniform2f(
                    this.blurProgram.uniforms.u_texelSize,
                    1 / this.bloomWidth,
                    1 / this.bloomHeight
                );
                gl.uniform2f(
                    this.blurProgram.uniforms.u_direction,
                    axisIndex === 0 ? 1 : 0,
                    axisIndex === 0 ? 0 : 1
                );
                gl.uniform1f(this.blurProgram.uniforms.u_radius, 0.82 + (passIndex * 0.38));
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                const previousSource = sourceIndex;
                sourceIndex = targetIndex;
                targetIndex = previousSource;
            }
        }
        return this.bloomTargets[sourceIndex];
    }

    /** @private */
    #drawFinalComposite(quality, bloomTexture, sceneTexture) {
        const gl = this.gl;
        const vignette = POSTPROCESS_CONSTANTS.VIGNETTE;
        const minDimension = Math.min(this.width, this.height);
        const vignetteEdgeWidth = minDimension
            * (vignette.BASE_EDGE_WIDTH_PX / vignette.BASE_REFERENCE_HEIGHT_PX)
            * vignette.EDGE_WIDTH_MULTIPLIER;
        const vignetteCornerRadius = minDimension
            * (vignette.BASE_CORNER_RADIUS_PX / vignette.BASE_REFERENCE_HEIGHT_PX);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.width, this.height);
        gl.disable(gl.BLEND);
        this.#bindFullscreenProgram(this.compositeProgram);
        this.#bindTexture(sceneTexture, 0, this.compositeProgram.uniforms.u_scene);
        this.#bindTexture(bloomTexture, 1, this.compositeProgram.uniforms.u_bloom);
        gl.uniform2f(this.compositeProgram.uniforms.u_resolution, this.width, this.height);
        gl.uniform1f(this.compositeProgram.uniforms.u_frameIndex, this.frameIndex);
        gl.uniform1f(this.compositeProgram.uniforms.u_bloomIntensity, quality.bloomIntensity);
        gl.uniform1f(this.compositeProgram.uniforms.u_contrast, quality.contrast);
        gl.uniform1f(this.compositeProgram.uniforms.u_saturation, quality.saturation);
        gl.uniform1f(this.compositeProgram.uniforms.u_shadowTint, quality.shadowTint);
        gl.uniform1f(this.compositeProgram.uniforms.u_highlightTint, quality.highlightTint);
        gl.uniform1f(this.compositeProgram.uniforms.u_grainStrength, quality.grainStrength);
        gl.uniform3fv(this.compositeProgram.uniforms.u_vignetteColor, this.vignetteColor);
        gl.uniform1f(this.compositeProgram.uniforms.u_vignetteAlpha, this.vignetteAlpha);
        gl.uniform1f(this.compositeProgram.uniforms.u_vignetteEdgeWidth, vignetteEdgeWidth);
        gl.uniform1f(this.compositeProgram.uniforms.u_vignetteCornerRadius, vignetteCornerRadius);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    /** @private */
    #createProgramInfo(fragmentSource, uniformNames) {
        const gl = this.gl;
        const vertexShader = compileShader(gl, FULLSCREEN_VERTEX_SHADER, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
        if (!vertexShader || !fragmentShader) {
            throw new Error('World postprocess shader compilation failed.');
        }
        const program = createProgram(gl, vertexShader, fragmentShader);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        if (!program) {
            throw new Error('World postprocess shader link failed.');
        }

        const uniforms = {};
        for (const uniformName of uniformNames) {
            uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
        }
        return {
            program,
            attributes: { a_position: gl.getAttribLocation(program, 'a_position') },
            uniforms
        };
    }

    /** @private */
    #createFullscreenBuffer() {
        const buffer = this.gl.createBuffer();
        if (!buffer) {
            throw new Error('World postprocess fullscreen buffer allocation failed.');
        }
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            1, 1
        ]), this.gl.STATIC_DRAW);
        return buffer;
    }

    /** @private */
    #createRenderTarget(width, height, filter) {
        const gl = this.gl;
        const texture = gl.createTexture();
        const framebuffer = gl.createFramebuffer();
        if (!texture || !framebuffer) {
            throw new Error('World postprocess framebuffer allocation failed.');
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            width,
            height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        );
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            texture,
            0
        );
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            gl.deleteFramebuffer(framebuffer);
            gl.deleteTexture(texture);
            throw new Error(`World postprocess framebuffer incomplete (${status}).`);
        }
        return { texture, framebuffer, width, height };
    }

    /** @private */
    #destroyTargets() {
        const targets = [
            this.sceneTarget,
            this.distortionTarget,
            ...this.bloomTargets
        ].filter(Boolean);
        for (const target of targets) {
            this.gl.deleteFramebuffer(target.framebuffer);
            this.gl.deleteTexture(target.texture);
        }
        this.sceneTarget = null;
        this.distortionTarget = null;
        this.bloomTargets = [];
    }

    /** @private */
    #bindFullscreenProgram(programInfo) {
        const gl = this.gl;
        gl.useProgram(programInfo.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(programInfo.attributes.a_position);
        gl.vertexAttribPointer(programInfo.attributes.a_position, 2, gl.FLOAT, false, 0, 0);
    }

    /** @private */
    #bindTexture(texture, unit, uniformLocation) {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(uniformLocation, unit);
    }

    /** @private */
    #validateCapabilities() {
        const gl = this.gl;
        if (gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) < 2) {
            throw new Error('World postprocess requires at least two texture units.');
        }
    }

    /** 이전 외부 프레임에서 남은 GL 오류가 현재 프레임 폴백을 오염시키지 않게 비웁니다. @private */
    #discardStaleGlErrors() {
        const gl = this.gl;
        for (let index = 0; index < 8; index++) {
            if (gl.getError() === gl.NO_ERROR) {
                return;
            }
        }
    }

    /** 현재 후처리 패스에서 발생한 GL 오류를 예외로 승격해 레거시 렌더링으로 복귀시킵니다. @private */
    #throwOnGlError(stage) {
        const errorCode = this.gl.getError();
        if (errorCode === this.gl.NO_ERROR) {
            return;
        }
        throw new Error(
            `World postprocess WebGL error during ${stage} (0x${errorCode.toString(16)}).`
        );
    }

    /** @private */
    #resolveQuality(quality) {
        if (Object.prototype.hasOwnProperty.call(POSTPROCESS_CONSTANTS.QUALITY_TIERS, quality)) {
            return quality;
        }
        return POSTPROCESS_CONSTANTS.DEFAULT_QUALITY;
    }

    /** @private */
    #reportFailure(error) {
        if (this.onFailure) {
            this.onFailure(error);
        }
    }

    /** QA와 운영 진단을 위해 저빈도로 canvas data attribute를 갱신합니다. @private */
    #syncCanvasDiagnostics(force) {
        if (!force || !this.gl.canvas?.dataset) {
            return;
        }
        const dataset = this.gl.canvas.dataset;
        dataset.worldPostprocessStatus = 'active';
        dataset.worldPostprocessQuality = this.quality;
        dataset.worldPostprocessBloomScale = String(POSTPROCESS_CONSTANTS.BLOOM_SCALE);
        dataset.worldPostprocessBloomSize = `${this.bloomWidth}x${this.bloomHeight}`;
        dataset.worldPostprocessCpuMs = this.rollingFrameCpuMs.toFixed(3);
        dataset.worldPostprocessSamples = String(this.frameSampleCount);
        delete dataset.worldPostprocessFallbackReason;
    }

    /** @private */
    #now() {
        return globalThis.performance?.now?.() ?? Date.now();
    }
}

export { WORLD_LAYER_IDS };
