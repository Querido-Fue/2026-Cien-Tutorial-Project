import assert from 'node:assert/strict';
import test from 'node:test';

import { TutorialKeyboardEdgeTracker } from '../project/engine/script/scene/tutorial/_tutorial_keyboard_edge_tracker.js';
import { TutorialMetaSession } from '../project/engine/script/scene/tutorial/_tutorial_meta_session.js';
import { createDefaultTutorialMeta } from '../project/engine/script/scene/tutorial/_tutorial_meta_progress.js';

test('키보드 에지 추적기는 유지 입력과 프레임 사이 빠른 탭을 구분한다', () => {
    const down = new Map([['KeyA', false], ['KeyB', false]]);
    let snapshot = { lastEvent: { code: 'KeyA', pressed: false, timeStamp: 1 } };
    const tracker = new TutorialKeyboardEdgeTracker({
        watchedCodes: ['KeyA', 'KeyB'],
        getCodeInput: (code) => down.get(code) === true,
        getSnapshot: () => snapshot
    });

    down.set('KeyA', true);
    tracker.prepare();
    assert.equal(tracker.wasPressed('KeyA'), true);
    tracker.capture();

    tracker.prepare();
    assert.equal(tracker.wasPressed('KeyA'), false);

    snapshot = { lastEvent: { code: 'KeyB', pressed: false, timeStamp: 2 } };
    tracker.prepare();
    assert.equal(tracker.wasPressed('KeyB'), true);
    assert.equal(tracker.wasAnyPressed(['KeyA', 'KeyB']), true);
});

test('메타 세션은 런 중 변경을 staging하고 이탈 시 한 번만 저장한다', async () => {
    const saved = [];
    const session = new TutorialMetaSession({
        initialMeta: createDefaultTutorialMeta(),
        save: async (meta) => saved.push(meta)
    });

    session.beginStaging();
    session.unlockAchievements(['first-defeat']);
    session.markCombatGuideSeen();
    await session.whenIdle();
    assert.equal(saved.length, 0);

    session.commitStaged();
    await session.whenIdle();
    assert.equal(saved.length, 1);
    assert.deepEqual(saved[0].unlockedAchievementIds, ['first-defeat']);
    assert.equal(saved[0].combatGuideSeen, true);
});

test('메타 세션은 획득 기록을 staging 중에도 즉시 확정한다', async () => {
    const saved = [];
    const session = new TutorialMetaSession({
        initialMeta: createDefaultTutorialMeta(),
        save: async (meta) => saved.push(meta)
    });

    session.beginStaging();
    session.syncBattleSnapshot({
        usedItems: ['ocarina'],
        knowledge: {
            identifiedItemIds: ['bow'],
            unlockedRecordIds: ['lora-diary-1']
        }
    });
    await session.whenIdle();

    assert.equal(saved.length, 1);
    assert.deepEqual(saved[0].identifiedItemIds, ['ocarina', 'bow']);
    assert.deepEqual(saved[0].unlockedRecordIds, ['lora-diary-1']);
});

test('메타 세션은 저장 차단 상태에서 메모리 진행만 유지한다', async () => {
    const saved = [];
    const session = new TutorialMetaSession({
        save: async (meta) => saved.push(meta)
    });
    session.setWritesBlocked(true);
    session.recordResult('true-ending');
    await session.whenIdle();

    assert.equal(session.current.playCount, 1);
    assert.deepEqual(session.current.endingIds, ['true-ending']);
    assert.equal(saved.length, 0);
});
