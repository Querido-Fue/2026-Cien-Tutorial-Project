import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { TEXT_RENDER_DATA } from '../project/engine/script/data/display/text_render_data.js';
import { TUTORIAL_GAME_DATA } from '../project/engine/script/data/game/tutorial_game_data.js';
import {
    getCanvasFontSize,
    PixelTextRenderer,
    scaleCanvasFontSize
} from '../project/engine/script/display/_pixel_text_renderer.js';
import { waitForFontFaces } from '../project/engine/script/util/font_util.js';

const FONT = '400 24px OwnglyphParkDahyun, sans-serif';

class FakeCanvasContext {
    constructor(canvas) {
        this.canvas = canvas;
        this.font = '10px sans-serif';
        this.textAlign = 'start';
        this.textBaseline = 'alphabetic';
        this.fillStyle = '#ffffff';
        this.imageSmoothingEnabled = true;
        this.drawCalls = [];
        this.fillCalls = [];
        this.putImageDataCalls = [];
        this.stack = [];
    }

    measureText(value) {
        const size = getCanvasFontSize(this.font) || 10;
        const width = Array.from(String(value)).length * size * 0.5;
        let left = 0;
        let right = width;
        if (this.textAlign === 'center') {
            left = width * 0.5;
            right = width * 0.5;
        } else if (this.textAlign === 'right' || this.textAlign === 'end') {
            left = width;
            right = 0;
        }
        return {
            width,
            actualBoundingBoxLeft: left,
            actualBoundingBoxRight: right,
            actualBoundingBoxAscent: size * 0.8,
            actualBoundingBoxDescent: size * 0.2
        };
    }

    fillText(...args) {
        this.fillCalls.push(args);
    }

    getImageData(x, y, width, height) {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let index = 3; index < data.length; index += 4) {
            data[index] = index % 8 === 3 ? 40 : 220;
        }
        return { data, width, height };
    }

    putImageData(imageData, x, y) {
        this.putImageDataCalls.push({ imageData, x, y });
    }

    save() {
        this.stack.push({ imageSmoothingEnabled: this.imageSmoothingEnabled });
    }

    restore() {
        const state = this.stack.pop();
        this.imageSmoothingEnabled = state?.imageSmoothingEnabled ?? true;
    }

    translate(x, y) {
        this.drawCalls.push({ type: 'translate', x, y });
    }

    rotate(radians) {
        this.drawCalls.push({ type: 'rotate', radians });
    }

    drawImage(...args) {
        this.drawCalls.push({ type: 'drawImage', args });
    }
}

class FakeCanvas {
    constructor() {
        this.width = 1;
        this.height = 1;
        this.context = new FakeCanvasContext(this);
    }

    getContext(type) {
        return type === '2d' ? this.context : null;
    }
}

function createRenderer(overrides = {}) {
    const canvases = [];
    const renderer = new PixelTextRenderer({
        ...TEXT_RENDER_DATA,
        ...overrides
    }, {
        createCanvas: () => {
            const canvas = new FakeCanvas();
            canvases.push(canvas);
            return canvas;
        }
    });
    return { renderer, canvases };
}

test('Canvas font 크기를 읽고 저해상도 래스터 크기로 변환한다', () => {
    assert.equal(TEXT_RENDER_DATA.PIXEL_PROFILES[0].ALPHA_THRESHOLD, 182);
    assert.equal(getCanvasFontSize(FONT), 24);
    assert.equal(scaleCanvasFontSize(FONT, 0.5), '400 12px OwnglyphParkDahyun, sans-serif');
    assert.equal(getCanvasFontSize('bold serif'), null);
    assert.equal(scaleCanvasFontSize('bold serif', 0.5), null);
});

