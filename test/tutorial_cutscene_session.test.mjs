import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { TutorialCutsceneSession } from '../project/engine/script/scene/tutorial/_tutorial_cutscene_session.js';

const CUTSCENES = Object.freeze({
    OPENING: Object.freeze({
        id: 'opening',
        title: '오프닝',
        cards: Object.freeze([
            Object.freeze({ speaker: '로라', text: '첫 카드' }),
            Object.freeze({ speaker: '플레이어', text: '둘째 카드' })
        ])
    }),
    STORY: Object.freeze({
        id: 'story',
        title: '이야기',
        cards: Object.freeze([
            Object.freeze({ speaker: '로라', text: '이야기 카드' })
        ])
    })
});

test('컷씬 세션은 활성 컷씬 뒤 대기열을 순서대로 열고 마지막 복귀 모드를 반환한다', () => {
    const session = new TutorialCutsceneSession({
        registry: CUTSCENES,
        enabled: true,
        initialReturnMode: 'menu'
    });

    const opened = session.open('opening', 'battle');
    assert.equal(opened.ok, true);
    assert.equal(opened.opened, true);
    assert.equal(session.getState().cutsceneId, 'opening');

    const queued = session.open('story', 'result');
    assert.equal(queued.ok, true);
    assert.equal(queued.queued, true);
    assert.equal(session.hasPending(), true);

    const advanced = session.advance();
    assert.equal(advanced.closed, false);
    assert.equal(session.getState().cardIndex, 1);

    const chained = session.advance();
    assert.equal(chained.closed, true);
    assert.equal(chained.completedCutsceneId, 'opening');
    assert.equal(chained.openedCutsceneId, 'story');
    assert.equal(chained.resumeMode, null);
    assert.equal(session.getState().cutsceneId, 'story');
    assert.equal(session.hasPending(), false);

    const completed = session.advance();
    assert.equal(completed.completedCutsceneId, 'story');
    assert.equal(completed.openedCutsceneId, null);
    assert.equal(completed.resumeMode, 'result');
    assert.equal(session.isOpen(), false);
});

test('컷씬 세션은 런 중 중복을 막고 명시적 반복과 reset 뒤 재생은 허용한다', () => {
    const session = new TutorialCutsceneSession({
        registry: CUTSCENES,
        enabled: true,
        initialReturnMode: 'menu'
    });

    assert.equal(session.open('story', 'battle').ok, true);
    assert.equal(session.advance().resumeMode, 'battle');

    const duplicate = session.open('story', 'battle');
    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.reason, 'duplicate-cutscene');

    assert.equal(session.open('story', 'gallery', { repeat: true }).ok, true);
    assert.equal(session.advance().resumeMode, 'gallery');

    session.reset({ returnMode: 'starter' });
    assert.equal(session.isOpen(), false);
    assert.equal(session.hasPending(), false);
    assert.equal(session.open('story', 'battle').ok, true);
});

test('컷씬 세션은 비활성·미등록 요청을 거부하고 skip도 본 컷씬으로 반환한다', () => {
    const disabled = new TutorialCutsceneSession({
        registry: CUTSCENES,
        enabled: false,
        initialReturnMode: 'menu'
    });
    assert.equal(disabled.open('opening', 'battle').reason, 'cutscenes-disabled');

    const session = new TutorialCutsceneSession({
        registry: CUTSCENES,
        enabled: true,
        initialReturnMode: 'menu'
    });
    assert.equal(session.open('missing', 'battle').reason, 'unknown-cutscene-id');
    session.open('opening', 'battle');
    const skipped = session.skip();
    assert.equal(skipped.ok, true);
    assert.equal(skipped.completedCutsceneId, 'opening');
    assert.equal(skipped.resumeMode, 'battle');
    assert.equal(session.isOpen(), false);
});

test('TutorialScene은 컷씬 세션에 큐·복귀·중복 상태를 위임하고 역참조를 만들지 않는다', async () => {
    const [sceneSource, sessionSource] = await Promise.all([
        readFile(new URL(
            '../project/engine/script/scene/tutorial/_tutorial_scene.js',
            import.meta.url
        ), 'utf8'),
        readFile(new URL(
            '../project/engine/script/scene/tutorial/_tutorial_cutscene_session.js',
            import.meta.url
        ), 'utf8')
    ]);

    assert.match(sceneSource, /import \{ TutorialCutsceneSession \}/);
    assert.match(sceneSource, /new TutorialCutsceneSession\b/);
    for (const legacyState of [
        'pendingCutscenes',
        'cutsceneReturnMode',
        'runCutsceneIds',
        '#openCutscene',
        '#resumeAfterCutscene'
    ]) {
        assert.equal(sceneSource.includes(legacyState), false, legacyState);
    }
    assert.equal((sessionSource.match(/export class /g) || []).length, 1);
    assert.equal(sessionSource.includes("from './_tutorial_scene.js'"), false);
});
