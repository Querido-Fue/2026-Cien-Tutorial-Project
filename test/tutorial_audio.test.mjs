import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
    migrateAudioSettings,
    normalizeAudioSettingValue
} from '../project/engine/script/data/sound/audio_setting_contract.js';
import {
    TUTORIAL_AUDIO_MANIFEST,
    TUTORIAL_BGM_IDS,
    TUTORIAL_SFX_IDS,
    TUTORIAL_UI_AUDIO_IDS
} from '../project/engine/script/data/sound/tutorial_audio_manifest.js';
import { TutorialAudioDirector } from '../project/engine/script/scene/tutorial/_tutorial_audio_director.js';
import { TUTORIAL_COMMANDS } from '../project/engine/script/scene/tutorial/_tutorial_scene_constants.js';
import { AudioBus } from '../project/engine/script/sound/_audio_bus.js';
import { AudioManifestResolver } from '../project/engine/script/sound/_audio_manifest_resolver.js';
import { AudioUnlockGate } from '../project/engine/script/sound/_audio_unlock_gate.js';
import { MusicBus } from '../project/engine/script/sound/_music_bus.js';
import {
    normalizeAudioVolume,
    sanitizeAudioVolume
} from '../project/engine/script/sound/_audio_volume.js';
import { auditTutorialAudioAssets } from '../scripts/tutorial-assets/tutorial_audio_asset_audit.mjs';
import { FakeAudio } from './_fake_audio.mjs';

const TEST_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(TEST_DIRECTORY, '..');

test('오디오 매니페스트는 버스 정책과 지하층 fallback을 완전하게 고정한다', () => {
    assert.equal(Object.isFrozen(TUTORIAL_AUDIO_MANIFEST), true);
    assert.equal(Object.isFrozen(TUTORIAL_AUDIO_MANIFEST.ENTRIES), true);
    const ids = TUTORIAL_AUDIO_MANIFEST.ENTRIES.map((entry) => entry.id);
    assert.equal(ids.length, 27);
    assert.equal(new Set(ids).size, ids.length);
    for (const entry of TUTORIAL_AUDIO_MANIFEST.ENTRIES) {
        assert.equal(Object.isFrozen(entry), true, entry.id);
        assert.match(entry.runtimePath, /^\.\.\/asset\/tutorial\/audio\/[a-z0-9./-]+\.mp3$/);
        assert.equal(['bgm', 'sfx', 'ui'].includes(entry.bus), true, entry.id);
        assert.equal(typeof entry.loop, 'boolean', entry.id);
        assert.equal(typeof entry.required, 'boolean', entry.id);
        assert.ok(entry.defaultVolume >= 0 && entry.defaultVolume <= 1, entry.id);
        assert.ok(Number.isInteger(entry.polyphony) && entry.polyphony >= 1, entry.id);
        assert.ok(entry.cooldownSeconds >= 0, entry.id);
    }
    const resolver = new AudioManifestResolver(TUTORIAL_AUDIO_MANIFEST);
    const basement = resolver.resolve(TUTORIAL_BGM_IDS.BASEMENT, 'bgm');
    assert.equal(basement.resolvedId, TUTORIAL_BGM_IDS.FLOOR_1);
    assert.equal(basement.fallbackUsed, true);
    assert.deepEqual(basement.fallbackChain, [
        TUTORIAL_BGM_IDS.BASEMENT,
        TUTORIAL_BGM_IDS.FLOOR_1
    ]);
    const expectedBgmVolumes = new Map([
        [TUTORIAL_BGM_IDS.MAIN, 0.504],
        [TUTORIAL_BGM_IDS.OPENING, 0.546],
        [TUTORIAL_BGM_IDS.FLOOR_1, 0.518],
        [TUTORIAL_BGM_IDS.BASEMENT, 0.518],
        [TUTORIAL_BGM_IDS.ENDING_STABILIZED, 0.546],
        [TUTORIAL_BGM_IDS.ENDING_SUBDUED, 0.546]
    ]);
    for (const [id, expectedVolume] of expectedBgmVolumes) {
        const entry = TUTORIAL_AUDIO_MANIFEST.ENTRIES.find((candidate) => candidate.id === id);
        assert.ok(Math.abs(entry.defaultVolume - expectedVolume) < 0.0001, id);
    }
    const breathing = TUTORIAL_AUDIO_MANIFEST.ENTRIES.find(
        (entry) => entry.id === TUTORIAL_SFX_IDS.LORA_HEAVY_BREATHING
    );
    assert.equal(breathing.defaultVolume, 0.31);

    const cyclic = new AudioManifestResolver([
        { id: 'a', available: false, fallback: 'b' },
        { id: 'b', available: false, fallback: 'a' }
    ]);
    assert.equal(cyclic.resolve('a'), null);
    assert.equal(resolver.resolve('missing'), null);
});

