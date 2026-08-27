/**
 * 숫자를 지정한 범위 안으로 제한합니다.
 * @param {*} value - 제한할 값입니다.
 * @param {number} min - 최솟값입니다.
 * @param {number} max - 최댓값입니다.
 * @returns {number} 제한된 숫자입니다.
 */
export function clampNumber(value, min, max) {
    return Math.min(Math.max(Number(value) || 0, min), max);
}

/**
 * 타일 좌표를 조회 키로 변환합니다.
 * @param {number} x - 타일 X 좌표입니다.
 * @param {number} y - 타일 Y 좌표입니다.
 * @returns {string} 좌표 키입니다.
 */
export function toTileKey(x, y) {
    return String(x) + ',' + String(y);
}

/**
 * 좌표처럼 보이는 값을 안전한 타일 좌표로 복제합니다.
 * @param {*} value - 원본 값입니다.
 * @returns {{x:number,y:number}|null} 좌표 복제본입니다.
 */
export function cloneTile(value) {
    const x = Number(value?.x);
    const y = Number(value?.y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
        return null;
    }
    return { x, y };
}

/**
 * 배열 또는 Map 값을 반복 가능한 배열로 정규화합니다.
 * @param {*} value - 원본 값입니다.
 * @returns {Array} 배열입니다.
 */
export function toList(value) {
    if (Array.isArray(value)) {
        return value;
    }
    if (value instanceof Map) {
        return Array.from(value.values());
    }
    return [];
}

/**
 * 배열, Map, Set과 일반 객체를 순환 참조까지 보존하며 방어 복제합니다.
 * @param {*} value - 복제할 값입니다.
 * @param {WeakMap<object, *>} [seen] - 순환 참조 방지 지도입니다.
 * @returns {*} 독립 복제본입니다.
 */
export function cloneValue(value, seen = new WeakMap()) {
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (seen.has(value)) {
        return seen.get(value);
    }
    if (Array.isArray(value)) {
        const copy = [];
        seen.set(value, copy);
        value.forEach((entry) => copy.push(cloneValue(entry, seen)));
        return copy;
    }
    if (value instanceof Map) {
        const copy = new Map();
        seen.set(value, copy);
        for (const [key, entry] of value.entries()) {
            copy.set(cloneValue(key, seen), cloneValue(entry, seen));
        }
        return copy;
    }
    if (value instanceof Set) {
        const copy = new Set();
        seen.set(value, copy);
        for (const entry of value.values()) {
            copy.add(cloneValue(entry, seen));
        }
        return copy;
    }
    const copy = {};
    seen.set(value, copy);
    for (const [key, entry] of Object.entries(value)) {
        copy[key] = cloneValue(entry, seen);
    }
    return copy;
}

/**
 * 직렬화 가능한 두 값을 기존 메타 비교 규칙으로 비교합니다.
 * @param {*} left - 왼쪽 값입니다.
 * @param {*} right - 오른쪽 값입니다.
 * @returns {boolean} JSON 표현이 같으면 true입니다.
 */
export function areSerializableValuesEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
