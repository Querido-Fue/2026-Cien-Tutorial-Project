import {
    measureText,
    render
} from 'display/display_system.js';
import { ColorSchemes } from 'display/_theme_handler.js';
import { getData } from 'data/data_handler.js';
import { clampFiniteNumber, resolveFiniteNumber } from 'util/number_util.js';

const ATTACK_CURSOR_CONSTANTS = getData('CURSOR_CONSTANTS').ATTACK;
const CURSOR_LAYER = 'top';

/**
 * @class UIAttackCursorRenderer
 * @description 공격용 칼 커서와 대상 HP 정보 패널의 기하·렌더링을 소유합니다.
 */
export class UIAttackCursorRenderer {
    #width;
    #height;
    #icon;
    #info;

    /** @param {{width?:number,height?:number}} viewport - 초기 렌더 영역입니다. */
    constructor(viewport = {}) {
        this.#width = Math.max(0, Number(viewport.width) || 0);
        this.#height = Math.max(0, Number(viewport.height) || 0);
        this.#icon = null;
        this.#info = null;
    }

    /** @param {number} width - 전체 너비입니다. @param {number} height - 전체 높이입니다. */
    resize(width, height) {
        this.#width = Math.max(0, Number(width) || 0);
        this.#height = Math.max(0, Number(height) || 0);
    }

    /** @param {object|null} presentation - 칼 에셋과 선택적 대상 정보입니다. */
    setPresentation(presentation) {
        this.#icon = presentation?.icon || null;
        this.#info = this.#normalizeInfo(presentation?.info);
    }

