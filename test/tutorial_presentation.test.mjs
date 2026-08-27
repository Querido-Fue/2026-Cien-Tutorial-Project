import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { TUTORIAL_GAME_DATA } from '../project/engine/script/data/game/tutorial_game_data.js';
import { TutorialAnimationTimeline } from '../project/engine/script/scene/tutorial/_tutorial_animation_timeline.js';
import { TutorialAssetLoader } from '../project/engine/script/scene/tutorial/_tutorial_asset_loader.js';
import { TutorialBattlePresenter } from '../project/engine/script/scene/tutorial/_tutorial_battle_presenter.js';
import { TutorialFeedbackQueue } from '../project/engine/script/scene/tutorial/_tutorial_feedback_queue.js';
import {
    TUTORIAL_AUDIO_CUE_IDS,
    TUTORIAL_MODEL_EVENT_TYPES,
    TUTORIAL_PRESENTATION_CUE_TYPES
} from '../project/engine/script/scene/tutorial/_tutorial_presentation_contract.js';

/** @param {object} values @returns {object} 프레젠터 입력 스냅샷입니다. */
function createSnapshot(values = {}) {
    return {
        floorIndex: values.floorIndex ?? 0,
        player: { x: 4, y: 4, hp: values.playerHp ?? 100, maxHp: 100 },
        lora: {
            x: 4,
            y: 0,
            hp: values.loraHp ?? 100,
            maxHp: 100,
            instability: values.instability ?? 70
        }
    };
}

