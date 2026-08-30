import { TutorialCombatRules } from './_tutorial_combat_rules.js';
import { TutorialEffectExecutor } from './_tutorial_effect_executor.js';
import { TutorialLoraIntentPlanner } from './_tutorial_lora_intent_planner.js';
import { TutorialPlayerActionPreviewer } from './_tutorial_player_action_previewer.js';
import { TutorialRecordSpawnPlanner } from './_tutorial_record_spawn_planner.js';

const PLAYER_ID = 'player';
const LORA_ID = 'lora';
const DEFAULT_STARTER_ITEM_ID = 'mascot-costume';
const CHECKPOINT_KIND = 'TutorialBattleModelCheckpoint';
const CHECKPOINT_VERSION = 2;
const DIRECTIONS = Object.freeze([
    Object.freeze({ x: 0, y: -1 }),
    Object.freeze({ x: 1, y: 0 }),
    Object.freeze({ x: 0, y: 1 }),
    Object.freeze({ x: -1, y: 0 })
]);

/** ver 3.5 전투의 직접 경로 이동, 행동 충전, 적 행동과 두 층 상태를 관리합니다. */
export class TutorialBattleModel {
    #config;
    #configSignature;
    #effectExecutor;
    #combatRules;
    #loraIntentPlanner;
    #playerActionPreviewer;
    #recordSpawnPlanner;
    #knowledge;
    #loraTurnPerformed;

