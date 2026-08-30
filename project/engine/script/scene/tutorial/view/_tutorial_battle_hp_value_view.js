import { drawBattleViewText } from './_tutorial_battle_view_helpers.js';

const HP_VALUE_OPTICAL_CENTER = Object.freeze({ x: -1, y: 1 });

/**
 * 상태 패널의 작은 장식 슬롯에 반올림한 HP 표시값을 그립니다.
 * @param {{render:Function}} port - 텍스트 렌더 포트입니다.
 * @param {object} options - 표시값과 장식 슬롯의 렌더 정보입니다.
 */
export function drawBattleHpValue(port, options) {
    const rect = options?.rect;
    if (!rect) {
        return;
    }
    const font = String(options.font || '8px monospace').replace(
        /(\d+(?:\.\d+)?)px/,
        (_, size) => Math.max(8, Math.round(Number(size) * 0.64)) + 'px'
    );
    drawBattleViewText(port, {
        layer: 'ui',
        text: String(Math.max(0, Math.round(Number(options.value) || 0))),
        x: Math.round(rect.x + (rect.w * 0.5)) + HP_VALUE_OPTICAL_CENTER.x,
        y: Math.round(rect.y + (rect.h * 0.5)) + HP_VALUE_OPTICAL_CENTER.y,
        font,
        fill: options.fill,
        align: 'center'
    });
}