test('모델의 전체 이벤트 타입이 명시적 프레젠테이션 계약과 일치한다', async () => {
    const source = await readFile(new URL(
        '../project/engine/script/scene/tutorial/_tutorial_battle_model.js',
        import.meta.url
    ), 'utf8');
    const extracted = Array.from(source.matchAll(/#createEvent\('([^']+)'/g))
        .map((match) => match[1])
        .filter((type, index, values) => values.indexOf(type) === index)
        .sort();
    assert.deepEqual(extracted, [...TUTORIAL_MODEL_EVENT_TYPES].sort());
    assert.equal(Object.isFrozen(TUTORIAL_MODEL_EVENT_TYPES), true);
});

test('대표 모델 이벤트는 같은 입력에서 같은 직렬화 가능한 cue를 만든다', () => {
    const presenter = new TutorialBattlePresenter({
        items: TUTORIAL_GAME_DATA.ITEMS,
        animation: TUTORIAL_GAME_DATA.ANIMATION
    });
    const input = {
        previousSnapshot: createSnapshot(),
        nextSnapshot: createSnapshot({
            floorIndex: 1,
            playerHp: 90,
            loraHp: 50,
            instability: 60
        }),
        path: [{ x: 4, y: 4 }, { x: 4, y: 3 }],
        events: [
            { type: 'player-damaged', amount: 20, hp: 80 },
            { type: 'player-healed', amount: 10, hp: 90 },
            { type: 'lora-damaged', damage: 50, hp: 50 },
            { type: 'instability-changed', before: 70, after: 60, change: -10 },
            { type: 'item-picked', itemId: 'music-box', x: 8, y: 2 },
            { type: 'item-used', itemId: 'music-box' },
            { type: 'teleported', from: { x: 0, y: 0 }, to: { x: 8, y: 7 } },
            { type: 'floor-transition', floorIndex: 1, player: { x: 4, y: 4 } },
            { type: 'battle-finished', outcome: 'success', reason: 'lora-neutralized' }
        ]
    };
    const before = JSON.stringify(input);
    const first = presenter.createCues(input);
    const second = presenter.createCues(input);
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(input), before);
    assert.doesNotThrow(() => JSON.stringify(first));
    assert.equal(Object.isFrozen(first), true);

    const types = new Set(first.map(({ type }) => type));
    for (const expected of [
        TUTORIAL_PRESENTATION_CUE_TYPES.EVENT_LOG,
        TUTORIAL_PRESENTATION_CUE_TYPES.FLOATING_TEXT,
        TUTORIAL_PRESENTATION_CUE_TYPES.HEALTH_TRANSITION,
        TUTORIAL_PRESENTATION_CUE_TYPES.INSTABILITY_TRANSITION,
        TUTORIAL_PRESENTATION_CUE_TYPES.ACTOR_ANIMATION,
        TUTORIAL_PRESENTATION_CUE_TYPES.SCREEN_SHAKE,
        TUTORIAL_PRESENTATION_CUE_TYPES.FLASH,
        TUTORIAL_PRESENTATION_CUE_TYPES.STABILIZE,
        TUTORIAL_PRESENTATION_CUE_TYPES.PATH_PARTICLES,
        TUTORIAL_PRESENTATION_CUE_TYPES.AUDIO
    ]) {
        assert.equal(types.has(expected), true, `${expected} cue가 없습니다.`);
    }
    const audioIds = first
        .filter(({ type }) => type === TUTORIAL_PRESENTATION_CUE_TYPES.AUDIO)
        .map(({ id }) => id);
    for (const expected of [
        TUTORIAL_AUDIO_CUE_IDS.DAMAGE,
        TUTORIAL_AUDIO_CUE_IDS.HEAL,
        TUTORIAL_AUDIO_CUE_IDS.ITEM_PICKUP,
        TUTORIAL_AUDIO_CUE_IDS.ITEM_USE,
        TUTORIAL_AUDIO_CUE_IDS.TELEPORT,
        TUTORIAL_AUDIO_CUE_IDS.FLOOR_TRANSITION,
        TUTORIAL_AUDIO_CUE_IDS.BATTLE_RESULT
    ]) {
        assert.equal(audioIds.includes(expected), true, `${expected} audio cue가 없습니다.`);
    }
});

test('피드백 큐는 cue 순서와 수명을 소유하고 오디오를 별도로 drain한다', () => {
    const presenter = new TutorialBattlePresenter({
        items: TUTORIAL_GAME_DATA.ITEMS,
        animation: TUTORIAL_GAME_DATA.ANIMATION
    });
    const cues = presenter.createCues({
        previousSnapshot: createSnapshot(),
        nextSnapshot: createSnapshot({ playerHp: 80, instability: 60 }),
        path: [{ x: 4, y: 4 }, { x: 4, y: 3 }],
        events: [
            { type: 'player-damaged', amount: 20, hp: 80 },
            { type: 'instability-changed', before: 70, after: 60, change: -10 }
        ]
    });
    const queue = new TutorialFeedbackQueue({
        eventLogLimit: 8,
        particleCount: 4,
        particleSeconds: 0.5
    });
    const ordered = queue.enqueue(cues, {
        actors: {
            player: { x: 4, y: 4 },
            lora: { x: 4, y: 0 }
        },
        projectTile: ({ x, y }) => ({ x: x * 10, y: y * 10 }),
        tileSide: 20,
        colors: {
            danger: '#f00',
            success: '#0f0',
            accent: '#fff',
            move: '#0ff'
        }
    });
    assert.deepEqual(
        ordered.map(({ sequence }) => sequence),
        ordered.map((_, index) => index)
    );
    const active = queue.getSnapshot();
    assert.equal(active.floatingTexts.length, 1);
    assert.equal(active.particles.length, 4);
    assert.ok(active.screenShakeSeconds > 0);
    assert.ok(active.flashSeconds > 0);
    assert.ok(active.stabilizeSeconds > 0);
    assert.ok(active.eventLog.length > 0);
    assert.ok(queue.drainAudioCues().length > 0);
    assert.equal(queue.drainAudioCues().length, 0);

    queue.update(10);
    assert.equal(queue.getSnapshot().floatingTexts.length, 0);
    assert.equal(queue.getSnapshot().particles.length, 0);
    queue.clear();
    assert.equal(queue.getSnapshot().eventLog.length, 0);
});

test('애니메이션 타임라인은 완료와 취소 경계에서 입력 잠금을 해제한다', async () => {
    let nextId = 0;
    const removed = [];
    const timeline = new TutorialAnimationTimeline({
        config: TUTORIAL_GAME_DATA.ANIMATION,
        animationPort: {
            animate(owner, properties) {
                owner[properties.variable] = properties.endValue;
                return { id: nextId++, promise: Promise.resolve() };
            },
            remove(id) {
                removed.push(id);
            }
        }
    });
    timeline.startAction(0.1);
    assert.equal(timeline.isLocked(), true);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(timeline.isLocked(), false);

    timeline.startPlayerPath({
        path: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        finalPlayer: { x: 1, y: 0 }
    });
    timeline.cancel();
    await Promise.resolve();
    assert.equal(timeline.isLocked(), false);
    assert.ok(removed.length > 0);
    timeline.destroy();
});

test('애니메이션 타임라인은 겹친 연출이 모두 끝날 때까지 잠금을 유지한다', async () => {
    let nextId = 0;
    const completions = new Map();
    const timeline = new TutorialAnimationTimeline({
        config: TUTORIAL_GAME_DATA.ANIMATION,
        animationPort: {
            animate(owner, properties) {
                const id = nextId++;
                const promise = new Promise((resolve) => {
                    completions.set(id, () => {
                        owner[properties.variable] = properties.endValue;
                        resolve();
                    });
                });
                return { id, promise };
            },
            remove(id) {
                completions.get(id)?.();
            }
        }
    });
    timeline.startAction(0.1);
    timeline.startFloorTransition({
        target: { x: 4, y: 4 },
        floorIndex: 1
    });
    completions.get(0)?.();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(timeline.isLocked(), true);

    timeline.cancel();
    await Promise.resolve();
    assert.equal(timeline.isLocked(), false);
    timeline.destroy();
});

test('에셋 로더는 주입 팩토리로 readiness, atlas, 실패와 destroy를 관리한다', () => {
    const images = [];
    class FakeImage {
        constructor() {
            this.complete = false;
            this.naturalWidth = 0;
            this.naturalHeight = 0;
            this.onload = null;
            this.onerror = null;
            images.push(this);
        }

        set src(value) {
            this.source = value;
        }

        succeed(width, height) {
            this.complete = true;
            this.naturalWidth = width;
            this.naturalHeight = height;
            this.onload?.();
        }

        fail() {
            this.onerror?.();
        }
    }
    const drawCalls = [];
    const canvasFactory = () => ({
        width: 0,
        height: 0,
        getContext: () => ({
            imageSmoothingEnabled: false,
            clearRect() {},
            drawImage(...args) {
                drawCalls.push(args);
            }
        })
    });
    const loader = new TutorialAssetLoader({
        imageFactory: () => new FakeImage(),
        canvasFactory
    });
    loader.loadImage('portrait', 'portrait.png');
    loader.loadAtlas('items', 'items.png', {
        COLUMNS: 2,
        ROWS: 1,
        CELLS: {
            first: { COLUMN: 0, ROW: 0 },
            second: { COLUMN: 1, ROW: 0 }
        }
    });
    loader.loadImage('failed', 'missing.png');
    assert.equal(loader.getStatus('portrait'), 'loading');
    images[0].succeed(20, 20);
    images[1].succeed(40, 20);
    images[2].fail();
    assert.equal(loader.isReady('portrait'), true);
    assert.equal(loader.hasAtlasCell('items', 'first'), true);
    assert.equal(loader.hasAtlasCell('items', 'second'), true);
    assert.equal(drawCalls.length, 2);
    assert.equal(loader.getStatus('failed'), 'failed');
    assert.equal(loader.getImage('failed'), null);
    assert.equal(loader.getSnapshot().items.atlasCellCount, 2);

    loader.destroy();
    assert.equal(images.every((image) => image.onload === null && image.onerror === null), true);
    assert.equal(loader.getStatus('portrait'), 'missing');
});

test('프레젠테이션 모듈은 장면·모델·저장·명령 큐를 역참조하지 않는다', async () => {
    const names = [
        '_tutorial_presentation_contract.js',
        '_tutorial_battle_presenter.js',
        '_tutorial_feedback_queue.js',
        '_tutorial_animation_timeline.js',
        '_tutorial_asset_loader.js'
    ];
    const sources = await Promise.all(names.map((name) => readFile(new URL(
        `../project/engine/script/scene/tutorial/${name}`,
        import.meta.url
    ), 'utf8')));
    for (const [index, source] of sources.entries()) {
        for (const forbidden of [
            '_tutorial_scene.js',
            '_tutorial_battle_model.js',
            '_tutorial_meta_progress.js',
            'simulation_command_queue.js'
        ]) {
            assert.equal(source.includes(forbidden), false, `${names[index]} -> ${forbidden}`);
        }
        const classCount = (source.match(/export class /g) || []).length;
        assert.ok(classCount <= 1, `${names[index]}에 클래스가 ${classCount}개 있습니다.`);
    }
});
