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

const LEGACY_PIXEL_FONT_FAMILY = 'LegacyPixelTest';
const LEGACY_PIXEL_RENDER_DATA = Object.freeze({
    PIXEL_CACHE_LIMIT: 384,
    PIXEL_PADDING: 2,
    MAX_RASTER_WIDTH: 4096,
    MAX_RASTER_HEIGHT: 512,
    PIXEL_PROFILES: Object.freeze([
        Object.freeze({
            ID: 'legacy-pixel-test',
            FONT_FAMILY: LEGACY_PIXEL_FONT_FAMILY,
            PIXEL_SIZE: 2,
            SMALL_FONT_MAX_PX: 22,
            SMALL_PIXEL_SIZE: 1,
            ALPHA_THRESHOLD: 182
        })
    ])
});
const FONT = `400 24px ${LEGACY_PIXEL_FONT_FAMILY}, sans-serif`;

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
        ...LEGACY_PIXEL_RENDER_DATA,
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
    assert.equal(LEGACY_PIXEL_RENDER_DATA.PIXEL_PROFILES[0].ALPHA_THRESHOLD, 182);
    assert.equal(getCanvasFontSize(FONT), 24);
    assert.equal(scaleCanvasFontSize(FONT, 0.5), '400 12px LegacyPixelTest, sans-serif');
    assert.equal(getCanvasFontSize('bold serif'), null);
    assert.equal(scaleCanvasFontSize('bold serif', 0.5), null);
});

test('분리된 레거시 도트 렌더러는 측정과 렌더 배율을 맞추고 래스터를 재사용한다', () => {
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

test('분리된 레거시 도트 렌더러는 작은 글자를 1px 격자로 유지하고 다른 폰트를 거부한다', () => {
    const { renderer, canvases } = createRenderer();
    const target = new FakeCanvas().context;
    assert.equal(renderer.render(target, {
        text: '작게',
        x: 10,
        y: 10,
        font: '400 18px LegacyPixelTest, sans-serif',
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
    assert.deepEqual(
        requests.map(({ font }) => font),
        [
            '400 24px PFStardust',
            '700 24px PFStardust',
            '800 24px PFStardust'
        ]
    );
    for (const request of requests) {
        assert.match(request.sample, /가나다/);
    }

    assert.equal(await waitForFontFaces(TEXT_RENDER_DATA.FONT_FACES, {
        fontSet: { load: async () => [] },
        timeoutMs: 50
    }), false);
});

test('튜토리얼 타이포그래피는 중요도에 따라 PF 스타더스트 굵기를 구분한다', () => {
    for (const spec of Object.values(TUTORIAL_GAME_DATA.TYPOGRAPHY)) {
        assert.equal(spec.FAMILY, 'PFStardust, sans-serif');
    }
    assert.deepEqual(
        Object.fromEntries(Object.entries(TUTORIAL_GAME_DATA.TYPOGRAPHY)
            .map(([name, spec]) => [name, spec.WEIGHT])),
        {
            TITLE: 800,
            SUBTITLE: 700,
            HEADING: 800,
            BODY: 400,
            SMALL: 400,
            BUTTON: 700,
            MONO: 700
        }
    );
});

test('런타임 PF 스타더스트 3종은 사용자 제공 원본 바이트를 그대로 보존한다', async () => {
    const expectedFonts = [
        ['PFStardustS.ttf', 653384, 'BFA5ABD54051F5A31A1D3E885BEA589CCB0E71FBA833097FAFDEC27E6C4D54DE'],
        ['PFStardustBold.ttf', 688124, 'D23021D127C8E020843B5A39D3FA27B4A92D62598F06DC541538318FD0A4F4C1'],
        ['PFStardustExtraBold.ttf', 690328, '00FBBC852D15A5A5F6189D32BB31AB3AD74EE2DE5AB949947F562371F48C38EC']
    ];
    for (const [fileName, length, sha256] of expectedFonts) {
        const font = await readFile(new URL(
            `../project/asset/font/${fileName}`,
            import.meta.url
        ));
        assert.equal(font.length, length);
        assert.equal(
            createHash('sha256').update(font).digest('hex').toUpperCase(),
            sha256
        );
    }
});

test('게임 그리기 경로는 도트 렌더러를 연결하지 않는다', async () => {
    const drawHandlerSource = await readFile(new URL(
        '../project/engine/script/display/_draw_handler_2d.js',
        import.meta.url
    ), 'utf8');
    assert.doesNotMatch(drawHandlerSource, /PixelTextRenderer|_pixel_text_renderer/);
    assert.match(drawHandlerSource, /case 'text':\s*renderDrawText\(context, options\);/);
});