    /** @param {number} x - 칼끝 X입니다. @param {number} y - 칼끝 Y입니다. @returns {boolean} 칼 에셋 렌더 여부입니다. */
    draw(x, y) {
        const pointerX = resolveFiniteNumber(Number(x), 0);
        const pointerY = resolveFiniteNumber(Number(y), 0);
        const iconHeight = Math.round(this.#scaleMetric(
            ATTACK_CURSOR_CONSTANTS.ICON_HEIGHT_WH_RATIO,
            ATTACK_CURSOR_CONSTANTS.ICON_HEIGHT_MIN_PX,
            ATTACK_CURSOR_CONSTANTS.ICON_HEIGHT_MAX_PX
        ));
        const sourceWidth = Number(
            this.#icon?.naturalWidth || this.#icon?.videoWidth || this.#icon?.width
        );
        const sourceHeight = Number(
            this.#icon?.naturalHeight || this.#icon?.videoHeight || this.#icon?.height
        );
        const hasRenderableIcon = this.#icon && sourceWidth > 0 && sourceHeight > 0;
        if (hasRenderableIcon) {
            const iconWidth = Math.max(1, Math.round(iconHeight * (sourceWidth / sourceHeight)));
            render(CURSOR_LAYER, {
                shape: 'image',
                x: Math.round(pointerX - (
                    iconWidth * ATTACK_CURSOR_CONSTANTS.ICON_HOTSPOT_X_RATIO
                )),
                y: Math.round(pointerY - (
                    iconHeight * ATTACK_CURSOR_CONSTANTS.ICON_HOTSPOT_Y_RATIO
                )),
                w: iconWidth,
                h: iconHeight,
                image: this.#icon,
                smoothing: false
            });
        }
        this.#drawInfo(pointerX, pointerY);
        return hasRenderableIcon === true;
    }

    /** 공격 대상의 이름과 예상 HP를 커서 옆에 표시합니다. @private */
    #drawInfo(pointerX, pointerY) {
        const info = this.#info;
        if (!info) {
            return;
        }
        const constants = ATTACK_CURSOR_CONSTANTS.INFO;
        const paddingX = this.#scaleMetric(
            constants.PADDING_X_WH_RATIO,
            constants.PADDING_X_MIN_PX,
            constants.PADDING_X_MAX_PX
        );
        const paddingY = this.#scaleMetric(
            constants.PADDING_Y_WH_RATIO,
            constants.PADDING_Y_MIN_PX,
            constants.PADDING_Y_MAX_PX
        );
        const titleLineHeight = this.#scaleMetric(
            constants.TITLE_LINE_HEIGHT_WH_RATIO,
            constants.TITLE_LINE_HEIGHT_MIN_PX,
            constants.TITLE_LINE_HEIGHT_MAX_PX
        );
        const detailLineHeight = this.#scaleMetric(
            constants.DETAIL_LINE_HEIGHT_WH_RATIO,
            constants.DETAIL_LINE_HEIGHT_MIN_PX,
            constants.DETAIL_LINE_HEIGHT_MAX_PX
        );
        const lineGap = this.#scaleMetric(
            constants.LINE_GAP_WH_RATIO,
            constants.LINE_GAP_MIN_PX,
            constants.LINE_GAP_MAX_PX
        );
        const minimumWidth = this.#scaleMetric(
            constants.MIN_WIDTH_WH_RATIO,
            constants.MIN_WIDTH_MIN_PX,
            constants.MIN_WIDTH_MAX_PX
        );
        const margin = this.#scaleMetric(
            constants.VIEWPORT_MARGIN_WH_RATIO,
            constants.VIEWPORT_MARGIN_MIN_PX,
            constants.VIEWPORT_MARGIN_MAX_PX
        );
        const offsetX = this.#scaleMetric(
            constants.OFFSET_X_WH_RATIO,
            constants.OFFSET_X_MIN_PX,
            constants.OFFSET_X_MAX_PX
        );
        const offsetY = this.#scaleMetric(
            constants.OFFSET_Y_WH_RATIO,
            constants.OFFSET_Y_MIN_PX,
            constants.OFFSET_Y_MAX_PX
        );
        const radius = this.#scaleMetric(
            constants.RADIUS_WH_RATIO,
            constants.RADIUS_MIN_PX,
            constants.RADIUS_MAX_PX
        );
        const contentWidth = Math.max(
            measureText(info.title, info.titleFont),
            measureText(info.detail, info.detailFont)
        );
        const availableWidth = Math.max(1, this.#width - (margin * 2));
        const panelWidth = Math.min(
            Math.max(minimumWidth, contentWidth + (paddingX * 2)),
            availableWidth
        );
        const panelHeight = (paddingY * 2) + titleLineHeight + lineGap + detailLineHeight;
        let panelX = pointerX + offsetX;
        if (panelX + panelWidth > this.#width - margin) {
            panelX = pointerX - offsetX - panelWidth;
        }
        panelX = clampFiniteNumber(
            panelX,
            margin,
            Math.max(margin, this.#width - panelWidth - margin),
            margin
        );
        const panelY = clampFiniteNumber(
            pointerY + offsetY,
            margin,
            Math.max(margin, this.#height - panelHeight - margin),
            margin
        );

        render(CURSOR_LAYER, {
            shape: 'roundRect',
            x: panelX,
            y: panelY,
            w: panelWidth,
            h: panelHeight,
            radius,
            fill: info.colors.panel,
            stroke: info.colors.border,
            lineWidth: constants.BORDER_WIDTH_PX
        });
        render(CURSOR_LAYER, {
            shape: 'text',
            x: panelX + paddingX,
            y: panelY + paddingY,
            text: info.title,
            font: info.titleFont,
            fill: info.colors.title,
            align: 'left',
            baseline: 'top'
        });
        render(CURSOR_LAYER, {
            shape: 'text',
            x: panelX + paddingX,
            y: panelY + paddingY + titleLineHeight + lineGap,
            text: info.detail,
            font: info.detailFont,
            fill: info.colors.detail,
            align: 'left',
            baseline: 'top'
        });
    }

    /** @param {object|null} info @returns {object|null} 렌더 가능한 정보입니다. @private */
    #normalizeInfo(info) {
        const title = String(info?.title || '').trim();
        const detail = String(info?.detail || '').trim();
        const titleFont = String(info?.titleFont || '').trim();
        const detailFont = String(info?.detailFont || '').trim();
        if (!title || !detail || !titleFont || !detailFont) {
            return null;
        }
        return Object.freeze({
            title,
            detail,
            titleFont,
            detailFont,
            colors: Object.freeze({
                panel: String(info?.colors?.panel || ColorSchemes.Background),
                border: String(info?.colors?.border || ColorSchemes.Cursor.Active),
                title: String(info?.colors?.title || ColorSchemes.Cursor.White),
                detail: String(info?.colors?.detail || ColorSchemes.Cursor.White)
            })
        });
    }

    /** @returns {number} 화면 높이에 맞춘 커서 픽셀 값입니다. @private */
    #scaleMetric(ratio, minimum, maximum) {
        return clampFiniteNumber(
            this.#height * resolveFiniteNumber(Number(ratio), 0),
            minimum,
            maximum,
            minimum
        );
    }
}
