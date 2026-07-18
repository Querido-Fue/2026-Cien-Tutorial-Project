const PLAYER_ID = 'player';
const LORA_ID = 'lora';
const DOOR_ID = 'door';
const ACTION_ATTACK = 'attack';
const ACTION_TALK = 'talk';
const DIRECTIONS = Object.freeze([
    Object.freeze({ x: 0, y: -1 }),
    Object.freeze({ x: 1, y: 0 }),
    Object.freeze({ x: 0, y: 1 }),
    Object.freeze({ x: -1, y: 0 })
]);

/**
 * @class MinPriorityQueue
 * @description 다익스트라 탐색에서 비용이 가장 낮은 좌표를 먼저 꺼내는 최소 힙입니다.
 */
class MinPriorityQueue {
    #items = [];
    #sequence = 0;

    /**
     * 현재 큐에 보관된 항목 수를 반환합니다.
     * @returns {number} 항목 수입니다.
     */
    get size() {
        return this.#items.length;
    }

    /**
     * 좌표를 지정한 비용으로 큐에 추가합니다.
     * @param {{x:number, y:number}} value - 탐색할 좌표입니다.
     * @param {number} priority - 누적 이동 비용입니다.
     */
    enqueue(value, priority) {
        const entry = {
            value,
            priority,
            sequence: this.#sequence++
        };
        this.#items.push(entry);
        this.#bubbleUp(this.#items.length - 1);
    }

    /**
     * 비용이 가장 낮은 항목을 꺼냅니다.
     * @returns {{value:{x:number,y:number}, priority:number}|null} 최우선 항목입니다.
     */
    dequeue() {
        if (this.#items.length === 0) {
            return null;
        }

        const first = this.#items[0];
        const last = this.#items.pop();
        if (this.#items.length > 0 && last) {
            this.#items[0] = last;
            this.#sinkDown(0);
        }

        return {
            value: first.value,
            priority: first.priority
        };
    }

    /**
     * 새 항목을 힙의 올바른 위치까지 위로 이동합니다.
     * @param {number} index - 이동을 시작할 인덱스입니다.
     * @private
     */
    #bubbleUp(index) {
        let currentIndex = index;
        while (currentIndex > 0) {
            const parentIndex = Math.floor((currentIndex - 1) / 2);
            if (!this.#comesBefore(this.#items[currentIndex], this.#items[parentIndex])) {
                break;
            }
            [this.#items[currentIndex], this.#items[parentIndex]] = [
                this.#items[parentIndex],
                this.#items[currentIndex]
            ];
            currentIndex = parentIndex;
        }
    }

    /**
     * 루트로 이동한 항목을 힙의 올바른 위치까지 아래로 이동합니다.
     * @param {number} index - 이동을 시작할 인덱스입니다.
     * @private
     */
    #sinkDown(index) {
        let currentIndex = index;
        const length = this.#items.length;

        while (true) {
            const leftIndex = (currentIndex * 2) + 1;
            const rightIndex = leftIndex + 1;
            let nextIndex = currentIndex;

            if (leftIndex < length
                && this.#comesBefore(this.#items[leftIndex], this.#items[nextIndex])) {
                nextIndex = leftIndex;
            }
            if (rightIndex < length
                && this.#comesBefore(this.#items[rightIndex], this.#items[nextIndex])) {
                nextIndex = rightIndex;
            }
            if (nextIndex === currentIndex) {
                return;
            }

            [this.#items[currentIndex], this.#items[nextIndex]] = [
                this.#items[nextIndex],
                this.#items[currentIndex]
            ];
            currentIndex = nextIndex;
        }
    }

    /**
     * 두 항목의 비용과 삽입 순서를 비교합니다.
     * @param {{priority:number, sequence:number}} left - 왼쪽 항목입니다.
     * @param {{priority:number, sequence:number}} right - 오른쪽 항목입니다.
     * @returns {boolean} 왼쪽 항목이 먼저 나와야 하면 true입니다.
     * @private
     */
    #comesBefore(left, right) {
        if (left.priority !== right.priority) {
            return left.priority < right.priority;
        }
        return left.sequence < right.sequence;
    }
}

/**
 * @class TutorialBattleModel
 * @description 튜토리얼 전투의 맵, 이동, 상호작용, 턴 상태를 관리하는 순수 자바스크립트 모델입니다.
 */
