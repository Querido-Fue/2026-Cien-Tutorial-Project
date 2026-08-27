import { isDeepStrictEqual } from 'node:util';
import { BALANCE_RESOLUTION_IDS } from './balance_simulation_contract.mjs';

/** @param {Map<string,number>} counts @returns {object} 키 정렬된 횟수 객체입니다. */
function sortedCounts(counts) {
    return Object.fromEntries([...counts.entries()]
        .filter(([, count]) => count !== 0)
        .sort(([left], [right]) => left.localeCompare(right)));
}

/** @param {Map<string,number>} counts @param {string} id @param {number} [amount=1] */
function increment(counts, id, amount = 1) {
    counts.set(id, (counts.get(id) ?? 0) + amount);
}

/** @param {object} snapshot @returns {object} 보고서 추적용 최소 상태입니다. */
function compactState(snapshot) {
    return {
        turn: snapshot.turn,
        phase: snapshot.phase,
        turnNumber: snapshot.turnNumber,
        floorId: snapshot.floor.id,
        playerHp: snapshot.player.hp,
        loraHp: snapshot.lora.hp,
        instability: snapshot.lora.instability
    };
}

/**
 * @class TutorialBalanceMetrics
 * @description 한 시나리오의 명령·피해·아이템·preview 일치 지표만 수집합니다.
 */
export class TutorialBalanceMetrics {
    #scenario;
    #initialSnapshot;
    #commandCounts;
    #acquiredItems;
    #usedItems;
    #damageByFloor;
    #previewChecks;
    #previewMismatches;
    #trace;

