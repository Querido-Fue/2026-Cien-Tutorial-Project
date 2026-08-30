import { getData } from 'data/data_handler.js';
import { colorUtil } from 'util/color_util.js';
import { clamp01 } from 'util/number_util.js';
import {
    compileShader,
    createProgram,
    FULLSCREEN_VERTEX_SHADER
} from './_shader_utils.js';

const PAGE_TURN_CONSTANTS = getData('EFFECT_RENDER_CONSTANTS').PAGE_TURN;

const PAGE_VERTEX_SHADER = `
    precision highp float;

    attribute vec2 a_unit;

    uniform vec2 u_resolution;
    uniform vec4 u_pageRect;
    uniform float u_progress;
    uniform float u_direction;
    uniform float u_curlStrength;
    uniform float u_depthRatio;
    uniform float u_perspectiveRatio;

    varying vec2 v_sourceUv;
    varying float v_light;
    varying float v_back;
    varying float v_edge;

    void main() {
        const float PI = 3.14159265359;
        float progress = clamp(u_progress, 0.0, 1.0);
        float pageWidth = max(1.0, u_pageRect.z);
        float pageHeight = max(1.0, u_pageRect.w);
        float spineX = u_direction > 0.0
            ? u_pageRect.x
            : u_pageRect.x + pageWidth;
        float radius = a_unit.x * pageWidth;
        float turnAngle = progress * PI;
        float turnActivity = sin(progress * PI);
        float curl = sin(a_unit.x * PI)
            * turnActivity
            * u_curlStrength
            * (0.68 - a_unit.x);
        float localAngle = turnAngle + curl;
        float localX = u_direction * radius * cos(localAngle);
        float depth = radius * sin(localAngle) * u_depthRatio;
        float vertical = (a_unit.y - 0.5) * pageHeight;
        vertical += sin(a_unit.x * PI)
            * turnActivity
            * (a_unit.y - 0.5)
            * pageHeight
            * 0.075;

        float perspective = pageWidth * u_perspectiveRatio;
        float perspectiveScale = perspective
            / max(pageWidth * 0.8, perspective - depth);
        vec2 projected = vec2(
            spineX + (localX * perspectiveScale),
            u_pageRect.y + (pageHeight * 0.5) + (vertical * perspectiveScale)
        );
        vec2 clipSpace = ((projected / u_resolution) * 2.0) - 1.0;
        gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);

        float sourceX = spineX + (u_direction * radius);
        float sourceY = u_pageRect.y + (a_unit.y * pageHeight);
        v_sourceUv = vec2(sourceX, sourceY) / u_resolution;
        float grazing = 1.0 - abs(cos(localAngle));
        v_light = 1.0 - (turnActivity * ((grazing * 0.34) + (a_unit.x * 0.08)));
        v_back = smoothstep(0.47, 0.53, progress);
        float edgeDistance = min(
            min(a_unit.x, 1.0 - a_unit.x),
            min(a_unit.y, 1.0 - a_unit.y)
        );
        v_edge = 1.0 - smoothstep(0.0, 0.035, edgeDistance);
    }
`;

const PAGE_FRAGMENT_SHADER = `
    precision highp float;

    varying vec2 v_sourceUv;
    varying float v_light;
    varying float v_back;
    varying float v_edge;

    uniform sampler2D u_pageTexture;
    uniform float u_progress;
    uniform float u_alpha;
    uniform vec3 u_backColor;
    uniform vec3 u_edgeColor;

    void main() {
        vec4 sampled = texture2D(u_pageTexture, v_sourceUv);
        if (sampled.a <= 0.002) {
            discard;
        }
        float finishFade = 1.0 - smoothstep(0.86, 0.985, u_progress);
        float alpha = sampled.a * u_alpha * finishFade;
        vec3 front = sampled.rgb * max(0.42, v_light);
        float paperGrain = 0.985 + (0.015 * sin(
            (v_sourceUv.x * 1733.0) + (v_sourceUv.y * 977.0)
        ));
        vec3 back = u_backColor * paperGrain;
        vec3 surfaceColor = mix(front, back, v_back * 0.92);
        surfaceColor = mix(surfaceColor, u_edgeColor, v_edge * 0.38);
        gl_FragColor = vec4(surfaceColor * alpha, alpha);
    }
`;

