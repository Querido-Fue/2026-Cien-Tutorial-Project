import { TUTORIAL_GAME_DATA } from '../../project/engine/script/data/game/tutorial_game_data.js';
import { TutorialBattleModel } from '../../project/engine/script/scene/tutorial/_tutorial_battle_model.js';
import {
    BALANCE_REPORT_SCHEMA_VERSION,
    BALANCE_MAX_COMMAND_LIMIT,
    BALANCE_SIMULATION_LIMITATIONS,
    BALANCE_STARTER_IDS,
    DEFAULT_BALANCE_MAX_COMMANDS
} from './balance_simulation_contract.mjs';
import { BALANCE_AGENT_PROFILES } from './balance_agent_profiles.mjs';
import { TutorialBalanceAgent } from './_tutorial_balance_agent.mjs';
import { TutorialBalanceMetrics } from './_tutorial_balance_metrics.mjs';
import { TutorialBalanceModelPort } from './_tutorial_balance_model_port.mjs';

/** @param {object} counts @param {string} id @param {number} [amount=1] */
function increment(counts, id, amount = 1) {
    counts[id] = (counts[id] ?? 0) + amount;
}

/** @param {object} value @returns {object} 키가 정렬된 얕은 객체입니다. */
function sortRecord(value) {
    return Object.fromEntries(Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right)));
}

/** @param {string} message @returns {Error} 하네스 불변식 오류입니다. */
function invariantError(message) {
    const error = new Error(message);
    error.code = 'invariant-failure';
    return error;
}

/**
 * @class TutorialBalanceRunner
 * @description 스타터×전략 시나리오를 조립하고 종료까지 공개 모델 명령을 순차 실행합니다.
 */
export class TutorialBalanceRunner {
    #gameData;
    #modelFactory;
    #eventPolarityByType;

