import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    TUTORIAL_COMMANDS,
    TUTORIAL_MODES
} from '../project/engine/script/scene/tutorial/_tutorial_scene_constants.js';
import {
    TUTORIAL_KEY_CODES,
    TUTORIAL_KEY_DIRECTIONS,
    TUTORIAL_SELECTION_KEY_CODES,
    TUTORIAL_WATCHED_KEY_CODES
} from '../project/engine/script/scene/tutorial/_tutorial_input_bindings.js';
import {
    canRestartTutorialRun,
    canReturnToTutorialMenu,
    getTutorialModePolicy,
    isTutorialBattleMode
} from '../project/engine/script/scene/tutorial/_tutorial_mode_policy.js';
import {
    areSerializableValuesEqual,
    clampNumber,
    cloneTile,
    cloneValue,
    toList,
    toTileKey
} from '../project/engine/script/scene/tutorial/_tutorial_value_utils.js';
import {
    TUTORIAL_META_VERSION,
    markTutorialCombatGuideSeen,
    normalizeTutorialMeta
} from '../project/engine/script/scene/tutorial/_tutorial_meta_progress.js';

const EXPECTED_MODES = Object.freeze({
    LOADING: 'loading',
    MENU: 'menu',
    STARTER: 'starter',
    BATTLE: 'battle',
    PAUSE: 'pause',
    RESULT: 'result',
    GALLERY: 'gallery',
    CHANGELOG: 'changelog',
    RECORD: 'record'
});

const EXPECTED_COMMANDS = Object.freeze({
    META_READY: 'tutorial/meta-ready',
    START: 'tutorial/start',
    OPEN_GALLERY: 'tutorial/open-gallery',
    OPEN_CHANGELOG: 'tutorial/open-changelog',
    CHANGELOG_SHIFT: 'tutorial/changelog-shift',
    RETURN_MENU: 'tutorial/return-menu',
    STARTER_SHIFT: 'tutorial/starter-shift',
    CHOOSE_STARTER: 'tutorial/choose-starter',
    PAUSE: 'tutorial/pause',
    RESUME: 'tutorial/resume',
    PAUSE_SHIFT: 'tutorial/pause-shift',
    RESTART: 'tutorial/restart',
    GALLERY_SECTION_SHIFT: 'tutorial/gallery-section-shift',
    GALLERY_SHIFT: 'tutorial/gallery-shift',
    GALLERY_PLAY: 'tutorial/gallery-play',
    CLOSE_RECORD: 'tutorial/close-record',
    CUTSCENE_NEXT: 'tutorial/cutscene-next',
    CUTSCENE_CLOSE: 'tutorial/cutscene-close',
    PLAN_STEP: 'tutorial/plan-step',
    PLAN_BACK: 'tutorial/plan-back',
    PLAN_RESET: 'tutorial/plan-reset',
    COMMIT_PATH: 'tutorial/commit-path',
    SELECT_ATTACK: 'tutorial/select-attack',
    ATTACK: 'tutorial/attack',
    HEAL: 'tutorial/heal',
    IDLE: 'tutorial/idle',
    USE_ITEM: 'tutorial/use-item',
    INVENTORY_PAGE_SHIFT: 'tutorial/inventory-page-shift',
    FOCUS_SHIFT: 'tutorial/focus-shift',
    SELECT_CLEANSE: 'tutorial/select-cleanse',
    CLEANSE_EVENT_TILE: 'tutorial/cleanse-event-tile',
    GUIDE_SHOW: 'tutorial/guide-show',
    GUIDE_ADVANCE: 'tutorial/guide-advance',
    GUIDE_DISMISS: 'tutorial/guide-dismiss',
    PERFORM_LORA: 'tutorial/perform-lora',
    COMPLETE_LORA: 'tutorial/complete-lora'
});

