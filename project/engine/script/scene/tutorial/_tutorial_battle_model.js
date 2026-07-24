const PLAYER_ID = 'player';
const LORA_ID = 'lora';
const DEFAULT_STARTER_ITEM_ID = 'bandage';
const CHECKPOINT_KIND = 'TutorialBattleModelCheckpoint';
const CHECKPOINT_VERSION = 1;
const PASSIVE_ITEM_TYPES = new Set(['bow', 'diamond-pickaxe', 'speed-boots']);
const TRAP_TYPES = new Set(['slip', 'item-loss', 'slow']);
const DIRECTIONS = Object.freeze([
    Object.freeze({ x: 0, y: -1 }),
    Object.freeze({ x: 1, y: 0 }),
    Object.freeze({ x: 0, y: 1 }),
    Object.freeze({ x: -1, y: 0 })
]);

/**
 * 두 층 전투의 이동, 아이템, 상태 효과, 로라 행동과 엔딩을 결정적으로 관리합니다.
 */
export class TutorialBattleModel {
    #config;
    #random;
    #randomTape;
    #randomCursor;
    #configSignature;
    #knowledge;
    #loraTurnPerformed;

    /**
     * @param {object} config - `TUTORIAL_GAME_DATA` 형식의 전투 설정입니다.
     * @param {{random?:()=>number,knowledge?:object}} [options={}] - 난수 공급자와 영구 지식입니다.
     */
    constructor(config, options = {}) {
        this.#config = this.#normalizeConfig(config);
        this.#random = typeof options.random === 'function' ? options.random : Math.random;
        this.#randomTape = [];
        this.#randomCursor = 0;
        this.#configSignature = this.#createConfigSignature();
        this.#knowledge = this.#normalizeKnowledge(options.knowledge);
        this.#loraTurnPerformed = false;
        this.reset();
    }