    /** @param {{gameData?:object,modelFactory?:(config:object)=>object}} [options={}] */
    constructor(options = {}) {
        this.#gameData = options.gameData ?? TUTORIAL_GAME_DATA;
        this.#modelFactory = options.modelFactory
            ?? ((config) => new TutorialBattleModel(config, { random: () => 0 }));
        this.#eventPolarityByType = Object.fromEntries(
            Object.entries(this.#gameData.EVENT_TILE_EFFECTS).map(([id, effect]) => (
                [id, effect.polarity]
            ))
        );
    }

    /**
     * 두 스타터와 네 전략의 결정론적 8개 시나리오를 실행합니다.
     * @param {{maxCommands?:number}} [options={}] - 시나리오별 모델 변경 명령 상한입니다.
     * @returns {object} JSON 직렬화 가능한 전체 보고서입니다.
     */
    runSuite(options = {}) {
        const maxCommands = options.maxCommands ?? DEFAULT_BALANCE_MAX_COMMANDS;
        if (!Number.isInteger(maxCommands)
            || maxCommands <= 0
            || maxCommands > BALANCE_MAX_COMMAND_LIMIT) {
            throw new RangeError(
                `TutorialBalanceRunner: maxCommands는 1~${BALANCE_MAX_COMMAND_LIMIT}여야 합니다.`
            );
        }
        const agents = BALANCE_AGENT_PROFILES.map((profile) => (
            new TutorialBalanceAgent(profile).getDescriptor()
        ));
        const scenarios = BALANCE_STARTER_IDS.flatMap((starterId) => (
            BALANCE_AGENT_PROFILES.map((profile) => (
                this.#runScenario({ starterId, profile, maxCommands })
            ))
        ));
        return {
            schemaVersion: BALANCE_REPORT_SCHEMA_VERSION,
            simulationVersion: 'tutorial-balance-v1',
            deterministicInputs: {
                starterIds: [...BALANCE_STARTER_IDS],
                agentIds: agents.map(({ id }) => id),
                scenarioCount: scenarios.length,
                maxCommandsPerScenario: maxCommands,
                randomnessUsed: false,
                randomSeed: null,
                tieBreak: [
                    'score-desc',
                    'steps-asc',
                    'remaining-moves-desc',
                    'y-asc',
                    'x-asc',
                    'path-lexical-asc',
                    'candidate-id-asc'
                ]
            },
            agents,
            limitations: [...BALANCE_SIMULATION_LIMITATIONS],
            scenarios,
            aggregate: this.#aggregate(scenarios)
        };
    }

    /** @param {{starterId:string,profile:object,maxCommands:number}} input @returns {object} @private */
    #runScenario({ starterId, profile, maxCommands }) {
        const model = this.#modelFactory(this.#gameData);
        model.reset({ starterItemId: starterId });
        const agent = new TutorialBalanceAgent(profile);
        const metrics = new TutorialBalanceMetrics({
            scenarioId: `${starterId}__${profile.id}`,
            starterId,
            agent: agent.getDescriptor(),
            initialSnapshot: model.getSnapshot(),
            maxCommands,
            floorIds: this.#gameData.FLOORS.map(({ id }) => id)
        });
        const port = new TutorialBalanceModelPort({ model, metrics, maxCommands });
        let error = null;
        try {
            this.#playUntilResolved(port, agent);
        } catch (caught) {
            error = caught instanceof Error ? caught : invariantError(String(caught));
            if (!error.code) {
                error.code = 'invariant-failure';
            }
        }
        return metrics.finalize({ snapshot: port.getSnapshot(), error });
    }

    /** @param {TutorialBalanceModelPort} port @param {TutorialBalanceAgent} agent @private */
    #playUntilResolved(port, agent) {
        while (!port.getSnapshot().result) {
            const snapshot = port.getSnapshot();
            if (snapshot.turn === 'player' && snapshot.phase === 'move') {
                const observation = port.getMovementObservation(this.#eventPolarityByType);
                const cleanseIntent = agent.chooseCleanseTarget(observation);
                if (cleanseIntent) {
                    port.cleanseEventTile(cleanseIntent);
                    continue;
                }
                port.commitMovement(agent.chooseMovement(observation));
                continue;
            }
            if (snapshot.turn === 'player' && snapshot.phase === 'action') {
                const observation = port.getActionObservation();
                port.performPlayerAction(agent.chooseAction(observation));
                continue;
            }
            if (snapshot.turn === 'lora' && snapshot.phase === 'lora') {
                port.performLoraTurn();
                if (!port.getSnapshot().result) {
                    port.completeLoraTurn();
                }
                continue;
            }
            throw invariantError(
                `TutorialBalanceRunner: 처리할 수 없는 상태 ${snapshot.turn}/${snapshot.phase}입니다.`
            );
        }
    }

    /** @param {object[]} scenarios @returns {object} @private */
    #aggregate(scenarios) {
        const resolutions = {};
        const outcomes = {};
        const endings = {};
        const actions = {};
        const acquiredItems = {};
        const usedItems = {};
        const damageByFloor = {};
        let commandsUsed = 0;
        let maxCommandsUsed = 0;
        let previewChecks = 0;
        let previewMismatches = 0;
        let structuralFailures = 0;

        for (const scenario of scenarios) {
            increment(resolutions, scenario.resolution);
            increment(outcomes, scenario.outcome ?? 'none');
            increment(endings, scenario.endingId ?? 'none');
            commandsUsed += scenario.commands.used;
            maxCommandsUsed = Math.max(maxCommandsUsed, scenario.commands.used);
            previewChecks += scenario.preview.checks;
            previewMismatches += scenario.preview.mismatchCount;
            structuralFailures += ['failed', 'incomplete'].includes(scenario.harnessStatus) ? 1 : 0;
            for (const [action, count] of Object.entries(scenario.actions)) {
                increment(actions, action, count);
            }
            for (const [itemId, count] of Object.entries(scenario.items.acquired)) {
                increment(acquiredItems, itemId, count);
            }
            for (const [itemId, count] of Object.entries(scenario.items.used)) {
                increment(usedItems, itemId, count);
            }
            for (const [floorId, damage] of Object.entries(scenario.damageByFloor)) {
                damageByFloor[floorId] ??= {
                    dealtTotal: 0,
                    dealtToLora: 0,
                    dealtToMobs: 0,
                    received: 0
                };
                for (const [field, amount] of Object.entries(damage)) {
                    damageByFloor[floorId][field] += amount;
                }
            }
        }

        return {
            scenarioCount: scenarios.length,
            resolutions: sortRecord(resolutions),
            outcomes: sortRecord(outcomes),
            endings: sortRecord(endings),
            actions: sortRecord(actions),
            items: {
                acquired: sortRecord(acquiredItems),
                used: sortRecord(usedItems)
            },
            damageByFloor: sortRecord(damageByFloor),
            commands: {
                total: commandsUsed,
                maximumInScenario: maxCommandsUsed
            },
            preview: {
                checks: previewChecks,
                mismatches: previewMismatches
            },
            structuralFailures,
            previewMismatchScenarios: scenarios.filter(
                ({ preview }) => preview.mismatchCount > 0
            ).length,
            byStarter: this.#groupSummary(scenarios, 'starterId'),
            byAgent: this.#groupSummary(scenarios, 'agent')
        };
    }

    /** @param {object[]} scenarios @param {'starterId'|'agent'} field @returns {object} @private */
    #groupSummary(scenarios, field) {
        const groups = {};
        for (const scenario of scenarios) {
            const id = field === 'agent' ? scenario.agent.id : scenario[field];
            groups[id] ??= {
                scenarios: 0,
                resolutions: {},
                endings: {},
                previewMismatches: 0
            };
            groups[id].scenarios += 1;
            increment(groups[id].resolutions, scenario.resolution);
            increment(groups[id].endings, scenario.endingId ?? 'none');
            groups[id].previewMismatches += scenario.preview.mismatchCount;
        }
        return Object.fromEntries(Object.entries(groups)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([id, group]) => [id, {
                ...group,
                resolutions: sortRecord(group.resolutions),
                endings: sortRecord(group.endings)
            }]));
    }
}