    /**
     * @param {object} config - `TUTORIAL_GAME_DATA` 형식의 전투 설정입니다.
     * @param {{knowledge?:object,random?:()=>number}} [options={}] - 발견 정보와 기록 배치 난수입니다.
     */
    constructor(config, options = {}) {
        this.#config = this.#normalizeConfig(config);
        this.#configSignature = this.#createConfigSignature();
        this.#recordSpawnPlanner = new TutorialRecordSpawnPlanner(this.#config.floors, { random: options.random });
        this.#effectExecutor = new TutorialEffectExecutor({
            items: this.#config.items,
            eventTileEffects: this.#config.eventTileEffects
        });
        this.#combatRules = new TutorialCombatRules({
            items: this.#config.items,
            player: this.#config.player,
            effectExecutor: this.#effectExecutor
        });
        this.#loraIntentPlanner = new TutorialLoraIntentPlanner({
            rules: this.#combatRules,
            lora: this.#config.lora
        });
        this.#playerActionPreviewer = new TutorialPlayerActionPreviewer({
            rules: this.#combatRules
        });
        this.#knowledge = this.#normalizeKnowledge(options.knowledge);
        this.#loraTurnPerformed = false;
        this.reset();
    }

    /**
     * 새 플레이를 초기화하고 선택한 스타터를 지급합니다.
     * @param {{starterItemId?:string}} [options={}] - 활 또는 인형탈 ID입니다.
     * @returns {object} 초기 스냅샷입니다.
     */
    reset({ starterItemId = DEFAULT_STARTER_ITEM_ID } = {}) {
        if (!this.#config.starterChoiceIds.has(starterItemId)) {
            throw new RangeError(`TutorialBattleModel: 지원하지 않는 시작 아이템 ${starterItemId}입니다.`);
        }

        const spawnedRecords = this.#recordSpawnPlanner.createFloorRecords(this.#knowledge.unlockedRecordIds);
        this.floorStates = this.#config.floors.map((floor, index) => ({
            index,
            id: floor.id,
            label: floor.label,
            width: this.#config.width,
            height: this.#config.height,
            playerStart: { ...floor.playerStart },
            loraStart: { ...floor.loraStart },
            heights: floor.heights.map((row) => [...row]),
            walls: floor.walls.map((wall) => ({ ...wall, destroyed: false })),
            items: floor.items.map((item) => ({ ...item, collected: false })),
            records: spawnedRecords[index].map((record) => ({ ...record, collected: false })),
            eventTiles: floor.eventTiles.map((eventTile) => ({
                ...eventTile,
                originalType: eventTile.type,
                cleansed: false,
                triggerCount: 0
            })),
            teleports: floor.teleports.map((teleport) => ({ ...teleport })),
            mobs: floor.mobs.map((mob) => ({
                ...mob,
                hp: mob.maxHp,
                maxHp: mob.maxHp,
                alive: true,
                dropped: false
            }))
        }));

        const firstFloor = this.floorStates[0];
        this.turn = 'player';
        this.phase = 'move';
        this.turnNumber = 1;
        this.round = 1;
        this.maxTurns = this.#config.maxTurns;
        this.maxRounds = this.maxTurns;
        this.floorIndex = 0;
        this.loraActionsCompleted = 0;
        this.playerTurnSerial = 1;
        this.extraPlayerTurns = 0;
        this.movementUsed = false;
        this.actionsUsed = 0;
        this.actionsPerTurn = 1;
        this.actionUsed = false;
        this.selectedAction = 'attack';
        this.consecutiveAttackCount = 0;

        this.player = {
            x: firstFloor.playerStart.x,
            y: firstFloor.playerStart.y,
            hp: this.#config.player.maxHp,
            maxHp: this.#config.player.maxHp,
            alive: true,
            mushroomActive: false
        };
        this.lora = {
            x: firstFloor.loraStart.x,
            y: firstFloor.loraStart.y,
            hp: this.#config.lora.maxHp,
            maxHp: this.#config.lora.maxHp,
            alive: true,
            instability: this.#config.lora.startInstability,
            maxInstability: this.#config.lora.maxInstability,
            peaceTurns: 0
        };

        this.inventory = new Map([[starterItemId, 1]]);
        this.usedItems = new Set();
        this.unlockedCutscenes = new Set();
        this.#knowledge.discoveredItemIds.add(starterItemId);
        this.#knowledge.identifiedItemIds.add(starterItemId);
        this.lastPlayerAction = null;
        this.lastLoraAction = null;
        this.lastEvents = [];
        this.result = null;
        this.#loraTurnPerformed = false;
        this.#beginPlayerTurn([], { initial: true });
        return this.getSnapshot();
    }

    /**
     * 좌표가 맵 내부인지 확인합니다.
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
     * 현재 층의 표시용 상태를 방어 복제합니다.
     * @returns {object} 현재 층 상태입니다.
     */
    getCurrentFloorState() {
        const floor = this.#getFloor();
        return this.#cloneValue({
            ...floor,
            items: floor.items.map((item) => ({
                ...item,
                identified: this.#knowledge.identifiedItemIds.has(item.itemId),
                nearbyHint: false
            })),
            eventTiles: floor.eventTiles.map((eventTile) => ({ ...eventTile }))
        });
    }

    /**
     * 현재 타일의 높이를 반환합니다.
     * @param {number} x - X 좌표입니다.
     * @param {number} y - Y 좌표입니다.
     * @returns {number|null} 높이 또는 맵 밖일 때 null입니다.
     */
    getTileHeight(x, y) {
        return this.isInside(x, y) ? this.#getFloor().heights[y][x] : null;
    }

    /**
     * 지정 타일을 점유한 주요 요소를 반환합니다.
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
        const mob = floor.mobs.find((entry) => entry.alive && this.#isSamePosition(entry, x, y));
        if (mob) {
            return { id: mob.id, type: 'mob', x, y, alive: true, hp: mob.hp };
        }
        const wall = floor.walls.find((entry) => !entry.destroyed && this.#isSamePosition(entry, x, y));
        if (wall) {
            return { id: wall.id, type: 'wall', x, y, destroyed: false };
        }
        const item = floor.items.find((entry) => !entry.collected && this.#isSamePosition(entry, x, y));
        if (item) {
            return { id: item.id, itemId: item.itemId, type: 'item', x, y };
        }
        const record = floor.records.find((entry) => (
            !entry.collected && this.#isSamePosition(entry, x, y)
        ));
        if (record) {
            return { id: record.id, recordId: record.recordId, type: 'record', x, y };
        }
        const teleport = floor.teleports.find((entry) => this.#isSamePosition(entry, x, y));
        if (teleport) {
            return { id: teleport.id, pairId: teleport.pairId, type: 'teleport', x, y };
        }
        const eventTile = floor.eventTiles.find((entry) => this.#isSamePosition(entry, x, y));
        return eventTile ? { ...eventTile, type: 'event-tile', effectType: eventTile.type } : null;
    }

    /**
     * 현재 이동 단계에서 도달 가능한 타일과 대표 경로를 계산합니다.
     * @returns {Map<string,object>} 좌표 키 기반 도달 가능 지도입니다.
     */
    getReachability() {
        const result = new Map();
        if (!this.#canPlanMovement()) {
            return result;
        }
        const start = [{ x: this.player.x, y: this.player.y }];
        const startPreview = this.previewPath(start);
        result.set(this.#toTileKey(this.player.x, this.player.y), {
            x: this.player.x,
            y: this.player.y,
            cost: 0,
            path: start,
            moveRange: startPreview.moveRange,
            remainingMoves: startPreview.remainingMoves
        });

        const queue = [start];
        const bestRemaining = new Map();
        bestRemaining.set(`${this.player.x},${this.player.y},${startPreview.hasPickaxe ? 1 : 0}`, startPreview.remainingMoves);
        for (let queueIndex = 0; queueIndex < queue.length; queueIndex++) {
            const path = queue[queueIndex];
            for (const direction of DIRECTIONS) {
                const nextPath = this.extendPath(path, direction.x, direction.y);
                if (!nextPath) {
                    continue;
                }
                const preview = this.previewPath(nextPath);
                if (!preview.ok) {
                    continue;
                }
                const endpoint = nextPath[nextPath.length - 1];
                const stateKey = `${endpoint.x},${endpoint.y},${preview.hasPickaxe ? 1 : 0}`;
                if ((bestRemaining.get(stateKey) ?? -1) >= preview.remainingMoves) {
                    continue;
                }
                bestRemaining.set(stateKey, preview.remainingMoves);
                const entry = {
                    x: endpoint.x,
                    y: endpoint.y,
                    cost: preview.stepsUsed,
                    path: nextPath.map((point) => ({ ...point })),
                    moveRange: preview.moveRange,
                    remainingMoves: preview.remainingMoves
                };
                result.set(this.#toTileKey(endpoint.x, endpoint.y), entry);
                const portalEntry = this.#getPortalEntryFromPath(nextPath);
                if (portalEntry) {
                    result.set(this.#toTileKey(portalEntry.x, portalEntry.y), {
                        ...entry,
                        x: portalEntry.x,
                        y: portalEntry.y
                    });
                }
                if (preview.remainingMoves > 0) {
                    queue.push(nextPath);
                }
            }
        }
        return result;
    }

    /**
     * 현재 위치에서 목적지까지 대표 경로를 반환합니다.
     * @param {number} x - 목적지 X입니다.
     * @param {number} y - 목적지 Y입니다.
     * @returns {Array<{x:number,y:number}>|null} 경로입니다.
     */
    getPathTo(x, y) {
        const entry = this.getReachability().get(this.#toTileKey(x, y));
        return entry ? entry.path.map((point) => ({ ...point })) : null;
    }

    /**
     * 사용자가 지정한 경로 끝에 방향 한 칸을 추가하고 포탈 출구를 자동 삽입합니다.
     * @param {Array<{x:number,y:number}>} path - 현재 계획 경로입니다.
     * @param {number} dx - X 방향입니다.
     * @param {number} dy - Y 방향입니다.
     * @returns {Array<{x:number,y:number}>|null} 유효한 확장 경로입니다.
     */
    extendPath(path, dx, dy) {
        if (!this.#canPlanMovement()
            || !Number.isInteger(dx)
            || !Number.isInteger(dy)
            || Math.abs(dx) + Math.abs(dy) !== 1) {
            return null;
        }
        const normalized = this.#expandTeleportPath(path);
        if (normalized.length === 0) {
            return null;
        }
        const endpoint = normalized[normalized.length - 1];
        const candidate = { x: endpoint.x + dx, y: endpoint.y + dy };
        if (!this.isInside(candidate.x, candidate.y)) {
            return null;
        }
        const expanded = this.#expandTeleportPath([...normalized, candidate]);
        return this.previewPath(expanded).ok ? expanded : null;
    }

    /**
     * 경로를 변경 없이 검증하고 현재 남은 이동력을 계산합니다.
     * @param {Array<{x:number,y:number}>} path - 시작점을 포함한 경로입니다.
     * @returns {object} 검증 결과입니다.
     */
    previewPath(path) {
        if (!this.#canPlanMovement()) {
            return this.#moveFailure('movement-unavailable');
        }
        const expanded = this.#expandTeleportPath(path);
        return this.#evaluatePath(expanded, { apply: false });
    }

    /**
     * 대표 경로를 찾아 목적지로 이동합니다.
     * @param {number} x - 목적지 X입니다.
     * @param {number} y - 목적지 Y입니다.
     * @returns {object} 이동 결과입니다.
     */
    commitMove(x, y) {
        const path = this.getPathTo(x, y);
        return path ? this.commitPath(path) : this.#moveFailure('unreachable-destination');
    }

    /**
     * 명시 경로를 검증하고 타일 효과를 순서대로 적용합니다.
     * @param {Array<{x:number,y:number}>} path - 시작점을 포함한 직접 지정 경로입니다.
     * @returns {object} 실제 이동 결과입니다.
     */
    commitPath(path) {
        if (!this.#canPlanMovement()) {
            return this.#moveFailure('movement-unavailable');
        }
        const expanded = this.#expandTeleportPath(path);
        const evaluated = this.#evaluatePath(expanded, { apply: true });
        if (!evaluated.ok) {
            return evaluated;
        }
        this.movementUsed = true;
        if (!this.result) {
            this.phase = 'action';
            this.actionsPerTurn = this.#getActionsPerTurn();
            this.#syncActionUsed();
        }
        this.#setLastEvents(evaluated.events);
        return {
            ...evaluated,
            action: 'move',
            path: evaluated.path.map((point) => ({ ...point })),
            events: this.#copyEvents(evaluated.events)
        };
    }

    /**
     * 표시용 행동 ID를 저장합니다.
     * @param {string} action - 행동 ID입니다.
     * @returns {boolean} 지원 여부입니다.
     */
    selectAction(action) {
        if (!['attack', 'heal', 'wait', 'use-item'].includes(action)) {
            return false;
        }
        this.selectedAction = action;
        return true;
    }

    /**
     * 지정 무기로 공격할 수 있는 로라와 몹을 반환합니다.
     * @param {{weapon?:'auto'|'melee'|'bow'}} [options={}] - 공격 방식입니다.
     * @returns {Array<object>} 대상 목록입니다.
     */
    getValidTargets(options = {}) {
        return this.#combatRules.getValidTargets(
            this.#createCombatPlanningState(),
            options
        );
    }

    /**
     * 로라 또는 몹 하나를 근접/원거리 공격합니다.
     * @param {string} [targetId=LORA_ID] - 대상 ID입니다.
     * @param {{weapon?:'auto'|'melee'|'bow'}} [options={}] - 공격 방식입니다.
     * @returns {object} 공격 결과입니다.
     */
    attack(targetId = LORA_ID, options = {}) {
        const plan = this.#combatRules.getPlayerAttackPlan(
            this.#createCombatPlanningState(),
            targetId,
            { ...options, mode: 'apply' }
        );
        if (!plan.ok) {
            return this.#actionFailure('attack', plan.reason);
        }

        const events = [];
        let appliedDamage = 0;
        let defeated = false;
        let instabilityChange = 0;
        if (plan.targetType === 'lora') {
            appliedDamage = plan.finalDamage;
            this.lora.hp = plan.targetHpAfter;
            this.lora.alive = this.lora.hp > 0;
            instabilityChange = this.#applyInstabilityCalculation(
                plan.instabilityCalculation,
                'player-attack',
                events
            );
            events.push(this.#createEvent('lora-damaged', {
                damage: appliedDamage,
                hp: this.lora.hp,
                weapon: plan.weapon
            }));
            defeated = !this.lora.alive;
        } else {
            const mob = this.#getFloor().mobs.find((candidate) => candidate.id === plan.targetId);
            const mobResult = this.#damageMob(
                mob,
                plan.calculatedDamage,
                'player-attack',
                events
            );
            appliedDamage = mobResult.damage;
            defeated = mobResult.defeated;
        }

        this.consecutiveAttackCount += 1;
        this.lastPlayerAction = {
            type: 'attack',
            targetId: plan.targetId,
            targetType: plan.targetType,
            weapon: plan.weapon,
            playerTurn: this.playerTurnSerial
        };
        this.#consumeAction(events);
        if (!this.lora.alive && !this.result) {
            this.#finishBattle('success', 'lora-neutralized', events);
        }
        this.#setLastEvents(events);
        return {
            ok: true,
            action: 'attack',
            targetId: plan.targetId,
            targetType: plan.targetType,
            weapon: plan.weapon,
            rawDamage: plan.rawDamage,
            calculatedDamage: plan.calculatedDamage,
            damage: appliedDamage,
            defeated,
            instabilityChange,
            result: this.#copyResult(),
            events: this.#copyEvents(events)
        };
    }

    /**
     * 행동 하나를 소비해 플레이어 HP를 20 회복합니다.
     * @returns {object} 회복 결과입니다.
     */
    heal() {
        const plan = this.#combatRules.getHealPlan(this.#createCombatPlanningState());
        if (!plan.ok) {
            return this.#actionFailure('heal', plan.reason);
        }
        const events = [];
        this.player.hp = plan.playerHpAfter;
        this.player.alive = this.player.hp > 0;
        events.push(this.#createEvent('player-healed', {
            amount: plan.amount,
            hp: this.player.hp,
            source: 'player-heal'
        }));
        this.consecutiveAttackCount = 0;
        this.lastPlayerAction = { type: 'heal', playerTurn: this.playerTurnSerial };
        this.#consumeAction(events);
        this.#setLastEvents(events);
        return {
            ok: true,
            action: 'heal',
            amount: plan.amount,
            events: this.#copyEvents(events)
        };
    }

    /**
     * 남은 행동을 모두 포기하고 적 행동 단계로 진행합니다.
     * @returns {object} 대기 결과입니다.
     */
    wait() {
        const plan = this.#combatRules.getWaitPlan(this.#createCombatPlanningState());
        if (!plan.ok) {
            return this.#actionFailure('wait', plan.reason);
        }
        const events = [this.#createEvent('player-waited')];
        this.consecutiveAttackCount = 0;
        this.lastPlayerAction = { type: 'wait', playerTurn: this.playerTurnSerial };
        this.actionsUsed = this.actionsPerTurn;
        this.#syncActionUsed();
        this.#completePlayerTurn(events);
        this.#setLastEvents(events);
        return { ok: true, action: 'wait', events: this.#copyEvents(events) };
    }

    /**
     * 행동 단계에서 보유 아이템 하나를 사용합니다.
     * @param {string} itemId - 아이템 ID입니다.
     * @returns {object} 사용 결과입니다.
     */
    useItem(itemId) {
        const plan = this.#combatRules.getItemUsePlan(
            this.#createCombatPlanningState(),
            itemId,
            { mode: 'apply' }
        );
        if (!plan.ok) {
            return this.#actionFailure('use-item', plan.reason, { itemId });
        }

        const item = this.#config.items[itemId];
        const events = [];
        if (plan.instabilityCalculation) {
            this.#applyInstabilityCalculation(
                plan.instabilityCalculation,
                plan.effectType,
                events
            );
        }
        if (plan.peaceTurnsAfter !== null) {
            this.lora.peaceTurns = plan.peaceTurnsAfter;
            events.push(this.#createEvent('peace', {
                active: true,
                remainingTurns: this.lora.peaceTurns
            }));
        }
        if (plan.extraPlayerTurnsAdded > 0) {
            this.extraPlayerTurns += plan.extraPlayerTurnsAdded;
            events.push(this.#createEvent('extra-player-turn', {
                pending: this.extraPlayerTurns
            }));
        }
        if (plan.mushroomActiveAfter !== null) {
            this.player.mushroomActive = plan.mushroomActiveAfter;
            events.push(this.#createEvent('mushroom-activated'));
        }

        this.usedItems.add(itemId);
        this.#knowledge.discoveredItemIds.add(itemId);
        this.#knowledge.identifiedItemIds.add(itemId);
        if (plan.consumeCount > 0) {
            this.#removeInventory(itemId, plan.consumeCount);
        }
        events.unshift(this.#createEvent('item-used', { itemId, label: item.label }));
        this.consecutiveAttackCount = 0;
        this.lastPlayerAction = { type: 'use-item', itemId, playerTurn: this.playerTurnSerial };
        this.#consumeAction(events);
        this.#setLastEvents(events);
        return {
            ok: true,
            action: 'use-item',
            itemId,
            effects: this.#cloneValue(plan.effects),
            events: this.#copyEvents(events)
        };
    }

    /**
     * 현재 이동 단계에서 정화 가능한 negative 이벤트 타일을 반환합니다.
     * @returns {Array<object>} 정화 대상 목록입니다.
     */
    getCleanseTargets() {
        if (!this.#canPlanMovement() || !this.#hasItem('tile-cleanser')) {
            return [];
        }
        return this.#getFloor().eventTiles
            .filter((eventTile) => this.#combatRules.isNegativeEventTile(eventTile.type))
            .map((eventTile) => ({ ...eventTile }));
    }

    /**
     * 이동 행동을 소비하지 않고 지정 negative 이벤트 타일을 positive 타일로 바꿉니다.
     * @param {string|{id?:string,x?:number,y?:number}} target - 이벤트 타일 ID 또는 좌표입니다.
     * @returns {object} 정화 결과입니다.
     */
    cleanseEventTile(target) {
        if (!this.#canPlanMovement()) {
            return this.#actionFailure('cleanse-event-tile', 'movement-unavailable');
        }
        if (!this.#hasItem('tile-cleanser')) {
            return this.#actionFailure('cleanse-event-tile', 'item-not-owned', {
                itemId: 'tile-cleanser'
            });
        }
        const id = typeof target === 'string' ? target : target?.id;
        const eventTile = this.#getFloor().eventTiles.find((candidate) => (
            (id && candidate.id === id)
            || (Number.isInteger(target?.x)
                && Number.isInteger(target?.y)
                && this.#isSamePosition(candidate, target.x, target.y))
        ));
        const plan = this.#combatRules.getMovementItemUsePlan(
            this.#createCombatPlanningState(),
            'tile-cleanser',
            eventTile,
            { mode: 'apply' }
        );
        if (!plan.ok) {
            return this.#actionFailure('cleanse-event-tile', plan.reason, {
                itemId: 'tile-cleanser'
            });
        }
        const beforeType = plan.eventTileTypeBefore;
        eventTile.type = plan.eventTileTypeAfter;
        eventTile.cleansed = true;
        this.#removeInventory(plan.itemId, plan.consumeCount);
        this.usedItems.add(plan.itemId);
        this.#knowledge.discoveredItemIds.add(plan.itemId);
        this.#knowledge.identifiedItemIds.add(plan.itemId);
        const events = [
            this.#createEvent('item-used', {
                itemId: plan.itemId,
                label: this.#config.items[plan.itemId].label
            }),
            this.#createEvent('event-tile-cleansed', {
                eventTileId: eventTile.id,
                x: eventTile.x,
                y: eventTile.y,
                beforeType,
                afterType: eventTile.type
            })
        ];
        this.#setLastEvents(events);
        return {
            ok: true,
            action: 'cleanse-event-tile',
            eventTileId: eventTile.id,
            events: this.#copyEvents(events)
        };
    }

    /**
     * 호환 호출부에서 남은 자원을 포기할 때 대기 행동으로 처리합니다.
     * @returns {object} 턴 종료 결과입니다.
     */
    endPlayerTurn() {
        return this.wait();
    }

    /** 기존 호출부용 별칭입니다. @returns {object} 대기 결과입니다. */
    endTurn() {
        return this.endPlayerTurn();
    }

    /**
     * 현재 불안정도에 해당하는 로라 상태를 반환합니다.
     * @param {number} [value=this.lora.instability] - 판정할 수치입니다.
     * @returns {object} 불안정 상태입니다.
     */
    getInstabilityState(value = this.lora.instability) {
        const normalized = this.#clamp(Number(value), 0, this.#config.lora.maxInstability);
        return this.#cloneValue(this.#config.lora.instabilityStates.find((state) => (
            normalized >= state.min && normalized <= state.max
        )));
    }

    /**
     * 다음 로라 행동과 예상 피해를 모델 상태 변경 없이 반환합니다.
     * @param {{allowForecast?:boolean}} [options={}] - 플레이어 턴 현재 상태 기준 예고 허용 여부입니다.
     * @returns {object} 상태·대상·피해·reason ID를 가진 의도입니다.
     */
    getLoraIntent(options = {}) {
        return this.#cloneValue(this.#loraIntentPlanner.getIntent(
            this.#createCombatPlanningState(),
            { allowForecast: options.allowForecast === true }
        ));
    }

    /**
     * 플레이어 행동 하나의 최종 예상 상태를 모델 상태 변경 없이 반환합니다.
     * @param {'attack'|'heal'|'use-item'|'wait'} action - 행동 ID입니다.
     * @param {object} [options={}] - targetId, weapon 또는 itemId입니다.
     * @returns {object} 검증 reason과 예상 변경입니다.
     */
    previewPlayerAction(action, options = {}) {
        return this.#cloneValue(this.#playerActionPreviewer.preview(
            this.#createCombatPlanningState(),
            action,
            options
        ));
    }

    /**
     * 현재 가능한 공격·회복·아이템·대기 미리보기를 한 번에 반환합니다.
     * @returns {object} 행동 종류별 미리보기입니다.
     */
    getPlayerActionPreviews() {
        return this.#cloneValue(this.#playerActionPreviewer.getAll(
            this.#createCombatPlanningState()
        ));
    }

    /**
     * 로라 턴 시작 패시브와 불안정 단계별 행동을 한 번 수행합니다.
     * @returns {object} 로라 행동 결과입니다.
     */
    performLoraTurn() {
        const intent = this.#loraIntentPlanner.getIntent(this.#createCombatPlanningState());
        if (!intent.ok) {
            return this.#actionFailure('none', intent.reason);
        }
        this.#loraTurnPerformed = true;
        const events = [];

        for (const calculation of intent.passiveChanges) {
            this.#applyInstabilityCalculation(calculation, calculation.source, events);
        }
        if (intent.executionAction === 'peace') {
            const instabilityChange = intent.passiveChanges.find(
                ({ source }) => source === 'music-box'
            )?.change ?? 0;
            events.push(this.#createEvent('peace', {
                active: true,
                remainingTurns: this.lora.peaceTurns
            }));
            this.lastLoraAction = { type: 'peace', loraAction: this.loraActionsCompleted + 1 };
            this.#setLastEvents(events);
            return {
                ok: true,
                action: 'peace',
                damage: 0,
                instabilityChange,
                events: this.#copyEvents(events)
            };
        }

        const state = this.getInstabilityState(intent.expectedInstability);
        if (intent.executionAction === 'idle') {
            this.lastLoraAction = {
                type: 'idle',
                stateId: intent.stateId,
                loraAction: this.loraActionsCompleted + 1
            };
            events.push(this.#createEvent('lora-attack', {
                action: 'idle',
                damage: 0,
                stateId: intent.stateId
            }));
            this.#setLastEvents(events);
            return { ok: true, action: 'idle', damage: 0, state, events: this.#copyEvents(events) };
        }

        const action = intent.executionAction;
        const playerDamage = this.#applyPlayerDamageCalculation(
            intent.damageCalculation,
            `lora-${action}`,
            events
        );
        this.lastLoraAction = {
            type: action,
            stateId: intent.stateId,
            loraAction: this.loraActionsCompleted + 1
        };
        events.unshift(this.#createEvent('lora-attack', {
            action,
            damage: playerDamage,
            stateId: intent.stateId
        }));
        if (!this.player.alive) {
            this.loraActionsCompleted += 1;
            this.turnNumber = Math.min(this.maxTurns, this.loraActionsCompleted + 1);
            this.round = this.turnNumber;
            this.#finishBattle('failure', 'player-defeated', events, {
                defeatedBy: LORA_ID
            });
        }
        this.#setLastEvents(events);
        return {
            ok: true,
            action,
            damage: playerDamage,
            state,
            defeated: !this.player.alive,
            result: this.#copyResult(),
            events: this.#copyEvents(events)
        };
    }

    /**
     * 로라 행동 뒤 몹 공격, 횟수 제한, 층 전환과 다음 플레이어 턴을 처리합니다.
     * @returns {object} 적 단계 완료 결과입니다.
     */
    completeLoraTurn() {
        if (this.turn !== 'lora' || this.phase !== 'lora') {
            return this.#actionFailure('complete-lora-turn', 'not-lora-turn');
        }
        let events = [];
        if (!this.#loraTurnPerformed) {
            const performed = this.performLoraTurn();
            events = this.#copyEvents(performed.events);
        }
        if (this.result) {
            return {
                ok: true,
                action: 'complete-lora-turn',
                result: this.#copyResult(),
                events
            };
        }

        const mobAttacks = this.#performMobTurns(events);
        this.loraActionsCompleted += 1;
        this.turnNumber = Math.min(this.maxTurns, this.loraActionsCompleted + 1);
        this.round = this.turnNumber;
        if (this.lora.peaceTurns > 0) {
            this.lora.peaceTurns -= 1;
        }
        if (!this.player.alive && !this.result) {
            this.#finishBattle('failure', 'player-defeated', events, {
                defeatedBy: 'mob'
            });
        }
        if (this.result) {
            this.#setLastEvents(events);
            return {
                ok: true,
                action: 'complete-lora-turn',
                mobAttacks,
                result: this.#copyResult(),
                events: this.#copyEvents(events)
            };
        }

        let floorTransitioned = false;
        if (this.loraActionsCompleted === this.#config.floorTransitionAfterTurn && this.floorIndex === 0) {
            floorTransitioned = this.#transitionToFloor(1, events);
        }
        if (this.loraActionsCompleted >= this.maxTurns) {
            this.#finishBattle('failure', 'turn-limit', events);
            this.#setLastEvents(events);
            return {
                ok: true,
                action: 'complete-lora-turn',
                floorTransitioned,
                mobAttacks,
                result: this.#copyResult(),
                events: this.#copyEvents(events)
            };
        }

        this.#beginPlayerTurn(events);
        this.#setLastEvents(events);
        return {
            ok: true,
            action: 'complete-lora-turn',
            floorTransitioned,
            mobAttacks,
            turnNumber: this.turnNumber,
            loraActionsCompleted: this.loraActionsCompleted,
            events: this.#copyEvents(events)
        };
    }

    /**
     * 테스트·저장·디버그용 전투 체크포인트를 생성합니다.
     * @returns {object} 독립 체크포인트입니다.
     */
    createCheckpoint() {
        return {
            kind: CHECKPOINT_KIND,
            version: CHECKPOINT_VERSION,
            configSignature: this.#configSignature,
            state: this.#cloneValue({
                floorStates: this.floorStates,
                turn: this.turn,
                phase: this.phase,
                turnNumber: this.turnNumber,
                round: this.round,
                maxTurns: this.maxTurns,
                maxRounds: this.maxRounds,
                floorIndex: this.floorIndex,
                loraActionsCompleted: this.loraActionsCompleted,
                playerTurnSerial: this.playerTurnSerial,
                extraPlayerTurns: this.extraPlayerTurns,
                movementUsed: this.movementUsed,
                actionsUsed: this.actionsUsed,
                actionsPerTurn: this.actionsPerTurn,
                actionUsed: this.actionUsed,
                selectedAction: this.selectedAction,
                consecutiveAttackCount: this.consecutiveAttackCount,
                player: this.player,
                lora: this.lora,
                inventory: this.inventory,
                usedItems: this.usedItems,
                unlockedCutscenes: this.unlockedCutscenes,
                lastPlayerAction: this.lastPlayerAction,
                lastLoraAction: this.lastLoraAction,
                lastEvents: this.lastEvents,
                result: this.result,
                loraTurnPerformed: this.#loraTurnPerformed,
                knowledge: this.#knowledge
            })
        };
    }

    /**
     * 호환되는 v2 체크포인트를 복원합니다.
     * @param {object} checkpoint - 복원할 체크포인트입니다.
     * @returns {object} 복원 후 스냅샷입니다.
     */
    restoreCheckpoint(checkpoint) {
        const cloned = this.#cloneValue(checkpoint);
        if (!cloned
            || cloned.kind !== CHECKPOINT_KIND
            || cloned.version !== CHECKPOINT_VERSION
            || cloned.configSignature !== this.#configSignature
            || !this.#isPlainRecord(cloned.state)) {
            throw new TypeError('TutorialBattleModel: 호환되지 않는 체크포인트입니다.');
        }
        const state = cloned.state;
        this.#validateRestoredState(state);
        this.floorStates = state.floorStates;
        this.turn = state.turn;
        this.phase = state.phase;
        this.turnNumber = state.turnNumber;
        this.round = state.round;
        this.maxTurns = state.maxTurns;
        this.maxRounds = state.maxRounds;
        this.floorIndex = state.floorIndex;
        this.loraActionsCompleted = state.loraActionsCompleted;
        this.playerTurnSerial = state.playerTurnSerial;
        this.extraPlayerTurns = state.extraPlayerTurns;
        this.movementUsed = state.movementUsed;
        this.actionsUsed = state.actionsUsed;
        this.actionsPerTurn = state.actionsPerTurn;
        this.actionUsed = state.actionUsed;
        this.selectedAction = state.selectedAction;
        this.consecutiveAttackCount = state.consecutiveAttackCount;
        this.player = state.player;
        this.lora = state.lora;
        this.inventory = state.inventory;
        this.usedItems = state.usedItems;
        this.unlockedCutscenes = state.unlockedCutscenes;
        this.lastPlayerAction = state.lastPlayerAction;
        this.lastLoraAction = state.lastLoraAction;
        this.lastEvents = state.lastEvents;
        this.result = state.result;
        this.#loraTurnPerformed = state.loraTurnPerformed;
        this.#knowledge = state.knowledge;
        return this.getSnapshot();
    }

    /**
     * 외부 표시와 테스트에 사용할 전체 상태를 반환합니다.
     * @returns {object} 방어 복제된 스냅샷입니다.
     */
    getSnapshot() {
        return this.#cloneValue({
            turn: this.turn,
            phase: this.phase,
            turnNumber: this.turnNumber,
            maxTurns: this.maxTurns,
            floorIndex: this.floorIndex,
            loraActionsCompleted: this.loraActionsCompleted,
            playerTurnSerial: this.playerTurnSerial,
            extraPlayerTurns: this.extraPlayerTurns,
            movementUsed: this.movementUsed,
            actionsUsed: this.actionsUsed,
            actionsPerTurn: this.actionsPerTurn,
            actionsRemaining: Math.max(0, this.actionsPerTurn - this.actionsUsed),
            actionUsed: this.actionUsed,
            consecutiveAttackCount: this.consecutiveAttackCount,
            player: this.player,
            lora: this.lora,
            inventory: [...this.inventory.entries()].map(([itemId, count]) => ({ itemId, count })),
            floor: this.getCurrentFloorState(),
            lastPlayerAction: this.lastPlayerAction,
            lastLoraAction: this.lastLoraAction,
            usedItems: [...this.usedItems],
            unlockedCutscenes: [],
            knowledge: {
                discoveredItemIds: [...this.#knowledge.discoveredItemIds],
                identifiedItemIds: [...this.#knowledge.identifiedItemIds],
                unlockedRecordIds: [...this.#knowledge.unlockedRecordIds],
                revealedTrapIds: [],
                unlockedCutsceneIds: []
            },
            result: this.result,
            lastEvents: this.lastEvents
        });
    }

    /** @returns {object} 순수 전투 계산기에 전달할 읽기 전용 값 스냅샷입니다. @private */
    #createCombatPlanningState() {
        return {
            turn: this.turn,
            phase: this.phase,
            result: this.result,
            movementUsed: this.movementUsed,
            actionsUsed: this.actionsUsed,
            actionsPerTurn: this.actionsPerTurn,
            extraPlayerTurns: this.extraPlayerTurns,
            playerTurnSerial: this.playerTurnSerial,
            consecutiveAttackCount: this.consecutiveAttackCount,
            loraTurnPerformed: this.#loraTurnPerformed,
            player: { ...this.player },
            lora: { ...this.lora },
            inventory: [...this.inventory.entries()].map(([itemId, count]) => ({
                itemId,
                count
            })),
            usedItems: [...this.usedItems],
            mobs: this.#getFloor().mobs.map((mob) => ({ ...mob }))
        };
    }

    /** 현재 층을 반환합니다. @private */
    #getFloor() {
        return this.floorStates[this.floorIndex];
    }

    /** 이동 계획 단계인지 확인합니다. @private */
    #canPlanMovement() {
        return this.turn === 'player'
            && this.phase === 'move'
            && !this.movementUsed
            && !this.result
            && this.player.alive;
    }

    /** 행동 사용 수와 구형 boolean 표시를 동기화합니다. @private */
    #syncActionUsed() {
        this.actionUsed = this.actionsUsed >= this.actionsPerTurn;
    }

    /** 보유 패시브 기준 행동 충전량을 반환합니다. @private */
    #getActionsPerTurn() {
        return this.#combatRules.getActionsPerTurn(this.#createCombatPlanningState());
    }

    /** 현재 이동 범위를 반환합니다. @private */
    #getMoveRange() {
        return this.#combatRules.getMoveRange(
            this.#createCombatPlanningState(),
            this.#config.player.moveRange
        );
    }

    /** 행동 하나를 소비하고 필요하면 플레이어 턴을 닫습니다. @private */
    #consumeAction(events) {
        this.actionsUsed += 1;
        this.#syncActionUsed();
        if (this.actionsUsed >= this.actionsPerTurn && !this.result) {
            this.#completePlayerTurn(events);
        }
    }

    /** 플레이어 턴 종료 패시브와 추가 턴/로라 턴 분기를 처리합니다. @private */
    #completePlayerTurn(events) {
        const turnEndPlan = this.#combatRules.getPlayerTurnEndPlan(
            this.#createCombatPlanningState(),
            { mode: 'apply' }
        );
        for (const calculation of turnEndPlan.instabilityCalculations) {
            this.#applyInstabilityCalculation(
                calculation,
                calculation.source,
                events
            );
        }
        events.push(this.#createEvent('player-turn-complete', {
            playerTurn: this.playerTurnSerial
        }));
        if (this.extraPlayerTurns > 0) {
            this.extraPlayerTurns -= 1;
            this.#beginPlayerTurn(events, { bonus: true });
            return;
        }
        this.turn = 'lora';
        this.phase = 'lora';
        this.#loraTurnPerformed = false;
    }

    /** 새 플레이어 턴의 이동·행동 자원을 초기화합니다. @private */
    #beginPlayerTurn(events, { initial = false, bonus = false } = {}) {
        if (!initial) {
            this.playerTurnSerial += 1;
        }
        this.turn = 'player';
        this.phase = 'move';
        this.movementUsed = false;
        this.actionsUsed = 0;
        this.actionsPerTurn = this.#getActionsPerTurn();
        this.#syncActionUsed();
        this.selectedAction = 'attack';
        this.#loraTurnPerformed = false;
        if (!initial) {
            events.push(this.#createEvent('player-turn-started', {
                playerTurn: this.playerTurnSerial,
                bonus,
                actionsPerTurn: this.actionsPerTurn
            }));
        }
    }

    /** 경로의 텔레포트 진입 뒤 빠진 출구 좌표를 삽입합니다. @private */
    #expandTeleportPath(path) {
        if (!Array.isArray(path) || path.length === 0) {
            return [];
        }
        const source = path.map((point) => this.#normalizePositionOrNull(point));
        if (source.some((point) => !point)) {
            return [];
        }
        const expanded = [{ ...source[0] }];
        for (let index = 1; index < source.length; index++) {
            const point = source[index];
            const previous = expanded[expanded.length - 1];
            expanded.push({ ...point });
            if (this.#distance(previous, point) !== 1) {
                continue;
            }
            const teleport = this.#findTeleportAt(point.x, point.y);
            const destination = teleport ? this.#findTeleportPair(teleport) : null;
            if (!destination) {
                continue;
            }
            const nextSource = source[index + 1];
            if (!nextSource || !this.#isSamePosition(nextSource, destination.x, destination.y)) {
                expanded.push({ x: destination.x, y: destination.y });
            }
        }
        return expanded;
    }

    /** 경로를 순회해 이동 예산을 검증하고 선택적으로 모델에 적용합니다. @private */
    #evaluatePath(path, { apply }) {
        if (!Array.isArray(path) || path.length === 0) {
            return this.#moveFailure('invalid-path');
        }
        if (!this.#isSamePosition(path[0], this.player.x, this.player.y)) {
            return this.#moveFailure('path-start-mismatch');
        }
        const moveRange = this.#getMoveRange();
        let remainingMoves = moveRange;
        let stepsUsed = 0;
        let hasPickaxe = this.#combatRules.canTraverseWalls(
            this.#createCombatPlanningState()
        );
        let current = { x: this.player.x, y: this.player.y };
        const events = [];
        const actualPath = [{ ...current }];

        for (let index = 1; index < path.length; index++) {
            const point = path[index];
            if (!this.isInside(point.x, point.y)) {
                return this.#moveFailure('invalid-path');
            }
            const distance = this.#distance(current, point);
            if (distance === 1) {
                if (remainingMoves <= 0) {
                    return this.#moveFailure('path-cost-exceeded');
                }
                const blocker = this.#getMovementBlocker(point.x, point.y);
                if (blocker?.type === 'lora' || blocker?.type === 'mob') {
                    return this.#moveFailure(`blocked-by-${blocker.type}`);
                }
                if (blocker?.type === 'wall' && !hasPickaxe) {
                    return this.#moveFailure('blocked-by-wall');
                }
                remainingMoves -= 1;
                stepsUsed += 1;
                current = { ...point };
                actualPath.push({ ...current });

                const item = this.#findItemAt(point.x, point.y);
                if (item && this.#combatRules.grantsWallTraversal(item.itemId)) {
                    hasPickaxe = true;
                }
                const eventTile = this.#findEventTileAt(point.x, point.y);
                if (eventTile) {
                    remainingMoves = this.#combatRules.getEventTilePlan(
                        this.#createCombatPlanningState(),
                        eventTile.type,
                        { remainingMoves, mode: apply ? 'apply' : 'preview' }
                    ).remainingMovesAfter;
                }
                if (apply) {
                    this.player.x = point.x;
                    this.player.y = point.y;
                    events.push(this.#createEvent('movement-step', {
                        x: point.x,
                        y: point.y,
                        step: stepsUsed,
                        remainingMoves
                    }));
                    if (blocker?.type === 'wall') {
                        events.push(this.#createEvent('wall-traversed', {
                            wallId: blocker.id,
                            itemId: this.#getWallTraversalItemId(),
                            x: point.x,
                            y: point.y
                        }));
                    }
                    this.#processTileEntry(events);
                    if (this.result) {
                        break;
                    }
                }
                continue;
            }

            const sourcePortal = this.#findTeleportAt(current.x, current.y);
            const destination = sourcePortal ? this.#findTeleportPair(sourcePortal) : null;
            if (!destination || !this.#isSamePosition(destination, point.x, point.y)) {
                return this.#moveFailure('invalid-path-step');
            }
            const from = { ...current };
            current = { ...point };
            actualPath.push({ ...current });
            if (apply) {
                this.player.x = point.x;
                this.player.y = point.y;
                events.push(this.#createEvent('teleported', {
                    teleportId: sourcePortal.id,
                    pairId: sourcePortal.pairId,
                    from,
                    to: { ...current },
                    remainingMoves
                }));
            }
        }

        return {
            ok: true,
            action: 'move',
            path: actualPath,
            cost: stepsUsed,
            stepsUsed,
            moveRange,
            remainingMoves,
            hasPickaxe,
            interrupted: Boolean(this.result),
            events
        };
    }

    /** 타일의 아이템·기록과 이벤트 효과를 적용합니다. @private */
    #processTileEntry(events) {
        const item = this.#findItemAt(this.player.x, this.player.y);
        if (item) {
            this.#pickupFloorItem(item, events);
        }
        const record = this.#findRecordAt(this.player.x, this.player.y);
        if (record) {
            this.#pickupFloorRecord(record, events);
        }
        const eventTile = this.#findEventTileAt(this.player.x, this.player.y);
        if (eventTile) {
            this.#triggerEventTile(eventTile, events);
        }
    }

    /** 이벤트 타일 효과를 적용합니다. @private */
    #triggerEventTile(eventTile, events) {
        eventTile.triggerCount += 1;
        events.push(this.#createEvent('event-tile-triggered', {
            eventTileId: eventTile.id,
            eventType: eventTile.type,
            x: eventTile.x,
            y: eventTile.y,
            triggerCount: eventTile.triggerCount
        }));
        const plan = this.#combatRules.getEventTilePlan(
            this.#createCombatPlanningState(),
            eventTile.type,
            { mode: 'apply' }
        );
        for (const operation of plan.effectExecution.operations) {
            if (operation.damageCalculation) {
                this.#applyPlayerDamageCalculation(
                    operation.damageCalculation,
                    operation.source,
                    events
                );
            }
            if (operation.instabilityCalculation) {
                this.#applyInstabilityCalculation(
                    operation.instabilityCalculation,
                    operation.source,
                    events
                );
            }
        }
        if (!this.player.alive && !this.result) {
            this.#finishBattle('failure', 'player-defeated', events, {
                defeatedBy: 'event-tile'
            });
        }
    }

    /** 바닥 아이템을 자동 획득합니다. @private */
    #pickupFloorItem(item, events) {
        item.collected = true;
        this.#addInventory(item.itemId, 1);
        this.#knowledge.discoveredItemIds.add(item.itemId);
        if (this.#combatRules.isPassiveItem(item.itemId)) {
            this.#knowledge.identifiedItemIds.add(item.itemId);
        }
        events.push(this.#createEvent('item-picked', {
            instanceId: item.id,
            itemId: item.itemId,
            label: this.#config.items[item.itemId]?.label ?? item.itemId,
            x: item.x,
            y: item.y
        }));
    }

    /** 바닥 기록을 영구 해금 지식에 추가합니다. @private */
    #pickupFloorRecord(record, events) {
        record.collected = true;
        this.#knowledge.unlockedRecordIds.add(record.recordId);
        events.push(this.#createEvent('record-picked', {
            instanceId: record.id,
            recordId: record.recordId,
            x: record.x,
            y: record.y
        }));
    }

    /** 살아있는 몹의 사거리 내 공격을 순서대로 적용합니다. @private */
    #performMobTurns(events) {
        const attacks = [];
        const peaceActive = this.lora.peaceTurns > 0;
        for (const mob of this.#getFloor().mobs) {
            if (!mob.alive) {
                continue;
            }
            const inRange = this.#distance(mob, this.player) <= this.#config.mob.attackRange;
            if (peaceActive || !inRange) {
                events.push(this.#createEvent('mob-waited', {
                    mobId: mob.id,
                    reason: peaceActive ? 'peace-active' : 'out-of-range'
                }));
                continue;
            }
            const damage = this.#damagePlayer(this.#config.mob.attackDamage, 'mob-attack', events);
            attacks.push({ mobId: mob.id, damage });
            events.push(this.#createEvent('mob-attack', {
                mobId: mob.id,
                damage,
                x: mob.x,
                y: mob.y
            }));
            if (!this.player.alive) {
                break;
            }
        }
        return attacks;
    }

    /** 지하층으로 낙하하며 같은 좌표의 오브젝트와 이벤트를 처리합니다. @private */
    #transitionToFloor(index, events) {
        const target = this.floorStates[index];
        if (!target) {
            return false;
        }
        const landing = { x: this.player.x, y: this.player.y };
        this.floorIndex = index;
        this.lora.x = target.loraStart.x;
        this.lora.y = target.loraStart.y;
        this.player.x = landing.x;
        this.player.y = landing.y;

        const wall = this.#findWallAt(landing.x, landing.y);
        if (wall) {
            wall.destroyed = true;
            events.push(this.#createEvent('wall-destroyed', {
                wallId: wall.id,
                x: wall.x,
                y: wall.y,
                source: 'floor-transition'
            }));
        }
        const mob = this.#findMobAt(landing.x, landing.y);
        if (mob) {
            this.#damageMob(mob, mob.hp, 'floor-transition', events);
        }
        this.#processTileEntry(events);
        events.push(this.#createEvent('floor-transition', {
            floorIndex: index,
            floorId: target.id,
            player: { ...landing },
            lora: { x: this.lora.x, y: this.lora.y }
        }));
        return true;
    }

    /** 플레이어에게 고정 감산 패시브를 반영한 피해를 적용합니다. @private */
    #damagePlayer(baseDamage, source, events) {
        const calculation = this.#combatRules.calculatePlayerDamage(
            this.#createCombatPlanningState(),
            baseDamage,
            { mode: 'apply' }
        );
        return this.#applyPlayerDamageCalculation(calculation, source, events);
    }

    /** 계산된 플레이어 피해를 상태와 이벤트에 적용합니다. @private */
    #applyPlayerDamageCalculation(calculation, source, events) {
        const applied = Math.max(0, Number(calculation?.finalDamage) || 0);
        this.player.hp = Math.max(0, Number(calculation?.playerHpAfter) || 0);
        this.player.alive = this.player.hp > 0;
        if (calculation?.mushroomEnds === true) {
            this.player.mushroomActive = false;
            events.push(this.#createEvent('mushroom-ended', { source }));
        }
        events.push(this.#createEvent('player-damaged', {
            amount: applied,
            hp: this.player.hp,
            reduction: Math.max(0, Number(calculation?.reduction) || 0),
            source
        }));
        return applied;
    }

    /** 몹에게 피해를 적용하고 사망 시 정화제를 드롭합니다. @private */
    #damageMob(mob, damage, source, events) {
        if (!mob || !mob.alive) {
            return { damage: 0, defeated: false };
        }
        const applied = Math.min(mob.hp, Math.max(0, Math.round(damage)));
        mob.hp = Math.max(0, mob.hp - applied);
        mob.alive = mob.hp > 0;
        events.push(this.#createEvent('mob-damaged', {
            mobId: mob.id,
            damage: applied,
            hp: mob.hp,
            x: mob.x,
            y: mob.y,
            source
        }));
        if (!mob.alive) {
            events.push(this.#createEvent('mob-defeated', {
                mobId: mob.id,
                x: mob.x,
                y: mob.y,
                source
            }));
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

    /** 로라 불안정도를 변경하고 오카리나의 증가 무효화를 적용합니다. @private */
    #changeInstability(amount, source, events) {
        const calculation = this.#combatRules.calculateInstabilityChange(
            this.#createCombatPlanningState(),
            {
                instability: this.lora.instability,
                maxInstability: this.lora.maxInstability,
                requestedChange: amount
            },
            { mode: 'apply' }
        );
        return this.#applyInstabilityCalculation(calculation, source, events);
    }

    /** 계산된 불안정도 변경을 상태와 이벤트에 적용합니다. @private */
    #applyInstabilityCalculation(calculation, source, events) {
        this.lora.instability = calculation.after;
        events.push(this.#createEvent('instability-changed', {
            source,
            before: calculation.before,
            after: calculation.after,
            change: calculation.change,
            requestedChange: calculation.requestedChange,
            suppressed: calculation.suppressed
        }));
        return calculation.change;
    }

    /**
     * 종료 조건과 불안정도 기반 결과를 확정하고 패배 원인을 보존합니다.
     * @param {string} outcome - 성공 또는 실패 결과입니다.
     * @param {string} reason - 전투 종료 사유입니다.
     * @param {object[]} events - 결과 사건을 추가할 배열입니다.
     * @param {{defeatedBy?:string|null}} [details={}] - 플레이어를 쓰러뜨린 주체입니다.
     * @private
     */
    #finishBattle(outcome, reason, events, { defeatedBy = null } = {}) {
        if (this.result) {
            return;
        }
        const neutralized = !this.lora.alive;
        let endingId = 'failure';
        let label = '작전 실패';
        if (neutralized) {
            if (this.lora.instability <= this.#config.trueEndingMaxInstability) {
                endingId = 'true';
                label = '안정된 무력화';
            } else if (this.lora.instability <= this.#config.specialEndingMaxInstability) {
                endingId = 'special';
                label = '불안 속의 무력화';
            } else {
                endingId = 'hollow';
                label = '붕괴 상태의 무력화';
            }
        } else if (reason === 'turn-limit') {
            label = '12번째 로라 행동 종료';
        } else if (reason === 'player-defeated') {
            label = '플레이어 무력화';
        }
        this.result = {
            outcome,
            reason,
            label,
            turn: this.turnNumber,
            loraActionsCompleted: this.loraActionsCompleted,
            playerHp: this.player.hp,
            loraHp: this.lora.hp,
            instability: this.lora.instability,
            neutralized,
            defeatedBy: reason === 'player-defeated' ? defeatedBy : null,
            usedItems: [...this.usedItems],
            unlockedCutscenes: [],
            score: this.#calculateScore(outcome, endingId),
            endingId
        };
        this.turn = 'result';
        this.phase = 'result';
        events.push(this.#createEvent('battle-finished', { ...this.result }));
    }

    /** 결과 점수를 계산합니다. @private */
    #calculateScore(outcome, endingId) {
        const endingBonus = endingId === 'true' ? 700 : endingId === 'special' ? 350 : 0;
        return Math.max(0, Math.round(
            (outcome === 'success' ? 1000 : 0)
            + this.player.hp * 4
            + (100 - this.lora.instability) * 6
            + (this.maxTurns - this.loraActionsCompleted) * 30
            + endingBonus
        ));
    }

    /** 현재 좌표의 활성 벽을 찾습니다. @private */
    #findWallAt(x, y) {
        return this.#getFloor().walls.find((wall) => (
            !wall.destroyed && this.#isSamePosition(wall, x, y)
        )) ?? null;
    }

    /** 현재 좌표의 살아있는 몹을 찾습니다. @private */
    #findMobAt(x, y) {
        return this.#getFloor().mobs.find((mob) => (
            mob.alive && this.#isSamePosition(mob, x, y)
        )) ?? null;
    }

    /** 현재 좌표의 미획득 아이템을 찾습니다. @private */
    #findItemAt(x, y) {
        return this.#getFloor().items.find((item) => (
            !item.collected && this.#isSamePosition(item, x, y)
        )) ?? null;
    }

    /** 현재 좌표의 미획득 기록을 찾습니다. @private */
    #findRecordAt(x, y) {
        return this.#getFloor().records.find((record) => (
            !record.collected && this.#isSamePosition(record, x, y)
        )) ?? null;
    }

    /** 현재 좌표의 이벤트 타일을 찾습니다. @private */
    #findEventTileAt(x, y) {
        return this.#getFloor().eventTiles.find((eventTile) => (
            this.#isSamePosition(eventTile, x, y)
        )) ?? null;
    }

    /** 현재 좌표의 포탈을 찾습니다. @private */
    #findTeleportAt(x, y) {
        return this.#getFloor().teleports.find((teleport) => (
            this.#isSamePosition(teleport, x, y)
        )) ?? null;
    }

    /** 포탈의 반대편 끝점을 찾습니다. @private */
    #findTeleportPair(source) {
        return this.#getFloor().teleports.find((teleport) => (
            teleport.id !== source.id && teleport.pairId === source.pairId
        )) ?? null;
    }

    /** 이동을 막는 로라, 몹, 벽을 반환합니다. @private */
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

    /** 경로 끝의 직전 좌표가 포탈 진입점이면 반환합니다. @private */
    #getPortalEntryFromPath(path) {
        if (path.length < 2) {
            return null;
        }
        const destination = path[path.length - 1];
        const source = path[path.length - 2];
        return this.#distance(source, destination) > 1 && this.#findTeleportAt(source.x, source.y)
            ? source
            : null;
    }

    /** 인벤토리에 아이템을 추가합니다. @private */
    #addInventory(itemId, count) {
        this.inventory.set(itemId, (this.inventory.get(itemId) ?? 0) + count);
    }

    /** 인벤토리에서 아이템을 제거합니다. @private */
    #removeInventory(itemId, count) {
        const next = Math.max(0, (this.inventory.get(itemId) ?? 0) - count);
        if (next <= 0) {
            this.inventory.delete(itemId);
        } else {
            this.inventory.set(itemId, next);
        }
    }

    /** 아이템 보유 여부를 확인합니다. @private */
    #hasItem(itemId) {
        return (this.inventory.get(itemId) ?? 0) > 0;
    }

    /** 보유 아이템 중 벽 통과 효과를 제공한 안정 ID를 반환합니다. @private */
    #getWallTraversalItemId() {
        for (const [itemId, count] of this.inventory) {
            if (count > 0 && this.#combatRules.grantsWallTraversal(itemId)) {
                return itemId;
            }
        }
        return null;
    }

    /** 복원 상태의 핵심 불변식을 확인합니다. @private */
    #validateRestoredState(state) {
        const validTurn = ['player', 'lora', 'result'].includes(state.turn);
        const validPhase = ['move', 'action', 'lora', 'result'].includes(state.phase);
        if (!validTurn
            || !validPhase
            || !Array.isArray(state.floorStates)
            || state.floorStates.length !== this.#config.floors.length
            || !(state.inventory instanceof Map)
            || !(state.usedItems instanceof Set)
            || !Number.isInteger(state.loraActionsCompleted)
            || state.loraActionsCompleted < 0
            || state.loraActionsCompleted > this.#config.maxTurns
            || !Number.isInteger(state.actionsUsed)
            || !Number.isInteger(state.actionsPerTurn)
            || state.actionsUsed < 0
            || state.actionsUsed > state.actionsPerTurn
            || state.maxTurns !== this.#config.maxTurns
            || state.player?.alive !== (state.player?.hp > 0)
            || state.lora?.alive !== (state.lora?.hp > 0)) {
            throw new TypeError('TutorialBattleModel: 체크포인트 상태 불변식이 올바르지 않습니다.');
        }
    }

    /** 이벤트 객체를 생성합니다. @private */
    #createEvent(type, payload = {}) {
        return {
            type,
            turn: this.turnNumber,
            loraActionsCompleted: this.loraActionsCompleted,
            playerTurn: this.playerTurnSerial,
            floorIndex: this.floorIndex,
            ...payload
        };
    }

    /** 최근 이벤트를 저장합니다. @private */
    #setLastEvents(events) {
        this.lastEvents = this.#copyEvents(events);
    }

    /** 이벤트 배열을 복제합니다. @private */
    #copyEvents(events) {
        return this.#cloneValue(events ?? []);
    }

    /** 결과를 복제합니다. @private */
    #copyResult() {
        return this.result ? this.#cloneValue(this.result) : null;
    }

    /** 이동 실패 결과를 생성합니다. @private */
    #moveFailure(reason) {
        return {
            ok: false,
            action: 'move',
            path: [],
            cost: null,
            stepsUsed: null,
            remainingMoves: null,
            interrupted: false,
            events: [],
            reason
        };
    }

    /** 행동 실패 결과를 생성합니다. @private */
    #actionFailure(action, reason, extra = {}) {
        return { ok: false, action, events: [], reason, ...extra };
    }

    /** 설정 서명을 생성합니다. @private */
    #createConfigSignature() {
        return JSON.stringify({
            width: this.#config.width,
            height: this.#config.height,
            floors: this.#config.floors,
            items: this.#config.items,
            eventTileEffects: this.#config.eventTileEffects,
            starterChoiceIds: [...this.#config.starterChoiceIds].sort(),
            maxTurns: this.#config.maxTurns,
            floorTransitionAfterTurn: this.#config.floorTransitionAfterTurn,
            player: this.#config.player,
            lora: this.#config.lora,
            mob: this.#config.mob
        });
    }

    /** 외부 설정을 검증하고 모델 전용 구조로 복제합니다. @private */
    #normalizeConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new TypeError('TutorialBattleModel: config 객체가 필요합니다.');
        }
        const width = this.#requirePositiveInteger(config.MAP?.WIDTH, 'MAP.WIDTH');
        const height = this.#requirePositiveInteger(config.MAP?.HEIGHT, 'MAP.HEIGHT');
        const items = {};
        for (const [itemId, item] of Object.entries(config.ITEMS ?? {})) {
            if (!item
                || item.id !== itemId
                || typeof item.label !== 'string'
                || !Array.isArray(item.effects)) {
                throw new TypeError(`TutorialBattleModel: ITEMS.${itemId} 설정이 올바르지 않습니다.`);
            }
            items[itemId] = Object.freeze({
                ...item,
                effects: Object.freeze(item.effects.map((effect) => Object.freeze({
                    ...effect,
                    conditions: Object.freeze([...(effect?.conditions ?? [])])
                })))
            });
        }
        const eventTileEffects = {};
        for (const [eventType, entry] of Object.entries(config.EVENT_TILE_EFFECTS ?? {})) {
            if (!entry || entry.id !== eventType || !Array.isArray(entry.effects)) {
                throw new TypeError(
                    `TutorialBattleModel: EVENT_TILE_EFFECTS.${eventType} 설정이 올바르지 않습니다.`
                );
            }
            eventTileEffects[eventType] = Object.freeze({
                ...entry,
                effects: Object.freeze(entry.effects.map((effect) => Object.freeze({
                    ...effect,
                    conditions: Object.freeze([...(effect?.conditions ?? [])])
                })))
            });
        }
        const frozenEventTileEffects = Object.freeze(eventTileEffects);
        const floors = this.#normalizeFloors(
            config.FLOORS,
            width,
            height,
            items,
            frozenEventTileEffects
        );
        const starterChoiceIds = new Set((config.STARTER_CHOICES ?? []).map((choice) => choice?.id));
        if (!starterChoiceIds.has('bow') || !starterChoiceIds.has('mascot-costume')) {
            throw new TypeError('TutorialBattleModel: 시작 선택에 bow와 mascot-costume이 필요합니다.');
        }
        const player = config.ACTORS?.PLAYER;
        const lora = config.ACTORS?.LORA;
        const mob = config.ACTORS?.MOB;
        const maxInstability = this.#requirePositiveNumber(
            lora?.MAX_INSTABILITY,
            'ACTORS.LORA.MAX_INSTABILITY'
        );
        const maxTurns = this.#requirePositiveInteger(config.RULES?.MAX_TURNS, 'RULES.MAX_TURNS');
        const floorTransitionAfterTurn = this.#requirePositiveInteger(
            config.RULES?.FLOOR_TRANSITION_AFTER_TURN,
            'RULES.FLOOR_TRANSITION_AFTER_TURN'
        );
        if (floorTransitionAfterTurn >= maxTurns) {
            throw new RangeError('TutorialBattleModel: 층 전환 횟수는 최대 로라 행동 횟수보다 작아야 합니다.');
        }
        return Object.freeze({
            width,
            height,
            floors: Object.freeze(floors),
            items: Object.freeze(items),
            eventTileEffects: frozenEventTileEffects,
            starterChoiceIds,
            maxTurns,
            floorTransitionAfterTurn,
            trueEndingMaxInstability: this.#requireNonNegativeNumber(
                config.RULES?.TRUE_ENDING_MAX_INSTABILITY,
                'RULES.TRUE_ENDING_MAX_INSTABILITY'
            ),
            specialEndingMaxInstability: this.#requireNonNegativeNumber(
                config.RULES?.SPECIAL_ENDING_MAX_INSTABILITY,
                'RULES.SPECIAL_ENDING_MAX_INSTABILITY'
            ),
            player: Object.freeze({
                maxHp: this.#requirePositiveNumber(player?.MAX_HP, 'ACTORS.PLAYER.MAX_HP'),
                moveRange: this.#requirePositiveInteger(player?.MOVE_RANGE, 'ACTORS.PLAYER.MOVE_RANGE'),
                attackDamage: this.#requirePositiveNumber(player?.ATTACK_DAMAGE, 'ACTORS.PLAYER.ATTACK_DAMAGE'),
                attackRange: this.#requirePositiveInteger(player?.ATTACK_RANGE, 'ACTORS.PLAYER.ATTACK_RANGE'),
                attackInstability: this.#requireNonNegativeNumber(
                    player?.ATTACK_INSTABILITY,
                    'ACTORS.PLAYER.ATTACK_INSTABILITY'
                ),
                consecutiveAttackInstability: this.#requireNonNegativeNumber(
                    player?.CONSECUTIVE_ATTACK_INSTABILITY,
                    'ACTORS.PLAYER.CONSECUTIVE_ATTACK_INSTABILITY'
                ),
                healAmount: this.#requirePositiveNumber(player?.HEAL_AMOUNT, 'ACTORS.PLAYER.HEAL_AMOUNT')
            }),
            lora: Object.freeze({
                maxHp: this.#requirePositiveNumber(lora?.MAX_HP, 'ACTORS.LORA.MAX_HP'),
                startInstability: this.#requireNonNegativeNumber(
                    lora?.START_INSTABILITY,
                    'ACTORS.LORA.START_INSTABILITY'
                ),
                maxInstability,
                meleeRange: this.#requirePositiveInteger(lora?.MELEE_RANGE, 'ACTORS.LORA.MELEE_RANGE'),
                instabilityStates: this.#normalizeInstabilityStates(
                    lora?.INSTABILITY_STATES,
                    maxInstability
                )
            }),
            mob: Object.freeze({
                defaultHp: this.#requirePositiveNumber(mob?.DEFAULT_HP, 'ACTORS.MOB.DEFAULT_HP'),
                attackDamage: this.#requirePositiveNumber(mob?.ATTACK_DAMAGE, 'ACTORS.MOB.ATTACK_DAMAGE'),
                attackRange: this.#requirePositiveInteger(mob?.ATTACK_RANGE, 'ACTORS.MOB.ATTACK_RANGE')
            })
        });
    }

    /** 두 층의 위치 기반 데이터를 정규화합니다. @private */
    #normalizeFloors(value, width, height, items, eventTileEffects) {
        if (!Array.isArray(value) || value.length !== 2) {
            throw new TypeError('TutorialBattleModel: FLOORS는 두 층이어야 합니다.');
        }
        return value.map((floor, floorIndex) => {
            if (!floor || typeof floor.id !== 'string' || typeof floor.label !== 'string') {
                throw new TypeError(`TutorialBattleModel: FLOORS[${floorIndex}]가 올바르지 않습니다.`);
            }
            const prefix = `FLOORS[${floorIndex}]`;
            const playerStart = this.#normalizeRequiredPosition(floor.playerStart, `${prefix}.playerStart`, width, height);
            const loraStart = this.#normalizeRequiredPosition(floor.loraStart, `${prefix}.loraStart`, width, height);
            const heights = this.#normalizeHeights(floor.heights, width, height, floorIndex);
            const walls = this.#normalizeEntityList(floor.walls, `${prefix}.walls`, width, height);
            const floorItems = this.#normalizeEntityList(
                floor.items,
                `${prefix}.items`,
                width,
                height,
                (entry, label) => {
                    if (!items[entry.itemId]) {
                        throw new TypeError(`TutorialBattleModel: ${label}.itemId가 존재하지 않습니다.`);
                    }
                    return { itemId: entry.itemId, hidden: entry.hidden === true };
                }
            );
            const records = this.#normalizeEntityList(
                floor.records,
                `${prefix}.records`,
                width,
                height,
                (entry, label) => {
                    if (typeof entry.recordId !== 'string' || entry.recordId.length === 0) {
                        throw new TypeError(`TutorialBattleModel: ${label}.recordId가 필요합니다.`);
                    }
                    return { recordId: entry.recordId };
                }
            );
            const eventTiles = this.#normalizeEntityList(
                floor.eventTiles,
                `${prefix}.eventTiles`,
                width,
                height,
                (entry, label) => {
                    if (!eventTileEffects[entry.type]) {
                        throw new TypeError(`TutorialBattleModel: ${label}.type이 올바르지 않습니다.`);
                    }
                    return { type: entry.type };
                }
            );
            const teleports = this.#normalizeEntityList(
                floor.teleports,
                `${prefix}.teleports`,
                width,
                height,
                (entry, label) => {
                    if (typeof entry.pairId !== 'string' || entry.pairId.length === 0) {
                        throw new TypeError(`TutorialBattleModel: ${label}.pairId가 필요합니다.`);
                    }
                    return { pairId: entry.pairId };
                }
            );
            const pairCounts = new Map();
            for (const teleport of teleports) {
                pairCounts.set(teleport.pairId, (pairCounts.get(teleport.pairId) ?? 0) + 1);
            }
            if ([...pairCounts.values()].some((count) => count !== 2)) {
                throw new TypeError(`TutorialBattleModel: ${prefix}.teleports는 pairId마다 두 끝점이 필요합니다.`);
            }
            const mobs = this.#normalizeEntityList(
                floor.mobs,
                `${prefix}.mobs`,
                width,
                height,
                (entry, label) => {
                    if (entry.dropItemId && !items[entry.dropItemId]) {
                        throw new TypeError(`TutorialBattleModel: ${label}.dropItemId가 존재하지 않습니다.`);
                    }
                    return {
                        maxHp: this.#requirePositiveNumber(entry.hp, `${label}.hp`),
                        dropItemId: entry.dropItemId ?? null
                    };
                }
            );
            return Object.freeze({
                id: floor.id,
                label: floor.label,
                playerStart: Object.freeze(playerStart),
                loraStart: Object.freeze(loraStart),
                heights: Object.freeze(heights.map((row) => Object.freeze(row))),
                walls: Object.freeze(walls.map((entry) => Object.freeze(entry))),
                items: Object.freeze(floorItems.map((entry) => Object.freeze(entry))),
                records: Object.freeze(records.map((entry) => Object.freeze(entry))),
                eventTiles: Object.freeze(eventTiles.map((entry) => Object.freeze(entry))),
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
            const position = this.#normalizeRequiredPosition(entry, entryLabel, width, height);
            return { id: entry.id, ...position, ...extend(entry, entryLabel) };
        });
    }

    /** 높이 행렬을 검증합니다. @private */
    #normalizeHeights(value, width, height, floorIndex) {
        if (!Array.isArray(value) || value.length !== height) {
            throw new RangeError(`TutorialBattleModel: FLOORS[${floorIndex}].heights 행 수가 맞지 않습니다.`);
        }
        return value.map((row, y) => {
            if (!Array.isArray(row)
                || row.length !== width
                || row.some((heightValue) => !Number.isFinite(heightValue))) {
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
        let expectedMin = 0;
        const ids = new Set();
        const result = value.map((state, index) => {
            if (!state
                || typeof state.id !== 'string'
                || ids.has(state.id)
                || typeof state.label !== 'string'
                || state.min !== expectedMin
                || !Number.isFinite(state.max)
                || state.max < state.min
                || !Number.isFinite(state.meleeDamage)
                || state.meleeDamage < 0
                || !Number.isFinite(state.areaDamage)
                || state.areaDamage < 0) {
                throw new TypeError(`TutorialBattleModel: 불안정 상태 ${index}가 올바르지 않습니다.`);
            }
            ids.add(state.id);
            expectedMin = state.max + 1;
            return Object.freeze({ ...state });
        });
        if (result[result.length - 1].max !== maxInstability) {
            throw new RangeError('TutorialBattleModel: 불안정 상태가 최대치까지 이어져야 합니다.');
        }
        return Object.freeze(result);
    }

    /** 외부 지식 입력을 Set 기반으로 정규화합니다. @private */
    #normalizeKnowledge(knowledge = {}) {
        const toSet = (value) => new Set(value instanceof Set ? value : Array.isArray(value) ? value : []);
        return {
            discoveredItemIds: toSet(knowledge?.discoveredItemIds),
            identifiedItemIds: toSet(knowledge?.identifiedItemIds),
            unlockedRecordIds: toSet(knowledge?.unlockedRecordIds),
            revealedTrapIds: new Set(),
            unlockedCutsceneIds: new Set()
        };
    }

    /** 체크포인트 값을 Map/Set까지 포함해 방어 복제합니다. @private */
    #cloneValue(value, seen = new WeakMap()) {
        if (value === null || typeof value !== 'object') {
            return value;
        }
        if (seen.has(value)) {
            throw new TypeError('TutorialBattleModel: 순환 참조는 지원하지 않습니다.');
        }
        seen.set(value, true);
        let clone;
        if (Array.isArray(value)) {
            clone = value.map((entry) => this.#cloneValue(entry, seen));
        } else if (value instanceof Map) {
            clone = new Map([...value.entries()].map(([key, entry]) => ([
                this.#cloneValue(key, seen),
                this.#cloneValue(entry, seen)
            ])));
        } else if (value instanceof Set) {
            clone = new Set([...value].map((entry) => this.#cloneValue(entry, seen)));
        } else if (this.#isPlainRecord(value)) {
            clone = {};
            for (const [key, entry] of Object.entries(value)) {
                clone[key] = this.#cloneValue(entry, seen);
            }
        } else {
            throw new TypeError('TutorialBattleModel: 지원하지 않는 객체 형식입니다.');
        }
        seen.delete(value);
        return clone;
    }

    /** 일반 객체인지 확인합니다. @private */
    #isPlainRecord(value) {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }

    /** 좌표 값을 검증해 복제합니다. @private */
    #normalizeRequiredPosition(value, label, width, height) {
        if (!value || !Number.isInteger(value.x) || !Number.isInteger(value.y)) {
            throw new TypeError(`TutorialBattleModel: ${label}는 정수 x/y 좌표여야 합니다.`);
        }
        if (value.x < 0 || value.x >= width || value.y < 0 || value.y >= height) {
            throw new RangeError(`TutorialBattleModel: ${label}가 맵 밖에 있습니다.`);
        }
        return { x: value.x, y: value.y };
    }

    /** 좌표처럼 보이는 값을 내부 좌표 또는 null로 바꿉니다. @private */
    #normalizePositionOrNull(value) {
        return value && Number.isInteger(value.x) && Number.isInteger(value.y)
            ? { x: value.x, y: value.y }
            : null;
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

    /** 두 좌표의 맨해튼 거리를 반환합니다. @private */
    #distance(left, right) {
        return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
    }

    /** 위치 객체가 지정 좌표와 같은지 확인합니다. @private */
    #isSamePosition(position, x, y) {
        return Boolean(position && position.x === x && position.y === y);
    }

    /** 좌표를 Map 키로 변환합니다. @private */
    #toTileKey(x, y) {
        return `${x},${y}`;
    }

    /** 숫자를 범위 안으로 제한합니다. @private */
    #clamp(value, min, max) {
        const normalized = Number.isFinite(value) ? value : min;
        return Math.min(max, Math.max(min, normalized));
    }
}