test('튜토리얼 모드와 명령 계약은 누락·중복 없이 고정된다', () => {
    assert.deepEqual(TUTORIAL_MODES, EXPECTED_MODES);
    assert.deepEqual(TUTORIAL_COMMANDS, EXPECTED_COMMANDS);
    assert.equal(Object.isFrozen(TUTORIAL_MODES), true);
    assert.equal(Object.isFrozen(TUTORIAL_COMMANDS), true);
    assert.equal(
        new Set(Object.values(TUTORIAL_MODES)).size,
        Object.keys(TUTORIAL_MODES).length
    );
    assert.equal(
        new Set(Object.values(TUTORIAL_COMMANDS)).size,
        Object.keys(TUTORIAL_COMMANDS).length
    );
});

test('키 바인딩은 네 방향과 모든 의미 키를 watched 목록에 한 번씩 포함한다', () => {
    assert.deepEqual(
        TUTORIAL_KEY_DIRECTIONS.map(({ x, y }) => [x, y]),
        [[0, -1], [1, 0], [0, 1], [-1, 0]]
    );
    assert.equal(
        new Set(TUTORIAL_KEY_DIRECTIONS.map(({ x, y }) => `${x},${y}`)).size,
        4
    );
    assert.equal(
        new Set(TUTORIAL_WATCHED_KEY_CODES).size,
        TUTORIAL_WATCHED_KEY_CODES.length
    );

    const requiredCodes = [
        ...Object.values(TUTORIAL_KEY_CODES),
        ...TUTORIAL_SELECTION_KEY_CODES.PREVIOUS,
        ...TUTORIAL_SELECTION_KEY_CODES.NEXT,
        ...TUTORIAL_KEY_DIRECTIONS.flatMap(({ codes }) => codes)
    ];
    for (const code of requiredCodes) {
        assert.equal(
            TUTORIAL_WATCHED_KEY_CODES.includes(code),
            true,
            `watched 목록에 ${code}가 없습니다.`
        );
    }
});

test('숫자와 타일 유틸은 기존 장면의 정규화 계약을 보존한다', () => {
    assert.equal(clampNumber(7, 0, 5), 5);
    assert.equal(clampNumber(-2, 0, 5), 0);
    assert.equal(clampNumber('3', 0, 5), 3);
    assert.equal(clampNumber(Number.NaN, 2, 5), 2);
    assert.equal(toTileKey(4, 7), '4,7');
    assert.deepEqual(cloneTile({ x: '4', y: 7 }), { x: 4, y: 7 });
    assert.equal(cloneTile({ x: 1.5, y: 2 }), null);
    assert.equal(cloneTile(null), null);

    const list = [1, 2];
    assert.equal(toList(list), list);
    assert.deepEqual(toList(new Map([['a', 1], ['b', 2]])), [1, 2]);
    assert.deepEqual(toList(new Set([1, 2])), []);
});

test('범용 방어 복제는 배열·Map·Set·순환 참조를 독립 복제한다', () => {
    const mapKey = { id: 'key' };
    const original = {
        tile: { x: 2, y: 3 },
        entries: [{ value: 1 }],
        map: new Map([[mapKey, { value: 2 }]]),
        set: new Set([{ value: 3 }])
    };
    original.self = original;

    const cloned = cloneValue(original);
    assert.notEqual(cloned, original);
    assert.equal(cloned.self, cloned);
    assert.notEqual(cloned.tile, original.tile);
    assert.notEqual(cloned.entries[0], original.entries[0]);
    assert.notEqual([...cloned.map.keys()][0], mapKey);
    assert.notEqual([...cloned.map.values()][0], [...original.map.values()][0]);
    assert.notEqual([...cloned.set][0], [...original.set][0]);

    cloned.tile.x = 9;
    cloned.entries[0].value = 9;
    assert.deepEqual(original.tile, { x: 2, y: 3 });
    assert.equal(original.entries[0].value, 1);
    assert.equal(areSerializableValuesEqual({ a: [1] }, { a: [1] }), true);
    assert.equal(areSerializableValuesEqual({ a: [1] }, { a: [2] }), false);
});

