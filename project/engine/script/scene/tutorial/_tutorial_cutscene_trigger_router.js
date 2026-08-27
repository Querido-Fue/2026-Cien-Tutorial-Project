/**
 * @class TutorialCutsceneTriggerRouter
 * @description 모델 사건과 첫 실행 메타를 기존 컷씬 ID로만 변환합니다.
 */
export class TutorialCutsceneTriggerRouter {
    #openingCutsceneId;
    #rules;
    #seenCutsceneIds;
    #usedItemIds;

    /**
     * @param {object} options - 컷씬 트리거 데이터와 등록된 컷씬 ID입니다.
     */
    constructor({ triggerData = {}, knownCutsceneIds = [] } = {}) {
        const knownIds = new Set(Array.isArray(knownCutsceneIds) ? knownCutsceneIds : []);
        this.#openingCutsceneId = this.#requireKnownCutsceneId(
            triggerData.openingCutsceneId,
            knownIds,
            'openingCutsceneId'
        );
        this.#rules = this.#normalizeRules(triggerData.eventRules, knownIds);
        this.#seenCutsceneIds = new Set();
        this.#usedItemIds = new Set();
    }

    /**
     * 새 런의 중복 상태를 초기화하고 첫 플레이 오프닝 ID를 반환합니다.
     * @param {{openingWatched?:boolean}} meta - 현재 메타 진행도입니다.
     * @returns {readonly string[]} 즉시 열 컷씬 ID입니다.
     */
    beginRun(meta = {}) {
        this.reset();
        if (meta.openingWatched === true) {
            return Object.freeze([]);
        }
        this.#seenCutsceneIds.add(this.#openingCutsceneId);
        return Object.freeze([this.#openingCutsceneId]);
    }

    /**
     * 모델 사건을 감사된 컷씬 ID 목록으로 변환합니다.
     * @param {readonly object[]} events - 모델 사건입니다.
     * @returns {readonly string[]} 같은 런에서 중복되지 않은 컷씬 ID입니다.
     */
    consume(events) {
        const eventList = Array.isArray(events) ? events : [];
        for (const event of eventList) {
            if (event?.type === 'item-used' && typeof event.itemId === 'string') {
                this.#usedItemIds.add(event.itemId);
            }
        }

        const triggeredIds = [];
        for (const rule of this.#rules) {
            if (rule.eventType === 'item-used-all') {
                if (rule.itemIds.every((itemId) => this.#usedItemIds.has(itemId))) {
                    this.#appendOnce(triggeredIds, rule.cutsceneId);
                }
                continue;
            }
            for (const event of eventList) {
                if (event?.type !== rule.eventType) {
                    continue;
                }
                if (rule.field && event[rule.field] !== rule.equals) {
                    continue;
                }
                if (rule.cutsceneField) {
                    const candidate = event[rule.cutsceneField];
                    if (rule.allowedCutsceneIds.includes(candidate)) {
                        this.#appendOnce(triggeredIds, candidate);
                    }
                    continue;
                }
                this.#appendOnce(triggeredIds, rule.cutsceneId);
            }
        }
        return Object.freeze(triggeredIds);
    }

    /** 새 런 또는 장면 이탈 시 누적 사건을 초기화합니다. */
    reset() {
        this.#seenCutsceneIds.clear();
        this.#usedItemIds.clear();
    }

    /** @param {string[]} target @param {string} cutsceneId @private */
    #appendOnce(target, cutsceneId) {
        if (!cutsceneId || this.#seenCutsceneIds.has(cutsceneId)) {
            return;
        }
        this.#seenCutsceneIds.add(cutsceneId);
        target.push(cutsceneId);
    }

    /** @param {*} id @param {Set<string>} knownIds @param {string} label @returns {string} @private */
    #requireKnownCutsceneId(id, knownIds, label) {
        if (typeof id !== 'string' || !knownIds.has(id)) {
            throw new TypeError(`TutorialCutsceneTriggerRouter: ${label}가 등록된 컷씬 ID가 아닙니다.`);
        }
        return id;
    }

    /** @param {*} rules @param {Set<string>} knownIds @returns {readonly object[]} @private */
    #normalizeRules(rules, knownIds) {
        if (!Array.isArray(rules)) {
            throw new TypeError('TutorialCutsceneTriggerRouter: eventRules 배열이 필요합니다.');
        }
        const ruleIds = new Set();
        return Object.freeze(rules.map((rule, index) => {
            const id = typeof rule?.id === 'string' ? rule.id.trim() : '';
            const eventType = typeof rule?.eventType === 'string' ? rule.eventType : '';
            if (!id || ruleIds.has(id) || !eventType) {
                throw new TypeError(`TutorialCutsceneTriggerRouter: 트리거 ${index}가 올바르지 않습니다.`);
            }
            ruleIds.add(id);
            if (eventType === 'item-used-all') {
                const itemIds = Array.isArray(rule.itemIds)
                    ? [...new Set(rule.itemIds.filter((itemId) => typeof itemId === 'string' && itemId))]
                    : [];
                if (itemIds.length === 0) {
                    throw new TypeError(`TutorialCutsceneTriggerRouter: ${id}의 itemIds가 비어 있습니다.`);
                }
                return Object.freeze({
                    id,
                    eventType,
                    itemIds: Object.freeze(itemIds),
                    cutsceneId: this.#requireKnownCutsceneId(
                        rule.cutsceneId,
                        knownIds,
                        `${id}.cutsceneId`
                    ),
                    field: null,
                    equals: null,
                    cutsceneField: null,
                    allowedCutsceneIds: Object.freeze([])
                });
            }
            const cutsceneField = typeof rule.cutsceneField === 'string'
                ? rule.cutsceneField
                : null;
            const allowedCutsceneIds = cutsceneField
                ? (Array.isArray(rule.allowedCutsceneIds)
                    ? rule.allowedCutsceneIds.map((candidate) => this.#requireKnownCutsceneId(
                        candidate,
                        knownIds,
                        `${id}.allowedCutsceneIds`
                    ))
                    : [])
                : [];
            if (cutsceneField && allowedCutsceneIds.length === 0) {
                throw new TypeError(`TutorialCutsceneTriggerRouter: ${id}의 엔딩 컷씬 목록이 비어 있습니다.`);
            }
            const cutsceneId = cutsceneField
                ? null
                : this.#requireKnownCutsceneId(
                    rule.cutsceneId,
                    knownIds,
                    `${id}.cutsceneId`
                );
            return Object.freeze({
                id,
                eventType,
                field: typeof rule.field === 'string' ? rule.field : null,
                equals: rule.equals,
                cutsceneId,
                cutsceneField,
                allowedCutsceneIds: Object.freeze(allowedCutsceneIds),
                itemIds: Object.freeze([])
            });
        }));
    }
}
