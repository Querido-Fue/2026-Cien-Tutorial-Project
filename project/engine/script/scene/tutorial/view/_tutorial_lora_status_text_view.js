import { drawBattleViewText } from './_tutorial_battle_view_helpers.js';

/**
 * Canvas 글꼴의 픽셀 크기를 바꿉니다.
 * @param {string} font - 원본 Canvas 글꼴입니다.
 * @param {number} size - 적용할 픽셀 크기입니다.
 * @returns {string} 크기가 바뀐 Canvas 글꼴입니다.
 */
function resizeFont(font, size) {
    return String(font || '12px sans-serif').replace(
        /(\d+(?:\.\d+)?)px/,
        `${size}px`
    );
}

/**
 * 두 문장이 원본 패널의 안전 폭 안에 들어가도록 글꼴을 축소합니다.
 * @param {{measureText?:Function}} port - 텍스트 측정 포트입니다.
 * @param {string} font - 기준 글꼴입니다.
 * @param {string[]} lines - 표시할 두 문장입니다.
 * @param {number} maxWidth - 허용 폭입니다.
 * @param {number} scale - 기준 글꼴 배율입니다.
 * @param {number} minSize - 최소 픽셀 크기입니다.
 * @returns {string} 안전 폭에 맞춘 글꼴입니다.
 */
function fitStatusFont(port, font, lines, maxWidth, scale, minSize) {
    const match = String(font || '').match(/(\d+(?:\.\d+)?)px/);
    const baseSize = Number(match?.[1]) || 12;
    let size = Math.max(minSize, baseSize * scale);
    let fittedFont = resizeFont(font, Number(size.toFixed(2)));
    if (typeof port.measureText !== 'function' || !(maxWidth > 0)) {
        return fittedFont;
    }
    const widest = Math.max(
        0,
        ...lines.map((line) => Number(port.measureText(line, fittedFont)) || 0)
    );
    if (widest > maxWidth) {
        size = Math.max(minSize, Math.floor(size * (maxWidth / widest)));
        fittedFont = resizeFont(font, size);
    }
    return fittedFont;
}

/**
 * 로라의 현재 상태와 예측 행동을 원본 패널의 두 문장으로 그립니다.
 * @param {{render:Function,measureText?:Function}} port - HUD 렌더 포트입니다.
 * @param {object} options - 문구 데이터와 패널 내부 렌더 정보입니다.
 */
export function drawTutorialLoraStatusText(port, options = {}) {
    const copy = options.copy || {};
    const lines = [
        copy.STATES?.[options.stateId] || copy.STATES?.unknown || '',
        copy.ACTIONS?.[options.actionType] || copy.ACTIONS?.unknown || ''
    ];
    const lineRects = Array.isArray(options.lineRects) ? options.lineRects : [];
    if (lineRects.length < 2 || lines.every((line) => !line)) {
        return;
    }
    const maxWidth = Math.min(...lineRects.slice(0, 2).map(
        (rect) => Math.max(0, Number(rect?.w) || 0)
    ));
    const font = fitStatusFont(
        port,
        options.font,
        lines,
        maxWidth,
        Number(options.fontScale) || 1,
        Math.max(1, Number(options.minFontSize) || 8)
    );
    lines.forEach((line, index) => {
        const rect = lineRects[index];
        if (!line || !rect) {
            return;
        }
        drawBattleViewText(port, {
            layer: 'ui',
            text: line,
            x: rect.x,
            y: Math.round(rect.y + (rect.h * 0.5)),
            font,
            fill: options.fill,
            align: 'left'
        });
    });
}
