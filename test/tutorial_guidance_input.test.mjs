import assert from 'node:assert/strict';
import test from 'node:test';

import { TutorialKeyboardCommandMapper } from '../project/engine/script/scene/tutorial/_tutorial_keyboard_command_mapper.js';
import { TutorialGuidanceBackdropView } from '../project/engine/script/scene/tutorial/view/_tutorial_guidance_backdrop_view.js';
import {
    TUTORIAL_COMMANDS,
    TUTORIAL_MODES
} from '../project/engine/script/scene/tutorial/_tutorial_scene_constants.js';

const ACTIVE_GUIDANCE = Object.freeze({
    mode: TUTORIAL_MODES.BATTLE,
    guidanceOpen: true,
    guidanceInteractive: true
});

test('열린 안내는 Enter·Space로 다음 단계, H·Escape로 건너뛴다', () => {
    const mapper = new TutorialKeyboardCommandMapper();
    for (const code of ['Enter', 'Space']) {
        assert.deepEqual(mapper.map(ACTIVE_GUIDANCE, [code]), {
            type: TUTORIAL_COMMANDS.GUIDE_ADVANCE
        });
    }
    for (const code of ['KeyH', 'Escape']) {
        assert.deepEqual(mapper.map(ACTIVE_GUIDANCE, [code]), {
            type: TUTORIAL_COMMANDS.GUIDE_DISMISS
        });
    }
});

test('포커스 전환 중에는 다음 클릭 키를 받지 않되 Escape 건너뛰기는 유지한다', () => {
    const mapper = new TutorialKeyboardCommandMapper();
    const transitioning = { ...ACTIVE_GUIDANCE, guidanceInteractive: false };
    assert.equal(mapper.map(transitioning, ['Enter']), null);
    assert.deepEqual(mapper.map(transitioning, ['Escape']), {
        type: TUTORIAL_COMMANDS.GUIDE_DISMISS
    });
});

test('아웃포커스 계층은 선택 영역을 감싼 원에서 바깥으로 블러를 점진적으로 강화한다', () => {
    const children = [];
    const createElement = () => ({
        style: {},
        children: [],
        isConnected: true,
        appendChild(child) {
            this.children.push(child);
        },
        remove() {
            this.isConnected = false;
        }
    });
    const canvas = {
        width: 1000,
        height: 500,
        getBoundingClientRect: () => ({ left: 5, top: 7, width: 100, height: 50 })
    };
    const documentRef = {
        body: {
            appendChild(child) {
                children.push(child);
            }
        },
        createElement,
        getElementById(id) {
            return id === 'ui' ? canvas : null;
        }
    };
    const view = new TutorialGuidanceBackdropView({
        MAX_BLUR_PX: 8,
        MIN_BRIGHTNESS: 0.84,
        DIM_ALPHA: 0.07,
        FOCUS_FEATHER_CSS_PX: 18
    }, documentRef);
    view.sync({
        visible: true,
        blurProgress: 1,
        focusRect: { x: 200, y: 100, w: 400, h: 200 },
        viewport: { WW: 1000, WH: 500 }
    });

    const [host] = children;
    const [radialPanel] = host.children;
    assert.deepEqual(
        { left: host.style.left, top: host.style.top, w: host.style.width, h: host.style.height },
        { left: '5px', top: '7px', w: '100px', h: '50px' }
    );
    assert.equal(host.children.length, 1);
    assert.equal(radialPanel.style.backdropFilter, 'blur(8px) brightness(0.84)');
    assert.match(
        radialPanel.style.maskImage,
        /^radial-gradient\(circle at 40px 20px,/
    );
    assert.match(radialPanel.style.maskImage, /transparent 22\.361px/);
    assert.match(radialPanel.style.maskImage, /rgba\(0, 0, 0, 0\.5\)/);
    assert.match(radialPanel.style.maskImage, /#000 40\.361px, #000 100%\)$/);
    assert.equal(radialPanel.style.maskImage, radialPanel.style.webkitMaskImage);
    view.clear();
    assert.equal(host.style.display, 'none');
});