    /**
     * @param {{scenarioId:string,starterId:string,agent:object,initialSnapshot:object,
     * maxCommands:number,floorIds:string[]}} input
     */
    constructor(input) {
        this.#scenario = {
            scenarioId: input.scenarioId,
            starterId: input.starterId,
            agent: input.agent,
            maxCommands: input.maxCommands
        };
        this.#initialSnapshot = input.initialSnapshot;
        this.#commandCounts = new Map();
        this.#acquiredItems = new Map();
        this.#usedItems = new Map();
        this.#damageByFloor = new Map(input.floorIds.map((floorId) => [floorId, {
            dealtTotal: 0,
            dealtToLora: 0,
            dealtToMobs: 0,
            received: 0
        }]));
        this.#previewChecks = new Map();
        this.#previewMismatches = [];
        this.#trace = [];
    }

    /** @returns {number} 지금까지 기록한 모델 변경 명령 수입니다. */
    getCommandCount() {
        return this.#trace.length;
    }

    /**
     * 모델 변경 명령 하나와 그 이벤트를 기록합니다.
     * @param {{kind:string,intent:object,before:object,after:object,result:object}} entry
     */
    recordCommand(entry) {
        const commandNumber = this.#trace.length + 1;
        increment(this.#commandCounts, entry.kind);
        const events = Array.isArray(entry.result?.events) ? entry.result.events : [];
        for (const event of events) {
            this.#recordEvent(event, entry.before, entry.after);
        }
        this.#trace.push({
            commandNumber,
            kind: entry.kind,
            intent: { ...entry.intent },
            before: compactState(entry.before),
            after: compactState(entry.after),
            ok: entry.result?.ok === true,
            reason: entry.result?.reason ?? null,
            events: events.map(({ type }) => type)
        });
    }

    /**
     * 공개 preview와 같은 명령의 실제 투영을 비교합니다.
     * @param {{kind:string,expected:object,actual:object}} check
     */
    recordPreview(check) {
        increment(this.#previewChecks, check.kind);
        if (isDeepStrictEqual(check.expected, check.actual)) {
            return;
        }
        this.#previewMismatches.push({
            commandNumber: this.#trace.length,
            kind: check.kind,
            expected: check.expected,
            actual: check.actual
        });
    }

    /**
     * 종료 스냅샷과 하네스 오류를 결합해 시나리오 보고서를 완성합니다.
     * @param {{snapshot:object,error?:Error|null}} input
     * @returns {object} 시나리오 보고서입니다.
     */
    finalize({ snapshot, error = null }) {
        const result = snapshot.result;
        const resolution = this.#resolveResolution(result, error);
        const harnessStatus = error
            ? 'failed'
            : this.#previewMismatches.length > 0
                ? 'preview-mismatch'
                : result
                    ? 'ok'
                    : 'incomplete';
        return {
            scenarioId: this.#scenario.scenarioId,
            starterId: this.#scenario.starterId,
            agent: this.#scenario.agent,
            harnessStatus,
            resolution,
            outcome: result?.outcome ?? null,
            reason: result?.reason ?? error?.code ?? null,
            endingId: result?.endingId ?? null,
            finalState: {
                turnNumber: snapshot.turnNumber,
                loraActionsCompleted: snapshot.loraActionsCompleted,
                floorIndex: snapshot.floorIndex,
                floorId: snapshot.floor.id,
                playerHp: snapshot.player.hp,
                playerMaxHp: snapshot.player.maxHp,
                loraHp: snapshot.lora.hp,
                loraMaxHp: snapshot.lora.maxHp,
                instability: snapshot.lora.instability,
                maxInstability: snapshot.lora.maxInstability
            },
            items: {
                starting: this.#inventoryCounts(this.#initialSnapshot.inventory),
                acquired: sortedCounts(this.#acquiredItems),
                used: sortedCounts(this.#usedItems),
                remaining: this.#inventoryCounts(snapshot.inventory),
                uniqueUsedItemIds: [...snapshot.usedItems].sort()
            },
            damageByFloor: Object.fromEntries([...this.#damageByFloor.entries()]
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([floorId, values]) => [floorId, { ...values }])),
            actions: {
                attack: this.#commandCounts.get('attack') ?? 0,
                heal: this.#commandCounts.get('heal') ?? 0,
                wait: this.#commandCounts.get('wait') ?? 0,
                useItem: this.#commandCounts.get('use-item') ?? 0,
                cleanseEventTile: this.#commandCounts.get('cleanse-event-tile') ?? 0,
                move: this.#commandCounts.get('move') ?? 0,
                loraTurn: this.#commandCounts.get('lora-turn') ?? 0,
                completeLoraTurn: this.#commandCounts.get('complete-lora-turn') ?? 0
            },
            commands: {
                used: this.#trace.length,
                limit: this.#scenario.maxCommands,
                byType: sortedCounts(this.#commandCounts)
            },
            preview: {
                checks: [...this.#previewChecks.values()].reduce((sum, count) => sum + count, 0),
                checksByType: sortedCounts(this.#previewChecks),
                mismatchCount: this.#previewMismatches.length,
                mismatches: [...this.#previewMismatches]
            },
            harnessError: error ? {
                code: error.code ?? 'invariant-failure',
                message: error.message
            } : null,
            invariantViolations: error?.code === 'invariant-failure' ? [{
                code: error.code,
                message: error.message
            }] : [],
            decisionTrace: [...this.#trace]
        };
    }

    /** @param {object|null} result @param {Error|null} error @returns {string} @private */
    #resolveResolution(result, error) {
        if (error?.code === 'command-limit') {
            return BALANCE_RESOLUTION_IDS.COMMAND_LIMIT;
        }
        if (error) {
            return BALANCE_RESOLUTION_IDS.INVARIANT_FAILURE;
        }
        if (result?.outcome === 'success') {
            return BALANCE_RESOLUTION_IDS.COMPLETED;
        }
        if (result?.reason === 'player-defeated') {
            return BALANCE_RESOLUTION_IDS.DEFEATED;
        }
        if (result?.reason === 'turn-limit') {
            return BALANCE_RESOLUTION_IDS.TURN_LIMIT;
        }
        return BALANCE_RESOLUTION_IDS.UNKNOWN;
    }

    /** @param {object} event @param {object} before @param {object} after @private */
    #recordEvent(event, before, after) {
        if (event.type === 'item-picked') {
            increment(this.#acquiredItems, event.itemId);
        }
        if (event.type === 'item-used') {
            increment(this.#usedItems, event.itemId);
        }
        const floorId = this.#eventFloorId(event, before, after);
        if (event.type === 'lora-damaged') {
            this.#incrementDamage(floorId, 'dealtToLora', event.damage);
            this.#incrementDamage(floorId, 'dealtTotal', event.damage);
        }
        if (event.type === 'mob-damaged') {
            this.#incrementDamage(floorId, 'dealtToMobs', event.damage);
            this.#incrementDamage(floorId, 'dealtTotal', event.damage);
        }
        if (event.type === 'player-damaged') {
            this.#incrementDamage(floorId, 'received', event.amount);
        }
    }

    /** @param {object} event @param {object} before @param {object} after @returns {string} @private */
    #eventFloorId(event, before, after) {
        const transitioned = before.floorIndex !== after.floorIndex;
        if (transitioned && ['floor-transition', 'event-tile'].includes(event.source)) {
            return after.floor.id;
        }
        return before.floor.id;
    }

    /** @param {string} floorId @param {string} field @param {*} amount @private */
    #incrementDamage(floorId, field, amount) {
        if (!this.#damageByFloor.has(floorId)) {
            this.#damageByFloor.set(floorId, {
                dealtTotal: 0,
                dealtToLora: 0,
                dealtToMobs: 0,
                received: 0
            });
        }
        const damage = Math.max(0, Number(amount) || 0);
        this.#damageByFloor.get(floorId)[field] += damage;
    }

    /** @param {Array<{itemId:string,count:number}>} inventory @returns {object} @private */
    #inventoryCounts(inventory) {
        return Object.fromEntries([...inventory]
            .filter(({ count }) => count > 0)
            .sort((left, right) => left.itemId.localeCompare(right.itemId))
            .map(({ itemId, count }) => [itemId, count]));
    }
}
