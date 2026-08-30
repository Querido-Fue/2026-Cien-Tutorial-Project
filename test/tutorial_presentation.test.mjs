import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { TUTORIAL_GAME_DATA } from '../project/engine/script/data/game/tutorial_game_data.js';
import { TutorialAnimationTimeline } from '../project/engine/script/scene/tutorial/_tutorial_animation_timeline.js';
import { TutorialBattleCamera } from '../project/engine/script/scene/tutorial/_tutorial_battle_camera.js';
import { TutorialAssetLoader } from '../project/engine/script/scene/tutorial/_tutorial_asset_loader.js';
import { TutorialBattlePresenter } from '../project/engine/script/scene/tutorial/_tutorial_battle_presenter.js';
import { TutorialFeedbackQueue } from '../project/engine/script/scene/tutorial/_tutorial_feedback_queue.js';
import { TutorialBattleFeedbackView } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_feedback_view.js';
import {
    TUTORIAL_AUDIO_CUE_IDS,
    TUTORIAL_MODEL_EVENT_TYPES,
    TUTORIAL_PRESENTATION_CUE_TYPES
} from '../project/engine/script/scene/tutorial/_tutorial_presentation_contract.js';

/** @param {object} values @returns {object} 프레젠터 입력 스냅샷입니다. */
function createSnapshot(values = {}) {
    return {
        floorIndex: values.floorIndex ?? 0,
        player: {
            x: values.playerX ?? 4,
            y: values.playerY ?? 4,
            hp: values.playerHp ?? 100,
            maxHp: 100
        },
        lora: {
            x: values.loraX ?? 4,
            y: values.loraY ?? 0,
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
            { type: 'record-picked', recordId: 'lora-diary:1', x: 3, y: 4 },
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
        TUTORIAL_AUDIO_CUE_IDS.PLAYER_HURT,
        TUTORIAL_AUDIO_CUE_IDS.PLAYER_HEAL,
        TUTORIAL_AUDIO_CUE_IDS.LORA_HURT,
        TUTORIAL_AUDIO_CUE_IDS.ITEM_EQUIP,
        TUTORIAL_AUDIO_CUE_IDS.ITEM_APPLY,
        TUTORIAL_AUDIO_CUE_IDS.TELEPORT,
        TUTORIAL_AUDIO_CUE_IDS.FLOOR_BREAK
    ]) {
        assert.equal(audioIds.includes(expected), true, `${expected} audio cue가 없습니다.`);
    }
    assert.equal(first.some((cue) => (
        cue.type === TUTORIAL_PRESENTATION_CUE_TYPES.EVENT_LOG
        && cue.sourceEventType === 'record-picked'
        && cue.message === '기록 획득'
    )), true);
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
    assert.equal(active.floatingTexts.length, 2);
    const expectedParticleCount = cues
        .filter((cue) => cue.type === TUTORIAL_PRESENTATION_CUE_TYPES.PATH_PARTICLES)
        .reduce((total, cue) => total + (Number(cue.count) || 4), 0);
    assert.equal(active.particles.length, expectedParticleCount);
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

test('이동 단계 아이템 거절은 정확한 HUD 안내로 노출되고 수명 후 사라진다', () => {
    const presenter = new TutorialBattlePresenter({
        animation: TUTORIAL_GAME_DATA.ANIMATION
    });
    const cues = presenter.createCues({
        previousSnapshot: createSnapshot(),
        nextSnapshot: createSnapshot(),
        failureReason: 'movement-command-required'
    });
    const noticeCue = cues.find((cue) => (
        cue.type === TUTORIAL_PRESENTATION_CUE_TYPES.HUD_NOTICE
    ));
    assert.equal(noticeCue.message, '이동 명령 후 사용해주세요');
    assert.equal(cues.some((cue) => (
        cue.type === TUTORIAL_PRESENTATION_CUE_TYPES.FLOATING_TEXT
    )), false);

    const queue = new TutorialFeedbackQueue();
    queue.enqueue(cues);
    assert.deepEqual(
        queue.getSnapshot().notices.map(({ message }) => message),
        ['이동 명령 후 사용해주세요']
    );
    queue.update(noticeCue.duration);
    assert.equal(queue.getSnapshot().notices.length, 0);
});

test('HUD 안내 텍스트는 배경보다 위의 UI 레이어에 그린다', () => {
    const commands = [];
    const view = new TutorialBattleFeedbackView({
        render: (layer, command) => commands.push({ layer, ...command }),
        renderGL() {}
    });
    view.draw({
        snapshot: { floorIndex: 0 },
        world: { presentation: { floorIndex: 0 } },
        feedback: {
            particles: [],
            floatingTexts: [],
            notices: [{
                message: '이동 명령 후 사용해주세요',
                seconds: 0.3,
                duration: 1.6
            }]
        },
        layout: {
            viewport: { WW: 1280, WH: 720, UIWW: 1280, UIOffsetX: 0 }
        },
        colors: {
            UI: {
                ButtonIdle: '#173650',
                Danger: '#ff6979',
                Border: '#52dbff',
                Text: '#e9f7fb'
            },
            Effects: { Move: '#5ce5ff' }
        },
        fonts: { SMALL: '16px sans-serif', BODY: '18px sans-serif' }
    });

    assert.deepEqual(commands.map(({ layer, shape }) => [layer, shape]), [
        ['texteffect', 'roundRect'],
        ['ui', 'text']
    ]);
});

test('플레이어·로라 공격 cue는 피해 대상 연출에 impact 동기화 정보를 전달한다', () => {
    const presenter = new TutorialBattlePresenter({
        items: TUTORIAL_GAME_DATA.ITEMS,
        animation: TUTORIAL_GAME_DATA.ANIMATION
    });
    const previous = createSnapshot();
    const next = createSnapshot({ playerHp: 80, loraHp: 50 });
    next.lastPlayerAction = { type: 'attack', weapon: 'bow' };
    const playerAttackCues = presenter.createCues({
        previousSnapshot: previous,
        nextSnapshot: next,
        events: [{
            type: 'mob-damaged', mobId: 'f1-mob', damage: 50, hp: 50,
            x: 7, y: 4, source: 'player-attack'
        }]
    });
    assert.ok(playerAttackCues.some((cue) => (
        cue.type === TUTORIAL_PRESENTATION_CUE_TYPES.ACTOR_ANIMATION
        && cue.actorId === 'player'
        && cue.animationId === 'ranged'
    )));
    assert.ok(playerAttackCues.some((cue) => (
        cue.actorId === 'f1-mob'
        && cue.animationId === 'hit'
        && cue.waitForImpact === true
        && cue.impactActorId === 'player'
        && cue.impactAnimationId === 'ranged'
    )));

    const bossAttackCues = presenter.createCues({
        previousSnapshot: previous,
        nextSnapshot: next,
        events: [{
            type: 'lora-damaged', damage: 50, hp: 50, weapon: 'melee'
        }]
    });
    assert.ok(bossAttackCues.some((cue) => (
        cue.actorId === 'player' && cue.animationId === 'melee'
    )));
    assert.ok(bossAttackCues.some((cue) => (
        cue.actorId === 'lora'
        && cue.animationId === 'hit'
        && cue.waitForImpact === true
        && cue.impactActorId === 'player'
        && cue.impactAnimationId === 'melee'
    )));

    const loraAttackCues = presenter.createCues({
        previousSnapshot: previous,
        nextSnapshot: next,
        events: [
            { type: 'lora-attack', action: 'area', damage: 20 },
            { type: 'player-damaged', amount: 20, hp: 80, source: 'lora-area' }
        ]
    });
    assert.ok(loraAttackCues.some((cue) => (
        cue.actorId === 'lora' && cue.animationId === 'area'
    )));
    assert.ok(loraAttackCues.some((cue) => (
        cue.actorId === 'player'
        && cue.animationId === 'hit'
        && cue.impactActorId === 'lora'
        && cue.impactAnimationId === 'area'
    )));
});

test('로라의 대기·공격·피격 cue는 플레이어가 뒤쪽에 있어도 전면 방향을 유지한다', () => {
    const presenter = new TutorialBattlePresenter({
        items: TUTORIAL_GAME_DATA.ITEMS,
        animation: TUTORIAL_GAME_DATA.ANIMATION
    });
    const previous = createSnapshot({
        playerX: 4,
        playerY: 0,
        loraX: 4,
        loraY: 4
    });
    const loraAttackCues = presenter.createCues({
        previousSnapshot: previous,
        nextSnapshot: previous,
        events: [{ type: 'lora-attack', action: 'melee', damage: 20 }]
    });
    const loraAttack = loraAttackCues.find((cue) => (
        cue.actorId === 'lora' && cue.animationId === 'melee'
    ));
    assert.equal(loraAttack.facing, 'right');

    const loraIdleCues = presenter.createCues({
        previousSnapshot: previous,
        nextSnapshot: previous,
        events: [{ type: 'lora-attack', action: 'idle', damage: 0 }]
    });
    const loraIdle = loraIdleCues.find((cue) => (
        cue.actorId === 'lora' && cue.animationId === 'idle'
    ));
    assert.equal(loraIdle.facing, 'right');

    const loraHitCues = presenter.createCues({
        previousSnapshot: previous,
        nextSnapshot: createSnapshot({
            playerX: 4,
            playerY: 0,
            loraX: 4,
            loraY: 4,
            loraHp: 80
        }),
        events: [{
            type: 'lora-damaged', damage: 20, hp: 80,
            weapon: 'melee', source: 'player-attack'
        }]
    });
    const loraHit = loraHitCues.find((cue) => (
        cue.actorId === 'lora' && cue.animationId === 'hit'
    ));
    assert.equal(loraHit.facing, 'right');
    assert.equal(['left', 'right'].includes(loraHit.facing), true);
});

test('피드백 큐는 지연 cue를 impact 시점 전에는 노출하지 않는다', () => {
    const queue = new TutorialFeedbackQueue();
    queue.enqueue([{
        type: TUTORIAL_PRESENTATION_CUE_TYPES.FLASH,
        duration: 0.2,
        delaySeconds: 0.25
    }]);
    assert.equal(queue.getSnapshot().flashSeconds, 0);
    assert.equal(queue.getSnapshot().delayedCueCount, 1);
    queue.update(0.24);
    assert.equal(queue.getSnapshot().flashSeconds, 0);
    queue.update(0.02);
    assert.equal(queue.getSnapshot().flashSeconds, 0.2);
    assert.equal(queue.getSnapshot().delayedCueCount, 0);
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

test('전투 카메라는 0.3초 easeOutExpo 감쇠로 플레이어를 추적하고 층 전환에는 즉시 맞춘다', () => {
    const camera = new TutorialBattleCamera({ durationSeconds: 0.3 });
    camera.reset({ x: 4, y: 4, floorIndex: 0 });
    const first = camera.update({
        target: { x: 5, y: 4 },
        floorIndex: 0,
        deltaSeconds: 0.03
    });
    assert.ok(Math.abs(first.x - 4.5) < 0.000001);
    const settled = camera.update({
        target: { x: 5, y: 4 },
        floorIndex: 0,
        deltaSeconds: 0.27
    });
    assert.ok(Math.abs(settled.x - 5) < 0.001);
    const nextFloor = camera.update({
        target: { x: 2, y: 6 },
        floorIndex: 1,
        deltaSeconds: 0.01
    });
    assert.deepEqual(
        { x: nextFloor.x, y: nextFloor.y, floorIndex: nextFloor.floorIndex },
        { x: 2, y: 6, floorIndex: 1 }
    );
    camera.destroy();
});

test('프레젠터의 숫자 게이지 끝값은 타임라인까지 보존된다', async () => {
    let nextId = 0;
    const completions = [];
    const presenter = new TutorialBattlePresenter({
        animation: TUTORIAL_GAME_DATA.ANIMATION
    });
    const timeline = new TutorialAnimationTimeline({
        config: TUTORIAL_GAME_DATA.ANIMATION,
        animationPort: {
            animate(owner, properties) {
                const id = nextId++;
                const promise = new Promise((resolve) => {
                    completions.push(() => {
                        owner[properties.variable] = properties.endValue;
                        resolve();
                    });
                });
                return { id, promise };
            }
        }
    });
    timeline.reset({ playerHp: 100, loraHp: 100, instability: 70 });
    const cues = presenter.createCues({
        previousSnapshot: createSnapshot(),
        nextSnapshot: createSnapshot({ playerHp: 75, instability: 67 }),
        events: [
            { type: 'player-damaged', damage: 25, hp: 75, source: 'lora-area' },
            { type: 'instability-changed', before: 70, after: 67, change: -3 }
        ]
    });
    const playerHealthCue = cues.find((cue) => (
        cue.type === TUTORIAL_PRESENTATION_CUE_TYPES.HEALTH_TRANSITION
        && cue.actorId === 'player'
    ));
    const instabilityCue = cues.find((cue) => (
        cue.type === TUTORIAL_PRESENTATION_CUE_TYPES.INSTABILITY_TRANSITION
    ));

    assert.equal(playerHealthCue.from, 100);
    assert.equal(playerHealthCue.to, 75);
    assert.equal(instabilityCue.from, 70);
    assert.equal(instabilityCue.to, 67);

    timeline.applyCues(cues);
    for (const complete of completions) {
        complete();
    }
    await Promise.resolve();
    assert.equal(timeline.getState().playerHp, 75);
    assert.equal(timeline.getState().instability, 67);
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

test('에셋 로더는 주입 팩토리로 준비 상태, 크기 검증, 실패와 destroy를 관리한다', () => {
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
    const loader = new TutorialAssetLoader({
        imageFactory: () => new FakeImage()
    });
    loader.loadImage('portrait', 'portrait.png', {
        expectedDimensions: { width: 20, height: 20 }
    });
    loader.loadImage('failed', 'missing.png');
    loader.loadImage('mismatch', 'mismatch.png', {
        expectedDimensions: { width: 40, height: 20 }
    });
    assert.equal(loader.getStatus('portrait'), 'loading');
    images[0].succeed(20, 20);
    images[1].fail();
    images[2].succeed(20, 20);
    assert.equal(loader.isReady('portrait'), true);
    assert.equal(loader.getStatus('failed'), 'failed');
    assert.equal(loader.getImage('failed'), null);
    assert.equal(loader.getStatus('mismatch'), 'failed');
    assert.equal(loader.getSnapshot().mismatch.error, 'image-dimensions-mismatch');
    assert.deepEqual(loader.getSnapshot().mismatch.actualDimensions, {
        width: 20,
        height: 20
    });

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
        '_tutorial_battle_camera.js',
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
