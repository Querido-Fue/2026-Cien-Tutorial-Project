const UI_INPUT_FOCUS_LAYER = 'ui';
const UI_RENDER_SUBLAYERS = Object.freeze(new Set(['top']));

/**
 * UI 요소의 렌더 레이어가 현재 마우스 입력 포커스를 받을 수 있는지 판정합니다.
 * `top`은 별도 캔버스지만 입력 의미상 `ui` 도메인에 속합니다.
 * @param {string} renderLayer - 요소가 그려지는 캔버스 레이어입니다.
 * @param {readonly string[]} focusList - 현재 활성 입력 포커스 목록입니다.
 * @returns {boolean} 요소가 포인터 입력을 받을 수 있으면 true입니다.
 */
export function isUiInputFocused(renderLayer, focusList) {
    if (!Array.isArray(focusList)) {
        return false;
    }
    if (focusList.includes(renderLayer)) {
        return true;
    }
    return UI_RENDER_SUBLAYERS.has(renderLayer)
        && focusList.includes(UI_INPUT_FOCUS_LAYER);
}
