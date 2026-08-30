import { getCanvas, getWW, getWH, render } from 'display/display_system.js';
import { getDelta } from 'engine/time_handler.js';
import { animate, remove } from 'animation/animation_system.js';
import { getMouseInput, isMousePressing } from 'input/input_system.js';
import { getData } from 'data/data_handler.js';
import { ColorSchemes } from 'display/_theme_handler.js';
import { toRadians } from 'util/math_util.js';
import { clampFiniteNumber, resolveFiniteNumber } from 'util/number_util.js';
import { UIAttackCursorRenderer } from './_ui_attack_cursor_renderer.js';

const CURSOR_CONSTANTS = getData('CURSOR_CONSTANTS');
const NORMAL_CURSOR_CONSTANTS = CURSOR_CONSTANTS.NORMAL;
const CURSOR_LAYER = 'top';
const NORMAL_CURSOR_TYPE = 'normal';
const ATTACK_CURSOR_TYPE = 'attack';
const NORMAL_CURSOR_ANIMATION_TYPE = 'easeOutExpo';

/**
 * @class UICursor
 * @description 엔진 커서의 위치/상태를 업데이트하고 현재 커서 타입에 맞게 그립니다.
 */
export class UICursor {
    #x;
    #y;
    #defaultSubCircleRadius;
    #defaultSubCircleAlpha;
    #type;
    #attackRenderer;
    #normalAnimTime;
    #normalAnimDuration;
    #normalRadiusAnimId;
    #normalAlphaAnimId;
    #clicking;
    #visible;

