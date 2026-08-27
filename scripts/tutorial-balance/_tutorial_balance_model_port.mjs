import { BALANCE_MAX_COMMAND_LIMIT } from './balance_simulation_contract.mjs';

/** @param {string} code @param {string} message @param {object} [details={}] @returns {Error} */
function createHarnessError(code, message, details = {}) {
    const error = new Error(message);
    error.code = code;
    Object.assign(error, details);
    return error;
}

/** @param {object|null} result @returns {object|null} preview 계약 범위의 결과입니다. */
function normalizeResult(result) {
    return result
        ? { outcome: result.outcome, reason: result.reason }
        : null;
}

/** @param {object} movement @returns {object} preview와 실행이 함께 약속하는 이동 필드입니다. */
function projectMovement(movement) {
    return {
        ok: movement.ok,
        action: movement.action,
        path: movement.path,
        cost: movement.cost,
        stepsUsed: movement.stepsUsed,
        moveRange: movement.moveRange,
        remainingMoves: movement.remainingMoves,
        hasPickaxe: movement.hasPickaxe,
        interrupted: movement.interrupted
    };
}

/**
 * @class TutorialBalanceModelPort
 * @description 시뮬레이터가 전투 모델의 공개 API만 호출하도록 관측·명령 경계를 제공합니다.
 */
export class TutorialBalanceModelPort {
    #model;
    #metrics;
    #maxCommands;

    /** @param {{model:object,metrics:object,maxCommands:number}} input */
    constructor({ model, metrics, maxCommands }) {
        if (!model || typeof model.getSnapshot !== 'function') {
            throw new TypeError('TutorialBalanceModelPort: 공개 전투 모델이 필요합니다.');
        }
        if (!metrics || typeof metrics.recordCommand !== 'function') {
            throw new TypeError('TutorialBalanceModelPort: 지표 수집기가 필요합니다.');
        }
        if (!Number.isInteger(maxCommands)
            || maxCommands <= 0
            || maxCommands > BALANCE_MAX_COMMAND_LIMIT) {
            throw new RangeError(
                `TutorialBalanceModelPort: maxCommands는 1~${BALANCE_MAX_COMMAND_LIMIT}여야 합니다.`
            );
        }
        this.#model = model;
        this.#metrics = metrics;
        this.#maxCommands = maxCommands;
    }

    /** @returns {object} 방어 복제된 공개 모델 snapshot입니다. */
    getSnapshot() {
        return this.#model.getSnapshot();
    }

    /**
     * 이동 agent에게 필요한 공개 관측을 조립합니다.
     * @param {object} eventPolarityByType - 데이터 ID별 positive/negative 값입니다.
     * @returns {object} snapshot, 정렬된 reachability와 정화 대상입니다.
     */
    getMovementObservation(eventPolarityByType) {
        const reachability = [...this.#model.getReachability().entries()]
            .map(([id, candidate]) => ({
                id,
                ...candidate,
                path: candidate.path.map(({ x, y }) => ({ x, y }))
            }))
            .sort((left, right) => left.id.localeCompare(right.id));
        const cleanseTargets = this.#model.getCleanseTargets()
            .sort((left, right) => left.id.localeCompare(right.id));
        return {
            snapshot: this.getSnapshot(),
            reachability,
            cleanseTargets,
            eventPolarityByType: { ...eventPolarityByType }
        };
    }

    /** @returns {object} 행동 agent에게 필요한 snapshot과 전체 공개 preview입니다. */
    getActionObservation() {
        return {
            snapshot: this.getSnapshot(),
            previews: this.#model.getPlayerActionPreviews()
        };
    }

    /** @param {{targetId:string,reason:string}} intent @returns {object} 정화 결과입니다. */
    cleanseEventTile(intent) {
        return this.#runCommand(
            'cleanse-event-tile',
            intent,
            () => this.#model.cleanseEventTile(intent.targetId)
        ).result;
    }

