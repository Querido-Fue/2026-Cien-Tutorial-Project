import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { TUTORIAL_CONTENT_DATA } from '../project/engine/script/data/game/tutorial_content_data.js';
import { TUTORIAL_GAME_DATA } from '../project/engine/script/data/game/tutorial_game_data.js';
import { TutorialAchievementEvaluator } from '../project/engine/script/scene/tutorial/_tutorial_achievement_evaluator.js';
import { TutorialCutsceneController } from '../project/engine/script/scene/tutorial/_tutorial_cutscene_controller.js';
import { TutorialCutsceneTriggerRouter } from '../project/engine/script/scene/tutorial/_tutorial_cutscene_trigger_router.js';
import { TutorialGalleryController } from '../project/engine/script/scene/tutorial/_tutorial_gallery_controller.js';
import {
    createDefaultTutorialMeta,
    loadTutorialMeta,
    markTutorialOpeningWatched,
    normalizeTutorialMeta,
    recordTutorialResult,
    saveTutorialMeta,
    TUTORIAL_META_RUNTIME_KEY,
    TUTORIAL_META_VERSION,
    unlockTutorialAchievement,
    unlockTutorialCutscene
} from '../project/engine/script/scene/tutorial/_tutorial_meta_progress.js';

test('확정 일기와 업적명은 문서 순서를 보존하고 임시 조건을 명시한다', () => {
    assert.equal(Object.isFrozen(TUTORIAL_CONTENT_DATA), true);
    assert.deepEqual(
        TUTORIAL_CONTENT_DATA.ACHIEVEMENTS.map((entry) => entry.title),
        [
            '스티브..?',
            '로라의 전설',
            '이건 시작에 불과해',
            '그녀를 스쳐가는 또 한 명의 플레이어',
            '너는 나의 빛이야',
            '깜짝 놀랐지?'
        ]
    );
    assert.deepEqual(
        TUTORIAL_CONTENT_DATA.ACHIEVEMENTS.map((entry) => entry.englishTitle),
        [
            'Steve? Is that you?',
            'The Legend of Lora',
            "It's Just the Beginning",
            'Just Another Random Player',
            'You Are My Sunshine',
            'Peekaboo!'
        ]
    );
    assert.equal(
        TUTORIAL_CONTENT_DATA.ACHIEVEMENTS.every(
            (entry) => entry.description === null
                && entry.descriptionStatus === 'unconfirmed'
                && entry.conditionStatus === 'provisional'
        ),
        true
    );
    assert.equal(TUTORIAL_CONTENT_DATA.DIARIES.LORA.length, 7);
    assert.equal(TUTORIAL_CONTENT_DATA.DIARIES.DEVELOPER.length, 3);
    assert.match(TUTORIAL_CONTENT_DATA.DIARIES.LORA[0], /나랑 알파/);
    assert.match(TUTORIAL_CONTENT_DATA.DIARIES.LORA[6], /또 나갔다/);
    assert.match(TUTORIAL_CONTENT_DATA.DIARIES.DEVELOPER[0], /2013년 10월 1일/);
    assert.match(TUTORIAL_CONTENT_DATA.DIARIES.DEVELOPER[1], /2013년 9월 14일/);
});

test('업적 판정은 안정된 모델 사건만 사용하고 저장된 ID를 중복 해금하지 않는다', () => {
    const evaluator = new TutorialAchievementEvaluator(
        TUTORIAL_CONTENT_DATA.ACHIEVEMENTS
    );
    const events = [
        { type: 'item-picked', itemId: 'diamond-pickaxe' },
        { type: 'item-picked', itemId: 'ocarina' },
        { type: 'floor-transition', floorIndex: 1 },
        { type: 'battle-finished', endingId: 'true' },
        { type: 'teleported' }
    ];
    const result = evaluator.evaluate(events, ['steve-pickaxe']);
    assert.deepEqual(result.unlockedIds, [
        'legend-of-lora',
        'just-the-beginning',
        'another-random-player',
        'you-are-my-sunshine',
        'peekaboo'
    ]);
    assert.deepEqual(
        result.notifications.map((entry) => entry.detail),
        ['로라의 전설', '이건 시작에 불과해', '그녀를 스쳐가는 또 한 명의 플레이어', '너는 나의 빛이야', '깜짝 놀랐지?']
    );
    assert.deepEqual(
        evaluator.evaluate(events, ['steve-pickaxe', ...result.unlockedIds]).unlockedIds,
        []
    );
});

