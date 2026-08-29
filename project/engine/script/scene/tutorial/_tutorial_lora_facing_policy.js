const FACING_EPSILON = 0.001;

/**
 * 로라가 사용할 수 있는 전면 방향으로 폴백 값을 정규화합니다.
 * @param {*} value - 후보 방향입니다.
 * @returns {'left'|'right'} 전면 방향입니다.
 */
function normalizeFrontFacing(value) {
    return value === 'right' ? 'right' : 'left';
}

/**
 * 쿼터뷰 화면의 좌우 성분을 따라 로라가 목표를 향하되 후면 행은 선택하지 않습니다.
 * 타일 X는 화면 오른쪽 아래, Y는 화면 왼쪽 아래로 투영되므로 `dx - dy`가
 * 화면상의 수평 방향을 나타냅니다.
 * @param {object} from - 로라의 타일 좌표입니다.
 * @param {object} to - 바라볼 목표의 타일 좌표입니다.
 * @param {'left'|'right'} [fallback='left'] - 수평 성분이 없을 때 전면 방향입니다.
 * @returns {'left'|'right'} 목표에 가장 가까운 전면 방향입니다.
 */
export function resolveLoraFrontFacing(from, to, fallback = 'left') {
    const dx = Number(to?.x) - Number(from?.x);
    const dy = Number(to?.y) - Number(from?.y);
    const normalizedFallback = normalizeFrontFacing(fallback);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
        return normalizedFallback;
    }

    const projectedHorizontal = dx - dy;
    if (Math.abs(projectedHorizontal) <= FACING_EPSILON) {
        return normalizedFallback;
    }
    return projectedHorizontal < 0 ? 'left' : 'right';
}
