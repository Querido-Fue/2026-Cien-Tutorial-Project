import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    BrowserCompatibilityWarningGate,
    isRecommendedGameRuntime
} from '../project/engine/script/app/_browser_compatibility_warning_gate.js';
import { korean } from '../project/engine/script/ui/lang/_korean.js';

function createMouseDown(button) {
    const event = new Event('mousedown');
    Object.defineProperty(event, 'button', { value: button });
    return event;
}

test('NW.js와 Chromium 계열만 권장 게임 런타임으로 판정한다', () => {
    assert.equal(isRecommendedGameRuntime({
        navigatorRef: { userAgent: 'Firefox/142.0' },
        nwRuntimeCheck: () => true
    }), true);
    assert.equal(isRecommendedGameRuntime({
        navigatorRef: {
            userAgentData: { brands: [{ brand: 'Chromium', version: '140' }] },
            userAgent: ''
        },
        nwRuntimeCheck: () => false
    }), true);
    assert.equal(isRecommendedGameRuntime({
        navigatorRef: { userAgent: 'Mozilla/5.0 Chrome/140.0 Safari/537.36' },
        nwRuntimeCheck: () => false
    }), true);
    assert.equal(isRecommendedGameRuntime({
        navigatorRef: { userAgent: 'Mozilla/5.0 Firefox/142.0' },
        nwRuntimeCheck: () => false
    }), false);
    assert.equal(isRecommendedGameRuntime({
        navigatorRef: { userAgent: 'Mozilla/5.0 CriOS/140.0 Mobile/15E148 Safari/604.1' },
        nwRuntimeCheck: () => false
    }), false);
});

test('비권장 브라우저 경고는 첫 주 클릭 처리가 끝난 다음 한 번만 열린다', () => {
    const windowRef = new EventTarget();
    const scheduled = [];
    let openCount = 0;
    const gate = new BrowserCompatibilityWarningGate({
        windowRef,
        navigatorRef: { userAgent: 'Mozilla/5.0 Firefox/142.0' },
        nwRuntimeCheck: () => false,
        overlayPort: {
            openBrowserCompatibilityWarningOverlay() {
                openCount++;
            }
        },
        schedule(callback) {
            scheduled.push(callback);
        }
    });

    assert.equal(gate.arm(), true);
    windowRef.dispatchEvent(createMouseDown(2));
    assert.equal(scheduled.length, 0);
    windowRef.dispatchEvent(createMouseDown(0));
    assert.equal(openCount, 0);
    assert.equal(scheduled.length, 1);
    scheduled.shift()();
    assert.equal(openCount, 1);
    windowRef.dispatchEvent(createMouseDown(0));
    assert.equal(scheduled.length, 0);
    assert.equal(openCount, 1);
});

test('권장 런타임에서는 첫 클릭 경고 감시를 등록하지 않는다', () => {
    const windowRef = new EventTarget();
    let openCount = 0;
    const gate = new BrowserCompatibilityWarningGate({
        windowRef,
        navigatorRef: { userAgent: 'Mozilla/5.0 Edg/140.0 Chrome/140.0' },
        nwRuntimeCheck: () => false,
        overlayPort: {
            openBrowserCompatibilityWarningOverlay() {
                openCount++;
            }
        }
    });

    assert.equal(gate.arm(), false);
    windowRef.dispatchEvent(createMouseDown(0));
    assert.equal(openCount, 0);
});

test('호환성 안내는 종료 팝업 크기와 파란 확인 버튼 하나만 사용한다', async () => {
    const overlaySource = await readFile(new URL(
        '../project/engine/script/overlay/_browser_compatibility_warning_overlay.js',
        import.meta.url
    ), 'utf8');
    const tutorialMainSource = await readFile(new URL(
        '../project/engine/script/tutorial_main.js',
        import.meta.url
    ), 'utf8');

    assert.equal(
        korean.browser_compatibility_warning_body_first
            + ' ' + korean.browser_compatibility_warning_body_second,
        '크롬 기반 브라우저 이외의 환경에서는 정상적으로 동작하지 않을 수 있습니다.'
    );
    assert.equal(korean.browser_compatibility_warning_confirm, '확인');
    assert.match(overlaySource, /EXIT_LAYOUT_CONSTANTS\.WIDTH_UIWW_RATIO/);
    assert.match(overlaySource, /EXIT_LAYOUT_CONSTANTS\.HEIGHT_WH_RATIO/);
    assert.equal((overlaySource.match(/\.item\('button'\)/g) || []).length, 1);
    assert.match(overlaySource, /applyOverlayConfirmButtonIcon\(handler\)/);
    assert.equal(
        tutorialMainSource.indexOf('tutorialGame.start()')
            < tutorialMainSource.indexOf('new BrowserCompatibilityWarningGate'),
        true
    );
});
