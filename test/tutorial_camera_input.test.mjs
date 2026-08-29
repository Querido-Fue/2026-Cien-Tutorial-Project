import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { resolvePointerLockExitHintPosition } from '../project/engine/script/app/_pointer_lock_exit_hint_layout.js';
import { APP_PAUSE_DATA } from '../project/engine/script/data/global/app_pause_data.js';
import { PointerLockExitIntentDetector } from '../project/engine/script/input/_pointer_lock_exit_intent_detector.js';
import {
    POINTER_LOCK_EXIT_HINT_EVENT,
    PointerLockInputHandler
} from '../project/engine/script/input/_pointer_lock_input_handler.js';
import { TutorialBattleCameraController } from '../project/engine/script/scene/tutorial/_tutorial_battle_camera_controller.js';

class TestCustomEvent extends Event {
    constructor(type, options = {}) {
        super(type, options);
        this.detail = options.detail;
    }
}

class TestWindow extends EventTarget {
    constructor() {
        super();
        this.CustomEvent = TestCustomEvent;
        this.now = 0;
        this.performance = { now: () => this.now };
    }
}

class TestDocument extends EventTarget {
    constructor() {
        super();
        this.pointerLockElement = null;
        this.documentElement = {
            requestPointerLock: () => {
                this.pointerLockElement = this.documentElement;
                this.dispatchEvent(new Event('pointerlockchange'));
            }
        };
    }

    exitPointerLock() {
        this.pointerLockElement = null;
        this.dispatchEvent(new Event('pointerlockchange'));
    }
}

function createInputEvent(type, properties = {}) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    for (const [key, value] of Object.entries(properties)) {
        Object.defineProperty(event, key, { configurable: true, value });
    }
    return event;
}

const LAYOUT = Object.freeze({
    viewport: Object.freeze({ WW: 1000, WH: 600 }),
    mapWidth: 9,
    mapHeight: 8,
    gridAxisX: Object.freeze({ x: 50, y: 25 }),
    gridAxisY: Object.freeze({ x: -50, y: 25 })
});

test('가장자리 카메라는 격자 역투영으로 이동하고 휠 클릭 복귀 뒤 재무장한다', () => {
    const controller = new TutorialBattleCameraController({
        edgeMarginRatio: 0.1,
        edgeSpeedViewportRatioPerSecond: 0.5,
        maxDeltaSeconds: 0.05
    });
    controller.reset({ x: 4, y: 4, floorIndex: 0 });

    const panned = controller.update({
        player: { x: 4, y: 4 },
        floorIndex: 0,
        layout: LAYOUT,
        pointer: { x: 1000, y: 300 },
        deltaSeconds: 0.05,
        edgePanEnabled: true
    });
    assert.ok(panned.x > 4);
    assert.ok(panned.y < 4);

    const recentered = controller.update({
        player: { x: 4, y: 4 },
        floorIndex: 0,
        layout: LAYOUT,
        pointer: { x: 1000, y: 300 },
        deltaSeconds: 0.05,
        edgePanEnabled: true,
        recenter: true
    });
    assert.deepEqual(recentered, { x: 4, y: 4 });

    const heldAtEdge = controller.update({
        player: { x: 4, y: 4 },
        floorIndex: 0,
        layout: LAYOUT,
        pointer: { x: 1000, y: 300 },
        deltaSeconds: 0.05,
        edgePanEnabled: true
    });
    assert.deepEqual(heldAtEdge, { x: 4, y: 4 });

    controller.update({
        player: { x: 4, y: 4 },
        floorIndex: 0,
        layout: LAYOUT,
        pointer: { x: 500, y: 300 },
        deltaSeconds: 0.05,
        edgePanEnabled: true
    });
    const rearmed = controller.update({
        player: { x: 4, y: 4 },
        floorIndex: 0,
        layout: LAYOUT,
        pointer: { x: 1000, y: 300 },
        deltaSeconds: 0.05,
        edgePanEnabled: true
    });
    assert.ok(rearmed.x > 4);

    const nextFloor = controller.update({
        player: { x: 2, y: 3 },
        floorIndex: 1,
        layout: LAYOUT,
        pointer: { x: 500, y: 300 },
        deltaSeconds: 0.05,
        edgePanEnabled: true
    });
    assert.deepEqual(nextFloor, { x: 2, y: 3 });
});

