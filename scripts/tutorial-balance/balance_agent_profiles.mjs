/** @param {*} value @returns {*} 객체와 하위 값을 재귀적으로 동결합니다. */
function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
        return value;
    }
    for (const child of Object.values(value)) {
        deepFreeze(child);
    }
    return Object.freeze(value);
}

/**
 * 네 agent가 공유하는 선택 vocabulary와 서로 다른 우선순위를 선언합니다.
 * 수치는 게임 밸런스 값이 아니라 후보 사이의 설명 가능한 정렬 가중치입니다.
 */
export const BALANCE_AGENT_PROFILES = deepFreeze([
    {
        id: 'bow-attack-first',
        label: '활 공격 우선',
        rules: [
            '활을 보유하면 제자리 이동 뒤 로라 원거리 공격을 가장 먼저 선택한다.',
            '활이 없으면 이번 턴 도달 후보 중 로라와 가장 가까운 안전한 타일로 접근한다.',
            'HP가 25% 이하일 때만 공격보다 회복을 앞세우며 그 밖에는 로라 공격을 지속한다.'
        ],
        movementMode: 'score',
        stayWhenBowOwned: true,
        cleanseNegativeTiles: false,
        preferredItemIds: [],
        preferredUseItemIds: [],
        collectAnyItems: false,
        actionPriorities: ['heal-threshold', 'attack-lora', 'attack-mob', 'wait'],
        weaponOrder: ['bow', 'melee'],
        healThresholdRatio: 0.25,
        weights: {
            preferredItemHit: 0,
            preferredItemApproach: 0,
            anyItemHit: 0,
            anyItemApproach: 0,
            positiveEventHit: 0,
            positiveEventApproach: 0,
            loraApproach: 20,
            mobApproach: 1,
            negativeEventPenalty: 120
        }
    },
    {
        id: 'mascot-stability-first',
        label: '인형탈 안정화 우선',
        rules: [
            '오카리나·오르골·낡은 곰인형·아이라인·사진과 안정 이벤트 타일에 먼저 접근한다.',
            '사용 가능한 안정 아이템은 공격보다 먼저 사용한다.',
            'HP가 55% 이하이면 회복하고, 안정 수단이 없을 때 로라를 근접 우선으로 공격한다.'
        ],
        movementMode: 'score',
        stayWhenBowOwned: false,
        cleanseNegativeTiles: false,
        preferredItemIds: [
            'ocarina',
            'music-box',
            'old-teddy',
            'eyeliner',
            'memory-photo'
        ],
        preferredUseItemIds: [
            'old-teddy',
            'memory-photo',
            'eyeliner',
            'music-box'
        ],
        collectAnyItems: false,
        actionPriorities: [
            'use-preferred-item',
            'heal-threshold',
            'attack-lora',
            'attack-mob',
            'wait'
        ],
        weaponOrder: ['melee', 'bow'],
        healThresholdRatio: 0.55,
        weights: {
            preferredItemHit: 12000,
            preferredItemApproach: 420,
            anyItemHit: 0,
            anyItemApproach: 0,
            positiveEventHit: 8000,
            positiveEventApproach: 260,
            loraApproach: 8,
            mobApproach: 1,
            negativeEventPenalty: 180
        }
    },
    {
        id: 'item-interaction-first',
        label: '아이템 수집·상호작용 우선',
        rules: [
            '현재 층의 미획득 아이템을 통과하거나 가까워지는 경로를 최우선으로 고른다.',
            '아이템이 없으면 정화제 드롭을 위해 몹에 접근하고 몹을 로라보다 먼저 공격한다.',
            '사용 가능한 아이템과 negative 타일 정화를 가능한 즉시 수행한다.'
        ],
        movementMode: 'score',
        stayWhenBowOwned: false,
        cleanseNegativeTiles: true,
        preferredItemIds: [],
        preferredUseItemIds: [
            'mushroom',
            'mirror',
            'memory-photo',
            'music-box',
            'old-teddy',
            'eyeliner'
        ],
        collectAnyItems: true,
        actionPriorities: [
            'use-any-item',
            'attack-mob',
            'heal-threshold',
            'attack-lora',
            'wait'
        ],
        weaponOrder: ['melee', 'bow'],
        healThresholdRatio: 0.35,
        weights: {
            preferredItemHit: 0,
            preferredItemApproach: 0,
            anyItemHit: 10000,
            anyItemApproach: 360,
            positiveEventHit: 200,
            positiveEventApproach: 0,
            loraApproach: 2,
            mobApproach: 18,
            negativeEventPenalty: 40
        }
    },
    {
        id: 'naive-recovery-abuse',
        label: '대기·회복 남용 탐지',
        rules: [
            '이동 단계에서는 항상 제자리를 확정한다.',
            '행동 단계에서는 HP와 무관하게 회복을 선택하고 공격·아이템 사용을 하지 않는다.',
            '회복을 선택할 수 없는 경우에만 대기한다.'
        ],
        movementMode: 'stay',
        stayWhenBowOwned: false,
        cleanseNegativeTiles: false,
        preferredItemIds: [],
        preferredUseItemIds: [],
        collectAnyItems: false,
        actionPriorities: ['heal-always', 'wait'],
        weaponOrder: ['melee', 'bow'],
        healThresholdRatio: 1,
        weights: {
            preferredItemHit: 0,
            preferredItemApproach: 0,
            anyItemHit: 0,
            anyItemApproach: 0,
            positiveEventHit: 0,
            positiveEventApproach: 0,
            loraApproach: 0,
            mobApproach: 0,
            negativeEventPenalty: 0
        }
    }
]);

/** @param {string} profileId @returns {object|null} 안정된 ID의 agent 프로필입니다. */
export function getBalanceAgentProfile(profileId) {
    return BALANCE_AGENT_PROFILES.find(({ id }) => id === profileId) ?? null;
}