    /** @param {{path:Array<{x:number,y:number}>,reason:string}} intent @returns {object} 이동 결과입니다. */
    commitMovement(intent) {
        const preview = this.#model.previewPath(intent.path);
        this.#assertValidPreview(preview, 'move');
        const execution = this.#runCommand(
            'move',
            intent,
            () => this.#model.commitPath(intent.path)
        );
        this.#metrics.recordPreview({
            kind: 'move',
            expected: projectMovement(preview),
            actual: projectMovement(execution.result)
        });
        return execution.result;
    }

    /** @param {object} intent @returns {object} 플레이어 행동 결과입니다. */
    performPlayerAction(intent) {
        const options = this.#getActionOptions(intent);
        const preview = this.#model.previewPlayerAction(intent.type, options);
        this.#assertValidPreview(preview, intent.type);
        const execution = this.#runCommand(
            intent.type,
            intent,
            () => this.#performPlayerCommand(intent, options)
        );
        this.#metrics.recordPreview({
            kind: `player-${intent.type}`,
            expected: preview.expected,
            actual: this.#projectActionState(execution.after, preview.targetId ?? null)
        });
        return execution.result;
    }

    /** @returns {object} 로라 행동 결과입니다. */
    performLoraTurn() {
        const intent = this.#model.getLoraIntent();
        this.#assertValidPreview(intent, 'lora-turn');
        const execution = this.#runCommand(
            'lora-turn',
            { type: 'lora-turn', reason: intent.reason },
            () => this.#model.performLoraTurn()
        );
        this.#metrics.recordPreview({
            kind: 'lora-turn',
            expected: {
                action: intent.executionAction,
                damage: intent.finalDamage,
                playerHp: intent.playerHpAfter,
                instability: intent.expectedInstability
            },
            actual: {
                action: execution.result.action,
                damage: execution.result.damage,
                playerHp: execution.after.player.hp,
                instability: execution.after.lora.instability
            }
        });
        return execution.result;
    }

    /** @returns {object} 몹·층 전환·다음 턴 처리 결과입니다. */
    completeLoraTurn() {
        return this.#runCommand(
            'complete-lora-turn',
            { type: 'complete-lora-turn', reason: 'enemy-phase-resolution' },
            () => this.#model.completeLoraTurn()
        ).result;
    }

    /** @param {object} preview @param {string} kind @private */
    #assertValidPreview(preview, kind) {
        if (preview?.ok === true) {
            return;
        }
        throw createHarnessError(
            'invariant-failure',
            `TutorialBalanceModelPort: ${kind} preview가 거부되었습니다 (${preview?.reason ?? 'unknown'}).`,
            { reason: preview?.reason ?? 'unknown' }
        );
    }

    /** @param {object} intent @returns {object} @private */
    #getActionOptions(intent) {
        if (intent.type === 'attack') {
            return { targetId: intent.targetId, weapon: intent.weapon };
        }
        if (intent.type === 'use-item') {
            return { itemId: intent.itemId };
        }
        return {};
    }

    /** @param {object} intent @param {object} options @returns {object} @private */
    #performPlayerCommand(intent, options) {
        if (intent.type === 'attack') {
            return this.#model.attack(options.targetId, { weapon: options.weapon });
        }
        if (intent.type === 'heal') {
            return this.#model.heal();
        }
        if (intent.type === 'use-item') {
            return this.#model.useItem(options.itemId);
        }
        if (intent.type === 'wait') {
            return this.#model.wait();
        }
        throw createHarnessError(
            'invariant-failure',
            `TutorialBalanceModelPort: 지원하지 않는 플레이어 명령 ${intent.type}입니다.`
        );
    }

    /**
     * 변경 명령의 수를 제한하고 전후 snapshot을 지표 수집기로 전달합니다.
     * @param {string} kind @param {object} intent @param {()=>object} perform
     * @returns {{result:object,before:object,after:object}}
     * @private
     */
    #runCommand(kind, intent, perform) {
        if (this.#metrics.getCommandCount() >= this.#maxCommands) {
            throw createHarnessError(
                'command-limit',
                `TutorialBalanceModelPort: 명령 한도 ${this.#maxCommands}에 도달했습니다.`,
                { maxCommands: this.#maxCommands }
            );
        }
        const before = this.getSnapshot();
        let result;
        try {
            result = perform();
        } catch (cause) {
            const after = this.getSnapshot();
            this.#metrics.recordCommand({
                kind,
                intent,
                before,
                after,
                result: { ok: false, reason: 'exception', events: [] }
            });
            throw createHarnessError(
                'invariant-failure',
                `TutorialBalanceModelPort: ${kind} 실행 중 예외가 발생했습니다 (${cause.message}).`,
                { cause }
            );
        }
        const after = this.getSnapshot();
        this.#metrics.recordCommand({ kind, intent, before, after, result });
        if (result?.ok !== true) {
            throw createHarnessError(
                'invariant-failure',
                `TutorialBalanceModelPort: ${kind} 실행이 거부되었습니다 (${result?.reason ?? 'unknown'}).`,
                { reason: result?.reason ?? 'unknown' }
            );
        }
        return { result, before, after };
    }

    /** @param {object} snapshot @param {string|null} targetId @returns {object} @private */
    #projectActionState(snapshot, targetId) {
        const target = snapshot.floor.mobs.find(({ id }) => id === targetId);
        return {
            turn: snapshot.turn,
            phase: snapshot.phase,
            playerHp: snapshot.player.hp,
            loraHp: snapshot.lora.hp,
            instability: snapshot.lora.instability,
            playerAlive: snapshot.player.alive,
            loraAlive: snapshot.lora.alive,
            mushroomActive: snapshot.player.mushroomActive,
            peaceTurns: snapshot.lora.peaceTurns,
            actionsUsed: snapshot.actionsUsed,
            actionsPerTurn: snapshot.actionsPerTurn,
            actionsRemaining: snapshot.actionsRemaining,
            extraPlayerTurns: snapshot.extraPlayerTurns,
            playerTurnSerial: snapshot.playerTurnSerial,
            consecutiveAttackCount: snapshot.consecutiveAttackCount,
            targetHp: target?.hp ?? (targetId === 'lora' ? snapshot.lora.hp : null),
            inventory: snapshot.inventory,
            usedItems: snapshot.usedItems,
            result: normalizeResult(snapshot.result)
        };
    }
}