test('음악 버스는 같은 곡을 재시작하지 않고 두 채널 crossfade를 완료한다', async () => {
    const audios = [];
    const resolver = new AudioManifestResolver(TUTORIAL_AUDIO_MANIFEST);
    const bus = new MusicBus({
        resolver,
        audioFactory: (source) => {
            const audio = new FakeAudio(source);
            audios.push(audio);
            return audio;
        },
        crossfadeSeconds: 0.5
    });
    assert.equal((await bus.play(TUTORIAL_BGM_IDS.MAIN)).ok, true);
    assert.equal(audios.length, 1);
    assert.equal((await bus.play(TUTORIAL_BGM_IDS.MAIN)).deduplicated, true);
    assert.equal(audios.length, 1);

    assert.equal((await bus.play(TUTORIAL_BGM_IDS.OPENING)).ok, true);
    assert.equal(audios.length, 2);
    assert.equal(bus.getState().fadingCount, 1);
    assert.equal(audios[1].volume, 0);
    bus.update(0.25);
    assert.ok(Math.abs(audios[0].volume - 0.252) < 0.001);
    assert.ok(Math.abs(audios[1].volume - 0.273) < 0.001);
    bus.update(0.25);
    assert.equal(audios[0].paused, true);
    assert.equal(audios[0].currentTime, 0);
    assert.ok(Math.abs(audios[1].volume - 0.546) < 0.001);
    assert.equal(bus.getState().fadingCount, 0);

    assert.equal((await bus.play(TUTORIAL_BGM_IDS.FLOOR_1)).ok, true);
    bus.update(0.5);
    assert.equal(audios.length, 3);
    const basement = await bus.play(TUTORIAL_BGM_IDS.BASEMENT);
    assert.equal(basement.deduplicated, true);
    assert.equal(basement.resolvedId, TUTORIAL_BGM_IDS.FLOOR_1);
    assert.equal(audios.length, 3);

    bus.setSuspended(true);
    assert.equal(audios[2].paused, true);
    bus.setSuspended(false);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(audios[2].paused, false);
    bus.destroy();
    assert.equal(audios[2].paused, true);
});

test('효과 버스는 cooldown·polyphony·loop 중복과 pause/resume을 제한한다', async () => {
    let now = 0;
    const audios = [];
    const resolver = new AudioManifestResolver({ ENTRIES: [
        Object.freeze({
            id: 'sfx.test', runtimePath: 'test.mp3', bus: 'sfx', available: true,
            loop: false, defaultVolume: 1, polyphony: 2, cooldownSeconds: 0.1
        }),
        Object.freeze({
            id: 'sfx.loop', runtimePath: 'loop.mp3', bus: 'sfx', available: true,
            loop: true, defaultVolume: 0.5, polyphony: 1, cooldownSeconds: 0
        })
    ] });
    const bus = new AudioBus({
        name: 'sfx', resolver, now: () => now,
        audioFactory: (source) => {
            const audio = new FakeAudio(source);
            audios.push(audio);
            return audio;
        }
    });
    assert.equal((await bus.play('sfx.test')).ok, true);
    assert.equal((await bus.play('sfx.test')).reason, 'cooldown');
    now = 0.11;
    assert.equal((await bus.play('sfx.test')).ok, true);
    now = 0.22;
    assert.equal((await bus.play('sfx.test')).reason, 'polyphony');
    audios[0].finish();
    bus.update();
    assert.equal((await bus.play('sfx.test')).ok, true);

    const loop = await bus.play('sfx.loop');
    assert.equal(loop.ok, true);
    assert.equal((await bus.play('sfx.loop')).deduplicated, true);
    bus.setVolume(0.5);
    assert.equal(loop.audio.volume, 0.25);
    bus.setSuspended(true);
    assert.equal(loop.audio.paused, true);
    bus.setSuspended(false);
    await Promise.resolve();
    assert.equal(loop.audio.paused, false);
    bus.stop('sfx.loop');
    assert.deepEqual(bus.getState().loopIds, []);
    bus.destroy();
    assert.equal(bus.getState().voiceCount, 0);
});