test('박다현체의 측정 폭과 렌더가 같은 도트 배율을 사용하고 래스터를 재사용한다', () => {
    const { renderer, canvases } = createRenderer();
    const measuredWidth = renderer.measureWidth('가나', FONT);
    assert.equal(measuredWidth, 24);
    assert.equal(renderer.measureWidth('가나', '400 24px Arial'), null);

    const target = new FakeCanvas().context;
    const command = {
        shape: 'text',
        text: '가나',
        x: 100,
        y: 50,
        font: FONT,
        fill: '#fefefe',
        align: 'center',
        baseline: 'middle'
    };
    assert.equal(renderer.render(target, command), true);
    assert.equal(renderer.render(target, command), true);
    assert.equal(canvases.length, 2, '측정 Canvas와 캐시된 문자열 Canvas만 생성해야 합니다.');

    const rasterCanvas = canvases[1];
    const imageCalls = target.drawCalls.filter(({ type }) => type === 'drawImage');
    assert.equal(imageCalls.length, 2);
    assert.equal(imageCalls[0].args[0], rasterCanvas);
    assert.equal(imageCalls[0].args[3], rasterCanvas.width * 2);
    assert.equal(imageCalls[0].args[4], rasterCanvas.height * 2);
    assert.equal(target.imageSmoothingEnabled, true, '최근접 설정은 렌더 뒤 복원해야 합니다.');

    const thresholded = rasterCanvas.context.putImageDataCalls[0].imageData.data;
    const alphas = [];
    for (let index = 3; index < thresholded.length; index += 4) {
        alphas.push(thresholded[index]);
    }
    assert.deepEqual(new Set(alphas), new Set([0, 255]));
});

test('작은 박다현체는 1px 격자로 유지하고 다른 폰트는 기존 렌더에 맡긴다', () => {
    const { renderer, canvases } = createRenderer();
    const target = new FakeCanvas().context;
    assert.equal(renderer.render(target, {
        text: '작게',
        x: 10,
        y: 10,
        font: '400 18px OwnglyphParkDahyun, sans-serif',
        fill: '#ffffff'
    }), true);
    const rasterCanvas = canvases[1];
    const imageCall = target.drawCalls.find(({ type }) => type === 'drawImage');
    assert.equal(imageCall.args[3], rasterCanvas.width);

    assert.equal(renderer.render(target, {
        text: '기본',
        x: 10,
        y: 10,
        font: '400 18px Arial',
        fill: '#ffffff'
    }), false);
});

test('웹폰트 로더는 선언된 굵기와 샘플을 요청하고 실패를 안전하게 반환한다', async () => {
    const requests = [];
    const loaded = await waitForFontFaces(TEXT_RENDER_DATA.FONT_FACES, {
        fontSet: {
            async load(font, sample) {
                requests.push({ font, sample });
                return [{}];
            }
        },
        timeoutMs: 50
    });
    assert.equal(loaded, true);
    assert.equal(requests.length, 1);
    assert.match(requests[0].font, /^400 24px OwnglyphParkDahyun/);
    assert.match(requests[0].sample, /가나다/);

    assert.equal(await waitForFontFaces(TEXT_RENDER_DATA.FONT_FACES, {
        fontSet: { load: async () => [] },
        timeoutMs: 50
    }), false);
});

test('튜토리얼 타이포그래피는 Regular 박다현체만 사용한다', () => {
    for (const spec of Object.values(TUTORIAL_GAME_DATA.TYPOGRAPHY)) {
        assert.equal(spec.FAMILY, 'OwnglyphParkDahyun, sans-serif');
        assert.equal(spec.WEIGHT, 400);
    }
});

test('런타임 폰트는 사용자 제공 원본 바이트를 그대로 보존한다', async () => {
    const font = await readFile(new URL(
        '../project/asset/font/OwnglyphParkDahyun.ttf',
        import.meta.url
    ));
    assert.equal(font.length, 2026460);
    assert.equal(
        createHash('sha256').update(font).digest('hex').toUpperCase(),
        'FBCC7E2E16ABD0C9192AFF6561871AB95C369BC58284879E813055BDE7C5568F'
    );
});