    /**
     * 전투를 초기화하고 시작 아이템 하나를 지급합니다.
     * @param {{starterItemId?:string}} [options={}] - `bow` 또는 `bandage` 시작 선택입니다.
     * @returns {object} 초기 스냅샷입니다.
     */
    reset({ starterItemId = DEFAULT_STARTER_ITEM_ID } = {}) {
        if (!this.#config.starterChoiceIds.has(starterItemId)) {
            throw new RangeError(`TutorialBattleModel: 지원하지 않는 시작 아이템 ${starterItemId}입니다.`);
        }

        this.#randomTape = [];
        this.#randomCursor = 0;

        this.floorStates = this.#config.floors.map((floor, index) => ({
            index,
            id: floor.id,
            label: floor.label,
            width: this.#config.width,
            height: this.#config.height,
            playerStart: { ...floor.playerStart },
            loraStart: { ...floor.loraStart },
            gate: floor.gate ? { ...floor.gate } : null,
            heights: floor.heights.map((row) => [...row]),
            walls: floor.walls.map((wall) => ({ ...wall, destroyed: false })),
            items: floor.items.map((item) => ({ ...item, collected: false })),
            traps: floor.traps.map((trap) => ({ ...trap, triggered: false })),
            teleports: floor.teleports.map((teleport) => ({ ...teleport, used: false })),
            mobs: floor.mobs.map((mob) => ({
                ...mob,
                hp: mob.maxHp,
                maxHp: mob.maxHp,
                alive: true,
                dropped: false
            }))
        }));

        this.turn = 'player';
        this.phase = 'move-or-action';
        this.turnNumber = 1;
        this.round = 1;
        this.maxTurns = this.#config.maxTurns;
        this.maxRounds = this.maxTurns;
        this.floorIndex = 0;
        this.movementUsed = false;
        this.actionUsed = false;
        this.selectedAction = 'attack';

        const firstFloor = this.floorStates[0];
        this.player = {
            x: firstFloor.playerStart.x,
            y: firstFloor.playerStart.y,
            hp: this.#config.player.maxHp,
            maxHp: this.#config.player.maxHp,
            alive: true,
            defending: false,
            shieldLoraTurns: 0,
            mushroomActive: false,
            slowMoveTurns: 0
        };
        this.lora = {
            x: firstFloor.loraStart.x,
            y: firstFloor.loraStart.y,
            hp: this.#config.lora.maxHp,
            maxHp: this.#config.lora.maxHp,
            alive: true,
            instability: this.#config.lora.startInstability,
            maxInstability: this.#config.lora.maxInstability,
            defending: false,
            peaceTurns: 0,
            restrainedTurns: 0
        };

        this.gateOpen = false;
        this.inventory = new Map([[starterItemId, 1]]);
        this.usedItems = new Set();
        this.unlockedCutscenes = new Set(this.#knowledge.unlockedCutsceneIds);
        this.unlockedCutscenes.add('opening');
        this.#knowledge.unlockedCutsceneIds.add('opening');
        this.#knowledge.identifiedItemIds.add('bow');
        this.#knowledge.identifiedItemIds.add('bandage');
        this.lastPlayerAction = null;
        this.lastLoraAction = null;
        this.lastInteractionItemId = null;
        this.lastEvents = [this.#createEvent('cutscene-unlocked', { cutsceneId: 'opening' })];
        this.result = null;
        this.#loraTurnPerformed = false;
        return this.getSnapshot();
    }

    /**
     * 현재 층 좌표가 맵 내부인지 확인합니다.
     * @param {number} x - X 좌표입니다.
     * @param {number} y - Y 좌표입니다.
     * @returns {boolean} 내부 좌표이면 true입니다.
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
     * 현재 층의 런 상태를 방어 복제하여 반환합니다.
     * @returns {object} 현재 층 상태입니다.
     */
    getCurrentFloorState() {
        const floor = this.#getFloor();
        return {
            index: floor.index,
            id: floor.id,
            label: floor.label,
            width: floor.width,
            height: floor.height,
            playerStart: { ...floor.playerStart },
            loraStart: { ...floor.loraStart },
            gate: floor.gate ? { ...floor.gate } : null,
            heights: floor.heights.map((row) => [...row]),
            walls: floor.walls.map((wall) => ({ ...wall })),
            items: floor.items.map((item) => ({
                ...item,
                identified: this.#knowledge.identifiedItemIds.has(item.itemId),
                nearbyHint: item.hidden === true
                    && !this.#knowledge.identifiedItemIds.has(item.itemId)
                    && this.#distance(this.player, item) <= 2
            })),
            traps: floor.traps.map((trap) => ({
                ...trap,
                revealed: trap.triggered || this.#knowledge.revealedTrapIds.has(trap.id)
            })),
            teleports: floor.teleports.map((teleport) => ({ ...teleport })),
            mobs: floor.mobs.map((mob) => ({ ...mob }))
        };
    }

    /**
     * 현재 타일의 시각 높이를 반환합니다.
     * @param {number} x - X 좌표입니다.
     * @param {number} y - Y 좌표입니다.
     * @returns {number|null} 높이 또는 맵 밖일 때 null입니다.
     */
    getTileHeight(x, y) {
        return this.isInside(x, y) ? this.#getFloor().heights[y][x] : null;
    }

    /**
     * 현재 층의 지정 타일을 점유한 주요 요소를 반환합니다.
     * @param {number} x - X 좌표입니다.
     * @param {number} y - Y 좌표입니다.
     * @returns {object|null} 점유 요소입니다.
     */
    getOccupantAt(x, y) {
        if (!this.isInside(x, y)) {
            return null;
        }
        const floor = this.#getFloor();
        if (this.#isSamePosition(this.player, x, y)) {
            return { id: PLAYER_ID, type: 'player', x, y, alive: this.player.alive };
        }
        if (this.#isSamePosition(this.lora, x, y)) {
            return { id: LORA_ID, type: 'lora', x, y, alive: this.lora.alive };
        }
        const mob = floor.mobs.find((candidate) => candidate.alive && this.#isSamePosition(candidate, x, y));
        if (mob) {
            return { id: mob.id, type: 'mob', x, y, alive: true, hp: mob.hp };
        }
        const wall = floor.walls.find((candidate) => !candidate.destroyed && this.#isSamePosition(candidate, x, y));
        if (wall) {
            return { id: wall.id, type: 'wall', x, y, destroyed: false };
        }
        if (floor.gate && this.#isSamePosition(floor.gate, x, y)) {
            return { id: 'gate', type: 'gate', x, y, open: this.gateOpen };
        }
        const item = floor.items.find((candidate) => !candidate.collected && this.#isSamePosition(candidate, x, y));
        if (item) {
            return { id: item.id, itemId: item.itemId, type: 'item', x, y };
        }
        const teleport = floor.teleports.find((candidate) => !candidate.used && this.#isSamePosition(candidate, x, y));
        return teleport ? { id: teleport.id, type: 'teleport', x, y, used: false } : null;
    }

    /**
     * 현재 플레이어가 사용할 수 있는 이동 범위와 경로를 계산합니다.
     * @returns {Map<string,{x:number,y:number,cost:number,path:Array<{x:number,y:number}>,moveRange:number}>} 도달 가능 지도입니다.
     */
    getReachability() {
        const result = new Map();
        if (this.turn !== 'player' || this.movementUsed || this.result) {
            return result;
        }

        const moveRange = this.#getMoveRange();
        const startsWithPickaxe = this.#hasItem('diamond-pickaxe');
        const queue = [{
            x: this.player.x,
            y: this.player.y,
            cost: 0,
            path: [{ x: this.player.x, y: this.player.y }],
            hasPickaxe: startsWithPickaxe
        }];
        const visited = new Map([[`${this.player.x},${this.player.y},${startsWithPickaxe ? 1 : 0}`, 0]]);

        for (let queueIndex = 0; queueIndex < queue.length; queueIndex++) {
            const current = queue[queueIndex];
            const tileKey = this.#toTileKey(current.x, current.y);
            const known = result.get(tileKey);
            if (!known || current.cost < known.cost) {
                result.set(tileKey, {
                    x: current.x,
                    y: current.y,
                    cost: current.cost,
                    path: current.path.map((point) => ({ ...point })),
                    moveRange
                });
            }
            if (current.cost >= moveRange || (current.cost > 0 && this.#stopsPlannedMovement(current.x, current.y))) {
                continue;
            }

            for (const direction of DIRECTIONS) {
                const x = current.x + direction.x;
                const y = current.y + direction.y;
                if (!this.isInside(x, y) || current.path.some((point) => point.x === x && point.y === y)) {
                    continue;
                }
                const blocker = this.#getMovementBlocker(x, y);
                if (blocker?.type === 'lora' || blocker?.type === 'mob') {
                    continue;
                }
                if (blocker?.type === 'wall' && !current.hasPickaxe) {
                    continue;
                }
                const floorItem = this.#findItemAt(x, y);
                const hasPickaxe = current.hasPickaxe || floorItem?.itemId === 'diamond-pickaxe';
                const cost = current.cost + 1;
                const stateKey = `${x},${y},${hasPickaxe ? 1 : 0}`;
                if ((visited.get(stateKey) ?? Number.POSITIVE_INFINITY) <= cost) {
                    continue;
                }
                visited.set(stateKey, cost);
                queue.push({
                    x,
                    y,
                    cost,
                    hasPickaxe,
                    path: [...current.path, { x, y }]
                });
            }
        }
        return result;
    }

    /**
     * 현재 위치에서 목적지까지의 도달 가능한 경로를 반환합니다.
     * @param {number} x - 목적지 X 좌표입니다.
     * @param {number} y - 목적지 Y 좌표입니다.
     * @returns {Array<{x:number,y:number}>|null} 경로 또는 null입니다.
     */
    getPathTo(x, y) {
        if (!this.isInside(x, y)) {
            return null;
        }
        const entry = this.getReachability().get(this.#toTileKey(x, y));
        return entry ? entry.path.map((point) => ({ ...point })) : null;
    }

    /**
     * 계산된 최단 경로로 이동합니다.
     * @param {number} x - 목적지 X 좌표입니다.
     * @param {number} y - 목적지 Y 좌표입니다.
     * @returns {object} 이동 결과입니다.
     */
    commitMove(x, y) {
        const path = this.getPathTo(x, y);
        return path ? this.commitPath(path) : this.#moveFailure('unreachable-destination');
    }

    /**
     * 명시 경로를 검증한 뒤 각 칸의 획득, 함정, 텔레포트와 벽 파괴를 순서대로 처리합니다.
     * @param {Array<{x:number,y:number}>} path - 시작점을 포함한 경로입니다.
     * @returns {object} 실제 이동 경로와 이벤트가 포함된 결과입니다.
     */
    commitPath(path) {
        if (this.turn !== 'player' || this.movementUsed || this.result) {
            return this.#moveFailure('movement-unavailable');
        }
        if (!Array.isArray(path) || path.length === 0) {
            return this.#moveFailure('invalid-path');
        }

        const normalizedPath = [];
        const visited = new Set();
        for (const point of path) {
            if (!point || !this.isInside(point.x, point.y)) {
                return this.#moveFailure('invalid-path');
            }
            const key = this.#toTileKey(point.x, point.y);
            if (visited.has(key)) {
                return this.#moveFailure('path-tile-revisited');
            }
            visited.add(key);
            normalizedPath.push({ x: point.x, y: point.y });
        }
        if (!this.#isSamePosition(normalizedPath[0], this.player.x, this.player.y)) {
            return this.#moveFailure('path-start-mismatch');
        }

        const moveRange = this.#getMoveRange();
        let hasPickaxe = this.#hasItem('diamond-pickaxe');
        let lastIndex = normalizedPath.length - 1;
        let interrupted = false;
        for (let index = 1; index < normalizedPath.length; index++) {
            const previous = normalizedPath[index - 1];
            const point = normalizedPath[index];
            if (this.#distance(previous, point) !== 1) {
                return this.#moveFailure('invalid-path-step');
            }
            if (index > moveRange) {
                return this.#moveFailure('path-cost-exceeded');
            }
            const blocker = this.#getMovementBlocker(point.x, point.y);
            if (blocker?.type === 'lora' || blocker?.type === 'mob') {
                return this.#moveFailure(`blocked-by-${blocker.type}`);
            }
            if (blocker?.type === 'wall' && !hasPickaxe) {
                return this.#moveFailure('blocked-by-wall');
            }
            const item = this.#findItemAt(point.x, point.y);
            hasPickaxe ||= item?.itemId === 'diamond-pickaxe';
            if (this.#stopsPlannedMovement(point.x, point.y)) {
                lastIndex = index;
                interrupted = index < normalizedPath.length - 1;
                break;
            }
        }

        const events = [];
        const actualPath = [{ x: this.player.x, y: this.player.y }];
        if (this.player.slowMoveTurns > 0) {
            this.player.slowMoveTurns -= 1;
        }
        for (let index = 1; index <= lastIndex; index++) {
            const point = normalizedPath[index];
            const wall = this.#findWallAt(point.x, point.y);
            if (wall && !wall.destroyed) {
                wall.destroyed = true;
                events.push(this.#createEvent('wall-destroyed', { wallId: wall.id, x: wall.x, y: wall.y }));
            }
            this.player.x = point.x;
            this.player.y = point.y;
            actualPath.push({ ...point });
            events.push(this.#createEvent('movement-step', { x: point.x, y: point.y, step: index }));
            const entry = this.#processTileEntry(events);
            if (entry.teleportedTo) {
                actualPath.push({ ...entry.teleportedTo });
            }
            if (entry.interrupted) {
                interrupted = true;
                break;
            }
        }
        this.movementUsed = true;
        this.#advancePlayerFlow(events);
        this.#setLastEvents(events);
        return {
            ok: true,
            action: 'move',
            path: actualPath,
            cost: Math.max(0, actualPath.length - 1 - (events.some((event) => event.type === 'teleported') ? 1 : 0)),
            moveRange,
            interrupted,
            events: this.#copyEvents(events)
        };
    }

    /**
     * 표시용 행동 선택을 저장합니다. 실제 자원은 행동 메서드가 성공할 때만 소모합니다.
     * @param {'attack'|'defend'|'wait'|'use-item'|'escape'} action - 행동 ID입니다.
     * @returns {boolean} 지원하는 행동이면 true입니다.
     */
    selectAction(action) {
        if (this.turn !== 'player' || !['attack', 'defend', 'wait', 'use-item', 'escape'].includes(action)) {
            return false;
        }
        this.selectedAction = action;
        return true;
    }

    /**
     * 현재 공격 가능한 로라와 몹을 반환합니다.
     * @returns {Array<{id:string,type:'lora'|'mob',x:number,y:number,distance:number,weapon:'melee'|'bow'}>} 대상 목록입니다.
     */
    getValidTargets() {
        if (!this.#canUseAction() || this.lora.peaceTurns > 0) {
            return [];
        }
        const candidates = [];
        if (this.lora.alive) {
            candidates.push({ id: LORA_ID, type: 'lora', x: this.lora.x, y: this.lora.y });
        }
        for (const mob of this.#getFloor().mobs) {
            if (mob.alive) {
                candidates.push({ id: mob.id, type: 'mob', x: mob.x, y: mob.y });
            }
        }
        const hasBow = this.#hasItem('bow');
        return candidates.flatMap((target) => {
            const distance = this.#distance(this.player, target);
            if (distance <= this.#config.player.attackRange) {
                return [{ ...target, distance, weapon: 'melee' }];
            }
            return hasBow ? [{ ...target, distance, weapon: 'bow' }] : [];
        });
    }

    /**
     * 로라 또는 몹 하나를 공격합니다.
     * @param {string} [targetId=LORA_ID] - 대상 ID입니다.
     * @param {{weapon?:'melee'|'bow'}} [options={}] - 가까운 대상에게 활을 강제할 수 있습니다.
     * @returns {object} 공격 결과입니다.
     */
    attack(targetId = LORA_ID, options = {}) {
        if (!this.#canUseAction()) {
            return this.#actionFailure('attack', 'action-unavailable');
        }
        if (this.lora.peaceTurns > 0) {
            return this.#actionFailure('attack', 'peace-active');
        }
        const target = this.getValidTargets().find((candidate) => candidate.id === targetId);
        if (!target) {
            return this.#actionFailure('attack', 'invalid-target');
        }

        let weapon = target.weapon;
        if (options.weapon === 'bow' && this.#hasItem('bow')) {
            weapon = 'bow';
        }
        let damage = weapon === 'bow'
            ? this.#config.items.bow.effect.rangedDamage
            : this.#config.player.attackDamage;
        if (this.#hasItem('old-teddy')) {
            damage *= this.#config.items['old-teddy'].effect.playerDamageMultiplier;
        }
        if (this.player.mushroomActive) {
            damage *= this.#config.items.mushroom.effect.nextAttackMultiplier;
        }
        if (target.type === 'lora' && this.lora.defending) {
            damage *= 1 - this.#config.lora.defendReduction;
        }
        damage = Math.max(0, Math.round(damage));

        const events = [];
        let appliedDamage = 0;
        let defeated = false;
        let instabilityChange = 0;
        if (target.type === 'lora') {
            appliedDamage = Math.min(this.lora.hp, damage);
            this.lora.hp = Math.max(0, this.lora.hp - damage);
            this.lora.alive = this.lora.hp > 0;
            this.lora.defending = false;
            const consecutive = this.lastPlayerAction?.type === 'attack'
                && this.lastPlayerAction?.targetId === LORA_ID;
            instabilityChange = this.#changeInstability(
                this.#config.player.attackInstability
                    + (consecutive ? this.#config.player.consecutiveAttackInstability : 0),
                'player-attack',
                events
            );
            defeated = !this.lora.alive;
            events.push(this.#createEvent('lora-damaged', {
                damage: appliedDamage,
                hp: this.lora.hp,
                weapon
            }));
            if (defeated && !this.gateOpen) {
                this.gateOpen = true;
                events.push(this.#createEvent('gate-opened', { gateOpen: true }));
            }
        } else {
            const mob = this.#getFloor().mobs.find((candidate) => candidate.id === target.id);
            const mobResult = this.#damageMob(mob, damage, 'player-attack', events);
            appliedDamage = mobResult.damage;
            defeated = mobResult.defeated;
        }

        this.player.mushroomActive = false;
        this.lastPlayerAction = { type: 'attack', targetId, targetType: target.type, weapon, turn: this.turnNumber };
        this.actionUsed = true;
        this.#advancePlayerFlow(events);
        this.#setLastEvents(events);
        return {
            ok: true,
            action: 'attack',
            targetId,
            targetType: target.type,
            weapon,
            damage: appliedDamage,
            defeated,
            instabilityChange,
            events: this.#copyEvents(events)
        };
    }

    /**
     * 다음 로라 공격에 대한 피해 감소를 준비합니다.
     * @returns {object} 방어 결과입니다.
     */
    defend() {
        if (!this.#canUseAction()) {
            return this.#actionFailure('defend', 'action-unavailable');
        }
        const events = [this.#createEvent('player-defended', {
            reduction: this.#config.player.defendReduction
        })];
        this.player.defending = true;
        this.lastPlayerAction = { type: 'defend', turn: this.turnNumber };
        this.actionUsed = true;
        this.#advancePlayerFlow(events);
        this.#setLastEvents(events);
        return { ok: true, action: 'defend', reduction: this.#config.player.defendReduction, events: this.#copyEvents(events) };
    }

    /**
     * 주요 행동을 대기로 소비합니다. 사용하지 않은 이동은 이어서 할 수 있습니다.
     * @returns {object} 대기 결과입니다.
     */
    wait() {
        if (!this.#canUseAction()) {
            return this.#actionFailure('wait', 'action-unavailable');
        }
        const events = [this.#createEvent('player-waited')];
        this.lastPlayerAction = { type: 'wait', turn: this.turnNumber };
        this.actionUsed = true;
        this.#advancePlayerFlow(events);
        this.#setLastEvents(events);
        return { ok: true, action: 'wait', events: this.#copyEvents(events) };
    }

    /**
     * 보유 아이템을 사용하고 해당 효과를 적용합니다.
     * @param {string} itemId - 아이템 ID입니다.
     * @returns {object} 사용 결과입니다.
     */
    useItem(itemId) {
        if (!this.#canUseAction()) {
            return this.#actionFailure('use-item', 'action-unavailable', { itemId });
        }
        const item = this.#config.items[itemId];
        if (!item || !this.#hasItem(itemId)) {
            return this.#actionFailure('use-item', 'item-not-owned', { itemId });
        }
        if (PASSIVE_ITEM_TYPES.has(item.effect.type)) {
            return this.#actionFailure('use-item', 'passive-item', { itemId });
        }
        if (item.useOnce && this.usedItems.has(itemId)) {
            return this.#actionFailure('use-item', 'item-already-used', { itemId });
        }

        const events = [];
        const effects = [];
        const effect = item.effect;
        switch (effect.type) {
        case 'bandage': {
            const playerHeal = this.#healPlayer(effect.playerHeal, 'bandage', events);
            const loraHeal = this.#healLora(effect.loraHeal, 'bandage', events);
            const instabilityChange = this.#applyStabilization(effect.instabilityReduction, 'bandage', events);
            effects.push({ type: 'healing', playerHeal, loraHeal, instabilityChange });
            break;
        }
        case 'old-teddy': {
            const instabilityChange = this.#applyStabilization(effect.instabilityReduction, 'old-teddy', events);
            this.#unlockCutscene('teddy', events);
            effects.push({ type: 'stabilize', instabilityChange });
            break;
        }
        case 'music-box': {
            this.lora.peaceTurns = Math.max(this.lora.peaceTurns, effect.durationLoraTurns);
            events.push(this.#createEvent('peace', { active: true, remainingTurns: this.lora.peaceTurns }));
            effects.push({ type: 'peace', durationLoraTurns: this.lora.peaceTurns });
            break;
        }
        case 'eyeliner': {
            let amount = effect.instabilityReduction;
            const synergy = this.lastInteractionItemId === 'mirror';
            if (synergy) {
                amount += effect.afterMirrorBonusReduction;
                this.#unlockCutscene('item-synergy', events);
            }
            const instabilityChange = this.#applyStabilization(amount, 'eyeliner', events);
            this.lastInteractionItemId = 'eyeliner';
            effects.push({ type: 'stabilize', instabilityChange, synergy });
            break;
        }
        case 'mirror': {
            const synergy = this.lastInteractionItemId === 'eyeliner';
            if (synergy) {
                const instabilityChange = this.#changeInstability(
                    effect.afterEyelinerInstabilityIncrease,
                    'mirror-after-eyeliner',
                    events
                );
                effects.push({ type: 'instability-surge', instabilityChange, synergy: true });
                this.#unlockCutscene('item-synergy', events);
            }
            this.lora.restrainedTurns += effect.restrainedLoraTurns;
            events.push(this.#createEvent('lora-restrained', { remainingTurns: this.lora.restrainedTurns }));
            this.lastInteractionItemId = 'mirror';
            effects.push({ type: 'restraint', loraTurns: effect.restrainedLoraTurns });
            break;
        }
        case 'glitch-item': {
            for (const mob of this.#getFloor().mobs) {
                if (mob.alive) {
                    this.#damageMob(mob, effect.mobDamage, 'glitch-item', events);
                }
            }
            const instabilityChange = this.#applyStabilization(effect.instabilityReduction, 'glitch-item', events);
            effects.push({ type: 'glitch-pulse', instabilityChange, mobDamage: effect.mobDamage });
            break;
        }
        case 'mushroom': {
            this.player.mushroomActive = true;
            effects.push({ type: 'mushroom', moveRange: effect.moveRange, attackMultiplier: effect.nextAttackMultiplier });
            break;
        }
        case 'shield-core': {
            this.player.shieldLoraTurns = Math.max(this.player.shieldLoraTurns, effect.loraTurns);
            effects.push({ type: 'shield', reduction: effect.damageReduction, loraTurns: this.player.shieldLoraTurns });
            break;
        }
        case 'memory-photo': {
            const instabilityChange = this.#applyStabilization(effect.instabilityReduction, 'memory-photo', events);
            this.#unlockCutscene('extra-interaction', events);
            effects.push({ type: 'stabilize', instabilityChange });
            break;
        }
        default:
            return this.#actionFailure('use-item', 'unsupported-item-effect', { itemId });
        }

        this.usedItems.add(itemId);
        this.#knowledge.discoveredItemIds.add(itemId);
        this.#knowledge.identifiedItemIds.add(itemId);
        if (item.consumable) {
            this.#removeInventory(itemId, 1);
        }
        events.unshift(this.#createEvent('item-used', { itemId, label: item.label }));
        this.lastPlayerAction = { type: 'use-item', itemId, turn: this.turnNumber };
        this.actionUsed = true;
        this.#advancePlayerFlow(events);
        this.#setLastEvents(events);
        return { ok: true, action: 'use-item', itemId, effects, events: this.#copyEvents(events) };
    }

    /**
     * 남은 이동과 행동을 포기하고 로라 턴으로 넘깁니다.
     * @returns {object} 턴 종료 결과입니다.
     */
    endPlayerTurn() {
        if (this.turn !== 'player' || this.result) {
            return this.#actionFailure('end-player-turn', 'not-player-turn');
        }
        const events = [this.#createEvent('player-turn-ended', {
            movementForfeited: !this.movementUsed,
            actionForfeited: !this.actionUsed
        })];
        if (!this.actionUsed) {
            this.lastPlayerAction = { type: 'end-player-turn', turn: this.turnNumber };
        }
        this.movementUsed = true;
        this.actionUsed = true;
        this.#beginLoraTurn();
        this.#setLastEvents(events);
        return { ok: true, action: 'end-player-turn', events: this.#copyEvents(events) };
    }

    /**
     * 기존 호출부를 위한 플레이어 턴 종료 별칭입니다.
     * @returns {object} 턴 종료 결과입니다.
     */
    endTurn() {
        return this.endPlayerTurn();
    }

    /**
     * 현재 불안정도에 해당하는 로라 상태를 반환합니다.
     * @param {number} [value=this.lora.instability] - 판정할 수치입니다.
     * @returns {object} 상태와 피해 수치입니다.
     */
    getInstabilityState(value = this.lora.instability) {
        const normalized = this.#clamp(
            Number.isFinite(value) ? value : this.lora.instability,
            0,
            this.#config.lora.maxInstability
        );
        const state = this.#config.lora.instabilityStates.find((candidate) => (
            normalized >= candidate.min && normalized <= candidate.max
        ));
        return this.#cloneCheckpointValue(state);
    }

    /**
     * 현재 상태에 따라 로라의 방어, 구속, 평화 또는 공격을 한 번 수행합니다.
     * @returns {object} 로라 행동 결과입니다.
     */
    performLoraTurn() {
        if (this.turn !== 'lora' || this.phase !== 'lora') {
            return this.#actionFailure('none', 'not-lora-turn');
        }
        if (this.#loraTurnPerformed) {
            return this.#actionFailure('none', 'lora-turn-already-performed');
        }
        this.#loraTurnPerformed = true;
        const events = [];

        if (!this.lora.alive) {
            this.lastLoraAction = { type: 'skip', turn: this.turnNumber };
            const result = { ok: true, action: 'skip', reason: 'lora-neutralized', damage: 0, events: [] };
            this.#setLastEvents(events);
            return result;
        }
        if (this.lora.peaceTurns > 0) {
            const reduction = this.#config.items['music-box'].effect.instabilityReductionPerTurn;
            const instabilityChange = this.#applyStabilization(reduction, 'music-box', events);
            events.push(this.#createEvent('peace', { active: true, remainingTurns: this.lora.peaceTurns }));
            this.lastLoraAction = { type: 'peace', turn: this.turnNumber };
            this.#setLastEvents(events);
            return { ok: true, action: 'peace', damage: 0, instabilityChange, events: this.#copyEvents(events) };
        }
        if (this.lora.restrainedTurns > 0) {
            this.lora.restrainedTurns -= 1;
            events.push(this.#createEvent('lora-restrained', { remainingTurns: this.lora.restrainedTurns }));
            this.lastLoraAction = { type: 'restrained', turn: this.turnNumber };
            this.#setLastEvents(events);
            return { ok: true, action: 'restrained', damage: 0, events: this.#copyEvents(events) };
        }

        this.lora.defending = false;
        const shouldDefend = this.lastPlayerAction?.type === 'attack'
            && this.lastPlayerAction?.targetId === LORA_ID
            && this.lastLoraAction?.type !== 'defend';
        if (shouldDefend) {
            this.lora.defending = true;
            this.lastLoraAction = { type: 'defend', turn: this.turnNumber };
            events.push(this.#createEvent('lora-defended', { reduction: this.#config.lora.defendReduction }));
            this.#setLastEvents(events);
            return {
                ok: true,
                action: 'defend',
                damage: 0,
                reduction: this.#config.lora.defendReduction,
                events: this.#copyEvents(events)
            };
        }

        const state = this.getInstabilityState();
        const adjacent = this.#distance(this.lora, this.player) <= this.#config.lora.meleeRange;
        const action = adjacent ? 'melee' : 'area';
        let baseDamage = adjacent ? state.meleeDamage : state.areaDamage;
        if (baseDamage > 0 && this.#hasItem('bow')) {
            baseDamage += this.#config.bowLoraDamageBonus;
        }
        if (baseDamage <= 0) {
            this.lastLoraAction = { type: 'idle', turn: this.turnNumber };
            events.push(this.#createEvent('lora-attack', { action: 'idle', damage: 0, stateId: state.id }));
            this.#setLastEvents(events);
            return { ok: true, action: 'idle', damage: 0, state, events: this.#copyEvents(events) };
        }

        const playerDamage = this.#damagePlayer(baseDamage, action, events);
        const mobDamages = [];
        if (action === 'area') {
            for (const mob of this.#getFloor().mobs) {
                if (mob.alive) {
                    const mobResult = this.#damageMob(mob, baseDamage, 'lora-area', events);
                    mobDamages.push({ mobId: mob.id, ...mobResult });
                }
            }
        }
        this.lastLoraAction = { type: action, turn: this.turnNumber, stateId: state.id };
        events.unshift(this.#createEvent('lora-attack', {
            action,
            damage: playerDamage,
            stateId: state.id,
            mobDamages
        }));
        if (!this.player.alive) {
            this.#finishBattle('failure', 'player-defeated', events);
        }
        this.#setLastEvents(events);
        return {
            ok: true,
            action,
            damage: playerDamage,
            state,
            mobDamages,
            defeated: !this.player.alive,
            result: this.#copyResult(),
            events: this.#copyEvents(events)
        };
    }

    /**
     * 로라 턴을 완료하고 층 전환, 턴 제한 또는 다음 플레이어 턴을 처리합니다.
     * @returns {object} 전환 결과입니다.
     */
    completeLoraTurn() {
        if (this.turn !== 'lora' || this.phase !== 'lora') {
            return this.#actionFailure('complete-lora-turn', 'not-lora-turn');
        }
        let events = [];
        if (!this.#loraTurnPerformed) {
            const performed = this.performLoraTurn();
            events = performed.events ? this.#copyEvents(performed.events) : [];
        }
        if (this.result) {
            return { ok: true, action: 'complete-lora-turn', result: this.#copyResult(), events };
        }

        this.player.defending = false;
        if (this.player.shieldLoraTurns > 0) {
            this.player.shieldLoraTurns -= 1;
        }
        if (this.lora.peaceTurns > 0) {
            this.lora.peaceTurns -= 1;
        }

        let floorTransitioned = false;
        if (this.turnNumber === this.#config.floorTransitionAfterTurn && this.floorIndex === 0) {
            floorTransitioned = this.#transitionToFloor(1, events);
        }
        if (this.turnNumber >= this.maxTurns) {
            this.#finishBattle(
                'failure',
                this.lora.alive ? 'turn-limit' : 'escape-failed',
                events
            );
            this.#setLastEvents(events);
            return {
                ok: true,
                action: 'complete-lora-turn',
                floorTransitioned,
                result: this.#copyResult(),
                events: this.#copyEvents(events)
            };
        }

        this.turnNumber += 1;
        this.round = this.turnNumber;
        this.turn = 'player';
        this.phase = 'move-or-action';
        this.movementUsed = false;
        this.actionUsed = false;
        this.selectedAction = 'attack';
        this.#loraTurnPerformed = false;
        if (this.#hasItem('bow') && this.lora.alive) {
            this.#changeInstability(this.#config.bowInstabilityPerTurn, 'bow-passive', events);
        }
        this.#setLastEvents(events);
        return {
            ok: true,
            action: 'complete-lora-turn',
            floorTransitioned,
            turnNumber: this.turnNumber,
            events: this.#copyEvents(events)
        };
    }

    /**
     * 현재 플레이어가 지하 게이트에서 탈출할 수 있는지 확인합니다.
     * @returns {boolean} 탈출 가능 여부입니다.
     */
    canEscape() {
        const gate = this.#getFloor().gate;
        return this.#canUseAction()
            && Boolean(gate)
            && this.gateOpen
            && !this.lora.alive
            && this.#isSamePosition(this.player, gate.x, gate.y);
    }

    /**
     * 열린 지하 게이트에서 별도 주요 행동으로 탈출합니다.
     * @returns {object} 탈출과 엔딩 결과입니다.
     */
    escape() {
        if (!this.canEscape()) {
            return this.#actionFailure('escape', 'escape-conditions-not-met');
        }
        const events = [];
        this.actionUsed = true;
        this.lastPlayerAction = { type: 'escape', turn: this.turnNumber };
        this.#finishBattle('success', 'escaped', events);
        this.#setLastEvents(events);
        return { ok: true, action: 'escape', result: this.#copyResult(), events: this.#copyEvents(events) };
    }

    /**
     * 현재 런의 모든 가변 상태를 되돌리기 가능한 체크포인트로 방어 복제합니다.
     * 난수 테이프는 체크포인트 생성 뒤 기록된 값도 같은 모델 안에서 재생할 수 있도록
     * 복원 시 커서를 되감는 기준으로 사용합니다.
     * @returns {object} 모델 설정과 호환되는 독립 체크포인트입니다.
     */
    createCheckpoint() {
        return {
            kind: CHECKPOINT_KIND,
            version: CHECKPOINT_VERSION,
            configSignature: this.#configSignature,
            state: {
                floorStates: this.#cloneCheckpointValue(this.floorStates),
                turn: this.turn,
                phase: this.phase,
                turnNumber: this.turnNumber,
                round: this.round,
                maxTurns: this.maxTurns,
                maxRounds: this.maxRounds,
                floorIndex: this.floorIndex,
                movementUsed: this.movementUsed,
                actionUsed: this.actionUsed,
                selectedAction: this.selectedAction,
                player: this.#cloneCheckpointValue(this.player),
                lora: this.#cloneCheckpointValue(this.lora),
                gateOpen: this.gateOpen,
                inventory: new Map(this.inventory),
                usedItems: new Set(this.usedItems),
                unlockedCutscenes: new Set(this.unlockedCutscenes),
                lastPlayerAction: this.#cloneCheckpointValue(this.lastPlayerAction),
                lastLoraAction: this.#cloneCheckpointValue(this.lastLoraAction),
                lastInteractionItemId: this.lastInteractionItemId,
                lastEvents: this.#cloneCheckpointValue(this.lastEvents),
                result: this.#cloneCheckpointValue(this.result),
                loraTurnPerformed: this.#loraTurnPerformed,
                knowledge: {
                    discoveredItemIds: new Set(this.#knowledge.discoveredItemIds),
                    identifiedItemIds: new Set(this.#knowledge.identifiedItemIds),
                    revealedTrapIds: new Set(this.#knowledge.revealedTrapIds),
                    unlockedCutsceneIds: new Set(this.#knowledge.unlockedCutsceneIds)
                },
                randomReplay: {
                    tape: [...this.#randomTape],
                    cursor: this.#randomCursor
                }
            }
        };
    }

    /**
     * 호환되는 체크포인트를 방어 복제하여 현재 런 상태를 완전히 복원합니다.
     * @param {object} checkpoint - `createCheckpoint()`가 반환한 체크포인트입니다.
     * @returns {object} 복원 직후의 표시용 스냅샷입니다.
     * @throws {TypeError} 체크포인트의 형식이나 상태 불변식이 올바르지 않을 때 발생합니다.
     */
    restoreCheckpoint(checkpoint) {
        const state = this.#normalizeCheckpoint(checkpoint);
        const replayTape = this.#mergeRandomReplayTape(state.randomReplay.tape);

        this.floorStates = state.floorStates;
        this.turn = state.turn;
        this.phase = state.phase;
        this.turnNumber = state.turnNumber;
        this.round = state.round;
        this.maxTurns = state.maxTurns;
        this.maxRounds = state.maxRounds;
        this.floorIndex = state.floorIndex;
        this.movementUsed = state.movementUsed;
        this.actionUsed = state.actionUsed;
        this.selectedAction = state.selectedAction;
        this.player = state.player;
        this.lora = state.lora;
        this.gateOpen = state.gateOpen;
        this.inventory = state.inventory;
        this.usedItems = state.usedItems;
        this.unlockedCutscenes = state.unlockedCutscenes;
        this.lastPlayerAction = state.lastPlayerAction;
        this.lastLoraAction = state.lastLoraAction;
        this.lastInteractionItemId = state.lastInteractionItemId;
        this.lastEvents = state.lastEvents;
        this.result = state.result;
        this.#loraTurnPerformed = state.loraTurnPerformed;
        this.#knowledge = state.knowledge;
        this.#randomTape = replayTape;
        this.#randomCursor = state.randomReplay.cursor;

        return this.getSnapshot();
    }

    /**
     * 외부 표시와 테스트에 사용할 전체 전투 스냅샷을 반환합니다.
     * @returns {object} 방어 복제된 스냅샷입니다.
     */
    getSnapshot() {
        return this.#cloneCheckpointValue({
            turn: this.turn,
            phase: this.phase,
            turnNumber: this.turnNumber,
            maxTurns: this.maxTurns,
            floorIndex: this.floorIndex,
            movementUsed: this.movementUsed,
            actionUsed: this.actionUsed,
            player: this.player,
            lora: this.lora,
            gateOpen: this.gateOpen,
            inventory: [...this.inventory.entries()].map(([itemId, count]) => ({ itemId, count })),
            floor: this.getCurrentFloorState(),
            lastPlayerAction: this.lastPlayerAction,
            lastLoraAction: this.lastLoraAction,
            usedItems: [...this.usedItems],
            unlockedCutscenes: [...this.unlockedCutscenes],
            knowledge: {
                discoveredItemIds: [...this.#knowledge.discoveredItemIds],
                identifiedItemIds: [...this.#knowledge.identifiedItemIds],
                revealedTrapIds: [...this.#knowledge.revealedTrapIds],
                unlockedCutsceneIds: [...this.#knowledge.unlockedCutsceneIds]
            },
            result: this.result,
            lastEvents: this.lastEvents
        });
    }

    /** 현재 층 내부 상태를 반환합니다. @private */
    #getFloor() {
        return this.floorStates[this.floorIndex];
    }

    /** 플레이어가 주요 행동을 사용할 수 있는지 확인합니다. @private */
    #canUseAction() {
        return this.turn === 'player' && !this.actionUsed && !this.result && this.player.alive;
    }

    /** 이동 또는 행동 사용 뒤 플레이어 단계와 로라 턴 진입을 갱신합니다. @private */
    #advancePlayerFlow(events) {
        if (this.movementUsed && this.actionUsed) {
            this.#beginLoraTurn();
            events.push(this.#createEvent('player-turn-complete'));
            return;
        }
        this.phase = this.movementUsed ? 'action' : this.actionUsed ? 'move' : 'move-or-action';
    }

    /** 로라 턴을 시작합니다. @private */
    #beginLoraTurn() {
        this.turn = 'lora';
        this.phase = 'lora';
        this.#loraTurnPerformed = false;
    }

    /** 현재 이동 가능 칸 수를 계산합니다. @private */
    #getMoveRange() {
        if (this.player.mushroomActive) {
            return this.#config.items.mushroom.effect.moveRange;
        }
        let range = this.#config.player.moveRange;
        if (this.#hasItem('speed-boots')) {
            range += this.#config.items['speed-boots'].effect.moveRangeBonus;
        }
        if (this.player.slowMoveTurns > 0) {
            range -= this.#config.slowTrapMovePenalty;
        }
        return Math.max(1, range);
    }

    /** 타일 진입 효과를 처리합니다. @private */
    #processTileEntry(events, { allowTeleport = true } = {}) {
        const item = this.#findItemAt(this.player.x, this.player.y);
        if (item) {
            this.#pickupFloorItem(item, events);
        }

        const trap = this.#findTrapAt(this.player.x, this.player.y);
        if (trap && !trap.triggered) {
            trap.triggered = true;
            this.#knowledge.revealedTrapIds.add(trap.id);
            const trapEvent = this.#createEvent('trap-triggered', {
                trapId: trap.id,
                trapType: trap.type,
                x: trap.x,
                y: trap.y
            });
            events.push(trapEvent);
            if (trap.type === 'item-loss') {
                this.#loseRandomItem(events, trap.id);
            } else if (trap.type === 'slow') {
                this.player.slowMoveTurns = Math.max(this.player.slowMoveTurns, 1);
            } else if (trap.type === 'slip') {
                return { interrupted: true, teleportedTo: null };
            }
        }

        if (allowTeleport) {
            const teleport = this.#findTeleportAt(this.player.x, this.player.y);
            if (teleport && !teleport.used) {
                teleport.used = true;
                const destination = this.#chooseTeleportDestination(teleport);
                if (destination) {
                    const from = { x: this.player.x, y: this.player.y };
                    this.player.x = destination.x;
                    this.player.y = destination.y;
                    events.push(this.#createEvent('teleported', {
                        teleportId: teleport.id,
                        from,
                        to: { ...destination }
                    }));
                    const landing = this.#processTileEntry(events, { allowTeleport: false });
                    return { interrupted: true, teleportedTo: { ...destination }, landing };
                }
            }
        }
        return { interrupted: false, teleportedTo: null };
    }

    /** 바닥 아이템을 자동 획득합니다. @private */
    #pickupFloorItem(item, events) {
        item.collected = true;
        this.#addInventory(item.itemId, 1);
        this.#knowledge.discoveredItemIds.add(item.itemId);
        const spec = this.#config.items[item.itemId];
        if (PASSIVE_ITEM_TYPES.has(spec?.effect?.type)) {
            this.#knowledge.identifiedItemIds.add(item.itemId);
        }
        events.push(this.#createEvent('item-picked', {
            instanceId: item.id,
            itemId: item.itemId,
            label: spec?.label ?? item.itemId,
            x: item.x,
            y: item.y
        }));
    }

    /** 텔레포트가 이동시킬 유효 타일을 난수 공급자로 선택합니다. @private */
    #chooseTeleportDestination(source) {
        const floor = this.#getFloor();
        const candidates = [];
        for (let y = 0; y < this.#config.height; y++) {
            for (let x = 0; x < this.#config.width; x++) {
                if ((x === source.x && y === source.y) || this.#getMovementBlocker(x, y)) {
                    continue;
                }
                const activeTeleport = floor.teleports.some((teleport) => (
                    !teleport.used && teleport.x === x && teleport.y === y
                ));
                if (!activeTeleport) {
                    candidates.push({ x, y });
                }
            }
        }
        if (candidates.length === 0) {
            return null;
        }
        const randomValue = this.#nextRandomValue();
        const normalized = Number.isFinite(randomValue) ? this.#clamp(randomValue, 0, 0.999999999) : 0;
        return candidates[Math.floor(normalized * candidates.length)];
    }

    /** 이동을 즉시 중단시키는 타일인지 확인합니다. @private */
    #stopsPlannedMovement(x, y) {
        const trap = this.#findTrapAt(x, y);
        return Boolean((trap && !trap.triggered && trap.type === 'slip') || this.#findTeleportAt(x, y));
    }

    /** 이동을 막는 로라, 몹 또는 벽을 반환합니다. @private */
    #getMovementBlocker(x, y) {
        if (this.#isSamePosition(this.lora, x, y)) {
            return { id: LORA_ID, type: 'lora' };
        }
        const mob = this.#findMobAt(x, y);
        if (mob) {
            return { id: mob.id, type: 'mob' };
        }
        const wall = this.#findWallAt(x, y);
        return wall ? { id: wall.id, type: 'wall' } : null;
    }

    /** 지정 좌표의 활성 벽을 찾습니다. @private */
    #findWallAt(x, y) {
        return this.#getFloor().walls.find((wall) => !wall.destroyed && this.#isSamePosition(wall, x, y)) ?? null;
    }

    /** 지정 좌표의 살아있는 몹을 찾습니다. @private */
    #findMobAt(x, y) {
        return this.#getFloor().mobs.find((mob) => mob.alive && this.#isSamePosition(mob, x, y)) ?? null;
    }

    /** 지정 좌표의 미획득 아이템을 찾습니다. @private */
    #findItemAt(x, y) {
        return this.#getFloor().items.find((item) => !item.collected && this.#isSamePosition(item, x, y)) ?? null;
    }

    /** 지정 좌표의 함정을 찾습니다. @private */
    #findTrapAt(x, y) {
        return this.#getFloor().traps.find((trap) => this.#isSamePosition(trap, x, y)) ?? null;
    }

    /** 지정 좌표의 미사용 텔레포트를 찾습니다. @private */
    #findTeleportAt(x, y) {
        return this.#getFloor().teleports.find((teleport) => !teleport.used && this.#isSamePosition(teleport, x, y)) ?? null;
    }

    /** 인벤토리에 아이템을 추가합니다. @private */
    #addInventory(itemId, count) {
        this.inventory.set(itemId, (this.inventory.get(itemId) ?? 0) + count);
    }

    /** 인벤토리 아이템을 제거합니다. @private */
    #removeInventory(itemId, count) {
        const next = Math.max(0, (this.inventory.get(itemId) ?? 0) - count);
        if (next === 0) {
            this.inventory.delete(itemId);
        } else {
            this.inventory.set(itemId, next);
        }
    }

    /** 아이템 보유 여부를 확인합니다. @private */
    #hasItem(itemId) {
        return (this.inventory.get(itemId) ?? 0) > 0;
    }

    /** 함정으로 잃을 아이템 하나를 결정합니다. @private */
    #loseRandomItem(events, trapId) {
        const candidates = [...this.inventory.entries()]
            .filter(([, count]) => count > 0)
            .map(([itemId]) => itemId);
        if (candidates.length === 0) {
            return;
        }
        const randomValue = this.#nextRandomValue();
        const normalized = Number.isFinite(randomValue) ? this.#clamp(randomValue, 0, 0.999999999) : 0;
        const itemId = candidates[Math.floor(normalized * candidates.length)];
        this.#removeInventory(itemId, 1);
        events.push(this.#createEvent('item-lost', { trapId, itemId }));
    }

    /** 플레이어 체력을 회복합니다. @private */
    #healPlayer(amount, source, events) {
        const applied = Math.min(this.player.maxHp - this.player.hp, Math.max(0, amount));
        this.player.hp += applied;
        this.player.alive = this.player.hp > 0;
        events.push(this.#createEvent('player-healed', { amount: applied, hp: this.player.hp, source }));
        return applied;
    }

    /** 로라 체력을 회복합니다. @private */
    #healLora(amount, source, events) {
        const applied = Math.min(this.lora.maxHp - this.lora.hp, Math.max(0, amount));
        this.lora.hp += applied;
        this.lora.alive = this.lora.hp > 0;
        if (this.lora.alive) {
            this.gateOpen = false;
        }
        events.push(this.#createEvent('lora-healed', { amount: applied, hp: this.lora.hp, source }));
        return applied;
    }

    /** 로라 HP에 따른 배율로 안정화 수치를 적용합니다. @private */
    #applyStabilization(amount, source, events) {
        const multiplier = this.lora.hp <= this.#config.lora.lowHpThreshold
            ? this.#config.lora.lowHpStabilizeMultiplier
            : 1;
        return this.#changeInstability(-Math.max(0, amount) * multiplier, source, events);
    }

    /** 로라 불안정도를 변경하고 실제 변화량을 반환합니다. @private */
    #changeInstability(amount, source, events) {
        const before = this.lora.instability;
        this.lora.instability = this.#clamp(
            before + amount,
            0,
            this.lora.maxInstability
        );
        const change = this.lora.instability - before;
        events.push(this.#createEvent('instability-changed', {
            source,
            before,
            after: this.lora.instability,
            change
        }));
        return change;
    }

    /** 플레이어에게 로라 피해를 적용합니다. @private */
    #damagePlayer(baseDamage, source, events) {
        let reduction = this.player.defending ? this.#config.player.defendReduction : 0;
        if (this.#hasItem('old-teddy')) {
            reduction += this.#config.items['old-teddy'].effect.playerDamageReduction;
        }
        if (this.player.shieldLoraTurns > 0) {
            reduction += this.#config.items['shield-core'].effect.damageReduction;
        }
        reduction = this.#clamp(reduction, 0, 0.9);
        const damage = Math.max(0, Math.round(baseDamage * (1 - reduction)));
        const applied = Math.min(this.player.hp, damage);
        this.player.hp = Math.max(0, this.player.hp - damage);
        this.player.alive = this.player.hp > 0;
        events.push(this.#createEvent('player-damaged', {
            amount: applied,
            hp: this.player.hp,
            reduction,
            source
        }));
        return applied;
    }

    /** 몹에게 피해를 적용하고 사망 시 드롭을 생성합니다. @private */
    #damageMob(mob, damage, source, events) {
        if (!mob || !mob.alive) {
            return { damage: 0, defeated: false };
        }
        const applied = Math.min(mob.hp, Math.max(0, Math.round(damage)));
        mob.hp = Math.max(0, mob.hp - damage);
        mob.alive = mob.hp > 0;
        events.push(this.#createEvent('mob-damaged', {
            mobId: mob.id,
            damage: applied,
            hp: mob.hp,
            source
        }));
        if (!mob.alive) {
            events.push(this.#createEvent('mob-defeated', { mobId: mob.id, source }));
            if (mob.dropItemId && !mob.dropped) {
                mob.dropped = true;
                this.#getFloor().items.push({
                    id: `drop-${mob.id}`,
                    itemId: mob.dropItemId,
                    x: mob.x,
                    y: mob.y,
                    hidden: false,
                    collected: false
                });
                events.push(this.#createEvent('item-dropped', {
                    mobId: mob.id,
                    itemId: mob.dropItemId,
                    x: mob.x,
                    y: mob.y
                }));
            }
        }
        return { damage: applied, defeated: !mob.alive };
    }

    /** 지하층으로 전환하고 두 전투자를 고정 시작 좌표로 옮깁니다. @private */
    #transitionToFloor(index, events) {
        const target = this.floorStates[index];
        if (!target) {
            return false;
        }
        const fallPosition = { x: this.player.x, y: this.player.y };
        const fallBlocked = !this.isInside(fallPosition.x, fallPosition.y)
            || this.#isSamePosition(target.loraStart, fallPosition.x, fallPosition.y)
            || target.mobs.some((mob) => (
                mob.alive && this.#isSamePosition(mob, fallPosition.x, fallPosition.y)
            ));
        const playerDestination = fallBlocked ? target.playerStart : fallPosition;

        this.floorIndex = index;
        this.player.x = playerDestination.x;
        this.player.y = playerDestination.y;
        this.lora.x = target.loraStart.x;
        this.lora.y = target.loraStart.y;
        const landingWall = this.#findWallAt(this.player.x, this.player.y);
        if (landingWall) {
            landingWall.destroyed = true;
            events.push(this.#createEvent('wall-destroyed', {
                wallId: landingWall.id,
                x: landingWall.x,
                y: landingWall.y,
                source: 'floor-transition'
            }));
        }
        this.#processTileEntry(events, { allowTeleport: false });
        events.push(this.#createEvent('floor-transition', {
            floorIndex: index,
            floorId: target.id,
            usedFallback: fallBlocked,
            player: { x: this.player.x, y: this.player.y },
            lora: { x: this.lora.x, y: this.lora.y }
        }));
        return true;
    }

    /** 컷씬 해금을 현재 런과 영구 지식에 반영합니다. @private */
    #unlockCutscene(cutsceneId, events) {
        if (!this.#config.cutsceneIds.has(cutsceneId) || this.unlockedCutscenes.has(cutsceneId)) {
            return;
        }
        this.unlockedCutscenes.add(cutsceneId);
        this.#knowledge.unlockedCutsceneIds.add(cutsceneId);
        events.push(this.#createEvent('cutscene-unlocked', { cutsceneId }));
    }

    /** 전투 결과와 엔딩, 점수를 확정합니다. @private */
    #finishBattle(outcome, reason, events) {
        const escaped = outcome === 'success' && reason === 'escaped';
        let endingId = 'failure';
        if (escaped) {
            const trueConditions = this.lora.instability <= this.#config.trueEndingMaxInstability
                && this.usedItems.has('old-teddy')
                && this.usedItems.has('mirror')
                && this.usedItems.has('eyeliner');
            const specialConditions = this.lora.instability <= this.#config.specialEndingMaxInstability
                && (this.usedItems.has('memory-photo') || this.usedItems.has('glitch-item'));
            endingId = trueConditions ? 'true' : specialConditions ? 'special' : 'hollow';
        }
        this.#unlockCutscene(endingId, events);
        const score = this.#calculateScore(outcome, endingId);
        this.result = {
            outcome,
            reason,
            turn: this.turnNumber,
            playerHp: this.player.hp,
            loraHp: this.lora.hp,
            instability: this.lora.instability,
            neutralized: !this.lora.alive,
            escaped,
            usedItems: [...this.usedItems],
            unlockedCutscenes: [...this.unlockedCutscenes],
            score,
            endingId
        };
        this.turn = 'result';
        this.phase = 'result';
        events.push(this.#createEvent('battle-finished', { ...this.result }));
    }

    /** 현재 결과 요소로 발표용 점수를 계산합니다. @private */
    #calculateScore(outcome, endingId) {
        if (outcome !== 'success') {
            return Math.max(0, Math.round(this.player.hp + (100 - this.lora.instability)));
        }
        const endingBonus = endingId === 'true' ? 1000 : endingId === 'special' ? 500 : 0;
        return Math.max(0, Math.round(
            1000
            + this.player.hp * 2
            + this.usedItems.size * 30
            + this.unlockedCutscenes.size * 100
            - this.lora.instability * 6
            - this.turnNumber * 20
            + endingBonus
        ));
    }

    /** 공통 이벤트 객체를 생성합니다. @private */
    #createEvent(type, payload = {}) {
        return { type, turn: this.turnNumber, floorIndex: this.floorIndex, ...payload };
    }

    /** 최근 이벤트를 방어 복제하여 저장합니다. @private */
    #setLastEvents(events) {
        this.lastEvents = this.#copyEvents(events);
    }

    /** 이벤트 배열을 복제합니다. @private */
    #copyEvents(events) {
        return this.#cloneCheckpointValue(events ?? []);
    }

    /** 전투 결과의 중첩 배열까지 방어 복제합니다. @private */
    #copyResult() {
        return this.result ? this.#cloneCheckpointValue(this.result) : null;
    }

    /** 설정이 같은 모델의 체크포인트인지 판별할 서명을 생성합니다. @private */
    #createConfigSignature() {
        return JSON.stringify({
            width: this.#config.width,
            height: this.#config.height,
            floors: this.#config.floors,
            items: this.#config.items,
            starterChoiceIds: [...this.#config.starterChoiceIds].sort(),
            cutsceneIds: [...this.#config.cutsceneIds].sort(),
            maxTurns: this.#config.maxTurns,
            floorTransitionAfterTurn: this.#config.floorTransitionAfterTurn,
            bowInstabilityPerTurn: this.#config.bowInstabilityPerTurn,
            bowLoraDamageBonus: this.#config.bowLoraDamageBonus,
            slowTrapMovePenalty: this.#config.slowTrapMovePenalty,
            trueEndingMaxInstability: this.#config.trueEndingMaxInstability,
            specialEndingMaxInstability: this.#config.specialEndingMaxInstability,
            player: this.#config.player,
            lora: this.#config.lora
        });
    }

    /** 난수 공급자를 기록/재생 테이프로 감싸 결정적인 다음 값을 반환합니다. @private */
    #nextRandomValue() {
        if (this.#randomCursor < this.#randomTape.length) {
            const replayed = this.#randomTape[this.#randomCursor];
            this.#randomCursor += 1;
            return replayed;
        }
        const recorded = Number(this.#random());
        this.#randomTape.push(recorded);
        this.#randomCursor += 1;
        return recorded;
    }

    /**
     * 같은 모델에서 체크포인트 이후 기록한 난수 꼬리는 보존하고 체크포인트 커서만 되감을 수 있게 병합합니다.
     * @private
     */
    #mergeRandomReplayTape(checkpointTape) {
        const isCurrentPrefix = checkpointTape.length <= this.#randomTape.length
            && checkpointTape.every((value, index) => Object.is(value, this.#randomTape[index]));
        return isCurrentPrefix ? [...this.#randomTape] : [...checkpointTape];
    }

    /** 런 상태와 체크포인트 값을 Map/Set까지 포함해 재귀적으로 방어 복제합니다. @private */
    #cloneCheckpointValue(value, ancestors = new Set()) {
        if (value === null || typeof value !== 'object') {
            return value;
        }
        if (ancestors.has(value)) {
            throw new TypeError('TutorialBattleModel: 잘못된 체크포인트입니다 (순환 참조는 지원하지 않습니다).');
        }
        ancestors.add(value);

        let clone;
        if (Array.isArray(value)) {
            clone = value.map((entry) => this.#cloneCheckpointValue(entry, ancestors));
        } else if (value instanceof Map) {
            clone = new Map([...value.entries()].map(([key, entry]) => ([
                this.#cloneCheckpointValue(key, ancestors),
                this.#cloneCheckpointValue(entry, ancestors)
            ])));
        } else if (value instanceof Set) {
            clone = new Set([...value].map((entry) => this.#cloneCheckpointValue(entry, ancestors)));
        } else if (this.#isPlainRecord(value)) {
            if (Object.getOwnPropertySymbols(value).length > 0) {
                throw new TypeError('TutorialBattleModel: 잘못된 체크포인트입니다 (심볼 속성은 지원하지 않습니다).');
            }
            clone = Object.getPrototypeOf(value) === null ? Object.create(null) : {};
            for (const key of Object.keys(value)) {
                const descriptor = Object.getOwnPropertyDescriptor(value, key);
                if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
                    throw new TypeError('TutorialBattleModel: 잘못된 체크포인트입니다 (접근자 속성은 지원하지 않습니다).');
                }
                Object.defineProperty(clone, key, {
                    value: this.#cloneCheckpointValue(descriptor.value, ancestors),
                    enumerable: descriptor.enumerable,
                    configurable: true,
                    writable: true
                });
            }
        } else {
            throw new TypeError('TutorialBattleModel: 잘못된 체크포인트입니다 (지원하지 않는 객체 형식입니다).');
        }

        ancestors.delete(value);
        return clone;
    }

    /** 체크포인트 외피를 확인하고 독립 상태 복제본을 반환합니다. @private */
    #normalizeCheckpoint(checkpoint) {
        const cloned = this.#cloneCheckpointValue(checkpoint);
        this.#assertCheckpoint(this.#isPlainRecord(cloned), '객체 형식이 필요합니다');
        this.#assertCheckpoint(cloned.kind === CHECKPOINT_KIND, '종류 표식이 맞지 않습니다');
        this.#assertCheckpoint(cloned.version === CHECKPOINT_VERSION, '지원하지 않는 버전입니다');
        this.#assertCheckpoint(cloned.configSignature === this.#configSignature, '현재 전투 설정과 호환되지 않습니다');
        this.#assertCheckpoint(this.#isPlainRecord(cloned.state), 'state 객체가 필요합니다');
        this.#validateCheckpointState(cloned.state);
        return cloned.state;
    }

    /** 체크포인트의 런 상태와 모델 불변식을 검증합니다. @private */
    #validateCheckpointState(state) {
        const allowedTurns = new Set(['player', 'lora', 'result']);
        const allowedPhases = new Set(['move-or-action', 'move', 'action', 'lora', 'result']);
        const allowedActions = new Set(['attack', 'defend', 'wait', 'use-item', 'escape']);
        this.#assertCheckpoint(allowedTurns.has(state.turn), 'turn 값이 올바르지 않습니다');
        this.#assertCheckpoint(allowedPhases.has(state.phase), 'phase 값이 올바르지 않습니다');
        this.#assertCheckpoint(
            Number.isInteger(state.turnNumber) && state.turnNumber >= 1 && state.turnNumber <= this.#config.maxTurns,
            'turnNumber 범위가 올바르지 않습니다'
        );
        this.#assertCheckpoint(state.round === state.turnNumber, 'round와 turnNumber가 일치하지 않습니다');
        this.#assertCheckpoint(state.maxTurns === this.#config.maxTurns, 'maxTurns가 설정과 다릅니다');
        this.#assertCheckpoint(state.maxRounds === this.#config.maxTurns, 'maxRounds가 설정과 다릅니다');
        this.#assertCheckpoint(
            Number.isInteger(state.floorIndex)
                && state.floorIndex >= 0
                && state.floorIndex < this.#config.floors.length,
            'floorIndex 범위가 올바르지 않습니다'
        );
        this.#assertCheckpoint(typeof state.movementUsed === 'boolean', 'movementUsed가 boolean이 아닙니다');
        this.#assertCheckpoint(typeof state.actionUsed === 'boolean', 'actionUsed가 boolean이 아닙니다');
        this.#assertCheckpoint(allowedActions.has(state.selectedAction), 'selectedAction 값이 올바르지 않습니다');
        this.#assertCheckpoint(typeof state.gateOpen === 'boolean', 'gateOpen이 boolean이 아닙니다');
        this.#assertCheckpoint(typeof state.loraTurnPerformed === 'boolean', '로라 턴 수행 표식이 올바르지 않습니다');

        if (state.turn === 'player') {
            const expectedPhase = state.movementUsed
                ? (state.actionUsed ? null : 'action')
                : (state.actionUsed ? 'move' : 'move-or-action');
            this.#assertCheckpoint(state.phase === expectedPhase, '플레이어 행동 자원과 phase가 일치하지 않습니다');
            this.#assertCheckpoint(state.loraTurnPerformed === false, '플레이어 턴에 로라 행동 표식이 남아 있습니다');
        } else if (state.turn === 'lora') {
            this.#assertCheckpoint(state.phase === 'lora', '로라 턴 phase가 올바르지 않습니다');
            this.#assertCheckpoint(state.movementUsed && state.actionUsed, '로라 턴 전에 플레이어 자원이 소진되지 않았습니다');
        } else {
            this.#assertCheckpoint(state.phase === 'result', '결과 상태 phase가 올바르지 않습니다');
        }

        this.#validateCheckpointFloorStates(state.floorStates);
        this.#validateCheckpointPlayer(state.player);
        this.#validateCheckpointLora(state.lora);
        const activeFloor = state.floorStates[state.floorIndex];
        this.#assertCheckpoint(
            this.#matchesCheckpointPosition(state.lora, activeFloor.loraStart),
            '로라 좌표가 현재 층 고정 좌표와 다릅니다'
        );
        this.#assertCheckpoint(state.gateOpen === !state.lora.alive, '게이트 상태와 로라 생존 상태가 일치하지 않습니다');

        this.#assertCheckpoint(state.inventory instanceof Map, 'inventory가 Map이 아닙니다');
        for (const [itemId, count] of state.inventory) {
            this.#assertCheckpoint(Boolean(this.#config.items[itemId]), `inventory의 ${String(itemId)} 아이템이 존재하지 않습니다`);
            this.#assertCheckpoint(Number.isInteger(count) && count > 0, `inventory의 ${String(itemId)} 수량이 올바르지 않습니다`);
        }

        const itemIds = new Set(Object.keys(this.#config.items));
        this.#validateCheckpointSet(state.usedItems, 'usedItems', itemIds);
        this.#validateCheckpointSet(state.unlockedCutscenes, 'unlockedCutscenes');
        this.#assertCheckpoint(this.#isPlainRecord(state.knowledge), 'knowledge 객체가 필요합니다');
        this.#validateCheckpointSet(state.knowledge.discoveredItemIds, 'knowledge.discoveredItemIds');
        this.#validateCheckpointSet(state.knowledge.identifiedItemIds, 'knowledge.identifiedItemIds');
        this.#validateCheckpointSet(state.knowledge.revealedTrapIds, 'knowledge.revealedTrapIds');
        this.#validateCheckpointSet(state.knowledge.unlockedCutsceneIds, 'knowledge.unlockedCutsceneIds');
        this.#assertCheckpoint(state.knowledge.identifiedItemIds.has('bow'), 'bow 식별 지식이 없습니다');
        this.#assertCheckpoint(state.knowledge.identifiedItemIds.has('bandage'), 'bandage 식별 지식이 없습니다');
        this.#assertCheckpoint(state.unlockedCutscenes.has('opening'), 'opening 컷씬 해금이 없습니다');
        this.#assertCheckpoint(
            this.#setsEqual(state.unlockedCutscenes, state.knowledge.unlockedCutsceneIds),
            '런 컷씬 해금과 지식 해금이 일치하지 않습니다'
        );
        for (const itemId of state.usedItems) {
            this.#assertCheckpoint(
                state.knowledge.discoveredItemIds.has(itemId) && state.knowledge.identifiedItemIds.has(itemId),
                `사용한 ${itemId} 아이템의 지식이 없습니다`
            );
        }
        for (const floor of state.floorStates) {
            for (const item of floor.items) {
                if (item.collected) {
                    this.#assertCheckpoint(
                        state.knowledge.discoveredItemIds.has(item.itemId),
                        `획득한 ${item.itemId} 아이템의 발견 지식이 없습니다`
                    );
                }
            }
            for (const trap of floor.traps) {
                if (trap.triggered) {
                    this.#assertCheckpoint(
                        state.knowledge.revealedTrapIds.has(trap.id),
                        `작동한 ${trap.id} 함정의 발견 지식이 없습니다`
                    );
                }
            }
        }

        this.#validateOptionalRecord(state.lastPlayerAction, 'lastPlayerAction');
        this.#validateOptionalRecord(state.lastLoraAction, 'lastLoraAction');
        this.#assertCheckpoint(
            state.lastInteractionItemId === null
                || (typeof state.lastInteractionItemId === 'string' && Boolean(this.#config.items[state.lastInteractionItemId])),
            'lastInteractionItemId가 올바르지 않습니다'
        );
        this.#assertCheckpoint(Array.isArray(state.lastEvents), 'lastEvents가 배열이 아닙니다');
        for (const event of state.lastEvents) {
            this.#assertCheckpoint(
                this.#isPlainRecord(event) && typeof event.type === 'string' && event.type.length > 0,
                'lastEvents에 올바르지 않은 이벤트가 있습니다'
            );
        }
        this.#validateOptionalRecord(state.result, 'result');
        this.#assertCheckpoint(
            (state.turn === 'result') === (state.result !== null),
            'result와 turn 상태가 일치하지 않습니다'
        );

        this.#assertCheckpoint(this.#isPlainRecord(state.randomReplay), 'randomReplay 객체가 필요합니다');
        this.#assertCheckpoint(Array.isArray(state.randomReplay.tape), '난수 재생 테이프가 배열이 아닙니다');
        for (let index = 0; index < state.randomReplay.tape.length; index++) {
            this.#assertCheckpoint(
                typeof state.randomReplay.tape[index] === 'number',
                `난수 재생 테이프의 ${index}번째 값이 숫자가 아닙니다`
            );
        }
        this.#assertCheckpoint(
            Number.isInteger(state.randomReplay.cursor)
                && state.randomReplay.cursor >= 0
                && state.randomReplay.cursor <= state.randomReplay.tape.length,
            '난수 재생 커서 범위가 올바르지 않습니다'
        );
    }

    /** 모든 층의 정적 구조와 런 중 가변 엔티티 상태를 검증합니다. @private */
    #validateCheckpointFloorStates(floorStates) {
        this.#assertCheckpoint(
            Array.isArray(floorStates) && floorStates.length === this.#config.floors.length,
            'floorStates 층 수가 설정과 다릅니다'
        );

        for (let floorIndex = 0; floorIndex < floorStates.length; floorIndex++) {
            const floor = floorStates[floorIndex];
            const baseline = this.#config.floors[floorIndex];
            this.#assertCheckpoint(this.#isPlainRecord(floor), `floorStates[${floorIndex}] 객체가 필요합니다`);
            this.#assertCheckpoint(floor.index === floorIndex, `floorStates[${floorIndex}].index가 올바르지 않습니다`);
            this.#assertCheckpoint(floor.id === baseline.id, `floorStates[${floorIndex}].id가 설정과 다릅니다`);
            this.#assertCheckpoint(floor.label === baseline.label, `floorStates[${floorIndex}].label이 설정과 다릅니다`);
            this.#assertCheckpoint(
                floor.width === this.#config.width && floor.height === this.#config.height,
                `floorStates[${floorIndex}] 크기가 설정과 다릅니다`
            );
            this.#assertCheckpoint(
                this.#matchesCheckpointPosition(floor.playerStart, baseline.playerStart),
                `floorStates[${floorIndex}].playerStart가 설정과 다릅니다`
            );
            this.#assertCheckpoint(
                this.#matchesCheckpointPosition(floor.loraStart, baseline.loraStart),
                `floorStates[${floorIndex}].loraStart가 설정과 다릅니다`
            );
            this.#assertCheckpoint(
                (floor.gate === null && baseline.gate === null)
                    || this.#matchesCheckpointPosition(floor.gate, baseline.gate),
                `floorStates[${floorIndex}].gate가 설정과 다릅니다`
            );

            this.#assertCheckpoint(
                Array.isArray(floor.heights) && floor.heights.length === baseline.heights.length,
                `floorStates[${floorIndex}].heights 행 수가 다릅니다`
            );
            for (let y = 0; y < baseline.heights.length; y++) {
                this.#assertCheckpoint(
                    Array.isArray(floor.heights[y])
                        && floor.heights[y].length === baseline.heights[y].length,
                    `floorStates[${floorIndex}].heights[${y}]가 설정과 다릅니다`
                );
                for (let x = 0; x < baseline.heights[y].length; x++) {
                    this.#assertCheckpoint(
                        floor.heights[y][x] === baseline.heights[y][x],
                        `floorStates[${floorIndex}].heights[${y}][${x}]가 설정과 다릅니다`
                    );
                }
            }

            this.#assertCheckpoint(
                Array.isArray(floor.walls) && floor.walls.length === baseline.walls.length,
                `floorStates[${floorIndex}].walls 구조가 다릅니다`
            );
            for (let index = 0; index < baseline.walls.length; index++) {
                const wall = floor.walls[index];
                const expected = baseline.walls[index];
                this.#assertCheckpoint(
                    this.#isPlainRecord(wall)
                        && wall.id === expected.id
                        && this.#matchesCheckpointPosition(wall, expected)
                        && typeof wall.destroyed === 'boolean',
                    `floorStates[${floorIndex}].walls[${index}]가 올바르지 않습니다`
                );
            }

            this.#assertCheckpoint(
                Array.isArray(floor.traps) && floor.traps.length === baseline.traps.length,
                `floorStates[${floorIndex}].traps 구조가 다릅니다`
            );
            for (let index = 0; index < baseline.traps.length; index++) {
                const trap = floor.traps[index];
                const expected = baseline.traps[index];
                this.#assertCheckpoint(
                    this.#isPlainRecord(trap)
                        && trap.id === expected.id
                        && trap.type === expected.type
                        && this.#matchesCheckpointPosition(trap, expected)
                        && typeof trap.triggered === 'boolean',
                    `floorStates[${floorIndex}].traps[${index}]가 올바르지 않습니다`
                );
            }

            this.#assertCheckpoint(
                Array.isArray(floor.teleports) && floor.teleports.length === baseline.teleports.length,
                `floorStates[${floorIndex}].teleports 구조가 다릅니다`
            );
            for (let index = 0; index < baseline.teleports.length; index++) {
                const teleport = floor.teleports[index];
                const expected = baseline.teleports[index];
                this.#assertCheckpoint(
                    this.#isPlainRecord(teleport)
                        && teleport.id === expected.id
                        && this.#matchesCheckpointPosition(teleport, expected)
                        && typeof teleport.used === 'boolean',
                    `floorStates[${floorIndex}].teleports[${index}]가 올바르지 않습니다`
                );
            }

            this.#assertCheckpoint(
                Array.isArray(floor.mobs) && floor.mobs.length === baseline.mobs.length,
                `floorStates[${floorIndex}].mobs 구조가 다릅니다`
            );
            for (let index = 0; index < baseline.mobs.length; index++) {
                const mob = floor.mobs[index];
                const expected = baseline.mobs[index];
                this.#assertCheckpoint(
                    this.#isPlainRecord(mob)
                        && mob.id === expected.id
                        && mob.dropItemId === expected.dropItemId
                        && this.#matchesCheckpointPosition(mob, expected)
                        && mob.maxHp === expected.maxHp,
                    `floorStates[${floorIndex}].mobs[${index}] 정적 상태가 올바르지 않습니다`
                );
                this.#assertCheckpoint(
                    Number.isFinite(mob.hp) && mob.hp >= 0 && mob.hp <= mob.maxHp,
                    `floorStates[${floorIndex}].mobs[${index}].hp 범위가 올바르지 않습니다`
                );
                this.#assertCheckpoint(
                    mob.alive === (mob.hp > 0) && typeof mob.dropped === 'boolean',
                    `floorStates[${floorIndex}].mobs[${index}] 생존 상태가 올바르지 않습니다`
                );
                this.#assertCheckpoint(
                    mob.dropped === Boolean(mob.dropItemId && !mob.alive),
                    `floorStates[${floorIndex}].mobs[${index}] 드롭 상태가 올바르지 않습니다`
                );
            }

            const droppedMobs = floor.mobs.filter((mob) => mob.dropped);
            this.#assertCheckpoint(
                Array.isArray(floor.items) && floor.items.length === baseline.items.length + droppedMobs.length,
                `floorStates[${floorIndex}].items 구조가 다릅니다`
            );
            const itemInstanceIds = new Set();
            for (let index = 0; index < floor.items.length; index++) {
                const item = floor.items[index];
                this.#assertCheckpoint(
                    this.#isPlainRecord(item)
                        && typeof item.id === 'string'
                        && item.id.length > 0
                        && !itemInstanceIds.has(item.id)
                        && Boolean(this.#config.items[item.itemId])
                        && typeof item.hidden === 'boolean'
                        && typeof item.collected === 'boolean',
                    `floorStates[${floorIndex}].items[${index}] 형식이 올바르지 않습니다`
                );
                this.#validateCheckpointPosition(item, `floorStates[${floorIndex}].items[${index}]`);
                itemInstanceIds.add(item.id);

                if (index < baseline.items.length) {
                    const expected = baseline.items[index];
                    this.#assertCheckpoint(
                        item.id === expected.id
                            && item.itemId === expected.itemId
                            && item.hidden === expected.hidden
                            && this.#matchesCheckpointPosition(item, expected),
                        `floorStates[${floorIndex}].items[${index}]가 설정과 다릅니다`
                    );
                    continue;
                }

                const droppedBy = droppedMobs.find((mob) => `drop-${mob.id}` === item.id);
                this.#assertCheckpoint(
                    Boolean(droppedBy)
                        && item.itemId === droppedBy.dropItemId
                        && item.hidden === false
                        && this.#matchesCheckpointPosition(item, droppedBy),
                    `floorStates[${floorIndex}].items[${index}] 드롭 출처가 올바르지 않습니다`
                );
            }
            for (const mob of droppedMobs) {
                this.#assertCheckpoint(
                    itemInstanceIds.has(`drop-${mob.id}`),
                    `floorStates[${floorIndex}]에 ${mob.id}의 드롭 아이템이 없습니다`
                );
            }
        }
    }

    /** 두 위치 객체의 정수 좌표가 같은지 확인합니다. @private */
    #matchesCheckpointPosition(actual, expected) {
        return this.#isPlainRecord(actual)
            && this.#isPlainRecord(expected)
            && actual.x === expected.x
            && actual.y === expected.y;
    }

    /** 플레이어 상태의 좌표, 체력과 효과 불변식을 검증합니다. @private */
    #validateCheckpointPlayer(player) {
        this.#assertCheckpoint(this.#isPlainRecord(player), 'player 객체가 필요합니다');
        this.#validateCheckpointPosition(player, 'player');
        this.#assertCheckpoint(player.maxHp === this.#config.player.maxHp, 'player.maxHp가 설정과 다릅니다');
        this.#assertCheckpoint(
            Number.isFinite(player.hp) && player.hp >= 0 && player.hp <= player.maxHp,
            'player.hp 범위가 올바르지 않습니다'
        );
        this.#assertCheckpoint(player.alive === (player.hp > 0), 'player.alive와 hp가 일치하지 않습니다');
        this.#assertCheckpoint(typeof player.defending === 'boolean', 'player.defending이 boolean이 아닙니다');
        this.#assertCheckpoint(typeof player.mushroomActive === 'boolean', 'player.mushroomActive가 boolean이 아닙니다');
        this.#assertCheckpoint(
            Number.isInteger(player.shieldLoraTurns) && player.shieldLoraTurns >= 0,
            'player.shieldLoraTurns가 올바르지 않습니다'
        );
        this.#assertCheckpoint(
            Number.isInteger(player.slowMoveTurns) && player.slowMoveTurns >= 0,
            'player.slowMoveTurns가 올바르지 않습니다'
        );
    }

    /** 로라 상태의 좌표, 체력, 불안정도와 효과 불변식을 검증합니다. @private */
    #validateCheckpointLora(lora) {
        this.#assertCheckpoint(this.#isPlainRecord(lora), 'lora 객체가 필요합니다');
        this.#validateCheckpointPosition(lora, 'lora');
        this.#assertCheckpoint(lora.maxHp === this.#config.lora.maxHp, 'lora.maxHp가 설정과 다릅니다');
        this.#assertCheckpoint(
            Number.isFinite(lora.hp) && lora.hp >= 0 && lora.hp <= lora.maxHp,
            'lora.hp 범위가 올바르지 않습니다'
        );
        this.#assertCheckpoint(lora.alive === (lora.hp > 0), 'lora.alive와 hp가 일치하지 않습니다');
        this.#assertCheckpoint(lora.maxInstability === this.#config.lora.maxInstability, 'lora.maxInstability가 설정과 다릅니다');
        this.#assertCheckpoint(
            Number.isFinite(lora.instability) && lora.instability >= 0 && lora.instability <= lora.maxInstability,
            'lora.instability 범위가 올바르지 않습니다'
        );
        this.#assertCheckpoint(typeof lora.defending === 'boolean', 'lora.defending이 boolean이 아닙니다');
        this.#assertCheckpoint(
            Number.isInteger(lora.peaceTurns) && lora.peaceTurns >= 0,
            'lora.peaceTurns가 올바르지 않습니다'
        );
        this.#assertCheckpoint(
            Number.isInteger(lora.restrainedTurns) && lora.restrainedTurns >= 0,
            'lora.restrainedTurns가 올바르지 않습니다'
        );
    }

    /** 체크포인트 좌표가 현재 맵 내부인지 검증합니다. @private */
    #validateCheckpointPosition(position, label) {
        this.#assertCheckpoint(
            Number.isInteger(position.x)
                && Number.isInteger(position.y)
                && position.x >= 0
                && position.x < this.#config.width
                && position.y >= 0
                && position.y < this.#config.height,
            `${label} 좌표가 맵 밖입니다`
        );
    }

    /** Set 형식과 허용 값 범위를 검증합니다. @private */
    #validateCheckpointSet(value, label, allowedValues = null) {
        this.#assertCheckpoint(value instanceof Set, `${label}가 Set이 아닙니다`);
        for (const entry of value) {
            this.#assertCheckpoint(
                typeof entry === 'string'
                    && entry.length > 0
                    && (!allowedValues || allowedValues.has(entry)),
                `${label}에 허용되지 않은 ${String(entry)} 값이 있습니다`
            );
        }
    }

    /** nullable 일반 객체 필드를 검증합니다. @private */
    #validateOptionalRecord(value, label) {
        this.#assertCheckpoint(value === null || this.#isPlainRecord(value), `${label} 형식이 올바르지 않습니다`);
    }

    /** 두 Set이 같은 값을 갖는지 확인합니다. @private */
    #setsEqual(left, right) {
        return left.size === right.size && [...left].every((value) => right.has(value));
    }

    /** 체크포인트 조건이 거짓이면 일관된 형식 오류를 발생시킵니다. @private */
    #assertCheckpoint(condition, detail) {
        if (!condition) {
            throw new TypeError(`TutorialBattleModel: 잘못된 체크포인트입니다 (${detail}).`);
        }
    }

    /** 값이 일반 객체 리터럴 계열인지 확인합니다. @private */
    #isPlainRecord(value) {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }

    /** 이동 실패 결과를 생성합니다. @private */
    #moveFailure(reason) {
        this.lastEvents = [];
        return { ok: false, action: 'move', path: [], cost: null, interrupted: false, events: [], reason };
    }

    /** 행동 실패 결과를 생성합니다. @private */
    #actionFailure(action, reason, extra = {}) {
        this.lastEvents = [];
        return { ok: false, action, events: [], reason, ...extra };
    }

    /** 두 좌표의 맨해튼 거리를 반환합니다. @private */
    #distance(left, right) {
        return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
    }

    /** 좌표가 지정 위치와 같은지 확인합니다. @private */
    #isSamePosition(position, x, y) {
        return Boolean(position && position.x === x && position.y === y);
    }

    /** 좌표를 Map 키로 변환합니다. @private */
    #toTileKey(x, y) {
        return `${x},${y}`;
    }

    /** 값을 범위 안으로 제한합니다. @private */
    #clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    /** 외부 지식 입력을 Set 기반 내부 상태로 정규화합니다. @private */
    #normalizeKnowledge(knowledge = {}) {
        const toSet = (value) => new Set(value instanceof Set ? value : Array.isArray(value) ? value : []);
        return {
            discoveredItemIds: toSet(knowledge?.discoveredItemIds),
            identifiedItemIds: toSet(knowledge?.identifiedItemIds),
            revealedTrapIds: toSet(knowledge?.revealedTrapIds),
            unlockedCutsceneIds: toSet(knowledge?.unlockedCutsceneIds)
        };
    }

    /** 외부 전투 설정을 검증하고 모델 전용 구조로 복제합니다. @private */
    #normalizeConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new TypeError('TutorialBattleModel: config 객체가 필요합니다.');
        }
        const width = this.#requirePositiveInteger(config.MAP?.WIDTH, 'MAP.WIDTH');
        const height = this.#requirePositiveInteger(config.MAP?.HEIGHT, 'MAP.HEIGHT');
        const maxTurns = this.#requirePositiveInteger(config.RULES?.MAX_TURNS, 'RULES.MAX_TURNS');
        const floorTransitionAfterTurn = this.#requirePositiveInteger(
            config.RULES?.FLOOR_TRANSITION_AFTER_TURN,
            'RULES.FLOOR_TRANSITION_AFTER_TURN'
        );
        if (floorTransitionAfterTurn >= maxTurns) {
            throw new RangeError('TutorialBattleModel: 층 전환 턴은 최대 턴보다 작아야 합니다.');
        }

        const itemEntries = Object.entries(config.ITEMS ?? {});
        if (itemEntries.length === 0) {
            throw new TypeError('TutorialBattleModel: ITEMS 설정이 필요합니다.');
        }
        const items = {};
        for (const [key, item] of itemEntries) {
            if (!item || item.id !== key || typeof item.label !== 'string' || !item.effect?.type) {
                throw new TypeError(`TutorialBattleModel: ITEMS.${key} 설정이 올바르지 않습니다.`);
            }
            items[key] = Object.freeze({ ...item, effect: Object.freeze({ ...item.effect }) });
        }

        const floors = this.#normalizeFloors(config.FLOORS, width, height, items);
        const playerConfig = config.ACTORS?.PLAYER;
        const loraConfig = config.ACTORS?.LORA;
        const loraMaxInstability = this.#requirePositiveNumber(
            loraConfig?.MAX_INSTABILITY,
            'ACTORS.LORA.MAX_INSTABILITY'
        );
        const instabilityStates = this.#normalizeInstabilityStates(
            loraConfig?.INSTABILITY_STATES,
            loraMaxInstability
        );
        const starterChoiceIds = new Set((config.STARTER_CHOICES ?? []).map((choice) => choice?.id));
        if (!starterChoiceIds.has('bow') || !starterChoiceIds.has('bandage')) {
            throw new TypeError('TutorialBattleModel: 시작 선택에 bow와 bandage가 필요합니다.');
        }
        const cutsceneIds = new Set(Object.values(config.CUTSCENES ?? {}).map((cutscene) => cutscene?.id));
        for (const requiredId of ['opening', 'teddy', 'item-synergy', 'extra-interaction', 'true', 'special', 'hollow', 'failure']) {
            if (!cutsceneIds.has(requiredId)) {
                throw new TypeError(`TutorialBattleModel: CUTSCENES에 ${requiredId}가 필요합니다.`);
            }
        }

        const startInstability = this.#requireNonNegativeNumber(
            loraConfig?.START_INSTABILITY,
            'ACTORS.LORA.START_INSTABILITY'
        );
        if (startInstability > loraMaxInstability) {
            throw new RangeError('TutorialBattleModel: 로라 시작 불안정도가 최대치를 넘습니다.');
        }

        return Object.freeze({
            width,
            height,
            floors: Object.freeze(floors),
            items: Object.freeze(items),
            starterChoiceIds,
            cutsceneIds,
            maxTurns,
            floorTransitionAfterTurn,
            bowInstabilityPerTurn: this.#requireNonNegativeNumber(
                config.RULES?.BOW_INSTABILITY_PER_TURN,
                'RULES.BOW_INSTABILITY_PER_TURN'
            ),
            bowLoraDamageBonus: this.#requireNonNegativeNumber(
                config.RULES?.BOW_LORA_DAMAGE_BONUS,
                'RULES.BOW_LORA_DAMAGE_BONUS'
            ),
            slowTrapMovePenalty: this.#requireNonNegativeNumber(
                config.RULES?.SLOW_TRAP_MOVE_PENALTY,
                'RULES.SLOW_TRAP_MOVE_PENALTY'
            ),
            trueEndingMaxInstability: this.#requireNonNegativeNumber(
                config.RULES?.TRUE_ENDING_MAX_INSTABILITY,
                'RULES.TRUE_ENDING_MAX_INSTABILITY'
            ),
            specialEndingMaxInstability: this.#requireNonNegativeNumber(
                config.RULES?.SPECIAL_ENDING_MAX_INSTABILITY,
                'RULES.SPECIAL_ENDING_MAX_INSTABILITY'
            ),
            player: Object.freeze({
                maxHp: this.#requirePositiveNumber(playerConfig?.MAX_HP, 'ACTORS.PLAYER.MAX_HP'),
                moveRange: this.#requirePositiveInteger(playerConfig?.MOVE_RANGE, 'ACTORS.PLAYER.MOVE_RANGE'),
                attackDamage: this.#requirePositiveNumber(playerConfig?.ATTACK_DAMAGE, 'ACTORS.PLAYER.ATTACK_DAMAGE'),
                attackRange: this.#requirePositiveInteger(playerConfig?.ATTACK_RANGE, 'ACTORS.PLAYER.ATTACK_RANGE'),
                attackInstability: this.#requireNonNegativeNumber(
                    playerConfig?.ATTACK_INSTABILITY,
                    'ACTORS.PLAYER.ATTACK_INSTABILITY'
                ),
                consecutiveAttackInstability: this.#requireNonNegativeNumber(
                    playerConfig?.CONSECUTIVE_ATTACK_INSTABILITY,
                    'ACTORS.PLAYER.CONSECUTIVE_ATTACK_INSTABILITY'
                ),
                defendReduction: this.#requireReduction(
                    playerConfig?.DEFEND_DAMAGE_REDUCTION,
                    'ACTORS.PLAYER.DEFEND_DAMAGE_REDUCTION'
                )
            }),
            lora: Object.freeze({
                maxHp: this.#requirePositiveNumber(loraConfig?.MAX_HP, 'ACTORS.LORA.MAX_HP'),
                startInstability,
                maxInstability: loraMaxInstability,
                meleeRange: this.#requirePositiveInteger(loraConfig?.MELEE_RANGE, 'ACTORS.LORA.MELEE_RANGE'),
                defendReduction: this.#requireReduction(
                    loraConfig?.DEFEND_DAMAGE_REDUCTION,
                    'ACTORS.LORA.DEFEND_DAMAGE_REDUCTION'
                ),
                lowHpThreshold: this.#requireNonNegativeNumber(
                    loraConfig?.LOW_HP_THRESHOLD,
                    'ACTORS.LORA.LOW_HP_THRESHOLD'
                ),
                lowHpStabilizeMultiplier: this.#requirePositiveNumber(
                    loraConfig?.LOW_HP_STABILIZE_MULTIPLIER,
                    'ACTORS.LORA.LOW_HP_STABILIZE_MULTIPLIER'
                ),
                instabilityStates
            })
        });
    }

    /** 층 데이터와 좌표 충돌을 검증합니다. @private */
    #normalizeFloors(value, width, height, items) {
        if (!Array.isArray(value) || value.length !== 2) {
            throw new TypeError('TutorialBattleModel: FLOORS는 두 층이어야 합니다.');
        }
        return value.map((floor, floorIndex) => {
            if (!floor || typeof floor.id !== 'string' || typeof floor.label !== 'string') {
                throw new TypeError(`TutorialBattleModel: FLOORS[${floorIndex}]가 올바르지 않습니다.`);
            }
            const playerStart = this.#normalizePosition(floor.playerStart, `FLOORS[${floorIndex}].playerStart`);
            const loraStart = this.#normalizePosition(floor.loraStart, `FLOORS[${floorIndex}].loraStart`);
            const gate = floor.gate ? this.#normalizePosition(floor.gate, `FLOORS[${floorIndex}].gate`) : null;
            const heights = this.#normalizeHeights(floor.heights, width, height, floorIndex);
            const walls = this.#normalizeEntityList(floor.walls, `FLOORS[${floorIndex}].walls`, width, height);
            const itemInstances = this.#normalizeEntityList(
                floor.items,
                `FLOORS[${floorIndex}].items`,
                width,
                height,
                (item, label) => {
                    if (!items[item.itemId]) {
                        throw new TypeError(`TutorialBattleModel: ${label}.itemId가 존재하지 않습니다.`);
                    }
                    return { itemId: item.itemId, hidden: item.hidden === true };
                }
            );
            const traps = this.#normalizeEntityList(
                floor.traps,
                `FLOORS[${floorIndex}].traps`,
                width,
                height,
                (trap, label) => {
                    if (!TRAP_TYPES.has(trap.type)) {
                        throw new TypeError(`TutorialBattleModel: ${label}.type이 올바르지 않습니다.`);
                    }
                    return { type: trap.type };
                }
            );
            const teleports = this.#normalizeEntityList(
                floor.teleports,
                `FLOORS[${floorIndex}].teleports`,
                width,
                height
            );
            const mobs = this.#normalizeEntityList(
                floor.mobs,
                `FLOORS[${floorIndex}].mobs`,
                width,
                height,
                (mob, label) => ({
                    maxHp: this.#requirePositiveNumber(mob.hp, `${label}.hp`),
                    dropItemId: mob.dropItemId ?? null
                })
            );
            for (const mob of mobs) {
                if (mob.dropItemId && !items[mob.dropItemId]) {
                    throw new TypeError(`TutorialBattleModel: ${mob.id}.dropItemId가 존재하지 않습니다.`);
                }
            }

            const occupied = new Set();
            for (const [position, label] of [
                [playerStart, 'playerStart'],
                [loraStart, 'loraStart'],
                ...(gate ? [[gate, 'gate']] : []),
                ...walls.map((entry) => [entry, entry.id]),
                ...itemInstances.map((entry) => [entry, entry.id]),
                ...traps.map((entry) => [entry, entry.id]),
                ...teleports.map((entry) => [entry, entry.id]),
                ...mobs.map((entry) => [entry, entry.id])
            ]) {
                this.#requireInside(position, width, height, `FLOORS[${floorIndex}].${label}`);
                const key = this.#toTileKey(position.x, position.y);
                if (occupied.has(key)) {
                    throw new RangeError(`TutorialBattleModel: FLOORS[${floorIndex}]의 ${label} 좌표가 겹칩니다.`);
                }
                occupied.add(key);
            }
            if (floorIndex === 1 && !gate) {
                throw new TypeError('TutorialBattleModel: 지하층에는 gate가 필요합니다.');
            }
            return Object.freeze({
                id: floor.id,
                label: floor.label,
                playerStart: Object.freeze(playerStart),
                loraStart: Object.freeze(loraStart),
                gate: gate ? Object.freeze(gate) : null,
                heights: Object.freeze(heights.map((row) => Object.freeze(row))),
                walls: Object.freeze(walls.map((entry) => Object.freeze(entry))),
                items: Object.freeze(itemInstances.map((entry) => Object.freeze(entry))),
                traps: Object.freeze(traps.map((entry) => Object.freeze(entry))),
                teleports: Object.freeze(teleports.map((entry) => Object.freeze(entry))),
                mobs: Object.freeze(mobs.map((entry) => Object.freeze(entry)))
            });
        });
    }

    /** 위치 기반 엔티티 배열을 정규화합니다. @private */
    #normalizeEntityList(value, label, width, height, extend = () => ({})) {
        if (!Array.isArray(value)) {
            throw new TypeError(`TutorialBattleModel: ${label}는 배열이어야 합니다.`);
        }
        const ids = new Set();
        return value.map((entry, index) => {
            const entryLabel = `${label}[${index}]`;
            if (!entry || typeof entry.id !== 'string' || entry.id.length === 0 || ids.has(entry.id)) {
                throw new TypeError(`TutorialBattleModel: ${entryLabel}.id가 없거나 중복되었습니다.`);
            }
            ids.add(entry.id);
            const position = this.#normalizePosition(entry, entryLabel);
            this.#requireInside(position, width, height, entryLabel);
            return { id: entry.id, ...position, ...extend(entry, entryLabel) };
        });
    }

    /** 높이 행렬을 검증합니다. @private */
    #normalizeHeights(value, width, height, floorIndex) {
        if (!Array.isArray(value) || value.length !== height) {
            throw new RangeError(`TutorialBattleModel: FLOORS[${floorIndex}].heights 행 수가 맞지 않습니다.`);
        }
        return value.map((row, y) => {
            if (!Array.isArray(row) || row.length !== width || row.some((heightValue) => !Number.isFinite(heightValue))) {
                throw new RangeError(`TutorialBattleModel: FLOORS[${floorIndex}].heights[${y}]가 올바르지 않습니다.`);
            }
            return [...row];
        });
    }

    /** 불안정 구간의 연속성과 피해 수치를 검증합니다. @private */
    #normalizeInstabilityStates(value, maxInstability) {
        if (!Array.isArray(value) || value.length === 0) {
            throw new TypeError('TutorialBattleModel: 불안정 상태 설정이 필요합니다.');
        }
        const ids = new Set();
        const states = value.map((state, index) => {
            const expectedMin = index === 0 ? 0 : value[index - 1].max + 1;
            if (!state
                || typeof state.id !== 'string'
                || ids.has(state.id)
                || typeof state.label !== 'string'
                || !Number.isFinite(state.min)
                || !Number.isFinite(state.max)
                || state.min !== expectedMin
                || state.max < state.min
                || !Number.isFinite(state.meleeDamage)
                || state.meleeDamage < 0
                || !Number.isFinite(state.areaDamage)
                || state.areaDamage < 0) {
                throw new TypeError(`TutorialBattleModel: 불안정 상태 ${index}가 올바르지 않습니다.`);
            }
            ids.add(state.id);
            return Object.freeze({ ...state });
        });
        if (states[states.length - 1].max !== maxInstability) {
            throw new RangeError('TutorialBattleModel: 불안정 상태가 최대치까지 이어져야 합니다.');
        }
        return Object.freeze(states);
    }

    /** 정수 좌표를 복제합니다. @private */
    #normalizePosition(value, label) {
        if (!value || !Number.isInteger(value.x) || !Number.isInteger(value.y)) {
            throw new TypeError(`TutorialBattleModel: ${label}는 정수 x/y 좌표여야 합니다.`);
        }
        return { x: value.x, y: value.y };
    }

    /** 좌표가 설정 맵 내부인지 검증합니다. @private */
    #requireInside(position, width, height, label) {
        if (position.x < 0 || position.x >= width || position.y < 0 || position.y >= height) {
            throw new RangeError(`TutorialBattleModel: ${label}가 맵 밖에 있습니다.`);
        }
    }

    /** 양의 정수를 요구합니다. @private */
    #requirePositiveInteger(value, label) {
        if (!Number.isInteger(value) || value <= 0) {
            throw new TypeError(`TutorialBattleModel: ${label}는 양의 정수여야 합니다.`);
        }
        return value;
    }

    /** 양의 유한수를 요구합니다. @private */
    #requirePositiveNumber(value, label) {
        if (!Number.isFinite(value) || value <= 0) {
            throw new TypeError(`TutorialBattleModel: ${label}는 양의 유한수여야 합니다.`);
        }
        return value;
    }

    /** 0 이상의 유한수를 요구합니다. @private */
    #requireNonNegativeNumber(value, label) {
        if (!Number.isFinite(value) || value < 0) {
            throw new TypeError(`TutorialBattleModel: ${label}는 0 이상의 유한수여야 합니다.`);
        }
        return value;
    }

    /** 0 이상 1 미만의 피해 감소율을 요구합니다. @private */
    #requireReduction(value, label) {
        if (!Number.isFinite(value) || value < 0 || value >= 1) {
            throw new TypeError(`TutorialBattleModel: ${label}는 0 이상 1 미만이어야 합니다.`);
        }
        return value;
    }
}