test('오디오 실패와 자동재생 unlock 대기는 예외 없이 안전하게 끝난다', async () => {
    const resolver = new AudioManifestResolver({ ENTRIES: [Object.freeze({
        id: 'bgm.blocked', runtimePath: 'blocked.mp3', bus: 'bgm', available: true,
        loop: true, defaultVolume: 1, polyphony: 1, cooldownSeconds: 0
    })] });
    let blockedCount = 0;
    const music = new MusicBus({
        resolver,
        audioFactory: (source) => new FakeAudio(source, { rejectPlayCount: 1 }),
        onPlayBlocked: () => { blockedCount += 1; }
    });
    const result = await music.play('bgm.blocked');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'play-blocked');
    assert.equal(blockedCount, 1);
    assert.equal((await music.play('missing')).reason, 'missing-cue');

    const listeners = new Map();
    let unlockCount = 0;
    const gate = new AudioUnlockGate({
        target: {
            addEventListener(name, callback) { listeners.set(name, callback); },
            removeEventListener(name) { listeners.delete(name); }
        },
        events: ['pointerdown'],
        onUnlock: async () => { unlockCount += 1; return true; }
    });
    gate.arm();
    gate.arm();
    assert.equal(listeners.size, 1);
    await listeners.get('pointerdown')();
    assert.equal(unlockCount, 1);
    assert.equal(listeners.size, 0);
    gate.destroy();
    music.destroy();
});

test('튜토리얼 오디오 디렉터는 화면 BGM·호흡 loop·UI 명령과 cue를 분리한다', () => {
    const calls = [];
    const soundPort = {
        playBgm(id) { calls.push(['bgm', id]); return Promise.resolve(); },
        playCue(id) { calls.push(['cue', id]); return Promise.resolve(); },
        startLoop(id) { calls.push(['loop', id]); return Promise.resolve(); },
        stopCue(id) { calls.push(['stop', id]); }
    };
    const director = new TutorialAudioDirector({ soundPort, instabilityThreshold: 61 });
    director.sync({ mode: 'menu' });
    director.sync({ mode: 'menu' });
    director.sync({
        mode: 'battle', floorIndex: 0, cutsceneOpen: true,
        lora: { hp: 100, instability: 70 }
    });
    director.sync({ mode: 'battle', floorIndex: 0, lora: { hp: 100, instability: 70 } });
    assert.equal(calls.filter(([type]) => type === 'loop').length, 0);
    director.sync({ mode: 'battle', floorIndex: 1, lora: { hp: 100, instability: 70 } });
    assert.deepEqual(calls.filter(([type]) => type === 'loop'), [
        ['loop', TUTORIAL_SFX_IDS.LORA_HEAVY_BREATHING]
    ]);
    director.sync({ mode: 'record', floorIndex: 1, lora: { hp: 100, instability: 70 } });
    director.sync({ mode: 'battle', floorIndex: 1, lora: { hp: 100, instability: 60 } });
    director.sync({ mode: 'result', result: { endingId: 'true' } });
    director.sync({ mode: 'result', result: { endingId: 'special' } });
    director.sync({ mode: 'gallery', cutsceneOpen: true });
    assert.deepEqual(calls.filter(([type]) => type === 'bgm'), [
        ['bgm', TUTORIAL_BGM_IDS.MAIN],
        ['bgm', TUTORIAL_BGM_IDS.OPENING],
        ['bgm', TUTORIAL_BGM_IDS.FLOOR_1],
        ['bgm', TUTORIAL_BGM_IDS.ENDING_STABILIZED],
        ['bgm', TUTORIAL_BGM_IDS.ENDING_SUBDUED],
        ['bgm', TUTORIAL_BGM_IDS.OPENING]
    ]);
    assert.equal(calls.some(([type, id]) => (
        type === 'stop' && id === TUTORIAL_SFX_IDS.LORA_HEAVY_BREATHING
    )), true);

    director.consume([{ id: TUTORIAL_SFX_IDS.PLAYER_HEAL }]);
    director.playCommand(TUTORIAL_COMMANDS.GALLERY_SHIFT);
    director.playCommand(TUTORIAL_COMMANDS.RETURN_MENU);
    director.playCommand(TUTORIAL_COMMANDS.CLOSE_RECORD);
    director.playCommand(TUTORIAL_COMMANDS.CHOOSE_STARTER);
    director.playCommand(TUTORIAL_COMMANDS.START);
    director.notifyAchievements(1);
    for (const expected of [
        TUTORIAL_SFX_IDS.PLAYER_HEAL,
        TUTORIAL_UI_AUDIO_IDS.BOOK_TURN,
        TUTORIAL_UI_AUDIO_IDS.BOOK_CLOSE,
        TUTORIAL_SFX_IDS.ITEM_EQUIP,
        TUTORIAL_UI_AUDIO_IDS.CLICK,
        TUTORIAL_UI_AUDIO_IDS.ACHIEVEMENT
    ]) {
        assert.equal(calls.some(([type, id]) => type === 'cue' && id === expected), true);
    }
    director.destroy();
});

