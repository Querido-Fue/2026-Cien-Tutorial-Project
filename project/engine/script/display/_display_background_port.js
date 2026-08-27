let backgroundSetter = null;

/**
 * 표시 시스템이 소유한 WebGL 배경색 적용 함수를 등록합니다.
 * @param {((r:number,g:number,b:number)=>void)|null} setter - 배경색 적용 함수입니다.
 */
export function registerDisplayBackgroundSetter(setter) {
    backgroundSetter = typeof setter === 'function' ? setter : null;
}

/**
 * 테마 계층에서 표시 시스템을 역참조하지 않고 현재 배경색을 요청합니다.
 * @param {number} r - red 채널입니다.
 * @param {number} g - green 채널입니다.
 * @param {number} b - blue 채널입니다.
 * @returns {boolean} 등록된 표시 대상에 전달했는지 여부입니다.
 */
export function setDisplayBackgroundColor(r, g, b) {
    if (!backgroundSetter) {
        return false;
    }
    backgroundSetter(r, g, b);
    return true;
}
