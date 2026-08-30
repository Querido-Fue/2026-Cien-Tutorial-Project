/**
 * @class TutorialRecordSpawnPlanner
 * @description 미획득 기록과 층별 후보 좌표를 독립 추첨해 한 페이즈에 최대 하나를 배치합니다.
 */
export class TutorialRecordSpawnPlanner {
    #recordIds;
    #spawnPointsByFloor;
    #random;

    /**
     * @param {readonly object[]} floors - 기록 ID와 후보 좌표를 제공하는 정규화된 층 설정입니다.
     * @param {{random?:()=>number}} [options={}] - 0 이상 1 미만을 반환하는 난수 공급자입니다.
     */
    constructor(floors, options = {}) {
        if (!Array.isArray(floors) || floors.length === 0) {
            throw new TypeError('TutorialRecordSpawnPlanner: 층 설정이 필요합니다.');
        }
        const random = options.random ?? Math.random;
        if (typeof random !== 'function') {
            throw new TypeError('TutorialRecordSpawnPlanner: random은 함수여야 합니다.');
        }

        const recordIds = [];
        this.#spawnPointsByFloor = floors.map((floor, floorIndex) => {
            if (!Array.isArray(floor?.records) || floor.records.length === 0) {
                throw new TypeError(
                    `TutorialRecordSpawnPlanner: FLOORS[${floorIndex}]에 기록 스폰포인트가 필요합니다.`
                );
            }
            return floor.records.map(({ id, recordId, x, y }, recordIndex) => {
                if (typeof recordId !== 'string' || recordId.length === 0) {
                    throw new TypeError(
                        `TutorialRecordSpawnPlanner: FLOORS[${floorIndex}].records[${recordIndex}]의 기록 ID가 필요합니다.`
                    );
                }
                recordIds.push(recordId);
                return { id, x, y };
            });
        });
        this.#recordIds = [...new Set(recordIds)];
        this.#random = random;
    }

    /**
     * 미획득 기록을 중복 없이 뽑아 각 층의 무작위 스폰포인트 하나에 배치합니다.
     * @param {Set<string>|readonly string[]} [unlockedRecordIds=[]] - 영구 해금된 기록 ID입니다.
     * @returns {Array<Array<{id:string,recordId:string,x:number,y:number}>>} 층별 런타임 기록입니다.
     */
    createFloorRecords(unlockedRecordIds = []) {
        const unlocked = unlockedRecordIds instanceof Set
            ? unlockedRecordIds
            : new Set(Array.isArray(unlockedRecordIds) ? unlockedRecordIds : []);
        const remainingRecordIds = this.#recordIds.filter((recordId) => !unlocked.has(recordId));

        return this.#spawnPointsByFloor.map((spawnPoints) => {
            if (remainingRecordIds.length === 0) {
                return [];
            }
            const recordIndex = this.#drawIndex(remainingRecordIds.length);
            const [recordId] = remainingRecordIds.splice(recordIndex, 1);
            const spawnPoint = spawnPoints[this.#drawIndex(spawnPoints.length)];
            return [{ ...spawnPoint, recordId }];
        });
    }

    /** 난수 공급자의 값을 배열 인덱스로 변환합니다. @param {number} length @returns {number} @private */
    #drawIndex(length) {
        const value = Number(this.#random());
        if (!Number.isFinite(value) || value < 0 || value >= 1) {
            throw new RangeError('TutorialRecordSpawnPlanner: random은 0 이상 1 미만이어야 합니다.');
        }
        return Math.floor(value * length);
    }
}
