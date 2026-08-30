import assert from 'node:assert/strict';
import test from 'node:test';

import { TUTORIAL_CONTENT_DATA } from '../project/engine/script/data/game/tutorial_content_data.js';
import { TUTORIAL_GAME_DATA } from '../project/engine/script/data/game/tutorial_game_data.js';
import { TutorialGalleryController } from '../project/engine/script/scene/tutorial/_tutorial_gallery_controller.js';
import { TutorialRecordSpawnPlanner } from '../project/engine/script/scene/tutorial/_tutorial_record_spawn_planner.js';
import {
    createDefaultTutorialMeta,
    unlockTutorialRecord
} from '../project/engine/script/scene/tutorial/_tutorial_meta_progress.js';
import { TutorialRecordPopupQueue } from '../project/engine/script/scene/tutorial/_tutorial_record_popup_queue.js';
import { TUTORIAL_COMMANDS } from '../project/engine/script/scene/tutorial/_tutorial_scene_constants.js';
import { TutorialGalleryView } from '../project/engine/script/scene/tutorial/view/_tutorial_gallery_view.js';

/** @param {{x:number,y:number}} value @returns {string} 좌표 키입니다. */
function positionKey(value) {
    return `${value.x},${value.y}`;
}

test('일기·개발자 기록 10개와 층별 후보 스폰포인트는 빈 타일에 고정된다', () => {
    const contentRecordIds = [
        ...TUTORIAL_CONTENT_DATA.RECORDS.LORA,
        ...TUTORIAL_CONTENT_DATA.RECORDS.DEVELOPER
    ].map(({ id }) => id);
    const placedRecords = TUTORIAL_GAME_DATA.FLOORS.flatMap(
        (floor) => floor.records
    );
    assert.equal(contentRecordIds.length, 10);
    assert.equal(new Set(contentRecordIds).size, 10);
    assert.deepEqual(
        placedRecords.map(({ recordId }) => recordId).sort(),
        [...contentRecordIds].sort()
    );

    for (const floor of TUTORIAL_GAME_DATA.FLOORS) {
        const occupied = new Set([
            positionKey(floor.playerStart),
            positionKey(floor.loraStart),
            ...floor.walls.map(positionKey),
            ...floor.items.map(positionKey),
            ...floor.eventTiles.map(positionKey),
            ...floor.teleports.map(positionKey),
            ...floor.mobs.map(positionKey)
        ]);
        const recordPositions = floor.records.map(positionKey);
        assert.equal(new Set(recordPositions).size, recordPositions.length, floor.id);
        assert.equal(recordPositions.some((key) => occupied.has(key)), false, floor.id);
    }
});

test('미획득 기록과 현재 페이즈 스폰포인트를 각각 무작위로 뽑아 최대 두 개만 배치한다', () => {
    const randomValues = [0.9, 0.8, 0, 0.2];
    const planner = new TutorialRecordSpawnPlanner(TUTORIAL_GAME_DATA.FLOORS, {
        random: () => randomValues.shift()
    });
    const planned = planner.createFloorRecords();

    assert.deepEqual(planned, [
        [{
            id: 'f1-developer-diary-1',
            recordId: 'developer-diary:3',
            x: 1,
            y: 6
        }],
        [{
            id: 'b1-lora-diary-6',
            recordId: 'lora-diary:1',
            x: 1,
            y: 3
        }]
    ]);
    assert.equal(planned.flat().length, 2);
    assert.equal(new Set(planned.flat().map(({ recordId }) => recordId)).size, 2);

    const allRecordIds = [
        ...TUTORIAL_CONTENT_DATA.RECORDS.LORA,
        ...TUTORIAL_CONTENT_DATA.RECORDS.DEVELOPER
    ].map(({ id }) => id);
    const lastRecordPlanner = new TutorialRecordSpawnPlanner(TUTORIAL_GAME_DATA.FLOORS, {
        random: () => 0
    });
    const onlyLastRecord = lastRecordPlanner.createFloorRecords(
        allRecordIds.filter((recordId) => recordId !== 'developer-diary:3')
    );
    assert.deepEqual(onlyLastRecord[0].map(({ recordId }) => recordId), [
        'developer-diary:3'
    ]);
    assert.deepEqual(onlyLastRecord[1], []);
    assert.deepEqual(lastRecordPlanner.createFloorRecords(allRecordIds), [[], []]);
});

