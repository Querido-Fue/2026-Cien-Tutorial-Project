/** @param {object} left @param {object} right @returns {number} 맨해튼 거리입니다. */
function distance(left, right) {
    return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

/** @param {Array<{x:number,y:number}>} path @returns {string} 안정된 경로 키입니다. */
function pathKey(path) {
    return path.map(({ x, y }) => `${x},${y}`).join('>');
}

/** @param {Array<object>} entries @param {string} itemId @returns {number} 우선순위입니다. */
function itemPriority(entries, itemId) {
    const index = entries.indexOf(itemId);
    return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

/**
 * @class TutorialBalanceAgent
 * @description 정적 전략 프로필을 공개 관측값에 적용해 결정론적 이동·행동 의도만 반환합니다.
 */
export class TutorialBalanceAgent {
    #profile;

    /** @param {object} profile - `BALANCE_AGENT_PROFILES`의 한 항목입니다. */
    constructor(profile) {
        if (!profile || typeof profile.id !== 'string' || !Array.isArray(profile.rules)) {
            throw new TypeError('TutorialBalanceAgent: 유효한 전략 프로필이 필요합니다.');
        }
        this.#profile = profile;
    }

    /** @returns {object} 보고서에 넣을 설명 가능한 전략 정보입니다. */
    getDescriptor() {
        return {
            id: this.#profile.id,
            label: this.#profile.label,
            rules: [...this.#profile.rules]
        };
    }

    /**
     * 이동 전에 정화할 타일 하나를 고릅니다.
     * @param {object} observation - 현재 snapshot과 공개 정화 대상입니다.
     * @returns {{type:'cleanse-event-tile',targetId:string}|null} 정화 의도입니다.
     */
    chooseCleanseTarget(observation) {
        if (!this.#profile.cleanseNegativeTiles) {
            return null;
        }
        const player = observation.snapshot.player;
        const target = [...observation.cleanseTargets].sort((left, right) => (
            distance(player, left) - distance(player, right)
            || left.y - right.y
            || left.x - right.x
            || left.id.localeCompare(right.id)
        ))[0];
        return target
            ? { type: 'cleanse-event-tile', targetId: target.id }
            : null;
    }

    /**
     * 공개 reachability 후보 중 한 경로를 안정 정렬해 고릅니다.
     * @param {object} observation - snapshot, 후보 경로와 이벤트 polarity입니다.
     * @returns {{type:'commit-path',path:Array<{x:number,y:number}>,reason:string}} 이동 의도입니다.
     */
    chooseMovement(observation) {
        const { snapshot } = observation;
        const candidates = observation.reachability.map((candidate) => ({
            ...candidate,
            path: candidate.path.map(({ x, y }) => ({ x, y }))
        }));
        if (candidates.length === 0) {
            throw new RangeError('TutorialBalanceAgent: 공개 이동 후보가 없습니다.');
        }

        const stay = candidates.find(({ path }) => {
            const endpoint = path[path.length - 1];
            return path.length === 1
                && endpoint.x === snapshot.player.x
                && endpoint.y === snapshot.player.y;
        });
        const hasBow = snapshot.inventory.some(({ itemId, count }) => (
            itemId === 'bow' && count > 0
        ));
        if (this.#profile.movementMode === 'stay'
            || (this.#profile.stayWhenBowOwned && hasBow)) {
            if (!stay) {
                throw new RangeError('TutorialBalanceAgent: 제자리 이동 후보가 없습니다.');
            }
            return { type: 'commit-path', path: stay.path, reason: 'stay-policy' };
        }

        const ranked = candidates.map((candidate) => ({
            candidate,
            endpoint: candidate.path[candidate.path.length - 1],
            score: this.#scoreMovement(candidate, observation),
            key: pathKey(candidate.path)
        })).sort((left, right) => (
            right.score - left.score
            || (left.candidate.stepsUsed ?? left.candidate.cost ?? 0)
                - (right.candidate.stepsUsed ?? right.candidate.cost ?? 0)
            || (right.candidate.remainingMoves ?? 0) - (left.candidate.remainingMoves ?? 0)
            || left.endpoint.y - right.endpoint.y
            || left.endpoint.x - right.endpoint.x
            || left.key.localeCompare(right.key)
            || left.candidate.id.localeCompare(right.candidate.id)
        ));
        return {
            type: 'commit-path',
            path: ranked[0].candidate.path,
            reason: 'profile-score'
        };
    }

    /**
     * 현재 행동 preview에서 프로필 우선순위에 맞는 첫 의도를 고릅니다.
     * @param {object} observation - snapshot과 `getPlayerActionPreviews()` 결과입니다.
     * @returns {object} attack, heal, use-item 또는 wait 의도입니다.
     */
    chooseAction(observation) {
        for (const priority of this.#profile.actionPriorities) {
            const decision = this.#resolveActionPriority(priority, observation);
            if (decision) {
                return decision;
            }
        }
        return { type: 'wait', reason: 'fallback-wait' };
    }

    /** @param {object} candidate @param {object} observation @returns {number} 이동 후보 점수입니다. @private */
    #scoreMovement(candidate, observation) {
        const { snapshot, eventPolarityByType } = observation;
        const weights = this.#profile.weights;
        const endpoint = candidate.path[candidate.path.length - 1];
        const pathTiles = candidate.path.slice(1);
        const pathTileKeys = new Set(pathTiles.map(({ x, y }) => `${x},${y}`));
        const floorItems = snapshot.floor.items.filter(({ collected }) => !collected);
        const preferredItems = floorItems.filter(({ itemId }) => (
            this.#profile.preferredItemIds.includes(itemId)
        ));
        const hitPreferredItems = preferredItems.filter(({ x, y }) => (
            pathTileKeys.has(`${x},${y}`)
        )).length;
        const hitAnyItems = floorItems.filter(({ x, y }) => (
            pathTileKeys.has(`${x},${y}`)
        )).length;
        const nearestPreferredDistance = preferredItems.length > 0
            ? Math.min(...preferredItems.map((item) => distance(endpoint, item)))
            : 0;
        const nearestAnyItemDistance = floorItems.length > 0
            ? Math.min(...floorItems.map((item) => distance(endpoint, item)))
            : 0;
        const livingMobs = snapshot.floor.mobs.filter(({ alive }) => alive);
        const nearestMobDistance = livingMobs.length > 0
            ? Math.min(...livingMobs.map((mob) => distance(endpoint, mob)))
            : 0;
        const crossedEvents = snapshot.floor.eventTiles.filter(({ x, y }) => (
            pathTileKeys.has(`${x},${y}`)
        ));
        const positiveFloorEvents = snapshot.lora.instability > 0
            ? snapshot.floor.eventTiles.filter(({ type }) => (
                eventPolarityByType[type] === 'positive'
            ))
            : [];
        const nearestPositiveEventDistance = positiveFloorEvents.length > 0
            ? Math.min(...positiveFloorEvents.map((eventTile) => distance(endpoint, eventTile)))
            : 0;
        const negativeEvents = crossedEvents.filter(({ type }) => (
            eventPolarityByType[type] === 'negative'
        )).length;
        const positiveEvents = snapshot.lora.instability > 0
            ? crossedEvents.filter(({ type }) => eventPolarityByType[type] === 'positive').length
            : 0;

        return hitPreferredItems * weights.preferredItemHit
            - nearestPreferredDistance * weights.preferredItemApproach
            + (this.#profile.collectAnyItems ? hitAnyItems * weights.anyItemHit : 0)
            - (this.#profile.collectAnyItems
                ? nearestAnyItemDistance * weights.anyItemApproach
                : 0)
            + positiveEvents * weights.positiveEventHit
            - nearestPositiveEventDistance * weights.positiveEventApproach
            - distance(endpoint, snapshot.lora) * weights.loraApproach
            - nearestMobDistance * weights.mobApproach
            - negativeEvents * weights.negativeEventPenalty;
    }

    /** @param {string} priority @param {object} observation @returns {object|null} 행동 의도입니다. @private */
    #resolveActionPriority(priority, observation) {
        const { previews, snapshot } = observation;
        if (priority === 'use-preferred-item') {
            return this.#findUsableItem(previews.items, true);
        }
        if (priority === 'use-any-item') {
            return this.#findUsableItem(previews.items, false);
        }
        if (priority === 'heal-threshold') {
            const ratio = snapshot.player.maxHp > 0
                ? snapshot.player.hp / snapshot.player.maxHp
                : 0;
            return previews.heal?.ok
                && previews.heal.amount > 0
                && ratio <= this.#profile.healThresholdRatio
                ? { type: 'heal', reason: 'hp-threshold' }
                : null;
        }
        if (priority === 'heal-always') {
            return previews.heal?.ok ? { type: 'heal', reason: 'naive-heal' } : null;
        }
        if (priority === 'attack-lora') {
            return this.#findAttack(previews.attack, 'lora');
        }
        if (priority === 'attack-mob') {
            return this.#findAttack(previews.attack, 'mob');
        }
        if (priority === 'wait') {
            return previews.wait?.ok ? { type: 'wait', reason: 'priority-wait' } : null;
        }
        throw new RangeError(`TutorialBalanceAgent: 알 수 없는 행동 우선순위 ${priority}입니다.`);
    }

    /** @param {Array<object>} previews @param {boolean} preferredOnly @returns {object|null} 아이템 의도입니다. @private */
    #findUsableItem(previews, preferredOnly) {
        const usable = previews.filter(({ ok, itemId }) => (
            ok && (!preferredOnly || this.#profile.preferredUseItemIds.includes(itemId))
        )).sort((left, right) => (
            itemPriority(this.#profile.preferredUseItemIds, left.itemId)
                - itemPriority(this.#profile.preferredUseItemIds, right.itemId)
            || left.itemId.localeCompare(right.itemId)
        ));
        return usable[0]
            ? { type: 'use-item', itemId: usable[0].itemId, reason: 'item-priority' }
            : null;
    }

    /** @param {object} attackPreviews @param {'lora'|'mob'} targetType @returns {object|null} 공격 의도입니다. @private */
    #findAttack(attackPreviews, targetType) {
        const candidates = Object.entries(attackPreviews).flatMap(([weapon, previews]) => (
            previews.filter((preview) => preview.ok && preview.targetType === targetType)
                .map((preview) => ({ ...preview, weapon }))
        )).sort((left, right) => (
            this.#profile.weaponOrder.indexOf(left.weapon)
                - this.#profile.weaponOrder.indexOf(right.weapon)
            || left.targetId.localeCompare(right.targetId)
        ));
        return candidates[0]
            ? {
                type: 'attack',
                targetId: candidates[0].targetId,
                weapon: candidates[0].weapon,
                reason: `${targetType}-priority`
            }
            : null;
    }
}