test('재포커스 클릭과 Escape는 게임 입력으로 전파되지 않는다', () => {
    const documentRef = new TestDocument();
    const windowRef = new TestWindow();
    const handler = new PointerLockInputHandler({ documentRef, windowRef });
    let resetCount = 0;
    let acquiredPosition = null;
    let leakedMouseDowns = 0;
    let leakedEscapeKeys = 0;
    handler.setInputResetCallback(() => {
        resetCount += 1;
    });
    handler.setLockAcquiredCallback((position) => {
        acquiredPosition = position;
    });
    documentRef.addEventListener('mousedown', () => {
        leakedMouseDowns += 1;
    });
    windowRef.addEventListener('keydown', () => {
        leakedEscapeKeys += 1;
    });

    handler.setEnabled(true);
    assert.equal(handler.getSnapshot().awaitingActivation, true);
    assert.equal(handler.getSnapshot().initialActivationPending, true);
    assert.equal(handler.getSnapshot().hasEverLocked, false);
    const activation = createInputEvent('mousedown', {
        button: 0,
        clientX: 321,
        clientY: 234
    });
    documentRef.dispatchEvent(activation);
    assert.equal(activation.defaultPrevented, true);
    assert.equal(leakedMouseDowns, 0);
    assert.equal(handler.isLocked(), true);
    assert.equal(handler.getSnapshot().initialActivationPending, false);
    assert.equal(handler.getSnapshot().hasEverLocked, true);
    assert.deepEqual(acquiredPosition, { clientX: 321, clientY: 234 });
    assert.equal(resetCount, 1);

    const nextGameplayClick = createInputEvent('mousedown', {
        button: 0,
        clientX: 400,
        clientY: 260
    });
    documentRef.dispatchEvent(nextGameplayClick);
    assert.equal(nextGameplayClick.defaultPrevented, false);
    assert.equal(leakedMouseDowns, 1);

    const escape = createInputEvent('keydown', { code: 'Escape' });
    windowRef.dispatchEvent(escape);
    assert.equal(escape.defaultPrevented, true);
    assert.equal(leakedEscapeKeys, 0);
    assert.equal(handler.isLocked(), false);
    assert.equal(handler.getSnapshot().awaitingActivation, true);
    assert.equal(handler.getSnapshot().initialActivationPending, false);
    assert.equal(resetCount, 2);

    handler.setActivationBypassCallback(() => true);
    const engineOverlayClick = createInputEvent('mousedown', {
        button: 0,
        clientX: 430,
        clientY: 280
    });
    documentRef.dispatchEvent(engineOverlayClick);
    assert.equal(engineOverlayClick.defaultPrevented, false);
    assert.equal(leakedMouseDowns, 2);
    assert.equal(handler.isLocked(), false);

    handler.setActivationBypassCallback(null);
    const refocusClick = createInputEvent('mousedown', {
        button: 0,
        clientX: 430,
        clientY: 280
    });
    documentRef.dispatchEvent(refocusClick);
    assert.equal(refocusClick.defaultPrevented, true);
    assert.equal(leakedMouseDowns, 2);
    assert.equal(handler.isLocked(), true);
    handler.destroy();
});