    /**
     * UI 커서 상태를 생성합니다.
     */
    constructor() {
        this.#x = 0;
        this.#y = 0;

        this.WW = getWW();
        this.WH = getWH();
        this.#defaultSubCircleRadius = this.WH * NORMAL_CURSOR_CONSTANTS.SUB_CIRCLE_RADIUS_WH_RATIO;
        this._subCircleRadius = this.#defaultSubCircleRadius;
        this.#defaultSubCircleAlpha = NORMAL_CURSOR_CONSTANTS.SUB_CIRCLE_ALPHA;
        this._subCircleAlpha = this.#defaultSubCircleAlpha;
        this.#type = NORMAL_CURSOR_TYPE;
        this.#attackRenderer = new UIAttackCursorRenderer({
            width: this.WW,
            height: this.WH
        });
        this.#normalAnimTime = 0;
        this.#normalAnimDuration = NORMAL_CURSOR_CONSTANTS.ANIM_DURATION;
        this.#normalRadiusAnimId = -1;
        this.#normalAlphaAnimId = -1;
        this.#clicking = false;
        this.#visible = true;
    }

    /**
     * 해상도 변경 시 커서 내부 원 크기 등의 배율을 새 WH 기준으로 재계산합니다.
     */
    resize() {
        this.WW = getWW();
        this.WH = getWH();
        this.#defaultSubCircleRadius = this.WH * NORMAL_CURSOR_CONSTANTS.SUB_CIRCLE_RADIUS_WH_RATIO;
        this.#attackRenderer.resize(this.WW, this.WH);
        this.#syncNormalCursorSizeForResolution();
    }

    /**
     * 커서 상태를 업데이트합니다.
     * 마우스 입력에 따라 애니메이션을 처리합니다.
     */
    update() {
        if (!this.#visible) {
            return;
        }

        this.#x = resolveFiniteNumber(Number(getMouseInput('x')), 0);
        this.#y = resolveFiniteNumber(Number(getMouseInput('y')), 0);

        if (isMousePressing('left')) {
            if (this.#type === NORMAL_CURSOR_TYPE) {
                if (!this.#clicking) {
                    remove(this.#normalRadiusAnimId);
                    remove(this.#normalAlphaAnimId);
                    const duration = this.#normalAnimDuration - this.#normalAnimTime;
                    this.#normalRadiusAnimId = this._startNormalCursorAnimation(
                        '_subCircleRadius',
                        this.#defaultSubCircleRadius * NORMAL_CURSOR_CONSTANTS.CLICK_RADIUS_MULTIPLIER,
                        duration
                    );
                    this.#normalAlphaAnimId = this._startNormalCursorAnimation(
                        '_subCircleAlpha',
                        this.#defaultSubCircleAlpha * NORMAL_CURSOR_CONSTANTS.CLICK_ALPHA_MULTIPLIER,
                        duration
                    );
                }
                this.#normalAnimTime += getDelta();
                if (this.#normalAnimTime >= this.#normalAnimDuration) {
                    this.#normalAnimTime = this.#normalAnimDuration;
                }
                this.#clicking = true;
            }
        } else {
            if (this.#type === NORMAL_CURSOR_TYPE) {
                if (this.#clicking) {
                    remove(this.#normalRadiusAnimId);
                    remove(this.#normalAlphaAnimId);
                    this.#normalRadiusAnimId = this._startNormalCursorAnimation(
                        '_subCircleRadius',
                        this.#defaultSubCircleRadius,
                        this.#normalAnimTime
                    );
                    this.#normalAlphaAnimId = this._startNormalCursorAnimation(
                        '_subCircleAlpha',
                        this.#defaultSubCircleAlpha,
                        this.#normalAnimTime
                    );
                }
                this.#normalAnimTime -= getDelta();
                if (this.#normalAnimTime <= 0) {
                    this.#normalAnimTime = 0;
                }
                this.#clicking = false;
            }
        }
    }

    /**
     * 커서를 그립니다.
     */
    draw() {
        if (!this.#visible) {
            return;
        }

        if (this.#type === NORMAL_CURSOR_TYPE) {
            this._drawNormalCursor();
        } else if (this.#type === ATTACK_CURSOR_TYPE) {
            this._drawAttackCursor();
        }
    }

    /**
     * 커서를 초기화합니다.
     */
    init() { return Promise.resolve(); }

    /**
     * 커서 가시성을 설정합니다.
     * 비표시 전환 시 마지막 프레임 잔상을 제거하기 위해 top 캔버스를 즉시 비웁니다.
     * @param {boolean} isVisible - 표시 여부입니다.
     */
    setVisible(isVisible) {
        const nextVisible = isVisible === true;
        if (this.#visible === nextVisible) {
            return;
        }

        this.#visible = nextVisible;
        if (!nextVisible) {
            this.#clearCursorLayer();
        }
    }

    /**
     * 장면이 요청한 커서 종류와 포인터 옆 정보 표시를 반영합니다.
     * null 또는 잘못된 요청은 일반 커서로 안전하게 되돌립니다.
     * @param {object|null} presentation - 커서 종류와 선택적 정보 패널입니다.
     */
    setPresentation(presentation = null) {
        const nextType = presentation?.type === ATTACK_CURSOR_TYPE
            ? ATTACK_CURSOR_TYPE
            : NORMAL_CURSOR_TYPE;
        const typeChanged = nextType !== this.#type;
        this.#type = nextType;
        this.#attackRenderer.setPresentation(
            nextType === ATTACK_CURSOR_TYPE ? presentation : null
        );
        if (typeChanged) {
            this.#syncNormalCursorSizeForResolution();
        }
    }

    /**
     * normal 커서 애니메이션을 시작합니다.
     * @param {string} variable - 애니메이션 대상 속성 이름입니다.
     * @param {number} endValue - 애니메이션 종료 값입니다.
     * @param {number} duration - 애니메이션 지속 시간입니다.
     * @returns {number} 생성된 애니메이션 ID입니다.
     */
    _startNormalCursorAnimation(variable, endValue, duration) {
        return animate(this, {
            variable,
            startValue: 'current',
            endValue,
            type: NORMAL_CURSOR_ANIMATION_TYPE,
            duration: clampFiniteNumber(Number(duration), 0, Infinity, 0)
        }).id;
    }

    /**
     * normal 커서를 렌더링합니다.
     */
    _drawNormalCursor() {
        const angle = NORMAL_CURSOR_CONSTANTS.ARROW_ROTATION_DEG;
        const angleRad = toRadians(angle);
        this._drawNormalCursorArrow(
            NORMAL_CURSOR_CONSTANTS.LARGE_ARROW_SIZE_WH_RATIO,
            angle,
            angleRad,
            ColorSchemes.Cursor.Fill
        );
        this._drawNormalCursorArrow(
            NORMAL_CURSOR_CONSTANTS.SMALL_ARROW_SIZE_WH_RATIO,
            angle,
            angleRad,
            ColorSchemes.Cursor.Active
        );
        const subCircleX = this.#x
            + (this._subCircleRadius / 2)
            + (this.WH * NORMAL_CURSOR_CONSTANTS.SUB_CIRCLE_OFFSET_X_WH_RATIO);
        const subCircleY = this.#y
            + (this._subCircleRadius / 2)
            + (this.WH * NORMAL_CURSOR_CONSTANTS.SUB_CIRCLE_OFFSET_Y_WH_RATIO);
        if (this._subCircleRadius <= 0 || this._subCircleAlpha <= 0) {
            return;
        }
        render(CURSOR_LAYER, {
            shape: 'circle',
            x: subCircleX,
            y: subCircleY,
            radius: this._subCircleRadius,
            fill: ColorSchemes.Cursor.Active,
            alpha: this._subCircleAlpha
        });
    }

    /**
     * normal 커서의 화살표 한 겹을 렌더링합니다.
     * @param {number} sizeRatio - WH 기준 크기 비율입니다.
     * @param {number} angle - 회전 각도입니다.
     * @param {number} angleRad - 회전 라디안입니다.
     * @param {string} fill - 채움 색상입니다.
     */
    _drawNormalCursorArrow(sizeRatio, angle, angleRad, fill) {
        const size = this.WH * sizeRatio;
        const offsetX = (size / 2) * Math.sin(angleRad);
        const offsetY = (-size / 2) * Math.cos(angleRad);
        render(CURSOR_LAYER, {
            shape: 'arrow',
            x: this.#x - offsetX,
            y: this.#y - offsetY,
            w: size,
            h: size,
            rotation: angle,
            fill
        });
    }

    /**
     * attack 커서를 렌더링합니다.
     */
    _drawAttackCursor() {
        if (!this.#attackRenderer.draw(this.#x, this.#y)) {
            this._drawNormalCursor();
        }
    }

    /**
     * 해상도 변경 직후 남아 있는 커서 애니메이션 값을 새 기준 크기에 맞춥니다.
     * @private
     */
    #syncNormalCursorSizeForResolution() {
        remove(this.#normalRadiusAnimId);
        remove(this.#normalAlphaAnimId);
        this.#normalRadiusAnimId = -1;
        this.#normalAlphaAnimId = -1;

        if (this.#type !== NORMAL_CURSOR_TYPE) {
            return;
        }

        const isClicking = this.#clicking === true || isMousePressing('left');
        this._subCircleRadius = this.#defaultSubCircleRadius * (
            isClicking
                ? NORMAL_CURSOR_CONSTANTS.CLICK_RADIUS_MULTIPLIER
                : 1
        );
        this._subCircleAlpha = this.#defaultSubCircleAlpha * (
            isClicking
                ? NORMAL_CURSOR_CONSTANTS.CLICK_ALPHA_MULTIPLIER
                : 1
        );
        this.#normalAnimTime = isClicking ? this.#normalAnimDuration : 0;
        this.#clicking = isClicking;
    }

    /**
     * @private
     * 커서가 그려지는 top 캔버스를 즉시 비웁니다.
     */
    #clearCursorLayer() {
        const canvas = getCanvas('top');
        const context = canvas?.getContext?.('2d');
        if (!canvas || !context) {
            return;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
    }
}