test('오디오 볼륨과 구버전 설정 마이그레이션은 누락·문자열·범위를 보정한다', () => {
    assert.equal(sanitizeAudioVolume(-10), 0);
    assert.equal(sanitizeAudioVolume(130), 100);
    assert.equal(normalizeAudioVolume('45'), 0.45);
    assert.equal(normalizeAudioSettingValue('77'), 77);
    const migration = migrateAudioSettings({ bgmVolume: '45', sfxVolume: 130 });
    assert.deepEqual(migration.values, {
        bgmVolume: 45,
        sfxVolume: 100,
        uiVolume: 100
    });
    assert.equal(migration.changed, true);
});

test('원본과 런타임 MP3 26개는 헤더·해시 계약을 만족하고 지하층만 폴백이다', async () => {
    const audit = await auditTutorialAudioAssets({
        manifest: TUTORIAL_AUDIO_MANIFEST,
        repositoryRoot: REPOSITORY_ROOT,
        checkRuntime: true
    });
    assert.deepEqual(audit.errors, []);
    assert.deepEqual(audit.warnings, []);
    assert.equal(audit.entries.filter(({ status }) => status === 'ready').length, 26);
    assert.deepEqual(
        audit.entries.filter(({ status }) => status === 'declared-fallback'),
        [{
            id: TUTORIAL_BGM_IDS.BASEMENT,
            status: 'declared-fallback',
            fallback: TUTORIAL_BGM_IDS.FLOOR_1
        }]
    );
});

test('오디오 런타임은 파일당 한 클래스와 장면 역참조 금지를 지킨다', async () => {
    const files = [
        '../project/engine/script/sound/_audio_manifest_resolver.js',
        '../project/engine/script/sound/_audio_unlock_gate.js',
        '../project/engine/script/sound/_music_bus.js',
        '../project/engine/script/sound/_audio_bus.js',
        '../project/engine/script/sound/sound_system.js',
        '../project/engine/script/scene/tutorial/_tutorial_audio_director.js'
    ];
    const sources = await Promise.all(files.map((file) => readFile(new URL(
        file,
        import.meta.url
    ), 'utf8')));
    for (const [index, source] of sources.entries()) {
        assert.equal((source.match(/export class /g) || []).length, 1, files[index]);
        assert.equal(source.includes("from './_tutorial_scene.js'"), false, files[index]);
    }
});
