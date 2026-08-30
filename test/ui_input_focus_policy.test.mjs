import assert from 'node:assert/strict';
import test from 'node:test';

import {
    isUiInputFocused
} from '../project/engine/script/ui/element/_ui_input_focus_policy.js';

test('UI 입력 포커스 정책은 같은 렌더 레이어를 그대로 허용한다', () => {
    assert.equal(isUiInputFocused('ui', ['ui', 'object']), true);
    assert.equal(isUiInputFocused('object', ['ui', 'object']), true);
});

test('top 렌더 서브레이어는 ui 입력 포커스를 공유한다', () => {
    assert.equal(isUiInputFocused('top', ['ui', 'object']), true);
});

test('엔진 오버레이가 포커스를 독점하면 top UI 입력을 차단한다', () => {
    assert.equal(isUiInputFocused('top', ['overlay']), false);
    assert.equal(isUiInputFocused('ui', ['overlay']), false);
    assert.equal(isUiInputFocused('top', null), false);
});