test('컷씬 트리거는 오프닝·실제 아이템·층 전환·엔딩만 한 런에 한 번 연결한다', () => {
    const router = new TutorialCutsceneTriggerRouter({
        triggerData: TUTORIAL_CONTENT_DATA.CUTSCENE_TRIGGERS,
        knownCutsceneIds: Object.values(TUTORIAL_GAME_DATA.CUTSCENES).map(
            (entry) => entry.id
        )
    });
    assert.deepEqual(router.beginRun({ openingWatched: false }), ['opening']);
    assert.deepEqual(router.consume([
        { type: 'item-used', itemId: 'old-teddy' },
        { type: 'item-used', itemId: 'old-teddy' },
        { type: 'item-used', itemId: 'memory-photo' },
        { type: 'item-used', itemId: 'mirror' }
    ]), ['teddy', 'extra-interaction']);
    assert.deepEqual(router.consume([
        { type: 'item-used', itemId: 'eyeliner' },
        { type: 'floor-transition', floorIndex: 1 },
        { type: 'battle-finished', endingId: 'true' },
        { type: 'battle-finished', endingId: 'failure' }
    ]), ['item-synergy', 'basement-transition', 'true']);
    assert.deepEqual(router.consume([
        { type: 'floor-transition', floorIndex: 1 },
        { type: 'battle-finished', endingId: 'true' }
    ]), []);
    assert.deepEqual(router.beginRun({ openingWatched: true }), []);
});

test('갤러리는 업적·일기·엔딩·컷씬을 분리하고 저장 메타로 재생 가능 상태를 복원한다', () => {
    const meta = {
        ...createDefaultTutorialMeta(),
        openingWatched: true,
        unlockedCutsceneIds: ['opening', 'true'],
        unlockedAchievementIds: ['steve-pickaxe'],
        endingIds: ['true']
    };
    const gallery = new TutorialGalleryController({
        content: TUTORIAL_CONTENT_DATA,
        cutscenes: TUTORIAL_GAME_DATA.CUTSCENES
    });
    let snapshot = gallery.getSnapshot(meta);
    assert.equal(snapshot.selectedSectionId, 'achievements');
    assert.equal(snapshot.entries[0].title, '스티브..?');
    assert.equal(snapshot.entries[0].unlocked, true);

    gallery.shiftSection(1);
    snapshot = gallery.getSnapshot(meta);
    assert.equal(snapshot.selectedSectionId, 'lora-diary');
    assert.equal(snapshot.entries.length, 7);
    assert.equal(snapshot.entries.every((entry) => entry.unlocked), true);
    assert.equal(snapshot.entries[0].body, TUTORIAL_CONTENT_DATA.DIARIES.LORA[0]);

    gallery.shiftSection(1);
    snapshot = gallery.getSnapshot(meta);
    assert.equal(snapshot.selectedSectionId, 'developer-diary');
    assert.equal(snapshot.entries[1].body, TUTORIAL_CONTENT_DATA.DIARIES.DEVELOPER[1]);

    gallery.shiftSection(1);
    snapshot = gallery.getSnapshot(meta);
    assert.equal(snapshot.selectedSectionId, 'endings');
    assert.equal(snapshot.selectedEntry.internalId, 'true');
    assert.equal(snapshot.selectedEntry.title, '완벽주의자');
    assert.equal(snapshot.selectedEntry.playable, true);

    gallery.shiftSection(1);
    snapshot = gallery.getSnapshot(meta);
    assert.equal(snapshot.selectedSectionId, 'cutscenes');
    assert.equal(snapshot.selectedEntry.internalId, 'opening');
    assert.equal(snapshot.selectedEntry.playable, true);
});

