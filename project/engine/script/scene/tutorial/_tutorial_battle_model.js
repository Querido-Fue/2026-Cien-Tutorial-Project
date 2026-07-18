const PLAYER_ID = 'player';
const LORA_ID = 'lora';
const DOOR_ID = 'door';
const ACTION_ATTACK = 'attack';
const ACTION_TALK = 'talk';
const ACTION_DEFEND = 'defend';
const ACTION_WAIT = 'wait';
const ACTION_ESCAPE = 'escape';
const PLAYER_ACTIONS = Object.freeze([
    ACTION_ATTACK,
    ACTION_TALK,
    ACTION_DEFEND,
    ACTION_WAIT,
    ACTION_ESCAPE
]);
const RANGED_INSTABILITY_STATES = Object.freeze(new Set([
    'shaken',
    'unstable',
    'collapse'
]));
const DEFENSIVE_INSTABILITY_STATES = Object.freeze(new Set([
    'stable',
    'anxious'
]));
const DIRECTIONS = Object.freeze([
    Object.freeze({ x: 0, y: -1 }),
    Object.freeze({ x: 1, y: 0 }),
    Object.freeze({ x: 0, y: 1 }),
    Object.freeze({ x: -1, y: 0 })
]);

/**
 * @class TutorialBattleModel
 * @description v3.2 튜토리얼 전투의 이동, 전투, 불안정도, 대화, 탈출 상태를 관리합니다.
 */
export class TutorialBattleModel {
    #config;
    #turnStartPlayer;
    #committedMove;
    #loraTurnPerformed;

    /**
     * @param {object} config - `TUTORIAL_GAME_DATA` 형식의 전투 설정입니다.
     */
    constructor(config) {
        this.#config = this.#normalizeConfig(config);
        this.#turnStartPlayer = null;
        this.#committedMove = null;
        this.#loraTurnPerformed = false;
        this.reset();
    }

