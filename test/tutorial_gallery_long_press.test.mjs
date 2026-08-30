import assert from 'node:assert/strict';
import test from 'node:test';

import { TUTORIAL_CONTENT_DATA } from '../project/engine/script/data/game/tutorial_content_data.js';
import { TUTORIAL_GAME_DATA } from '../project/engine/script/data/game/tutorial_game_data.js';
import { TutorialGalleryController } from '../project/engine/script/scene/tutorial/_tutorial_gallery_controller.js';
import { TutorialLongPressController } from '../project/engine/script/scene/tutorial/_tutorial_long_press_controller.js';
import { TutorialMetaSession } from '../project/engine/script/scene/tutorial/_tutorial_meta_session.js';
import {
    TUTORIAL_COMMANDS
} from '../project/engine/script/scene/tutorial/_tutorial_scene_constants.js';
import { TutorialGalleryView } from '../project/engine/script/scene/tutorial/view/_tutorial_gallery_view.js';

const HOLD_TARGET = Object.freeze({ key: 'gallery-back', durationSeconds: 2 });

test('롱프레스는 2초 임계값에서 한 번만 발동하고 릴리스 클릭을 억제한다', () => {
    const controller = new TutorialLongPressController();
    assert.equal(controller.update({
        pressStarted: true,
        pressing: true,
        hoveredTarget: HOLD_TARGET,
        timestampSeconds: 10
    }), null);
    assert.equal(controller.update({
        pressing: true,
        hoveredTarget: HOLD_TARGET,
        timestampSeconds: 11.99
    }), null);
    assert.equal(controller.update({
        pressing: true,
        hoveredTarget: HOLD_TARGET,
        timestampSeconds: 12
    }), 'gallery-back');
    assert.equal(controller.shouldSuppressActivation(), true);

    assert.equal(controller.update({
        pressing: true,
        hoveredTarget: HOLD_TARGET,
        timestampSeconds: 17
    }), null);
    controller.completeFrame({ pressing: true });
    assert.equal(controller.shouldSuppressActivation(), true);
    controller.update({
        released: true,
        hoveredTarget: HOLD_TARGET,
        timestampSeconds: 17.016
    });
    assert.equal(controller.shouldSuppressActivation(), true);
    controller.completeFrame({ pressing: false });
    assert.equal(controller.shouldSuppressActivation(), false);
});

test('임계시간 전 이탈은 롱프레스를 취소하고 릴리스 프레임도 임계값에 포함한다', () => {
    const controller = new TutorialLongPressController();
    controller.update({
        pressStarted: true,
        pressing: true,
        hoveredTarget: HOLD_TARGET,
        timestampSeconds: 20
    });
    assert.equal(controller.update({
        pressing: true,
        hoveredTarget: null,
        timestampSeconds: 21
    }), null);
    assert.equal(controller.update({
        pressing: true,
        hoveredTarget: HOLD_TARGET,
        timestampSeconds: 23
    }), null);

    controller.completeFrame({ pressing: false });
    controller.update({
        pressStarted: true,
        pressing: true,
        hoveredTarget: HOLD_TARGET,
        timestampSeconds: 30
    });
    assert.equal(controller.update({
        released: true,
        hoveredTarget: HOLD_TARGET,
        timestampSeconds: 32
    }), 'gallery-back');
    assert.equal(controller.shouldSuppressActivation(), true);
});

test('메뉴 갤러리 닫기 버튼에만 2초 전체 해금 명령을 노출한다', () => {
    const gallery = new TutorialGalleryController({
        content: TUTORIAL_CONTENT_DATA,
        cutscenes: TUTORIAL_GAME_DATA.CUTSCENES
    });
    const snapshot = gallery.getSnapshot({});
    const view = new TutorialGalleryView({}, {});
    const baseViewModel = {
        ...snapshot,
        viewport: { WW: 1280, WH: 720, UIWW: 1280, UIOffsetX: 0 },
        closeCommandType: TUTORIAL_COMMANDS.RETURN_MENU,
        recordPopup: false
    };
    const menuClose = view.getButtonSpecs(baseViewModel).find(
        ({ key }) => key === 'gallery-back'
    );
    assert.equal(menuClose.longPressSeconds, 2);
    assert.deepEqual(menuClose.longPressCommand, {
        type: TUTORIAL_COMMANDS.GALLERY_UNLOCK_ALL
    });

    const recordClose = view.getButtonSpecs({
        ...baseViewModel,
        closeCommandType: TUTORIAL_COMMANDS.CLOSE_RECORD,
        recordPopup: true
    }).find(({ key }) => key === 'gallery-back');
    assert.equal('longPressSeconds' in recordClose, false);
    assert.equal('longPressCommand' in recordClose, false);
});

test('전체 해금은 staging 중에도 한 번 즉시 저장되고 반복 호출은 쓰기를 늘리지 않는다', async () => {
    const saved = [];
    const session = new TutorialMetaSession({
        save: async (meta) => {
            saved.push(structuredClone(meta));
            return meta;
        }
    });
    const gallery = new TutorialGalleryController({
        content: TUTORIAL_CONTENT_DATA,
        cutscenes: TUTORIAL_GAME_DATA.CUTSCENES
    });
    session.beginStaging();
    assert.equal(session.unlockGallery(gallery.getUnlockCatalog()), true);
    await session.whenIdle();
    assert.equal(saved.length, 1);
    assert.equal(session.current.unlockedRecordIds.length, 10);
    assert.equal(session.current.unlockedAchievementIds.length, 6);
    assert.equal(session.current.endingIds.length, 4);
    assert.equal(session.current.openingWatched, false);

    assert.equal(session.unlockGallery(gallery.getUnlockCatalog()), false);
    await session.whenIdle();
    assert.equal(saved.length, 1);
});
