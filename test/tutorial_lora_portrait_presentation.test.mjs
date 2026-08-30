import assert from 'node:assert/strict';
import test from 'node:test';

import { TUTORIAL_ASSET_MANIFEST } from '../project/engine/script/data/game/tutorial_asset_manifest.js';
import { LORA_STATUS_PANEL_LAYOUT } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_hud_layout.js';
import {
    resolveTutorialLoraPortraitPresentation
} from '../project/engine/script/scene/tutorial/view/_tutorial_lora_portrait_presentation.js';

const ASSET_KEY_BY_STATE = Object.freeze({
    stable: 'loraPortraitStable',
    anxious: 'loraPortraitAnxious',
    shaken: 'loraPortraitShaken',
    unstable: 'loraPortraitUnstable',
    collapse: 'loraPortraitCollapse'
});

test('불안정도 다섯 단계는 각각 전용 로라 도트 초상을 사용한다', () => {
    const images = Object.fromEntries(
        Object.values(ASSET_KEY_BY_STATE).map((key) => [key, { key }])
    );
    const assetPort = {
        getUiAsset(key) {
            return images[key] || null;
        }
    };

    for (const [stateId, assetKey] of Object.entries(ASSET_KEY_BY_STATE)) {
        const presentation = resolveTutorialLoraPortraitPresentation(
            assetPort, stateId, LORA_STATUS_PANEL_LAYOUT
        );
        assert.equal(presentation.image, images[assetKey]);
        assert.equal(
            presentation.visualCenter,
            LORA_STATUS_PANEL_LAYOUT.PORTRAIT_MOOD_VISUAL_CENTER
        );
    }
    assert.ok(
        LORA_STATUS_PANEL_LAYOUT.PORTRAIT_MOOD_VISUAL_CENTER.Y
        > LORA_STATUS_PANEL_LAYOUT.PORTRAIT_VISUAL_CENTER.Y
    );
});

test('상태 초상이 없으면 기존 초상과 기존 클립 중심으로 안전하게 폴백한다', () => {
    const fallback = { key: 'loraPortraitIcon' };
    const presentation = resolveTutorialLoraPortraitPresentation({
        getUiAsset(key) {
            return key === 'loraPortraitIcon' ? fallback : null;
        }
    }, 'stable', LORA_STATUS_PANEL_LAYOUT);

    assert.equal(presentation.image, fallback);
    assert.equal(
        presentation.visualCenter,
        LORA_STATUS_PANEL_LAYOUT.PORTRAIT_VISUAL_CENTER
    );
});

test('상태별 로라 초상은 투명 픽셀 렌더 자산으로 매니페스트에 등록된다', () => {
    for (const [stateId, assetKey] of Object.entries(ASSET_KEY_BY_STATE)) {
        const id = TUTORIAL_ASSET_MANIFEST.UI[assetKey];
        const entry = TUTORIAL_ASSET_MANIFEST.ENTRIES.find((candidate) => candidate.id === id);
        assert.ok(entry, stateId);
        assert.equal(entry.pixelated, true);
        assert.equal(entry.layer, 'portrait');
        assert.deepEqual(entry.expectedDimensions, { width: 1254, height: 1254 });
        assert.match(entry.runtimePath, new RegExp(`lora-portrait-${stateId}-pixel-v3\\.png$`));
    }
});
