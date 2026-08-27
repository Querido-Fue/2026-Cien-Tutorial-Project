import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { BALANCE_AGENT_PROFILES } from '../scripts/tutorial-balance/balance_agent_profiles.mjs';
import { TutorialBalanceAgent } from '../scripts/tutorial-balance/_tutorial_balance_agent.mjs';
import { TutorialBalanceModelPort } from '../scripts/tutorial-balance/_tutorial_balance_model_port.mjs';
import { TutorialBalanceRunner } from '../scripts/tutorial-balance/_tutorial_balance_runner.mjs';

test('두 번 실행한 스타터×agent 8개 보고서는 완전히 동일하다', () => {
    const first = new TutorialBalanceRunner().runSuite();
    const second = new TutorialBalanceRunner().runSuite();

    assert.deepEqual(second, first);
    assert.equal(first.scenarios.length, 8);
    assert.deepEqual(first.deterministicInputs.starterIds, ['bow', 'mascot-costume']);
    assert.deepEqual(
        first.deterministicInputs.agentIds,
        BALANCE_AGENT_PROFILES.map(({ id }) => id)
    );
    assert.equal(first.deterministicInputs.randomnessUsed, false);
    assert.equal(first.deterministicInputs.randomSeed, null);
});

test('기본 시뮬레이션은 모델 결과로 종료하고 preview·실행 투영이 일치한다', () => {
    const report = new TutorialBalanceRunner().runSuite();

    assert.equal(report.aggregate.structuralFailures, 0);
    assert.equal(report.aggregate.preview.mismatches, 0);
    for (const scenario of report.scenarios) {
        assert.equal(scenario.harnessStatus, 'ok');
        assert.notEqual(scenario.resolution, 'unknown');
        assert.ok(scenario.commands.used > 0);
        assert.ok(scenario.commands.used <= scenario.commands.limit);
        assert.equal(scenario.invariantViolations.length, 0);
    }
});

test('작은 명령 상한은 무한 반복 대신 모든 시나리오를 command-limit로 닫는다', () => {
    const report = new TutorialBalanceRunner().runSuite({ maxCommands: 1 });

    assert.equal(report.scenarios.length, 8);
    for (const scenario of report.scenarios) {
        assert.equal(scenario.resolution, 'command-limit');
        assert.equal(scenario.commands.used, 1);
        assert.equal(scenario.commands.limit, 1);
        assert.equal(scenario.harnessError.code, 'command-limit');
        assert.deepEqual(scenario.invariantViolations, []);
    }
});

test('명령 상한은 과도한 추적 메모리 사용을 막는 절대 범위를 가진다', () => {
    assert.throws(
        () => new TutorialBalanceRunner().runSuite({ maxCommands: 4097 }),
        /1~4096/
    );
});

test('agent의 동점 선택은 입력 순서와 무관하게 좌표·경로·ID로 고정된다', () => {
    const profile = BALANCE_AGENT_PROFILES.find(({ id }) => id === 'item-interaction-first');
    const agent = new TutorialBalanceAgent(profile);
    const snapshot = {
        player: { x: 1, y: 1 },
        lora: { x: 8, y: 7, instability: 0 },
        inventory: [],
        floor: { items: [], mobs: [], eventTiles: [] }
    };
    const left = { id: '1,0', cost: 1, remainingMoves: 3, path: [{ x: 1, y: 1 }, { x: 1, y: 0 }] };
    const right = { id: '0,1', cost: 1, remainingMoves: 3, path: [{ x: 1, y: 1 }, { x: 0, y: 1 }] };
    const observation = (reachability) => ({
        snapshot,
        reachability,
        cleanseTargets: [],
        eventPolarityByType: {}
    });

    const forward = agent.chooseMovement(observation([left, right]));
    const reversed = agent.chooseMovement(observation([right, left]));
    assert.deepEqual(reversed, forward);
    assert.deepEqual(forward.path.at(-1), { x: 1, y: 0 });
});

test('모델 port는 거부된 preview를 실행하지 않아 공개 불변식을 우회하지 않는다', () => {
    let healCalls = 0;
    const model = {
        getSnapshot: () => ({ result: null }),
        previewPlayerAction: () => ({ ok: false, reason: 'action-unavailable' }),
        heal: () => {
            healCalls += 1;
            return { ok: true, events: [] };
        }
    };
    const metrics = {
        getCommandCount: () => 0,
        recordCommand: () => {},
        recordPreview: () => {}
    };
    const port = new TutorialBalanceModelPort({ model, metrics, maxCommands: 4 });

    assert.throws(
        () => port.performPlayerAction({ type: 'heal', reason: 'test' }),
        ({ code }) => code === 'invariant-failure'
    );
    assert.equal(healCalls, 0);
});

test('agent 모듈은 모델 구현·체크포인트 API에 의존하지 않는다', async () => {
    const sourcePath = fileURLToPath(new URL(
        '../scripts/tutorial-balance/_tutorial_balance_agent.mjs',
        import.meta.url
    ));
    const source = await readFile(sourcePath, 'utf8');

    assert.doesNotMatch(source, /_tutorial_battle_model/);
    assert.doesNotMatch(source, /createCheckpoint|restoreCheckpoint/);
    assert.doesNotMatch(source, /\.commitPath\(|\.attack\(|\.heal\(|\.wait\(|\.useItem\(/);
});