test('메타 저장은 해금 멱등성·손상 정규화·완료 횟수 경계를 보존한다', async () => {
    const corrupted = normalizeTutorialMeta({
        version: -10,
        playCount: '3.8',
        openingWatched: 'true',
        combatGuideSeen: 1,
        identifiedItemIds: ['mirror', '', 'mirror', 7],
        discoveredTrapIds: 'broken',
        unlockedCutsceneIds: ['opening', 'opening', null],
        unlockedAchievementIds: ['peekaboo', 'peekaboo', {}],
        bestScore: -20,
        endingIds: ['true', 'true']
    });
    assert.deepEqual(corrupted, {
        version: TUTORIAL_META_VERSION,
        playCount: 3,
        openingWatched: true,
        combatGuideSeen: true,
        identifiedItemIds: ['mirror'],
        discoveredTrapIds: [],
        unlockedCutsceneIds: ['opening'],
        unlockedAchievementIds: ['peekaboo'],
        bestScore: 0,
        endingIds: ['true']
    });

    let meta = createDefaultTutorialMeta();
    meta = unlockTutorialCutscene(meta, 'opening');
    meta = unlockTutorialCutscene(meta, 'opening');
    meta = unlockTutorialAchievement(meta, 'peekaboo');
    meta = unlockTutorialAchievement(meta, 'peekaboo');
    meta = markTutorialOpeningWatched(meta);
    assert.deepEqual(meta.unlockedCutsceneIds, ['opening']);
    assert.deepEqual(meta.unlockedAchievementIds, ['peekaboo']);
    assert.equal(meta.playCount, 0, '중단 플레이의 해금은 완료 횟수를 늘리지 않아야 합니다.');

    const completed = recordTutorialResult({ ...meta, bestScore: 50 }, {
        endingId: 'true',
        score: 99999
    });
    assert.equal(completed.playCount, 1);
    assert.equal(completed.bestScore, 50, '미확정 점수는 새 결과에서 갱신하지 않습니다.');
    assert.deepEqual(completed.endingIds, ['true']);

    let storedKey = null;
    let storedValue = null;
    await saveTutorialMeta(completed, {
        setRuntimeStateValue(key, value) {
            storedKey = key;
            storedValue = structuredClone(value);
        }
    });
    assert.equal(storedKey, TUTORIAL_META_RUNTIME_KEY);
    const loaded = await loadTutorialMeta({
        getRuntimeStateValue(key) {
            assert.equal(key, TUTORIAL_META_RUNTIME_KEY);
            return structuredClone(storedValue);
        }
    });
    assert.deepEqual(loaded, completed);

    const cutscenes = new TutorialCutsceneController(TUTORIAL_GAME_DATA.CUTSCENES);
    assert.equal(cutscenes.open('true').ok, true);
    while (cutscenes.isOpen()) {
        cutscenes.next();
    }
    assert.equal(cutscenes.open('true').ok, true, '재실행 후에도 같은 컷씬을 다시 열 수 있어야 합니다.');
});

test('콘텐츠 런타임은 파일당 한 클래스와 장면 역참조 금지를 지킨다', async () => {
    const names = [
        '_tutorial_achievement_evaluator.js',
        '_tutorial_cutscene_trigger_router.js',
        '_tutorial_gallery_controller.js'
    ];
    const sources = await Promise.all(names.map((name) => readFile(new URL(
        `../project/engine/script/scene/tutorial/${name}`,
        import.meta.url
    ), 'utf8')));
    for (const [index, source] of sources.entries()) {
        assert.equal((source.match(/export class /g) || []).length, 1, names[index]);
        assert.equal(source.includes("from './_tutorial_scene.js'"), false, names[index]);
        assert.equal(source.includes('_tutorial_battle_model.js'), false, names[index]);
        assert.equal(source.includes('save_system.js'), false, names[index]);
    }
});

test('장면은 콘텐츠 책임을 분리된 클래스에 위임하고 점수 UI를 다시 노출하지 않는다', async () => {
    const sceneSource = await readFile(new URL(
        '../project/engine/script/scene/tutorial/_tutorial_scene.js',
        import.meta.url
    ), 'utf8');
    for (const dependency of [
        'TutorialAchievementEvaluator',
        'TutorialCutsceneTriggerRouter',
        'TutorialGalleryController'
    ]) {
        assert.match(sceneSource, new RegExp(`import \\{ ${dependency} \\}`));
        assert.match(sceneSource, new RegExp(`new ${dependency}\\b`));
    }

    const scoreFreeSources = await Promise.all([
        '_tutorial_scene.js',
        '_tutorial_gallery_controller.js',
        'view/_tutorial_menu_view.js',
        'view/_tutorial_result_view.js'
    ].map((name) => readFile(new URL(
        `../project/engine/script/scene/tutorial/${name}`,
        import.meta.url
    ), 'utf8')));
    for (const source of scoreFreeSources) {
        assert.equal(/bestScore|calculateScore|전투 기록/.test(source), false);
        assert.equal(/['"]엔딩 ID/.test(source), false);
    }
});
