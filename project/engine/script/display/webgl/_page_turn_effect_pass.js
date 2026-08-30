import { getData } from 'data/data_handler.js';
import { colorUtil } from 'util/color_util.js';
import { clamp01 } from 'util/number_util.js';
import {
    compileShader,
    createProgram,
    FULLSCREEN_VERTEX_SHADER
} from './_shader_utils.js';
import {
    PAGE_VERTEX_SHADER,
    PAGE_FRAGMENT_SHADER,
    SHADOW_FRAGMENT_SHADER,
    SPREAD_FRAGMENT_SHADER
} from './_page_turn_effect_shaders.js';

const PAGE_TURN_CONSTANTS = getData('EFFECT_RENDER_CONSTANTS').PAGE_TURN;

/**
 * @class PageTurnEffectPass
 * @description 이전·다음 콘텐츠를 고정 페이지와 양면 3D 곡면 메시로 나누어 넘깁니다.
 */
export class PageTurnEffectPass {
    /** @param {WebGLRenderingContext} gl - 대상 WebGL 컨텍스트입니다. */
    constructor(gl) {
        this.gl = gl;
        this.pageProgram = this.#createPageProgram();
        this.shadowProgram = this.#createShadowProgram();
        this.spreadProgram = this.#createSpreadProgram();
        this.mesh = this.#createPageMesh();
        this.fullscreenBuffer = this.#createFullscreenBuffer();
        this.textureSlots = new Map();
        this.colorCache = new Map();
    }

    /**
     * 이전·다음 책 스냅샷의 양면을 방향·진행도에 맞춰 GPU에서 변형합니다.
     * @param {object} command - 페이지 영역과 재질 명령입니다.
     * @param {number} width - 현재 surface 너비입니다.
     * @param {number} height - 현재 surface 높이입니다.
     */
    draw(command, width, height) {
        const pageRect = this.#resolvePageRect(command?.pageRect);
        const backPageRect = this.#resolvePageRect(command?.backPageRect);
        const textures = {
            front: this.#syncTexture(command?.image, 'front'),
            back: this.#syncTexture(command?.backImage, 'back')
        };
        if (!pageRect || !backPageRect || !textures.front || !textures.back) {
            return;
        }
        const gl = this.gl;
        const renderWidth = Math.max(1, gl.drawingBufferWidth || width);
        const renderHeight = Math.max(1, gl.drawingBufferHeight || height);
        const progress = clamp01(Number(command?.progress) || 0);
        const direction = Number(command?.direction) < 0 ? -1 : 1;
        const scissor = this.#createScissorRect(pageRect, renderWidth, renderHeight);
        if (!scissor) {
            return;
        }

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.SCISSOR_TEST);
        this.#drawSpread(command, pageRect, textures, direction, renderWidth, renderHeight);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(scissor.x, renderHeight - scissor.y - scissor.h, scissor.w, scissor.h);
        this.#drawShadow(command, pageRect, progress, direction, renderWidth, renderHeight);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        this.#drawPage(command, pageRect, backPageRect, textures, progress, direction, renderWidth, renderHeight);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.SCISSOR_TEST);
    }

    /** GL 프로그램·버퍼·스냅샷 텍스처를 해제합니다. */
    destroy() {
        const gl = this.gl;
        gl.deleteBuffer(this.mesh?.vertexBuffer);
        gl.deleteBuffer(this.mesh?.indexBuffer);
        gl.deleteBuffer(this.fullscreenBuffer);
        for (const slot of this.textureSlots.values()) {
            gl.deleteTexture(slot.texture);
        }
        this.textureSlots.clear();
        gl.deleteProgram(this.pageProgram?.program);
        gl.deleteProgram(this.shadowProgram?.program);
        gl.deleteProgram(this.spreadProgram?.program);
        this.colorCache.clear();
    }

    /** 고정 면은 이전 목적 페이지와 새 출발 페이지를 각각 한 번만 합성합니다. @private */
    #drawSpread(command, rect, textures, direction, width, height) {
        const gl = this.gl;
        const info = this.spreadProgram;
        gl.useProgram(info.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.fullscreenBuffer);
        gl.enableVertexAttribArray(info.attributes.a_position);
        gl.vertexAttribPointer(info.attributes.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(info.uniforms.u_resolution, width, height);
        gl.uniform4f(info.uniforms.u_pageRect, rect.x, rect.y, rect.w, rect.h);
        gl.uniform1f(info.uniforms.u_direction, direction);
        gl.uniform1f(info.uniforms.u_alpha, this.#resolveAlpha(command));
        this.#bindTextures(info, textures);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
    #drawPage(command, rect, backRect, textures, progress, direction, width, height) {
        const gl = this.gl;
        const info = this.pageProgram;
        gl.useProgram(info.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh.vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.mesh.indexBuffer);
        gl.enableVertexAttribArray(info.attributes.a_unit);
        gl.vertexAttribPointer(info.attributes.a_unit, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(info.uniforms.u_resolution, width, height);
        gl.uniform4f(info.uniforms.u_pageRect, rect.x, rect.y, rect.w, rect.h);
        gl.uniform4f(info.uniforms.u_backPageRect, backRect.x, backRect.y, backRect.w, backRect.h);
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
        gl.uniform1f(info.uniforms.u_alpha, this.#resolveAlpha(command));
        gl.uniform3fv(info.uniforms.u_backColor, this.#resolveColor(
            command?.backColor,
            [0.906, 0.725, 0.471]
        ));
        gl.uniform3fv(info.uniforms.u_edgeColor, this.#resolveColor(
            command?.edgeColor,
            [1, 0.878, 0.659]
        ));
        this.#bindTextures(info, textures);
        gl.drawElements(gl.TRIANGLES, this.mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    /** @private */
    #createPageProgram() {
        return this.#createProgramInfo(PAGE_VERTEX_SHADER, PAGE_FRAGMENT_SHADER, [
            'u_resolution', 'u_pageRect', 'u_backPageRect', 'u_progress', 'u_direction',
            'u_curlStrength', 'u_depthRatio', 'u_perspectiveRatio', 'u_pageTexture',
            'u_backTexture', 'u_alpha', 'u_backColor', 'u_edgeColor'
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
    #createSpreadProgram() {
        return this.#createProgramInfo(FULLSCREEN_VERTEX_SHADER, SPREAD_FRAGMENT_SHADER, [
            'u_resolution', 'u_pageRect', 'u_direction', 'u_alpha',
            'u_pageTexture', 'u_backTexture'
        ], ['a_position']);
    }

    /** @private */
    #bindTextures(info, textures) {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures.front);
        gl.uniform1i(info.uniforms.u_pageTexture, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, textures.back);
        gl.uniform1i(info.uniforms.u_backTexture, 1);
    }

    /** @param {object} command @returns {number} 정규화된 불투명도입니다. @private */
    #resolveAlpha(command) {
        return clamp01(Number.isFinite(Number(command?.alpha)) ? Number(command.alpha) : 1);
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
    #syncTexture(image, slotName) {
        const width = Number(image?.naturalWidth || image?.width);
        const height = Number(image?.naturalHeight || image?.height);
        if (!(width > 0) || !(height > 0)) {
            return null;
        }
        const slot = this.textureSlots.get(slotName);
        if (image === slot?.image && slot.texture) {
            return slot.texture;
        }
        const gl = this.gl;
        gl.deleteTexture(slot?.texture || null);
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
        );
        this.textureSlots.set(slotName, { image, texture });
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
            && Number.isFinite(rect.w)
            && Number.isFinite(rect.h)
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