test('구버전 메타는 전투 안내 미확인으로 이관되고 확인 상태는 새 객체에 기록된다', () => {
    const migrated = normalizeTutorialMeta({ version: 1, playCount: 2 });
    assert.equal(migrated.version, TUTORIAL_META_VERSION);
    assert.equal(migrated.combatGuideSeen, false);
    const seen = markTutorialCombatGuideSeen(migrated);
    assert.equal(seen.combatGuideSeen, true);
    assert.equal(migrated.combatGuideSeen, false);
});

test('모드 정책 표는 기존 표시·복귀·재시작·전투 입력 경계를 보존한다', () => {
    const expected = [
        [TUTORIAL_MODES.LOADING, 'loading', null, false, false, false],
        [TUTORIAL_MODES.MENU, 'menu', 'menu', true, false, false],
        [TUTORIAL_MODES.STARTER, 'starter', 'starter', true, false, false],
        [TUTORIAL_MODES.BATTLE, 'battle', 'battle', true, true, true],
        [TUTORIAL_MODES.PAUSE, 'pause', 'pause', true, true, false],
        [TUTORIAL_MODES.RESULT, 'result', 'result', true, true, false],
        [TUTORIAL_MODES.GALLERY, 'gallery', 'gallery', true, false, false],
        [TUTORIAL_MODES.CHANGELOG, 'changelog', 'changelog', true, false, false],
        [TUTORIAL_MODES.RECORD, 'gallery', 'gallery', false, false, false]
    ];

    for (const [mode, view, buttons, returnMenu, restart, battle] of expected) {
        assert.deepEqual(getTutorialModePolicy(mode), {
            view,
            buttons,
            canReturnMenu: returnMenu,
            canRestartRun: restart,
            acceptsBattleInput: battle
        });
        assert.equal(canReturnToTutorialMenu(mode), returnMenu);
        assert.equal(canRestartTutorialRun(mode), restart);
        assert.equal(isTutorialBattleMode(mode), battle);
    }
    assert.equal(getTutorialModePolicy('unknown'), null);
});

test('TutorialScene은 seam 모듈을 import하고 같은 정의를 내부에 남기지 않는다', async () => {
    const scene = await readFile(new URL(
        '../project/engine/script/scene/tutorial/_tutorial_scene.js',
        import.meta.url
    ), 'utf8');

    for (const moduleName of [
        '_tutorial_scene_constants.js',
        '_tutorial_input_bindings.js',
        '_tutorial_mode_policy.js',
        '_tutorial_value_utils.js'
    ]) {
        assert.equal(scene.includes(moduleName), true, `${moduleName} import가 없습니다.`);
    }
    for (const pattern of [
        /\nconst MODES\s*=/,
        /\nconst COMMANDS\s*=/,
        /\nconst WATCHED_KEY_CODES\s*=/,
        /\nconst KEY_DIRECTIONS\s*=/,
        /\nfunction clampNumber\s*\(/,
        /\nfunction toTileKey\s*\(/,
        /\nfunction cloneTile\s*\(/,
        /\nfunction cloneCheckpointValue\s*\(/
    ]) {
        assert.equal(pattern.test(scene), false, `장면에 중복 정의가 남았습니다: ${pattern}`);
    }
});

test('seam 의존성은 장면을 역참조하지 않는 단방향 그래프다', async () => {
    const seamNames = [
        '_tutorial_scene_constants.js',
        '_tutorial_input_bindings.js',
        '_tutorial_mode_policy.js',
        '_tutorial_value_utils.js'
    ];
    const sources = await Promise.all(seamNames.map((name) => readFile(new URL(
        `../project/engine/script/scene/tutorial/${name}`,
        import.meta.url
    ), 'utf8')));

    for (const source of sources) {
        assert.equal(source.includes("from './_tutorial_scene.js'"), false);
    }
    assert.equal(/\bimport\s/.test(sources[0]), false);
    assert.equal(/\bimport\s/.test(sources[1]), false);
    assert.match(sources[2], /from '\.\/_tutorial_scene_constants\.js'/);
    assert.equal(/\bimport\s/.test(sources[3]), false);
});