    /** 전투를 초기 상태로 되돌립니다. */
    reset() {
        const playerStart = this.#config.playerStart;
        const loraStart = this.#config.loraStart;

        this.turn = 'player';
        this.phase = 'move';
        this.round = 1;
        this.maxRounds = this.#config.maxRounds;
        this.selectedAction = ACTION_ATTACK;
        this.player = {
            x: playerStart.x,
            y: playerStart.y,
            hp: this.#config.playerMaxHp,
            maxHp: this.#config.playerMaxHp,
            alive: true,
            defending: false
        };
        this.lora = {
            x: loraStart.x,
            y: loraStart.y,
            hp: this.#config.loraMaxHp,
            maxHp: this.#config.loraMaxHp,
            alive: true,
            instability: this.#config.loraStartInstability,
            maxInstability: this.#config.loraMaxInstability,
            defending: false,
            defendCooldown: 0
        };
        this.door = { ...this.#config.door };
        this.gateOpen = false;
        this.boxes = this.#config.boxes.map((box) => ({
            id: box.id,
            x: box.x,
            y: box.y,
            destroyed: false
        }));
        this.lastPlayerAction = null;
        this.lastLoraAction = null;
        this.dialogueHistory = [];
        this.result = null;
        this.#turnStartPlayer = { ...this.player };
        this.#committedMove = null;
        this.#loraTurnPerformed = false;
    }

    /**
     * 좌표가 맵 안에 있는지 확인합니다.
     * @param {number} x - 타일 X 좌표입니다.
     * @param {number} y - 타일 Y 좌표입니다.
     * @returns {boolean} 유효한 정수 타일 좌표이면 true입니다.
     */
    isInside(x, y) {
        return Number.isInteger(x)
            && Number.isInteger(y)
            && x >= 0
            && x < this.#config.width
            && y >= 0
            && y < this.#config.height;
    }

    /**
     * 시각 표현에 사용할 타일 높이를 반환합니다. 높이는 이동과 상호작용 판정에 관여하지 않습니다.
     * @param {number} x - 타일 X 좌표입니다.
     * @param {number} y - 타일 Y 좌표입니다.
     * @returns {number|null} 타일 높이 또는 맵 밖일 때 null입니다.
     */
    getTileHeight(x, y) {
        if (!this.isInside(x, y)) {
            return null;
        }
        return this.#config.heights[y][x];
    }

    /**
     * 지정한 타일을 점유한 전투 요소를 반환합니다.
     * @param {number} x - 타일 X 좌표입니다.
     * @param {number} y - 타일 Y 좌표입니다.
     * @returns {{id:string,type:'player'|'lora'|'door'|'box',x:number,y:number}|null} 점유 요소입니다.
     */
    getOccupantAt(x, y) {
        if (!this.isInside(x, y)) {
            return null;
        }
        if (this.#isSamePosition(this.player, x, y)) {
            return { id: PLAYER_ID, type: 'player', x, y };
        }
        if (this.#isSamePosition(this.lora, x, y)) {
            return { id: LORA_ID, type: 'lora', x, y };
        }
        if (this.#isSamePosition(this.door, x, y)) {
            return { id: DOOR_ID, type: 'door', x, y };
        }

        const box = this.boxes.find((candidate) => (
            candidate.destroyed !== true && this.#isSamePosition(candidate, x, y)
        ));
        return box ? { id: box.id, type: 'box', x, y } : null;
    }

    /**
     * 현재 플레이어 위치에서 최대 이동 거리 안의 최단 경로를 계산합니다.
     * 같은 거리에서는 로라 공격 범위 노출이 적은 경로를 우선합니다.
     * 문과 높이는 이동을 막지 않으며 모든 이동 타일 비용은 1입니다.
     * @returns {Map<string,{x:number,y:number,cost:number,path:Array<{x:number,y:number}>}>} 도달 가능 지도입니다.
     */
    getReachability() {
        const reachability = new Map();
        if (!this.#isValidPosition(this.player)) {
            return reachability;
        }

        const start = { x: this.player.x, y: this.player.y };
        const startKey = this.#toTileKey(start.x, start.y);
        const queue = [start];
        let queueIndex = 0;
        const distances = new Map([[startKey, 0]]);
        const threatCosts = new Map([[startKey, this.#getLoraThreatCost(start.x, start.y)]]);
        const previous = new Map();
        const coordinates = new Map([[startKey, start]]);

        while (queueIndex < queue.length) {
            const current = queue[queueIndex++];
            const currentKey = this.#toTileKey(current.x, current.y);
            const currentCost = distances.get(currentKey);
            const currentThreatCost = threatCosts.get(currentKey);
            if (currentCost === undefined || currentCost >= this.#config.moveRange) {
                continue;
            }

            for (const direction of DIRECTIONS) {
                const nextX = current.x + direction.x;
                const nextY = current.y + direction.y;
                const nextKey = this.#toTileKey(nextX, nextY);
                if (!this.isInside(nextX, nextY)
                    || this.#isMovementBlocked(nextX, nextY)) {
                    continue;
                }

                const next = { x: nextX, y: nextY };
                const nextCost = currentCost + 1;
                const nextThreatCost = (currentThreatCost ?? 0)
                    + this.#getLoraThreatCost(nextX, nextY);
                const knownCost = distances.get(nextKey);
                const knownThreatCost = threatCosts.get(nextKey);
                if (knownCost !== undefined
                    && (knownCost < nextCost
                        || (knownCost === nextCost
                            && (knownThreatCost ?? Number.POSITIVE_INFINITY) <= nextThreatCost))) {
                    continue;
                }

                distances.set(nextKey, nextCost);
                threatCosts.set(nextKey, nextThreatCost);
                previous.set(nextKey, currentKey);
                coordinates.set(nextKey, next);
                queue.push(next);
            }
        }

        for (const [key, cost] of distances) {
            const position = coordinates.get(key);
            if (!position) {
                continue;
            }
            reachability.set(key, {
                x: position.x,
                y: position.y,
                cost,
                path: this.#buildPath(key, previous, coordinates)
            });
        }
        return reachability;
    }

    /**
     * 현재 플레이어 위치에서 목적지까지의 최단 경로를 반환합니다.
     * @param {number} x - 목적지 X 좌표입니다.
     * @param {number} y - 목적지 Y 좌표입니다.
     * @returns {Array<{x:number,y:number}>|null} 시작점과 목적지를 포함한 경로입니다.
     */
    getPathTo(x, y) {
        if (!this.isInside(x, y)) {
            return null;
        }
        const entry = this.getReachability().get(this.#toTileKey(x, y));
        return entry ? entry.path.map((point) => ({ ...point })) : null;
    }

    /**
     * 최단 경로로 플레이어 이동을 확정합니다.
     * @param {number} x - 목적지 X 좌표입니다.
     * @param {number} y - 목적지 Y 좌표입니다.
     * @returns {{ok:boolean,path:Array<{x:number,y:number}>,cost:number|null,reason?:string}} 이동 결과입니다.
     */
    commitMove(x, y) {
        if (this.turn !== 'player' || this.phase !== 'move') {
            return this.#createMoveFailure('not-player-move-phase');
        }
        if (!this.isInside(x, y)) {
            return this.#createMoveFailure('invalid-destination');
        }

        const entry = this.getReachability().get(this.#toTileKey(x, y));
        if (!entry) {
            return this.#createMoveFailure('unreachable-destination');
        }

        const path = entry.path.map((point) => ({ ...point }));
        this.player.x = x;
        this.player.y = y;
        this.phase = 'action';
        this.selectedAction = ACTION_ATTACK;
        this.#committedMove = {
            path: path.map((point) => ({ ...point })),
            cost: entry.cost
        };
        return { ok: true, path, cost: entry.cost };
    }

    /**
     * 플레이어가 직접 입력한 경로를 검증하고 확정합니다.
     * 한 턴 안에서 같은 타일을 다시 밟거나 출발점으로 돌아오는 경로는 허용하지 않습니다.
     * @param {Array<{x:number,y:number}>} path - 시작 타일부터 목적지까지의 경로입니다.
     * @returns {{ok:boolean,path:Array<{x:number,y:number}>,cost:number|null,reason?:string}} 이동 결과입니다.
     */
    commitPath(path) {
        if (this.turn !== 'player' || this.phase !== 'move') {
            return this.#createMoveFailure('not-player-move-phase');
        }
        if (!Array.isArray(path) || path.length === 0) {
            return this.#createMoveFailure('invalid-path');
        }

        const normalizedPath = [];
        const visited = new Set();
        for (const point of path) {
            if (!point || !this.isInside(point.x, point.y)) {
                return this.#createMoveFailure('invalid-path');
            }
            const key = this.#toTileKey(point.x, point.y);
            if (visited.has(key)) {
                return this.#createMoveFailure('path-tile-revisited');
            }
            visited.add(key);
            normalizedPath.push({ x: point.x, y: point.y });
        }
        if (!this.#isSamePosition(normalizedPath[0], this.player.x, this.player.y)) {
            return this.#createMoveFailure('path-start-mismatch');
        }

        for (let index = 1; index < normalizedPath.length; index++) {
            const previous = normalizedPath[index - 1];
            const current = normalizedPath[index];
            if (!this.#isAdjacent(previous, current)
                || this.#isMovementBlocked(current.x, current.y)) {
                return this.#createMoveFailure('invalid-path-step');
            }
        }

        const cost = normalizedPath.length - 1;
        if (cost > this.#config.moveRange) {
            return this.#createMoveFailure('path-cost-exceeded');
        }

        const destination = normalizedPath[normalizedPath.length - 1];
        this.player.x = destination.x;
        this.player.y = destination.y;
        this.phase = 'action';
        this.selectedAction = ACTION_ATTACK;
        this.#committedMove = {
            path: normalizedPath.map((point) => ({ ...point })),
            cost
        };
        return {
            ok: true,
            path: normalizedPath.map((point) => ({ ...point })),
            cost
        };
    }

    /**
     * 행동 전에 이번 턴의 이동을 되돌립니다.
     * @returns {boolean} 이동을 되돌렸으면 true입니다.
     */
    undoMove() {
        if (this.turn !== 'player'
            || this.phase !== 'action'
            || !this.#committedMove
            || !this.#isValidPosition(this.#turnStartPlayer)) {
            return false;
        }

        this.player.x = this.#turnStartPlayer.x;
        this.player.y = this.#turnStartPlayer.y;
        this.phase = 'move';
        this.selectedAction = ACTION_ATTACK;
        this.#committedMove = null;
        return true;
    }

    /**
     * 플레이어 행동을 선택합니다. 이동하지 않은 상태라면 비용 0의 행동 단계로 진입합니다.
     * @param {'attack'|'talk'|'defend'|'wait'|'escape'} action - 선택할 행동입니다.
     * @returns {boolean} 행동을 선택했으면 true입니다.
     */
    selectAction(action) {
        if (this.turn !== 'player'
            || (this.phase !== 'move' && this.phase !== 'action')
            || !this.#isValidAction(action)) {
            return false;
        }
        if (this.phase === 'move') {
            this.phase = 'action';
            this.#committedMove = {
                path: [{ x: this.player.x, y: this.player.y }],
                cost: 0
            };
        }
        this.selectedAction = action;
        return true;
    }

    /**
     * 현재 행동으로 상호작용할 수 있는 인접 대상을 반환합니다.
     * @param {'attack'|'talk'} [action=this.selectedAction] - 검사할 행동입니다.
     * @returns {Array<{id:string,type:'lora'|'box',x:number,y:number}>} 유효 대상입니다.
     */
    getValidTargets(action = this.selectedAction) {
        if (this.turn !== 'player'
            || this.phase !== 'action'
            || (action !== ACTION_ATTACK && action !== ACTION_TALK)
            || !this.#isValidPosition(this.player)) {
            return [];
        }

        const targets = [];
        if (this.lora.alive === true && this.#isInteractionReachable(this.player, this.lora)) {
            targets.push({
                id: LORA_ID,
                type: 'lora',
                x: this.lora.x,
                y: this.lora.y
            });
        }
        if (action === ACTION_ATTACK) {
            for (const box of this.boxes) {
                if (box.destroyed !== true && this.#isInteractionReachable(this.player, box)) {
                    targets.push({
                        id: box.id,
                        type: 'box',
                        x: box.x,
                        y: box.y
                    });
                }
            }
        }
        return targets;
    }

    /**
     * 선택한 행동으로 로라 또는 상자와 상호작용합니다.
     * @param {string} targetId - `lora` 또는 상자 ID입니다.
     * @returns {object} 상호작용 결과입니다.
     */
    performInteraction(targetId) {
        const action = this.selectedAction;
        if (this.turn !== 'player' || this.phase !== 'action') {
            return this.#createInteractionFailure(action, targetId, 'not-player-action-phase');
        }
        if (action !== ACTION_ATTACK && action !== ACTION_TALK) {
            return this.#createInteractionFailure(action, targetId, 'invalid-action');
        }
        if (typeof targetId !== 'string' || targetId.length === 0) {
            return this.#createInteractionFailure(action, targetId, 'invalid-target-id');
        }

        const target = this.getValidTargets(action).find((candidate) => candidate.id === targetId);
        if (!target) {
            return this.#createInteractionFailure(action, targetId, 'invalid-target');
        }

        if (action === ACTION_TALK) {
            this.lastPlayerAction = ACTION_TALK;
            this.#beginLoraTurn();
            return this.#createInteractionSuccess(action, target, {
                damage: 0,
                instabilityChange: 0
            });
        }

        if (target.type === 'box') {
            const box = this.boxes.find((candidate) => candidate.id === targetId);
            if (!box || box.destroyed === true) {
                return this.#createInteractionFailure(action, targetId, 'invalid-target');
            }
            box.destroyed = true;
            this.lastPlayerAction = 'attack-box';
            this.#beginLoraTurn();
            return this.#createInteractionSuccess(action, target, {
                damage: 0,
                destroyed: true,
                instabilityChange: 0
            });
        }

        const wasConsecutiveAttack = this.lastPlayerAction === 'attack-lora';
        const baseDamage = this.#config.playerAttackDamage;
        const damage = this.lora.defending
            ? baseDamage * (1 - this.#config.loraDefendReduction)
            : baseDamage;
        const appliedDamage = Math.min(this.lora.hp, damage);
        const instabilityChange = this.#config.playerAttackInstability
            + (wasConsecutiveAttack ? this.#config.consecutiveAttackInstability : 0);

        this.lora.hp = Math.max(0, this.lora.hp - damage);
        this.lora.alive = this.lora.hp > 0;
        this.lora.defending = false;
        this.lora.instability = this.#clamp(
            this.lora.instability + instabilityChange,
            0,
            this.lora.maxInstability
        );
        this.lastPlayerAction = 'attack-lora';

        const defeated = !this.lora.alive;
        if (defeated) {
            this.gateOpen = true;
        }
        this.#beginLoraTurn();

        return this.#createInteractionSuccess(action, target, {
            damage: appliedDamage,
            defeated,
            gateOpened: defeated,
            instabilityChange
        });
    }

    /**
     * 이번 로라 턴에 받는 피해를 30% 줄입니다.
     * @returns {{ok:boolean,action:string,reduction?:number,reason?:string}} 방어 결과입니다.
     */
    defend() {
        if (!this.#canUsePlayerAction()) {
            return { ok: false, action: ACTION_DEFEND, reason: 'not-player-action-phase' };
        }
        this.player.defending = true;
        this.lastPlayerAction = ACTION_DEFEND;
        this.#beginLoraTurn();
        return {
            ok: true,
            action: ACTION_DEFEND,
            reduction: this.#config.playerDefendReduction
        };
    }

    /**
     * 행동 없이 플레이어 턴을 종료합니다.
     * @returns {boolean} 턴을 종료했으면 true입니다.
     */
    endTurn() {
        if (!this.#canUsePlayerAction()) {
            return false;
        }
        this.lastPlayerAction = ACTION_WAIT;
        this.#beginLoraTurn();
        return true;
    }

    /**
     * 기존 대기 API입니다. `endTurn()`과 동일하게 동작합니다.
     * @returns {boolean} 턴을 종료했으면 true입니다.
     */
    wait() {
        return this.endTurn();
    }

    /**
     * 현재 위치와 상태에서 탈출할 수 있는지 확인합니다.
     * @returns {boolean} 탈출 행동이 가능하면 true입니다.
     */
    canEscape() {
        return this.turn === 'player'
            && (this.phase === 'move' || this.phase === 'action')
            && this.player.alive === true
            && this.lora.alive === false
            && this.gateOpen === true
            && this.#isSamePosition(this.player, this.door.x, this.door.y)
            && this.result === null;
    }

    /**
     * 열린 게이트 타일에서 전투를 성공으로 끝냅니다.
     * @returns {{ok:boolean,action:string,result?:object,reason?:string}} 탈출 결과입니다.
     */
    escape() {
        if (!this.canEscape()) {
            return { ok: false, action: ACTION_ESCAPE, reason: 'escape-conditions-not-met' };
        }
        this.lastPlayerAction = ACTION_ESCAPE;
        this.#finishBattle('success', 'escaped');
        return { ok: true, action: ACTION_ESCAPE, result: this.result };
    }

    /**
     * 로라의 불안정도 구간을 반환합니다.
     * @param {number} [value=this.lora.instability] - 판정할 불안정도입니다.
     * @returns {{id:string,label:string,min:number,max:number}} 불안정 상태입니다.
     */
    getInstabilityState(value = this.lora.instability) {
        const normalizedValue = this.#clamp(
            Number.isFinite(value) ? value : this.lora.instability,
            0,
            this.#config.loraMaxInstability
        );
        const state = this.#config.instabilityStates.find((candidate) => (
            normalizedValue >= candidate.min && normalizedValue <= candidate.max
        ));
        return { ...(state ?? this.#config.instabilityStates[0]) };
    }

    /**
     * 현재 상태에 따라 로라의 이동 또는 행동을 한 번 수행합니다.
     * @returns {object} 행동 종류, 이동, 피해와 상태가 포함된 결정형 결과입니다.
     */
    performLoraTurn() {
        if (this.turn !== 'lora' || this.phase !== 'lora') {
            return { ok: false, action: 'none', reason: 'not-lora-turn' };
        }
        if (this.#loraTurnPerformed) {
            return { ok: false, action: 'none', reason: 'lora-turn-already-performed' };
        }
        this.#loraTurnPerformed = true;

        if (this.lora.alive !== true) {
            this.lastLoraAction = 'skip';
            return {
                ok: true,
                action: 'skip',
                reason: 'lora-incapacitated',
                damage: 0
            };
        }

        if (this.lora.defendCooldown > 0) {
            this.lora.defendCooldown -= 1;
        }

        const instabilityState = this.getInstabilityState();
        if (instabilityState.id === 'stable') {
            this.lastLoraAction = ACTION_TALK;
            return { ok: true, action: ACTION_TALK, damage: 0 };
        }

        const followedAnAttack = this.lastLoraAction === 'melee'
            || this.lastLoraAction === 'ranged';
        if (followedAnAttack && this.lora.defendCooldown === 0) {
            this.lora.defending = true;
            this.lora.defendCooldown = this.#config.loraDefendCooldown;
            this.lastLoraAction = ACTION_DEFEND;
            return {
                ok: true,
                action: ACTION_DEFEND,
                damage: 0,
                reduction: this.#config.loraDefendReduction,
                cooldown: this.lora.defendCooldown
            };
        }

        if (this.#isAdjacent(this.lora, this.player)) {
            return this.#performLoraAttack('melee', this.#config.loraMeleeDamage);
        }

        if (RANGED_INSTABILITY_STATES.has(instabilityState.id)
            && this.#isPlayerInLoraRangedArea()) {
            return this.#performLoraAttack('ranged', this.#config.loraRangedDamage);
        }

        if (DEFENSIVE_INSTABILITY_STATES.has(instabilityState.id)
            && this.lora.defendCooldown === 0) {
            this.lora.defending = true;
            this.lora.defendCooldown = this.#config.loraDefendCooldown;
            this.lastLoraAction = ACTION_DEFEND;
            return {
                ok: true,
                action: ACTION_DEFEND,
                damage: 0,
                reduction: this.#config.loraDefendReduction,
                cooldown: this.lora.defendCooldown
            };
        }

        const movement = this.#chooseLoraMovement();
        if (movement) {
            const from = { x: this.lora.x, y: this.lora.y };
            this.lora.x = movement.x;
            this.lora.y = movement.y;
            this.lastLoraAction = 'move';
            return {
                ok: true,
                action: 'move',
                from,
                to: { x: movement.x, y: movement.y },
                damage: 0
            };
        }

        this.lastLoraAction = ACTION_TALK;
        return { ok: true, action: ACTION_TALK, damage: 0 };
    }

    /**
     * 로라 턴을 끝내고 짝수 라운드 대화 또는 다음 플레이어 라운드로 전환합니다.
     * 로라 행동을 아직 수행하지 않았다면 호환성을 위해 먼저 자동 수행합니다.
     * @returns {boolean} 정상적으로 상태를 전환했으면 true입니다.
     */
    completeLoraTurn() {
        if (this.turn !== 'lora' || this.phase !== 'lora') {
            return false;
        }
        if (!this.#loraTurnPerformed) {
            this.performLoraTurn();
        }
        if (this.result !== null) {
            return false;
        }

        this.player.defending = false;
        if (this.round % 2 === 0) {
            this.turn = 'dialogue';
            this.phase = 'dialogue';
            this.#committedMove = null;
            return true;
        }
        if (this.round >= this.#config.maxRounds) {
            this.#finishBattle('failure', 'turn-limit');
            return true;
        }

        this.#startNextPlayerRound();
        return true;
    }

    /**
     * 짝수 라운드 강제 대화 선택을 기록하고 다음 상태로 전환합니다.
     * 미작성 기획 영역이므로 선택 자체는 수치에 영향을 주지 않습니다.
     * @param {'avoid'|'attack'|'understand'|'lie'} choice - 선택한 대화 유형입니다.
     * @returns {{ok:boolean,choice:string,round?:number,result?:object,reason?:string}} 대화 처리 결과입니다.
     */
    chooseDialogue(choice) {
        if (this.turn !== 'dialogue' || this.phase !== 'dialogue') {
            return { ok: false, choice: '', reason: 'not-dialogue-phase' };
        }
        if (!this.#config.dialogueChoiceIds.has(choice)) {
            return {
                ok: false,
                choice: typeof choice === 'string' ? choice : '',
                reason: 'invalid-dialogue-choice'
            };
        }

        const completedRound = this.round;
        this.dialogueHistory.push({ round: completedRound, choice });
        if (completedRound >= this.#config.maxRounds) {
            this.#finishBattle('failure', 'turn-limit');
        } else {
            this.#startNextPlayerRound();
        }

        return {
            ok: true,
            choice,
            round: completedRound,
            result: this.result
        };
    }

    /** @private */
    #performLoraAttack(action, baseDamage) {
        const damage = this.player.defending
            ? baseDamage * (1 - this.#config.playerDefendReduction)
            : baseDamage;
        const appliedDamage = Math.min(this.player.hp, damage);
        this.player.hp = Math.max(0, this.player.hp - damage);
        this.player.alive = this.player.hp > 0;
        this.lastLoraAction = action;

        if (!this.player.alive) {
            this.#finishBattle('failure', 'player-defeated');
        }
        return {
            ok: true,
            action,
            damage: appliedDamage,
            defeated: !this.player.alive,
            defended: this.player.defending === true,
            result: this.result
        };
    }

    /** @private */
    #chooseLoraMovement() {
        const candidates = [];
        for (let index = 0; index < DIRECTIONS.length; index++) {
            const direction = DIRECTIONS[index];
            const x = this.lora.x + direction.x;
            const y = this.lora.y + direction.y;
            if (!this.isInside(x, y)
                || Math.max(
                    Math.abs(x - this.door.x),
                    Math.abs(y - this.door.y)
                ) > this.#config.loraGateZoneRadius
                || this.#isLoraMovementBlocked(x, y)) {
                continue;
            }
            candidates.push({
                x,
                y,
                order: index,
                playerDistance: Math.abs(x - this.player.x) + Math.abs(y - this.player.y)
            });
        }
        candidates.sort((left, right) => (
            left.playerDistance - right.playerDistance || left.order - right.order
        ));
        return candidates[0] ?? null;
    }

    /** @private */
    #isPlayerInLoraRangedArea() {
        return Math.abs(this.player.x - this.lora.x) <= this.#config.loraRangedRange
            && Math.abs(this.player.y - this.lora.y) <= this.#config.loraRangedRange;
    }

    /**
     * 자동 경로의 동률 비교에 사용할 로라 공격 범위 노출 비용을 반환합니다.
     * @param {number} x - 검사할 타일 X 좌표입니다.
     * @param {number} y - 검사할 타일 Y 좌표입니다.
     * @returns {number} 공격 범위 안이면 1, 아니면 0입니다.
     * @private
     */
    #getLoraThreatCost(x, y) {
        if (this.lora.alive !== true) {
            return 0;
        }
        const state = this.getInstabilityState();
        if (state.id === 'stable') {
            return 0;
        }

        const deltaX = Math.abs(x - this.lora.x);
        const deltaY = Math.abs(y - this.lora.y);
        if (deltaX + deltaY === this.#config.loraMeleeRange) {
            return 1;
        }
        return RANGED_INSTABILITY_STATES.has(state.id)
            && deltaX <= this.#config.loraRangedRange
            && deltaY <= this.#config.loraRangedRange
            ? 1
            : 0;
    }

    /** @private */
    #startNextPlayerRound() {
        this.round += 1;
        this.turn = 'player';
        this.phase = 'move';
        this.selectedAction = ACTION_ATTACK;
        this.#turnStartPlayer = { ...this.player };
        this.#committedMove = null;
        this.#loraTurnPerformed = false;
    }

    /** @private */
    #beginLoraTurn() {
        this.turn = 'lora';
        this.phase = 'lora';
        this.lora.defending = false;
        this.#committedMove = null;
        this.#loraTurnPerformed = false;
    }

    /** @private */
    #finishBattle(outcome, reason) {
        this.result = {
            outcome,
            reason,
            round: this.round,
            playerHp: this.player.hp,
            loraHp: this.lora.hp,
            instability: this.lora.instability,
            instabilityState: this.getInstabilityState().id,
            dialogueChoices: this.dialogueHistory.map((entry) => ({ ...entry }))
        };
        this.turn = 'result';
        this.phase = 'result';
        this.#committedMove = null;
    }

    /** @private */
    #canUsePlayerAction() {
        return this.turn === 'player'
            && (this.phase === 'move' || this.phase === 'action')
            && this.result === null;
    }

    /** @private */
    #createInteractionSuccess(action, target, overrides = {}) {
        return {
            ok: true,
            action,
            targetId: target.id,
            targetType: target.type,
            damage: 0,
            destroyed: false,
            defeated: false,
            victory: false,
            gateOpened: false,
            instabilityChange: 0,
            ...overrides
        };
    }

    /** @private */
    #createInteractionFailure(action, targetId, reason) {
        return {
            ok: false,
            action: typeof action === 'string' ? action : '',
            targetId: typeof targetId === 'string' ? targetId : '',
            targetType: null,
            damage: 0,
            destroyed: false,
            defeated: false,
            victory: false,
            gateOpened: false,
            instabilityChange: 0,
            reason
        };
    }

    /** @private */
    #createMoveFailure(reason) {
        return { ok: false, path: [], cost: null, reason };
    }

    /** @private */
    #isMovementBlocked(x, y) {
        if (this.#isSamePosition(this.lora, x, y)) {
            return true;
        }
        return this.boxes.some((box) => (
            box.destroyed !== true && this.#isSamePosition(box, x, y)
        ));
    }

    /** @private */
    #isLoraMovementBlocked(x, y) {
        if (this.#isSamePosition(this.player, x, y)
            || this.#isSamePosition(this.door, x, y)) {
            return true;
        }
        return this.boxes.some((box) => (
            box.destroyed !== true && this.#isSamePosition(box, x, y)
        ));
    }

    /** @private */
    #buildPath(destinationKey, previous, coordinates) {
        const reversedPath = [];
        let key = destinationKey;
        while (key !== undefined) {
            const position = coordinates.get(key);
            if (!position) {
                return [];
            }
            reversedPath.push({ x: position.x, y: position.y });
            key = previous.get(key);
        }
        return reversedPath.reverse();
    }

    /** @private */
    #isInteractionReachable(left, right) {
        return this.#isAdjacent(left, right);
    }

    /** @private */
    #isAdjacent(left, right) {
        if (!this.#isValidPosition(left) || !this.#isValidPosition(right)) {
            return false;
        }
        return Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1;
    }

    /** @private */
    #isValidPosition(position) {
        return Boolean(position
            && typeof position === 'object'
            && this.isInside(position.x, position.y));
    }

    /** @private */
    #isSamePosition(position, x, y) {
        return Boolean(position && position.x === x && position.y === y);
    }

    /** @private */
    #isValidAction(action) {
        return PLAYER_ACTIONS.includes(action);
    }

    /** @private */
    #toTileKey(x, y) {
        return `${x},${y}`;
    }

    /** @private */
    #clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    /**
     * 외부 설정을 검증하고 모델 전용 불변 데이터로 복제합니다.
     * @param {object} config - 원본 튜토리얼 게임 데이터입니다.
     * @returns {object} 정규화된 설정입니다.
     * @private
     */
    #normalizeConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new TypeError('TutorialBattleModel: config 객체가 필요합니다.');
        }

        const map = config.MAP;
        const actors = config.ACTORS;
        const objects = config.OBJECTS;
        const rules = config.RULES;
        const dialogue = config.DIALOGUE;
        if (!map || typeof map !== 'object'
            || !actors || typeof actors !== 'object'
            || !objects || typeof objects !== 'object'
            || !rules || typeof rules !== 'object'
            || !dialogue || typeof dialogue !== 'object') {
            throw new TypeError(
                'TutorialBattleModel: MAP, ACTORS, OBJECTS, RULES, DIALOGUE 설정이 필요합니다.'
            );
        }

        const width = this.#requirePositiveInteger(map.WIDTH, 'MAP.WIDTH');
        const height = this.#requirePositiveInteger(map.HEIGHT, 'MAP.HEIGHT');
        const moveRange = this.#requireNonNegativeNumber(map.MOVE_RANGE, 'MAP.MOVE_RANGE', true);
        const heights = this.#normalizeHeights(map.HEIGHTS, width, height);

        const playerConfig = actors.PLAYER;
        const loraConfig = actors.LORA;
        const playerStart = this.#normalizePosition(playerConfig?.START, 'ACTORS.PLAYER.START');
        const loraStart = this.#normalizePosition(loraConfig?.START, 'ACTORS.LORA.START');
        const door = this.#normalizePosition(objects.DOOR, 'OBJECTS.DOOR');
        const boxes = this.#normalizeBoxes(objects.BOXES);
        const playerMaxHp = this.#requirePositiveNumber(
            playerConfig?.MAX_HP,
            'ACTORS.PLAYER.MAX_HP'
        );
        const playerDefendReduction = this.#requireReduction(
            playerConfig?.DEFEND_DAMAGE_REDUCTION,
            'ACTORS.PLAYER.DEFEND_DAMAGE_REDUCTION'
        );
        const loraMaxHp = this.#requirePositiveNumber(loraConfig?.MAX_HP, 'ACTORS.LORA.MAX_HP');
        const loraMaxInstability = this.#requirePositiveNumber(
            loraConfig?.MAX_INSTABILITY,
            'ACTORS.LORA.MAX_INSTABILITY'
        );
        const loraStartInstability = this.#requireNonNegativeNumber(
            loraConfig?.START_INSTABILITY,
            'ACTORS.LORA.START_INSTABILITY'
        );
        if (loraStartInstability > loraMaxInstability) {
            throw new RangeError(
                'TutorialBattleModel: ACTORS.LORA.START_INSTABILITY가 최대치를 넘을 수 없습니다.'
            );
        }

        const normalized = {
            width,
            height,
            moveRange,
            heights: Object.freeze(heights.map((row) => Object.freeze(row))),
            playerStart: Object.freeze(playerStart),
            playerMaxHp,
            playerDefendReduction,
            loraStart: Object.freeze(loraStart),
            loraMaxHp,
            loraStartInstability,
            loraMaxInstability,
            loraMoveRange: this.#requirePositiveInteger(
                loraConfig?.MOVE_RANGE,
                'ACTORS.LORA.MOVE_RANGE'
            ),
            loraGateZoneRadius: this.#requireNonNegativeNumber(
                loraConfig?.GATE_ZONE_RADIUS,
                'ACTORS.LORA.GATE_ZONE_RADIUS',
                true
            ),
            loraMeleeDamage: this.#requirePositiveNumber(
                loraConfig?.MELEE_DAMAGE,
                'ACTORS.LORA.MELEE_DAMAGE'
            ),
            loraMeleeRange: this.#requirePositiveInteger(
                loraConfig?.MELEE_RANGE,
                'ACTORS.LORA.MELEE_RANGE'
            ),
            loraRangedDamage: this.#requirePositiveNumber(
                loraConfig?.RANGED_DAMAGE,
                'ACTORS.LORA.RANGED_DAMAGE'
            ),
            loraRangedRange: this.#requirePositiveInteger(
                loraConfig?.RANGED_RANGE,
                'ACTORS.LORA.RANGED_RANGE'
            ),
            loraDefendReduction: this.#requireReduction(
                loraConfig?.DEFEND_DAMAGE_REDUCTION,
                'ACTORS.LORA.DEFEND_DAMAGE_REDUCTION'
            ),
            loraDefendCooldown: this.#requireNonNegativeNumber(
                loraConfig?.DEFEND_COOLDOWN,
                'ACTORS.LORA.DEFEND_COOLDOWN',
                true
            ),
            instabilityStates: this.#normalizeInstabilityStates(
                loraConfig?.INSTABILITY_STATES,
                loraMaxInstability
            ),
            door: Object.freeze(door),
            boxes: Object.freeze(boxes.map((box) => Object.freeze(box))),
            maxRounds: this.#requirePositiveInteger(rules.MAX_ROUNDS, 'RULES.MAX_ROUNDS'),
            playerAttackDamage: this.#requirePositiveNumber(
                rules.PLAYER_ATTACK_DAMAGE,
                'RULES.PLAYER_ATTACK_DAMAGE'
            ),
            playerAttackInstability: this.#requireNonNegativeNumber(
                rules.PLAYER_ATTACK_INSTABILITY,
                'RULES.PLAYER_ATTACK_INSTABILITY'
            ),
            consecutiveAttackInstability: this.#requireNonNegativeNumber(
                rules.CONSECUTIVE_ATTACK_INSTABILITY,
                'RULES.CONSECUTIVE_ATTACK_INSTABILITY'
            ),
            dialogueChoiceIds: this.#normalizeDialogueChoiceIds(dialogue.CHOICES)
        };

        for (const [position, label] of [
            [playerStart, 'ACTORS.PLAYER.START'],
            [loraStart, 'ACTORS.LORA.START'],
            [door, 'OBJECTS.DOOR']
        ]) {
            this.#requireInsideConfig(position, width, height, label);
        }
        if (this.#isSamePosition(playerStart, loraStart.x, loraStart.y)) {
            throw new RangeError('TutorialBattleModel: 플레이어와 로라 시작 위치가 겹칩니다.');
        }

        const occupiedKeys = new Set([
            this.#toTileKey(playerStart.x, playerStart.y),
            this.#toTileKey(loraStart.x, loraStart.y),
            this.#toTileKey(door.x, door.y)
        ]);
        for (const box of boxes) {
            this.#requireInsideConfig(box, width, height, `OBJECTS.BOXES(${box.id})`);
            const key = this.#toTileKey(box.x, box.y);
            if (occupiedKeys.has(key)) {
                throw new RangeError(`TutorialBattleModel: ${box.id}의 시작 위치가 다른 요소와 겹칩니다.`);
            }
            occupiedKeys.add(key);
        }

        return Object.freeze(normalized);
    }

    /** @private */
    #normalizeHeights(value, width, height) {
        if (!Array.isArray(value) || value.length !== height) {
            throw new RangeError('TutorialBattleModel: MAP.HEIGHTS 행 수가 MAP.HEIGHT와 일치해야 합니다.');
        }
        return value.map((row, y) => {
            if (!Array.isArray(row) || row.length !== width) {
                throw new RangeError(
                    `TutorialBattleModel: MAP.HEIGHTS[${y}] 열 수가 MAP.WIDTH와 일치해야 합니다.`
                );
            }
            return row.map((heightValue, x) => {
                if (!Number.isFinite(heightValue)) {
                    throw new TypeError(
                        `TutorialBattleModel: MAP.HEIGHTS[${y}][${x}]는 유한한 숫자여야 합니다.`
                    );
                }
                return heightValue;
            });
        });
    }

    /** @private */
    #normalizeInstabilityStates(value, maxInstability) {
        if (!Array.isArray(value) || value.length === 0) {
            throw new TypeError('TutorialBattleModel: ACTORS.LORA.INSTABILITY_STATES가 필요합니다.');
        }
        const ids = new Set();
        const states = value.map((state, index) => {
            if (!state || typeof state !== 'object'
                || typeof state.id !== 'string'
                || state.id.length === 0
                || typeof state.label !== 'string'
                || !Number.isFinite(state.min)
                || !Number.isFinite(state.max)
                || state.min > state.max
                || ids.has(state.id)) {
                throw new TypeError(
                    `TutorialBattleModel: ACTORS.LORA.INSTABILITY_STATES[${index}]가 올바르지 않습니다.`
                );
            }
            ids.add(state.id);
            return Object.freeze({
                id: state.id,
                label: state.label,
                min: state.min,
                max: state.max
            });
        });
        if (states[0].min !== 0 || states[states.length - 1].max !== maxInstability) {
            throw new RangeError(
                'TutorialBattleModel: 불안정 상태 구간이 0부터 최대 불안정도까지 이어져야 합니다.'
            );
        }
        return Object.freeze(states);
    }

    /** @private */
    #normalizeDialogueChoiceIds(value) {
        if (!Array.isArray(value) || value.length === 0) {
            throw new TypeError('TutorialBattleModel: DIALOGUE.CHOICES가 필요합니다.');
        }
        const ids = new Set();
        for (let index = 0; index < value.length; index++) {
            const choice = value[index];
            if (!choice || typeof choice.id !== 'string' || choice.id.length === 0 || ids.has(choice.id)) {
                throw new TypeError(`TutorialBattleModel: DIALOGUE.CHOICES[${index}].id가 올바르지 않습니다.`);
            }
            ids.add(choice.id);
        }
        return Object.freeze(ids);
    }

    /** @private */
    #normalizeBoxes(value) {
        if (!Array.isArray(value)) {
            throw new TypeError('TutorialBattleModel: OBJECTS.BOXES는 배열이어야 합니다.');
        }
        const usedIds = new Set([PLAYER_ID, LORA_ID, DOOR_ID]);
        return value.map((box, index) => {
            if (!box || typeof box !== 'object') {
                throw new TypeError(`TutorialBattleModel: OBJECTS.BOXES[${index}]는 객체여야 합니다.`);
            }
            if (typeof box.id !== 'string' || box.id.length === 0 || usedIds.has(box.id)) {
                throw new TypeError(`TutorialBattleModel: OBJECTS.BOXES[${index}].id가 없거나 중복되었습니다.`);
            }
            usedIds.add(box.id);
            const position = this.#normalizePosition(box, `OBJECTS.BOXES[${index}]`);
            return { id: box.id, x: position.x, y: position.y };
        });
    }

    /** @private */
    #normalizePosition(value, label) {
        if (!value || typeof value !== 'object'
            || !Number.isInteger(value.x)
            || !Number.isInteger(value.y)) {
            throw new TypeError(`TutorialBattleModel: ${label}는 정수 x/y 좌표여야 합니다.`);
        }
        return { x: value.x, y: value.y };
    }

    /** @private */
    #requirePositiveInteger(value, label) {
        if (!Number.isInteger(value) || value <= 0) {
            throw new TypeError(`TutorialBattleModel: ${label}는 양의 정수여야 합니다.`);
        }
        return value;
    }

    /** @private */
    #requirePositiveNumber(value, label) {
        if (!Number.isFinite(value) || value <= 0) {
            throw new TypeError(`TutorialBattleModel: ${label}는 양의 유한한 숫자여야 합니다.`);
        }
        return value;
    }

    /** @private */
    #requireNonNegativeNumber(value, label, integerOnly = false) {
        const valid = Number.isFinite(value)
            && value >= 0
            && (!integerOnly || Number.isInteger(value));
        if (!valid) {
            const expected = integerOnly ? '0 이상의 정수' : '0 이상의 유한한 숫자';
            throw new TypeError(`TutorialBattleModel: ${label}는 ${expected}여야 합니다.`);
        }
        return value;
    }

    /** @private */
    #requireReduction(value, label) {
        if (!Number.isFinite(value) || value < 0 || value >= 1) {
            throw new TypeError(`TutorialBattleModel: ${label}는 0 이상 1 미만이어야 합니다.`);
        }
        return value;
    }

    /** @private */
    #requireInsideConfig(position, width, height, label) {
        if (position.x < 0 || position.x >= width || position.y < 0 || position.y >= height) {
            throw new RangeError(`TutorialBattleModel: ${label}가 맵 밖에 있습니다.`);
        }
    }
}