test('기록 해금은 갤러리 본문 공개와 안정 ID 직접 선택을 함께 복원한다', () => {
    let meta = createDefaultTutorialMeta();
    meta = unlockTutorialRecord(meta, 'developer-diary:2');
    const gallery = new TutorialGalleryController({
        content: TUTORIAL_CONTENT_DATA,
        cutscenes: TUTORIAL_GAME_DATA.CUTSCENES
    });
    assert.equal(gallery.selectEntry('developer-diary:2', meta), true);
    const snapshot = gallery.getSnapshot(meta);
    assert.equal(snapshot.selectedSectionId, 'developer-diary');
    assert.equal(
        snapshot.sections.find(({ id }) => id === 'developer-diary')?.title,
        '개발자의 기록'
    );
    assert.equal(snapshot.selectedIndex, 1);
    assert.equal(snapshot.selectedEntry.unlocked, true);
    assert.equal(
        snapshot.selectedEntry.body,
        TUTORIAL_CONTENT_DATA.DIARIES.DEVELOPER[1]
    );
    assert.equal(snapshot.entries[0].unlocked, false);
    assert.equal(snapshot.entries[0].body, '???');
    assert.equal(gallery.selectEntry('unknown-record', meta), false);
});

test('한 경로의 여러 기록 팝업은 중복 없이 획득 순서로 열린다', () => {
    const queue = new TutorialRecordPopupQueue();
    assert.equal(queue.enqueue([
        'lora-diary:1',
        'lora-diary:2',
        'lora-diary:1',
        '',
        null
    ]), 2);
    assert.equal(queue.hasWork(), true);
    assert.equal(queue.openNext(), 'lora-diary:1');
    assert.equal(queue.openNext(), 'lora-diary:1');
    assert.equal(queue.enqueue(['lora-diary:1', 'developer-diary:1']), 1);
    assert.equal(queue.closeActive(), 'lora-diary:1');
    assert.equal(queue.openNext(), 'lora-diary:2');
    assert.equal(queue.closeActive(), 'lora-diary:2');
    assert.equal(queue.openNext(), 'developer-diary:1');
    assert.equal(queue.closeActive(), 'developer-diary:1');
    assert.equal(queue.hasWork(), false);
    queue.clear();
    assert.equal(queue.getActiveId(), null);
});

test('전투 기록 팝업은 갤러리 버튼 레이아웃을 재사용하고 전용 닫기 명령을 낸다', () => {
    const gallery = new TutorialGalleryController({
        content: TUTORIAL_CONTENT_DATA,
        cutscenes: TUTORIAL_GAME_DATA.CUTSCENES
    });
    const meta = unlockTutorialRecord(createDefaultTutorialMeta(), 'lora-diary:1');
    gallery.selectEntry('lora-diary:1', meta);
    const snapshot = gallery.getSnapshot(meta);
    const view = new TutorialGalleryView({ render() {}, renderGL() {} });
    const buttons = view.getButtonSpecs({
        viewport: { WW: 1280, WH: 720, UIWW: 1280, UIOffsetX: 0 },
        sections: snapshot.sections,
        entries: snapshot.entries,
        selectedEntry: snapshot.selectedEntry,
        selectedIndex: snapshot.selectedIndex,
        closeCommandType: TUTORIAL_COMMANDS.CLOSE_RECORD
    });
    assert.equal(
        buttons.find(({ key }) => key === 'gallery-back').command.type,
        TUTORIAL_COMMANDS.CLOSE_RECORD
    );
});