const SHADOW_FRAGMENT_SHADER = `
    precision highp float;

    varying vec2 v_uv;

    uniform vec2 u_resolution;
    uniform vec4 u_pageRect;
    uniform float u_progress;
    uniform float u_direction;
    uniform float u_shadowAlpha;
    uniform vec3 u_shadowColor;

    void main() {
        const float PI = 3.14159265359;
        vec2 point = vec2(
            v_uv.x * u_resolution.x,
            (1.0 - v_uv.y) * u_resolution.y
        );
        float pageWidth = max(1.0, u_pageRect.z);
        float pageHeight = max(1.0, u_pageRect.w);
        float spineX = u_direction > 0.0
            ? u_pageRect.x
            : u_pageRect.x + pageWidth;
        float activity = sin(clamp(u_progress, 0.0, 1.0) * PI);
        float edgeX = spineX + (
            u_direction * pageWidth * cos(u_progress * PI)
        );
        float shadowWidth = pageWidth * (0.025 + (activity * 0.12));
        float edgeDistance = (point.x - edgeX) / max(1.0, shadowWidth);
        float edgeShadow = exp(-(edgeDistance * edgeDistance) * 1.8);
        float spineDistance = abs(point.x - spineX) / max(1.0, shadowWidth * 1.4);
        float spineShadow = exp(-(spineDistance * spineDistance) * 1.35) * 0.34;
        float top = u_pageRect.y - (pageHeight * 0.12);
        float bottom = u_pageRect.y + pageHeight + (pageHeight * 0.12);
        float verticalMask = smoothstep(top, top + (pageHeight * 0.08), point.y)
            * (1.0 - smoothstep(bottom - (pageHeight * 0.08), bottom, point.y));
        float horizontalMask = 1.0 - smoothstep(
            pageWidth * 1.02,
            pageWidth * 1.32,
            abs(point.x - spineX)
        );
        float alpha = (edgeShadow + spineShadow)
            * activity
            * verticalMask
            * horizontalMask
            * u_shadowAlpha;
        if (alpha <= 0.002) {
            discard;
        }
        gl_FragColor = vec4(u_shadowColor * alpha, alpha);
    }
`;

/**
 * @class PageTurnEffectPass
 * @description 이전 UI 프레임의 실제 페이지 픽셀을 3D 곡면 메시와 낙하 그림자로 넘깁니다.
 */
export class PageTurnEffectPass {
    /** @param {WebGLRenderingContext} gl - 대상 WebGL 컨텍스트입니다. */
    constructor(gl) {
        this.gl = gl;
        this.pageProgram = this.#createPageProgram();
        this.shadowProgram = this.#createShadowProgram();
        this.mesh = this.#createPageMesh();
        this.fullscreenBuffer = this.#createFullscreenBuffer();
        this.sourceImage = null;
        this.sourceTexture = null;
        this.colorCache = new Map();
    }

    /**
     * 페이지 스냅샷 한 장을 방향·진행도에 맞춰 GPU에서 변형합니다.
     * @param {object} command - 페이지 영역과 재질 명령입니다.
     * @param {number} width - 현재 surface 너비입니다.
     * @param {number} height - 현재 surface 높이입니다.
     */
    draw(command, width, height) {
        const pageRect = this.#resolvePageRect(command?.pageRect);
        const texture = this.#syncTexture(command?.image);
        if (!pageRect || !texture) {
            return;
        }
        const gl = this.gl;
        const renderWidth = Math.max(1, gl.drawingBufferWidth || width);
        const renderHeight = Math.max(1, gl.drawingBufferHeight || height);
        const progress = clamp01(Number(command?.progress) || 0);
        if (progress <= 0 || progress >= 1) {
            return;
        }
        const direction = Number(command?.direction) < 0 ? -1 : 1;
        const scissor = this.#createScissorRect(pageRect, renderWidth, renderHeight);
        if (!scissor) {
            return;
        }

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(scissor.x, renderHeight - scissor.y - scissor.h, scissor.w, scissor.h);
        this.#drawShadow(command, pageRect, progress, direction, renderWidth, renderHeight);
        this.#drawPage(command, pageRect, texture, progress, direction, renderWidth, renderHeight);
        gl.disable(gl.SCISSOR_TEST);
    }