export class TutorialBattleModel {
    #config;
    #turnStartPlayer;
    #committedMove;

    /**
     * @param {object} config - `TUTORIAL_GAME_DATA` 형식의 전투 설정입니다.
     */
    constructor(config) {
        this.#config = this.#normalizeConfig(config);
        this.#turnStartPlayer = null;
        this.#committedMove = null;
        this.reset();
    }

    /**
     * 전투를 초기 상태로 되돌립니다.
     */
    reset() {
        const playerStart = this.#config.playerStart;
        const loraStart = this.#config.loraStart;

        this.turn = 'player';
        this.phase = 'move';
        this.round = 1;
        this.selectedAction = ACTION_ATTACK;
        this.player = { x: playerStart.x, y: playerStart.y };
        this.lora = {
            x: loraStart.x,
            y: loraStart.y,
            hp: this.#config.loraMaxHp,
            maxHp: this.#config.loraMaxHp,
            alive: true
        };
        this.door = { ...this.#config.door };
        this.boxes = this.#config.boxes.map((box) => ({
            id: box.id,
            x: box.x,
            y: box.y,
            destroyed: false
        }));
        this.#turnStartPlayer = { ...this.player };
        this.#committedMove = null;
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
     * 지정한 타일의 높이를 반환합니다.
     * @param {number} x - 타일 X 좌표입니다.
     * @param {number} y - 타일 Y 좌표입니다.
     * @returns {number|null} 타일 높이 또는 유효하지 않은 좌표일 때 null입니다.
     */
    getTileHeight(x, y) {
        if (!this.isInside(x, y)) {
            return null;
        }
        return this.#config.heights[y][x];
    }

    /**
     * 지정한 타일을 점유한 전투 요소를 반환합니다.
     * 파괴된 상자는 점유 요소에서 제외합니다.
     * @param {number} x - 타일 X 좌표입니다.
     * @param {number} y - 타일 Y 좌표입니다.
     * @returns {{id:string,type:'player'|'lora'|'door'|'box',x:number,y:number}|null} 점유 요소 설명입니다.
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
     * 현재 플레이어 위치에서 이동 가능한 타일과 최소 비용 경로를 계산합니다.
     * Map 키는 `x,y` 문자열이며 시작 타일도 비용 0으로 포함합니다.
     * @returns {Map<string,{x:number,y:number,cost:number,path:Array<{x:number,y:number}>}>} 도달 가능 타일 지도입니다.
     */
    getReachability() {
        const reachability = new Map();
        if (!this.#isValidPosition(this.player)) {
            return reachability;
        }

        const start = { x: this.player.x, y: this.player.y };
        const startKey = this.#toTileKey(start.x, start.y);
        const distances = new Map([[startKey, 0]]);
        const previous = new Map();
        const coordinates = new Map([[startKey, start]]);
        const queue = new MinPriorityQueue();
        queue.enqueue(start, 0);

        while (queue.size > 0) {
            const currentEntry = queue.dequeue();
            if (!currentEntry) {
                break;
            }

            const current = currentEntry.value;
            const currentKey = this.#toTileKey(current.x, current.y);
            const currentCost = distances.get(currentKey);
            if (currentCost === undefined || currentEntry.priority !== currentCost) {
                continue;
            }

            for (const direction of DIRECTIONS) {
                const nextX = current.x + direction.x;
                const nextY = current.y + direction.y;
                if (!this.isInside(nextX, nextY) || this.#isMovementBlocked(nextX, nextY)) {
                    continue;
                }

                const stepCost = this.#getStepCost(current.x, current.y, nextX, nextY);
                if (stepCost === null) {
                    continue;
                }

                const nextCost = currentCost + stepCost;
                if (nextCost > this.#config.moveRange) {
                    continue;
                }

                const nextKey = this.#toTileKey(nextX, nextY);
                const knownCost = distances.get(nextKey);
                if (knownCost !== undefined && knownCost <= nextCost) {
                    continue;
                }

                const nextPosition = { x: nextX, y: nextY };
                distances.set(nextKey, nextCost);
                previous.set(nextKey, currentKey);
                coordinates.set(nextKey, nextPosition);
                queue.enqueue(nextPosition, nextCost);
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
     * 현재 플레이어 위치에서 목적지까지의 최소 비용 경로를 반환합니다.
     * @param {number} x - 목적지 X 좌표입니다.
     * @param {number} y - 목적지 Y 좌표입니다.
     * @returns {Array<{x:number,y:number}>|null} 시작점과 목적지를 포함한 경로 또는 null입니다.
     */
    getPathTo(x, y) {
        if (!this.isInside(x, y)) {
            return null;
        }
        const entry = this.getReachability().get(this.#toTileKey(x, y));
        return entry ? entry.path.map((point) => ({ ...point })) : null;
    }

    /**
     * 플레이어 이동 목적지를 확정하고 행동 단계로 전환합니다.
     * 현재 상태와 목적지를 다시 검증하므로 표시용 reachability 결과를 신뢰하지 않습니다.
     * @param {number} x - 목적지 X 좌표입니다.
     * @param {number} y - 목적지 Y 좌표입니다.
     * @returns {{ok:boolean,path:Array<{x:number,y:number}>,cost:number|null,reason?:string}} 이동 처리 결과입니다.
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
        this.player = { x, y };
        this.phase = 'action';
        this.selectedAction = ACTION_ATTACK;
        this.#committedMove = {
            path: path.map((point) => ({ ...point })),
            cost: entry.cost
        };
        return { ok: true, path, cost: entry.cost };
    }

    /**
     * 플레이어가 순서대로 입력한 실제 이동 경로를 검증하고 확정합니다.
     * 최단 경로가 아니어도 허용하므로 같은 타일 재방문과 출발점 복귀를 표현할 수 있습니다.
     * @param {Array<{x:number,y:number}>} path - 시작 타일부터 목적지까지의 순서 경로입니다.
     * @returns {{ok:boolean,path:Array<{x:number,y:number}>,cost:number|null,reason?:string}} 이동 처리 결과입니다.
     */
    commitPath(path) {
        if (this.turn !== 'player' || this.phase !== 'move') {
            return this.#createMoveFailure('not-player-move-phase');
        }
        if (!Array.isArray(path) || path.length === 0) {
            return this.#createMoveFailure('invalid-path');
        }

        const normalizedPath = [];
        for (const point of path) {
            if (!point || !this.isInside(point.x, point.y)) {
                return this.#createMoveFailure('invalid-path');
            }
            normalizedPath.push({ x: point.x, y: point.y });
        }
        if (!this.#isSamePosition(normalizedPath[0], this.player.x, this.player.y)) {
            return this.#createMoveFailure('path-start-mismatch');
        }

        let cost = 0;
        for (let index = 1; index < normalizedPath.length; index++) {
            const previous = normalizedPath[index - 1];
            const current = normalizedPath[index];
            if (!this.#isAdjacent(previous, current) || this.#isMovementBlocked(current.x, current.y)) {
                return this.#createMoveFailure('invalid-path-step');
            }

            const stepCost = this.#getStepCost(previous.x, previous.y, current.x, current.y);
            if (stepCost === null) {
                return this.#createMoveFailure('invalid-height-step');
            }
            cost += stepCost;
            if (cost > this.#config.moveRange) {
                return this.#createMoveFailure('path-cost-exceeded');
            }
        }

        const destination = normalizedPath[normalizedPath.length - 1];
        this.player = { ...destination };
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
     * 상호작용 전 행동 단계에서 이번 턴 시작 위치로 이동을 되돌립니다.
     * @returns {boolean} 이동을 되돌렸으면 true입니다.
     */
    undoMove() {
        if (this.turn !== 'player'
            || this.phase !== 'action'
            || !this.#committedMove
            || !this.#isValidPosition(this.#turnStartPlayer)) {
            return false;
        }

        this.player = { ...this.#turnStartPlayer };
        this.phase = 'move';
        this.selectedAction = ACTION_ATTACK;
        this.#committedMove = null;
        return true;
    }

    /**
     * 행동 단계에서 사용할 상호작용 종류를 선택합니다.
     * @param {'attack'|'talk'} action - 선택할 행동입니다.
     * @returns {boolean} 행동을 선택했으면 true입니다.
     */
    selectAction(action) {
        if (this.turn !== 'player' || this.phase !== 'action' || !this.#isValidAction(action)) {
            return false;
        }
        this.selectedAction = action;
        return true;
    }

    /**
     * 현재 위치와 행동에 맞는 인접 상호작용 대상을 반환합니다.
     * @param {'attack'|'talk'} [action=this.selectedAction] - 검사할 행동입니다.
     * @returns {Array<{id:string,type:'lora'|'box',x:number,y:number}>} 유효한 대상 목록입니다.
     */
    getValidTargets(action = this.selectedAction) {
        if (this.turn !== 'player'
            || this.phase !== 'action'
            || !this.#isValidAction(action)
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
     * 선택된 행동으로 지정한 인접 대상과 상호작용합니다.
     * @param {string} targetId - `lora` 또는 상자 ID입니다.
     * @returns {{ok:boolean,action:string,targetId:string,targetType:string|null,damage:number,destroyed:boolean,defeated:boolean,victory:boolean,reason?:string}} 상호작용 결과입니다.
     */
    performInteraction(targetId) {
        const action = this.selectedAction;
        if (this.turn !== 'player' || this.phase !== 'action') {
            return this.#createInteractionFailure(action, targetId, 'not-player-action-phase');
        }
        if (!this.#isValidAction(action)) {
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
            this.#beginLoraTurn();
            return {
                ok: true,
                action,
                targetId,
                targetType: target.type,
                damage: 0,
                destroyed: false,
                defeated: false,
                victory: false
            };
        }

        if (target.type === 'box') {
            const box = this.boxes.find((candidate) => candidate.id === targetId);
            if (!box || box.destroyed === true) {
                return this.#createInteractionFailure(action, targetId, 'invalid-target');
            }
            box.destroyed = true;
            this.#beginLoraTurn();
            return {
                ok: true,
                action,
                targetId,
                targetType: target.type,
                damage: 0,
                destroyed: true,
                defeated: false,
                victory: false
            };
        }

        const damage = Math.min(this.lora.hp, this.#config.playerAttackDamage);
        this.lora.hp = Math.max(0, this.lora.hp - this.#config.playerAttackDamage);
        this.lora.alive = this.lora.hp > 0;
        const defeated = !this.lora.alive;

        if (defeated) {
            this.turn = 'victory';
            this.phase = 'victory';
            this.#committedMove = null;
        } else {
            this.#beginLoraTurn();
        }

        return {
            ok: true,
            action,
            targetId,
            targetType: target.type,
            damage,
            destroyed: false,
            defeated,
            victory: defeated
        };
    }

    /**
     * 플레이어가 남은 행동을 포기하고 로라 턴으로 넘깁니다.
     * 이동 단계와 행동 단계 모두에서 사용할 수 있습니다.
     * @returns {boolean} 턴을 넘겼으면 true입니다.
     */
    wait() {
        if (this.turn !== 'player' || (this.phase !== 'move' && this.phase !== 'action')) {
            return false;
        }
        this.#beginLoraTurn();
        return true;
    }

    /**
     * 로라 턴을 끝내고 다음 플레이어 라운드를 시작합니다.
     * @returns {boolean} 다음 라운드를 시작했으면 true입니다.
     */
    completeLoraTurn() {
        if (this.turn !== 'lora' || this.phase !== 'lora' || this.lora.alive !== true) {
            return false;
        }

        this.round += 1;
        this.turn = 'player';
        this.phase = 'move';
        this.selectedAction = ACTION_ATTACK;
        this.#turnStartPlayer = { ...this.player };
        this.#committedMove = null;
        return true;
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
        if (!map || typeof map !== 'object'
            || !actors || typeof actors !== 'object'
            || !objects || typeof objects !== 'object'
            || !rules || typeof rules !== 'object') {
            throw new TypeError('TutorialBattleModel: MAP, ACTORS, OBJECTS, RULES 설정이 필요합니다.');
        }

        const width = this.#requirePositiveInteger(map.WIDTH, 'MAP.WIDTH');
        const height = this.#requirePositiveInteger(map.HEIGHT, 'MAP.HEIGHT');
        const moveRange = this.#requireNonNegativeNumber(map.MOVE_RANGE, 'MAP.MOVE_RANGE', true);
        const maxHeightStep = this.#requireNonNegativeNumber(
            map.MAX_HEIGHT_STEP,
            'MAP.MAX_HEIGHT_STEP',
            true
        );
        const uphillExtraCost = this.#requireNonNegativeNumber(
            map.UPHILL_EXTRA_COST,
            'MAP.UPHILL_EXTRA_COST'
        );
        const heights = this.#normalizeHeights(map.HEIGHTS, width, height);

        const playerStart = this.#normalizePosition(actors.PLAYER?.START, 'ACTORS.PLAYER.START');
        const loraStart = this.#normalizePosition(actors.LORA?.START, 'ACTORS.LORA.START');
        const door = this.#normalizePosition(objects.DOOR, 'OBJECTS.DOOR');
        const loraMaxHp = this.#requirePositiveNumber(actors.LORA?.MAX_HP, 'ACTORS.LORA.MAX_HP');
        const playerAttackDamage = this.#requirePositiveNumber(
            rules.PLAYER_ATTACK_DAMAGE,
            'RULES.PLAYER_ATTACK_DAMAGE'
        );
        const boxes = this.#normalizeBoxes(objects.BOXES);

        this.#requireInsideConfig(playerStart, width, height, 'ACTORS.PLAYER.START');
        this.#requireInsideConfig(loraStart, width, height, 'ACTORS.LORA.START');
        this.#requireInsideConfig(door, width, height, 'OBJECTS.DOOR');
        if (this.#isSamePosition(playerStart, loraStart.x, loraStart.y)) {
            throw new RangeError('TutorialBattleModel: 플레이어와 로라 시작 위치가 겹칩니다.');
        }

        const occupiedKeys = new Set([
            this.#toTileKey(playerStart.x, playerStart.y),
            this.#toTileKey(loraStart.x, loraStart.y)
        ]);
        const doorKey = this.#toTileKey(door.x, door.y);
        if (occupiedKeys.has(doorKey)) {
            throw new RangeError('TutorialBattleModel: 문 위치가 전투 요소와 겹칩니다.');
        }
        occupiedKeys.add(doorKey);
        for (const box of boxes) {
            this.#requireInsideConfig(box, width, height, `OBJECTS.BOXES(${box.id})`);
            const key = this.#toTileKey(box.x, box.y);
            if (occupiedKeys.has(key)) {
                throw new RangeError(`TutorialBattleModel: ${box.id}의 시작 위치가 다른 요소와 겹칩니다.`);
            }
            occupiedKeys.add(key);
        }

        return Object.freeze({
            width,
            height,
            moveRange,
            maxHeightStep,
            uphillExtraCost,
            heights: Object.freeze(heights.map((row) => Object.freeze(row))),
            playerStart: Object.freeze(playerStart),
            loraStart: Object.freeze(loraStart),
            door: Object.freeze(door),
            loraMaxHp,
            boxes: Object.freeze(boxes.map((box) => Object.freeze(box))),
            playerAttackDamage
        });
    }

    /**
     * 높이 배열을 맵 크기에 맞춰 검증하고 복제합니다.
     * @param {unknown} value - 높이 배열 후보입니다.
     * @param {number} width - 맵 너비입니다.
     * @param {number} height - 맵 높이입니다.
     * @returns {number[][]} 복제된 높이 배열입니다.
     * @private
     */
    #normalizeHeights(value, width, height) {
        if (!Array.isArray(value) || value.length !== height) {
            throw new RangeError('TutorialBattleModel: MAP.HEIGHTS 행 수가 MAP.HEIGHT와 일치해야 합니다.');
        }

        return value.map((row, y) => {
            if (!Array.isArray(row) || row.length !== width) {
                throw new RangeError(`TutorialBattleModel: MAP.HEIGHTS[${y}] 열 수가 MAP.WIDTH와 일치해야 합니다.`);
            }
            return row.map((heightValue, x) => {
                if (!Number.isFinite(heightValue)) {
                    throw new TypeError(`TutorialBattleModel: MAP.HEIGHTS[${y}][${x}]는 유한한 숫자여야 합니다.`);
                }
                return heightValue;
            });
        });
    }

    /**
     * 상자 초기값을 검증하고 복제합니다.
     * @param {unknown} value - 상자 배열 후보입니다.
     * @returns {Array<{id:string,x:number,y:number}>} 복제된 상자 목록입니다.
     * @private
     */
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

    /**
     * 좌표 객체를 정수 타일 좌표로 검증하고 복제합니다.
     * @param {unknown} value - 좌표 후보입니다.
     * @param {string} label - 오류 메시지에 사용할 설정 경로입니다.
     * @returns {{x:number,y:number}} 복제된 좌표입니다.
     * @private
     */
    #normalizePosition(value, label) {
        if (!value || typeof value !== 'object'
            || !Number.isInteger(value.x)
            || !Number.isInteger(value.y)) {
            throw new TypeError(`TutorialBattleModel: ${label}는 정수 x/y 좌표여야 합니다.`);
        }
        return { x: value.x, y: value.y };
    }

    /**
     * 양의 정수를 검증합니다.
     * @param {unknown} value - 숫자 후보입니다.
     * @param {string} label - 오류 메시지에 사용할 설정 경로입니다.
     * @returns {number} 검증된 정수입니다.
     * @private
     */
    #requirePositiveInteger(value, label) {
        if (!Number.isInteger(value) || value <= 0) {
            throw new TypeError(`TutorialBattleModel: ${label}는 양의 정수여야 합니다.`);
        }
        return value;
    }

    /**
     * 0 이상의 숫자를 검증합니다.
     * @param {unknown} value - 숫자 후보입니다.
     * @param {string} label - 오류 메시지에 사용할 설정 경로입니다.
     * @param {boolean} [integerOnly=false] - 정수만 허용할지 여부입니다.
     * @returns {number} 검증된 숫자입니다.
     * @private
     */
    #requireNonNegativeNumber(value, label, integerOnly = false) {
        const isValid = Number.isFinite(value)
            && value >= 0
            && (!integerOnly || Number.isInteger(value));
        if (!isValid) {
            const typeLabel = integerOnly ? '0 이상의 정수' : '0 이상의 유한한 숫자';
            throw new TypeError(`TutorialBattleModel: ${label}는 ${typeLabel}여야 합니다.`);
        }
        return value;
    }

    /**
     * 양의 숫자를 검증합니다.
     * @param {unknown} value - 숫자 후보입니다.
     * @param {string} label - 오류 메시지에 사용할 설정 경로입니다.
     * @returns {number} 검증된 숫자입니다.
     * @private
     */
    #requirePositiveNumber(value, label) {
        if (!Number.isFinite(value) || value <= 0) {
            throw new TypeError(`TutorialBattleModel: ${label}는 양의 유한한 숫자여야 합니다.`);
        }
        return value;
    }

    /**
     * 설정 좌표가 지정한 맵 크기 안에 있는지 검증합니다.
     * @param {{x:number,y:number}} position - 검사할 좌표입니다.
     * @param {number} width - 맵 너비입니다.
     * @param {number} height - 맵 높이입니다.
     * @param {string} label - 오류 메시지에 사용할 설정 경로입니다.
     * @private
     */
    #requireInsideConfig(position, width, height, label) {
        if (position.x < 0 || position.x >= width || position.y < 0 || position.y >= height) {
            throw new RangeError(`TutorialBattleModel: ${label}가 맵 밖에 있습니다.`);
        }
    }

    /**
     * 현재 타일에서 인접 타일로 이동할 실제 비용을 계산합니다.
     * @param {number} fromX - 출발 X 좌표입니다.
     * @param {number} fromY - 출발 Y 좌표입니다.
     * @param {number} toX - 도착 X 좌표입니다.
     * @param {number} toY - 도착 Y 좌표입니다.
     * @returns {number|null} 이동 비용 또는 높이차 제한을 넘을 때 null입니다.
     * @private
     */
    #getStepCost(fromX, fromY, toX, toY) {
        const fromHeight = this.getTileHeight(fromX, fromY);
        const toHeight = this.getTileHeight(toX, toY);
        if (fromHeight === null || toHeight === null) {
            return null;
        }

        const difference = toHeight - fromHeight;
        if (Math.abs(difference) > this.#config.maxHeightStep) {
            return null;
        }
        return difference > 0 ? 1 + this.#config.uphillExtraCost : 1;
    }

    /**
     * 타일이 로라 또는 파괴되지 않은 상자에 막혀 있는지 확인합니다.
     * @param {number} x - 타일 X 좌표입니다.
     * @param {number} y - 타일 Y 좌표입니다.
     * @returns {boolean} 이동할 수 없는 점유 타일이면 true입니다.
     * @private
     */
    #isMovementBlocked(x, y) {
        if (this.#isSamePosition(this.lora, x, y)
            || this.#isSamePosition(this.door, x, y)) {
            return true;
        }
        return this.boxes.some((box) => (
            box.destroyed !== true && this.#isSamePosition(box, x, y)
        ));
    }

    /**
     * 목적지 키에서 시작점까지 predecessor를 따라 경로를 복원합니다.
     * @param {string} destinationKey - 목적지 타일 키입니다.
     * @param {Map<string,string>} previous - 이전 타일 키 지도입니다.
     * @param {Map<string,{x:number,y:number}>} coordinates - 타일 좌표 지도입니다.
     * @returns {Array<{x:number,y:number}>} 시작점과 목적지를 포함한 경로입니다.
     * @private
     */
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

    /**
     * 로라 턴 상태로 전환하고 이동 되돌리기 정보를 폐기합니다.
     * @private
     */
    #beginLoraTurn() {
        this.turn = 'lora';
        this.phase = 'lora';
        this.#committedMove = null;
    }

    /**
     * 이동 실패 결과를 생성합니다.
     * @param {string} reason - 실패 사유 코드입니다.
     * @returns {{ok:false,path:[],cost:null,reason:string}} 이동 실패 결과입니다.
     * @private
     */
    #createMoveFailure(reason) {
        return { ok: false, path: [], cost: null, reason };
    }

    /**
     * 상호작용 실패 결과를 생성합니다.
     * @param {unknown} action - 요청 당시 행동입니다.
     * @param {unknown} targetId - 요청 당시 대상 ID입니다.
     * @param {string} reason - 실패 사유 코드입니다.
     * @returns {{ok:false,action:string,targetId:string,targetType:null,damage:0,destroyed:false,defeated:false,victory:false,reason:string}} 상호작용 실패 결과입니다.
     * @private
     */
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
            reason
        };
    }

    /**
     * 두 요소가 상하좌우로 인접했는지 확인합니다.
     * @param {{x:number,y:number}} left - 첫 번째 좌표입니다.
     * @param {{x:number,y:number}} right - 두 번째 좌표입니다.
     * @returns {boolean} 맨해튼 거리가 1이면 true입니다.
     * @private
     */
    #isAdjacent(left, right) {
        if (!this.#isValidPosition(left) || !this.#isValidPosition(right)) {
            return false;
        }
        return Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1;
    }

    /**
     * 두 요소가 근접해 있고 공격 가능한 높이 차 안에 있는지 확인합니다.
     * @param {{x:number,y:number}} left - 행동 주체 좌표입니다.
     * @param {{x:number,y:number}} right - 상호작용 대상 좌표입니다.
     * @returns {boolean} 상하좌우 인접 및 허용 높이 차를 만족하면 true입니다.
     * @private
     */
    #isInteractionReachable(left, right) {
        if (!this.#isAdjacent(left, right)) {
            return false;
        }
        const leftHeight = this.getTileHeight(left.x, left.y);
        const rightHeight = this.getTileHeight(right.x, right.y);
        return leftHeight !== null
            && rightHeight !== null
            && Math.abs(leftHeight - rightHeight) <= this.#config.maxHeightStep;
    }

    /**
     * 좌표 객체가 현재 맵 안의 정수 좌표인지 확인합니다.
     * @param {unknown} position - 좌표 후보입니다.
     * @returns {boolean} 유효한 위치이면 true입니다.
     * @private
     */
    #isValidPosition(position) {
        return Boolean(
            position
            && typeof position === 'object'
            && this.isInside(position.x, position.y)
        );
    }

    /**
     * 요소가 지정한 좌표에 있는지 확인합니다.
     * @param {unknown} position - 요소 좌표 후보입니다.
     * @param {number} x - 비교할 X 좌표입니다.
     * @param {number} y - 비교할 Y 좌표입니다.
     * @returns {boolean} 좌표가 같으면 true입니다.
     * @private
     */
    #isSamePosition(position, x, y) {
        return Boolean(position && position.x === x && position.y === y);
    }

    /**
     * 지원하는 플레이어 행동인지 확인합니다.
     * @param {unknown} action - 행동 후보입니다.
     * @returns {boolean} 공격 또는 대화이면 true입니다.
     * @private
     */
    #isValidAction(action) {
        return action === ACTION_ATTACK || action === ACTION_TALK;
    }

    /**
     * 타일 좌표를 Map 키로 변환합니다.
     * @param {number} x - 타일 X 좌표입니다.
     * @param {number} y - 타일 Y 좌표입니다.
     * @returns {string} `x,y` 형태의 키입니다.
     * @private
     */
    #toTileKey(x, y) {
        return `${x},${y}`;
    }
}
