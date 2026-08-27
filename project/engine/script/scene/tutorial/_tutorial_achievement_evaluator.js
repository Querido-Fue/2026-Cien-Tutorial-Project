/**
 * @class TutorialAchievementEvaluator
 * @description 안정된 모델 사건을 임시 업적 조건과 대조해 새 해금 알림만 생성합니다.
 */
export class TutorialAchievementEvaluator {
    #definitions;

    /** @param {readonly object[]} definitions - ID와 사건 조건을 가진 업적 정의입니다. */
    constructor(definitions = []) {
        this.#definitions = this.#normalizeDefinitions(definitions);
    }

    /**
     * 모델 사건에서 아직 저장되지 않은 업적을 원본 정의 순서로 판정합니다.
     * @param {readonly object[]} events - 모델이 반환한 사건입니다.
     * @param {readonly string[]} unlockedIds - 저장된 업적 ID입니다.
     * @returns {{unlockedIds:readonly string[],notifications:readonly object[]}} 새 해금 결과입니다.
     */
    evaluate(events, unlockedIds = []) {
        const eventList = Array.isArray(events) ? events : [];
        const knownIds = new Set(Array.isArray(unlockedIds) ? unlockedIds : []);
        const newlyUnlockedIds = [];
        const notifications = [];
        for (const definition of this.#definitions) {
            if (knownIds.has(definition.id)
                || !eventList.some((event) => this.#matches(event, definition.condition))) {
                continue;
            }
            knownIds.add(definition.id);
            newlyUnlockedIds.push(definition.id);
            notifications.push(Object.freeze({
                key: 'achievement:' + definition.id,
                title: '업적 달성',
                detail: definition.title
            }));
        }
        return Object.freeze({
            unlockedIds: Object.freeze(newlyUnlockedIds),
            notifications: Object.freeze(notifications)
        });
    }

    /** @param {object} event @param {object} condition @returns {boolean} 사건 일치 여부입니다. @private */
    #matches(event, condition) {
        if (!event || event.type !== condition.eventType) {
            return false;
        }
        if (!condition.field) {
            return true;
        }
        return event[condition.field] === condition.equals;
    }

    /** @param {readonly object[]} definitions @returns {readonly object[]} 검증된 불변 정의입니다. @private */
    #normalizeDefinitions(definitions) {
        if (!Array.isArray(definitions)) {
            throw new TypeError('TutorialAchievementEvaluator: 업적 정의 배열이 필요합니다.');
        }
        const ids = new Set();
        return Object.freeze(definitions.map((definition, index) => {
            const id = typeof definition?.id === 'string' ? definition.id.trim() : '';
            const title = typeof definition?.title === 'string' ? definition.title : '';
            const condition = definition?.condition;
            if (!id || ids.has(id) || !title || typeof condition?.eventType !== 'string') {
                throw new TypeError(`TutorialAchievementEvaluator: 업적 정의 ${index}가 올바르지 않습니다.`);
            }
            ids.add(id);
            return Object.freeze({
                id,
                title,
                condition: Object.freeze({
                    eventType: condition.eventType,
                    field: typeof condition.field === 'string' ? condition.field : null,
                    equals: condition.equals
                })
            });
        }));
    }
}