test('가장자리 이탈 안내는 1%·1초 체류와 40도 이동 또는 정지 조건을 지원한다', () => {
    const record = (
        detector,
        timeMilliseconds,
        { degrees = 0, pointerX = 1000, movementDistance = 4 } = {}
    ) => {
        const radians = degrees * (Math.PI / 180);
        detector.record({
            locked: true,
            pointerX,
            pointerY: 300,
            viewportWidth: 1000,
            viewportHeight: 600,
            movementX: Math.cos(radians) * movementDistance,
            movementY: Math.sin(radians) * movementDistance,
            timeMilliseconds
        });
    };

    const movingDetector = new PointerLockExitIntentDetector();
    for (let time = 0; time <= 900; time += 100) {
        record(movingDetector, time, { degrees: 0 });
    }
    assert.equal(movingDetector.getSnapshot().visible, false);
    record(movingDetector, 1000, { degrees: 0 });
    assert.equal(movingDetector.getSnapshot().visible, true);
    assert.equal(movingDetector.getSnapshot().edge, 'right');
    record(movingDetector, 1500, { degrees: 35 });
    assert.equal(movingDetector.getSnapshot().visible, true);
    record(movingDetector, 1510, { degrees: 50 });
    assert.equal(movingDetector.getSnapshot().visible, false);

    const stationaryDetector = new PointerLockExitIntentDetector();
    record(stationaryDetector, 2000, { movementDistance: 0 });
    stationaryDetector.update(2999);
    assert.equal(stationaryDetector.getSnapshot().visible, false);
    stationaryDetector.update(3000);
    assert.equal(stationaryDetector.getSnapshot().visible, true);

    const withinToleranceDetector = new PointerLockExitIntentDetector();
    for (let time = 4000; time <= 5000; time += 100) {
        record(withinToleranceDetector, time, {
            degrees: (time / 100) % 2 === 0 ? -19 : 19
        });
    }
    assert.equal(withinToleranceDetector.getSnapshot().visible, true);

    const outsideToleranceDetector = new PointerLockExitIntentDetector();
    for (let time = 6000; time <= 7000; time += 100) {
        record(outsideToleranceDetector, time, {
            degrees: (time / 100) % 2 === 0 ? -21 : 21
        });
    }
    assert.equal(outsideToleranceDetector.getSnapshot().visible, false);

    const minimumVisibleDetector = new PointerLockExitIntentDetector();
    record(minimumVisibleDetector, 8000, { movementDistance: 0 });
    minimumVisibleDetector.update(9000);
    assert.equal(minimumVisibleDetector.getSnapshot().visible, true);
    record(minimumVisibleDetector, 9100, {
        pointerX: 500,
        movementDistance: 0
    });
    assert.equal(minimumVisibleDetector.getSnapshot().visible, true);
    minimumVisibleDetector.update(9499);
    assert.equal(minimumVisibleDetector.getSnapshot().visible, true);
    minimumVisibleDetector.update(9500);
    assert.equal(minimumVisibleDetector.getSnapshot().visible, false);

    const cornerDetector = new PointerLockExitIntentDetector();
    for (let time = 10000; time <= 11000; time += 100) {
        const useRightEdge = (time / 100) % 2 === 0;
        cornerDetector.record({
            locked: true,
            pointerX: useRightEdge ? 1000 : 995,
            pointerY: useRightEdge ? 597 : 600,
            viewportWidth: 1000,
            viewportHeight: 600,
            movementX: 2,
            movementY: 2,
            timeMilliseconds: time
        });
    }
    assert.equal(cornerDetector.getSnapshot().visible, true);
});

test('포인터 핸들러는 이탈 의도 표시와 해제를 DOM 상태 이벤트로 전달한다', () => {
    const documentRef = new TestDocument();
    const windowRef = new TestWindow();
    const handler = new PointerLockInputHandler({ documentRef, windowRef });
    const hintEvents = [];
    windowRef.addEventListener(POINTER_LOCK_EXIT_HINT_EVENT, (event) => {
        hintEvents.push(event.detail);
    });
    handler.setEnabled(true);
    documentRef.dispatchEvent(createInputEvent('mousedown', {
        button: 0,
        clientX: 500,
        clientY: 300
    }));

    for (let time = 0; time <= 1200; time += 100) {
        windowRef.now = time;
        handler.recordPointerMovement({
            pointerX: 1000,
            pointerY: 300,
            viewportWidth: 1000,
            viewportHeight: 600,
            movementX: 3,
            movementY: 0
        });
    }
    assert.equal(hintEvents.at(-1)?.visible, true);

    windowRef.now = 1441;
    handler.update();
    assert.equal(hintEvents.at(-1)?.visible, true);

    windowRef.now = 1500;
    handler.recordPointerMovement({
        pointerX: 500,
        pointerY: 300,
        viewportWidth: 1000,
        viewportHeight: 600,
        movementX: 0,
        movementY: 0
    });
    assert.equal(hintEvents.at(-1)?.visible, false);
    handler.destroy();
});