    /** GL 프로그램·버퍼·스냅샷 텍스처를 해제합니다. */
    destroy() {
        const gl = this.gl;
        gl.deleteBuffer(this.mesh?.vertexBuffer);
        gl.deleteBuffer(this.mesh?.indexBuffer);
        gl.deleteBuffer(this.fullscreenBuffer);
        gl.deleteTexture(this.sourceTexture);
        gl.deleteProgram(this.pageProgram?.program);
        gl.deleteProgram(this.shadowProgram?.program);
        this.sourceImage = null;
        this.sourceTexture = null;
        this.colorCache.clear();
    }

    /** @private */
    #drawShadow(command, rect, progress, direction, width, height) {
        const gl = this.gl;
        const info = this.shadowProgram;
        gl.useProgram(info.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.fullscreenBuffer);
        gl.enableVertexAttribArray(info.attributes.a_position);
        gl.vertexAttribPointer(info.attributes.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(info.uniforms.u_resolution, width, height);
        gl.uniform4f(info.uniforms.u_pageRect, rect.x, rect.y, rect.w, rect.h);
        gl.uniform1f(info.uniforms.u_progress, progress);
        gl.uniform1f(info.uniforms.u_direction, direction);
        gl.uniform1f(info.uniforms.u_shadowAlpha, clamp01(
            Number(command?.shadowAlpha) || 0
        ));
        gl.uniform3fv(info.uniforms.u_shadowColor, this.#resolveColor(
            command?.shadowColor,
            [0.17, 0.086, 0.039]
        ));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /** @private */
    #drawPage(command, rect, texture, progress, direction, width, height) {
        const gl = this.gl;
        const info = this.pageProgram;
        gl.useProgram(info.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh.vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.mesh.indexBuffer);
        gl.enableVertexAttribArray(info.attributes.a_unit);
        gl.vertexAttribPointer(info.attributes.a_unit, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(info.uniforms.u_resolution, width, height);
        gl.uniform4f(info.uniforms.u_pageRect, rect.x, rect.y, rect.w, rect.h);
        gl.uniform1f(info.uniforms.u_progress, progress);
        gl.uniform1f(info.uniforms.u_direction, direction);
        gl.uniform1f(info.uniforms.u_curlStrength, Math.min(
            PAGE_TURN_CONSTANTS.MAX_CURL_STRENGTH,
            Math.max(0, Number(command?.curlStrength) || 0)
        ));
        gl.uniform1f(info.uniforms.u_depthRatio, Math.max(
            0,
            Math.min(1, Number(command?.depthRatio) || 0)
        ));
        gl.uniform1f(info.uniforms.u_perspectiveRatio, Math.max(
            PAGE_TURN_CONSTANTS.MIN_PERSPECTIVE_RATIO,
            Math.min(
                PAGE_TURN_CONSTANTS.MAX_PERSPECTIVE_RATIO,
                Number(command?.perspectiveRatio)
                    || PAGE_TURN_CONSTANTS.MIN_PERSPECTIVE_RATIO
            )
        ));
        gl.uniform1f(info.uniforms.u_alpha, clamp01(
            Number.isFinite(Number(command?.alpha)) ? Number(command.alpha) : 1
        ));
        gl.uniform3fv(info.uniforms.u_backColor, this.#resolveColor(
            command?.backColor,
            [0.906, 0.725, 0.471]
        ));
        gl.uniform3fv(info.uniforms.u_edgeColor, this.#resolveColor(
            command?.edgeColor,
            [1, 0.878, 0.659]
        ));
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(info.uniforms.u_pageTexture, 0);
        gl.drawElements(gl.TRIANGLES, this.mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    /** @private */
    #createPageProgram() {
        return this.#createProgramInfo(PAGE_VERTEX_SHADER, PAGE_FRAGMENT_SHADER, [
            'u_resolution', 'u_pageRect', 'u_progress', 'u_direction',
            'u_curlStrength', 'u_depthRatio', 'u_perspectiveRatio', 'u_pageTexture',
            'u_alpha', 'u_backColor', 'u_edgeColor'
        ], ['a_unit']);
    }

    /** @private */
    #createShadowProgram() {
        return this.#createProgramInfo(FULLSCREEN_VERTEX_SHADER, SHADOW_FRAGMENT_SHADER, [
            'u_resolution', 'u_pageRect', 'u_progress', 'u_direction',
            'u_shadowAlpha', 'u_shadowColor'
        ], ['a_position']);
    }

    /** @private */
    #createProgramInfo(vertexSource, fragmentSource, uniformNames, attributeNames) {
        const gl = this.gl;
        const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
        if (!vertexShader || !fragmentShader) {
            throw new Error('PageTurnEffectPass: 셰이더 컴파일에 실패했습니다.');
        }
        const program = createProgram(gl, vertexShader, fragmentShader);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        if (!program) {
            throw new Error('PageTurnEffectPass: 셰이더 링크에 실패했습니다.');
        }
        return {
            program,
            uniforms: Object.fromEntries(uniformNames.map((name) => (
                [name, gl.getUniformLocation(program, name)]
            ))),
            attributes: Object.fromEntries(attributeNames.map((name) => (
                [name, gl.getAttribLocation(program, name)]
            )))
        };
    }

    /** @private */
    #createPageMesh() {
        const gl = this.gl;
        const columns = PAGE_TURN_CONSTANTS.MESH_COLUMNS;
        const rows = PAGE_TURN_CONSTANTS.MESH_ROWS;
        const vertices = [];
        const indices = [];
        for (let row = 0; row <= rows; row++) {
            for (let column = 0; column <= columns; column++) {
                vertices.push(column / columns, row / rows);
            }
        }
        for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
                const topLeft = row * (columns + 1) + column;
                const topRight = topLeft + 1;
                const bottomLeft = topLeft + columns + 1;
                const bottomRight = bottomLeft + 1;
                indices.push(
                    topLeft, topRight, bottomRight,
                    topLeft, bottomRight, bottomLeft
                );
            }
        }
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            new Uint16Array(indices),
            gl.STATIC_DRAW
        );
        return { vertexBuffer, indexBuffer, indexCount: indices.length };
    }

    /** @returns {WebGLBuffer} 풀스크린 그림자 쿼드입니다. @private */
    #createFullscreenBuffer() {
        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1, 1, 1
        ]), this.gl.STATIC_DRAW);
        return buffer;
    }

    /** @private */
    #syncTexture(image) {
        const width = Number(image?.naturalWidth || image?.width);
        const height = Number(image?.naturalHeight || image?.height);
        if (!(width > 0) || !(height > 0)) {
            return null;
        }
        if (image === this.sourceImage && this.sourceTexture) {
            return this.sourceTexture;
        }
        const gl = this.gl;
        gl.deleteTexture(this.sourceTexture);
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
        );
        this.sourceImage = image;
        this.sourceTexture = texture;
        return texture;
    }

    /** @private */
    #resolvePageRect(value) {
        const rect = {
            x: Number(value?.x),
            y: Number(value?.y),
            w: Number(value?.w),
            h: Number(value?.h)
        };
        return Number.isFinite(rect.x)
            && Number.isFinite(rect.y)
            && rect.w >= PAGE_TURN_CONSTANTS.MIN_PAGE_SIZE
            && rect.h >= PAGE_TURN_CONSTANTS.MIN_PAGE_SIZE
            ? rect
            : null;
    }

    /** @private */
    #createScissorRect(rect, width, height) {
        const horizontalPadding = rect.w * 0.38;
        const verticalPadding = rect.h * 0.16;
        const left = Math.max(0, Math.floor(rect.x - rect.w - horizontalPadding));
        const top = Math.max(0, Math.floor(rect.y - verticalPadding));
        const right = Math.min(width, Math.ceil(rect.x + (rect.w * 2) + horizontalPadding));
        const bottom = Math.min(height, Math.ceil(rect.y + rect.h + verticalPadding));
        return right > left && bottom > top
            ? { x: left, y: top, w: right - left, h: bottom - top }
            : null;
    }

    /** @private */
    #resolveColor(value, fallback) {
        if (typeof value !== 'string' || !value) {
            return new Float32Array(fallback);
        }
        if (this.colorCache.has(value)) {
            return this.colorCache.get(value);
        }
        let result;
        try {
            const rgb = colorUtil().cssToRgb(value);
            result = new Float32Array([rgb.r / 255, rgb.g / 255, rgb.b / 255]);
        } catch (_error) {
            result = new Float32Array(fallback);
        }
        this.colorCache.set(value, result);
        return result;
    }
}