test('이탈 안내 팝업은 네 모서리에서도 전체 상자가 화면 안에 남는다', () => {
    const viewportWidth = 800;
    const viewportHeight = 600;
    const popupWidth = 260;
    const popupHeight = 60;
    const cases = [
        { edge: 'left', pointerX: 0, pointerY: 0 },
        { edge: 'right', pointerX: 800, pointerY: 0 },
        { edge: 'top', pointerX: 800, pointerY: 0 },
        { edge: 'bottom', pointerX: 0, pointerY: 600 }
    ];

    for (const entry of cases) {
        const position = resolvePointerLockExitHintPosition({
            ...entry,
            viewportWidth,
            viewportHeight,
            popupWidth,
            popupHeight,
            inset: 16,
            cursorOffset: 18
        });
        assert.ok(position.left >= 16);
        assert.ok(position.top >= 16);
        assert.ok(position.left + popupWidth <= viewportWidth - 16);
        assert.ok(position.top + popupHeight <= viewportHeight - 16);
    }
});

test('최초 안내·포커스 블러·엔진 생존 정책이 분리되어 있다', async () => {
    const [html, css, sceneSource, inputBindings, engineSource] = await Promise.all([
        readFile(new URL('../project/engine/index.html', import.meta.url), 'utf8'),
        readFile(new URL('../project/engine/style.css', import.meta.url), 'utf8'),
        readFile(new URL(
            '../project/engine/script/scene/tutorial/_tutorial_scene.js',
            import.meta.url
        ), 'utf8'),
        readFile(new URL(
            '../project/engine/script/scene/tutorial/_tutorial_input_bindings.js',
            import.meta.url
        ), 'utf8'),
        readFile(new URL(
            '../project/engine/script/app/engine_app.js',
            import.meta.url
        ), 'utf8')
    ]);
    assert.match(html, /일시 정지됨/);
    assert.match(html, /화면을 클릭해 복귀/);
    assert.match(html, /화면을 클릭해주세요/);
    assert.match(html, /마우스 고정을 해제하려면 ESC키를 누르세요/);
    assert.match(css, /blur\(10px\)\s+brightness\(0\.58\)/);
    assert.match(css, /400ms cubic-bezier\(0\.16, 1, 0\.3, 1\)/);
    assert.match(css, /opacity 200ms cubic-bezier\(0\.16, 1, 0\.3, 1\)/);
    assert.match(css, /body\.pointer-lock-initial #pointer-lock-focus-overlay/);
    assert.match(sceneSource, /pointerLock\.initialActivationPending/);
    assert.match(sceneSource, /buttonGroup === 'menu'[\s\S]{0,100}initialActivationPending === true/);
    assert.match(engineSource, /setPointerLockActivationBypassCallback/);
    assert.match(engineSource, /overlayManager\?\.hasAnyOverlay/);
    assert.match(sceneSource, /consumeMouseState\('middle', 'clicked'\)/);
    assert.match(inputBindings, /ALTERNATE_CONFIRM:\s*'Space'/);
    assert.match(sceneSource, /KEY_CODES\.ALTERNATE_CONFIRM\)\)\s*\{\s*enqueueSimulationCommand\(\{ type: COMMANDS\.IDLE \}\)/);
    assert.doesNotMatch(sceneSource, /KEY_CODES\.ALTERNATE_CONFIRM[^\n]*CAMERA/);
    for (const policy of [
        APP_PAUSE_DATA.INACTIVE_POLICY,
        APP_PAUSE_DATA.POINTER_LOCK_RELEASED_POLICY
    ]) {
        assert.equal(policy.keepLoopRunning, true);
        assert.equal(policy.runFixedStep, false);
        assert.equal(policy.runSceneUpdate, false);
        assert.equal(policy.runObjectUpdate, false);
        assert.equal(policy.runInputUpdate, true);
        assert.equal(policy.runAnimationUpdate, true);
        assert.equal(policy.runOverlayUpdate, true);
    }
});
