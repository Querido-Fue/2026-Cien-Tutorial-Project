import { UIPool, releaseUIItem } from 'ui/_ui_pool.js';
import { fitTutorialAssetRect } from './_tutorial_asset_view_helpers.js';

/**
 * @class TutorialButtonHost
 * @description 튜토리얼 버튼의 풀 수명과 명령·포인터 포커스 포트 전달을 소유합니다.
 */
export class TutorialButtonHost {
    #parent;
    #onCommand;
    #onFocus;
    #assetPort;
    #renderPort;
    #buttons;
    #signature;

    /**
     * @param {object} options - 버튼 호스트 의존성입니다.
     * @param {object} options.parent - UI 요소의 부모 객체입니다.
     * @param {Function} options.onCommand - 명령 의도를 씬으로 전달하는 콜백입니다.
     * @param {Function} [options.onFocus] - 포인터 포커스 키를 씬으로 전달하는 콜백입니다.
     * @param {object} [options.assetPort] - 버튼 배경 에셋 읽기 포트입니다.
     * @param {object} [options.renderPort] - 아이콘 렌더 포트입니다.
     */
    constructor({
        parent,
        onCommand,
        onFocus = () => {},
        assetPort = {},
        renderPort = {}
    }) {
        this.#parent = parent;
        this.#onCommand = onCommand;
        this.#onFocus = onFocus;
        this.#assetPort = assetPort;
        this.#renderPort = renderPort;
        this.#buttons = {};
        this.#signature = null;
    }

    /**
     * 현재 버튼 구성이 지정 서명과 같은지 확인합니다.
     * @param {string} signature - 버튼 구성 서명입니다.
     * @returns {boolean} 같은 구성이면 true입니다.
     */
    isCurrent(signature) {
        return this.#signature === signature;
    }

    /** 다음 갱신에서 버튼을 다시 만들도록 서명을 무효화합니다. */
    invalidate() {
        this.#signature = null;
    }

    /**
     * 버튼 사양을 풀 기반 UI 요소로 교체합니다.
     * @param {string} signature - 버튼 구성 서명입니다.
     * @param {object[]} specs - 버튼 사양 목록입니다.
     * @param {object} style - 공통 글꼴·색·애니메이션 스타일입니다.
     */
    setButtons(signature, specs, style) {
        if (this.isCurrent(signature)) {
            return;
        }
        this.#releaseButtons();
        this.#signature = signature;
        for (const spec of specs) {
            this.#createButton(spec, style);
        }
    }

    /** 모든 버튼의 포인터 상호작용을 갱신합니다. */
    update() {
        for (const button of Object.values(this.#buttons)) {
            button.item.update();
        }
    }

    /** 모든 버튼을 UI 레이어에 그립니다. */
    draw() {
        for (const button of Object.values(this.#buttons)) {
            button.item.draw();
        }
    }

    /** 소유한 풀 요소를 반납하고 호스트를 초기화합니다. */
    destroy() {
        this.#releaseButtons();
        this.#signature = null;
    }

    /**
     * 단일 버튼 사양을 풀 요소로 변환합니다.
     * @param {object} spec - 버튼 사양입니다.
     * @param {object} style - 공통 스타일입니다.
     * @private
     */
    #createButton(spec, style) {
        if (!spec || typeof spec.key !== 'string') {
            return;
        }
        const enabled = spec.enabled !== false;
        const inspectable = spec.inspectable === true || enabled;
        const icon = spec.icon || this.#createItemIconChild(spec.iconId, spec.iconWidth);
        const backgroundImage = spec.backgroundAssetKey
            ? this.#assetPort.getUiAsset?.(spec.backgroundAssetKey)
            : null;
        const visualRect = spec.fitHitToBackground === true && backgroundImage
            ? fitTutorialAssetRect(backgroundImage, spec)
            : null;
        const interactiveRect = visualRect || spec;
        const textElement = UIPool.text_element.get();
        textElement.init({
            parent: this.#parent,
            layer: 'ui',
            text: spec.label,
            font: style.font.family,
            fontWeight: style.font.weight,
            size: style.font.size,
            color: enabled
                ? (spec.textColor || style.colors.text)
                : style.colors.muted,
            align: 'center'
        });
        const button = UIPool.button.get();
        button.init({
            parent: this.#parent,
            layer: 'ui',
            x: interactiveRect.x,
            y: interactiveRect.y,
            width: interactiveRect.w,
            height: interactiveRect.h,
            center: icon ? [icon, textElement] : [textElement],
            itemSpacing: spec.itemSpacing,
            radius: spec.radius ?? style.defaultRadius,
            shadow: spec.shadow,
            backgroundImage,
            drawBackground: spec.drawBackground !== false,
            backgroundImageAlpha: enabled
                ? (spec.backgroundImageAlpha ?? 1)
                : (spec.backgroundImageAlpha ?? 1) * 0.32,
            idleColor: enabled || spec.focused
                ? (spec.active || spec.focused
                    ? style.colors.accent
                    : spec.idleColor || style.colors.idle)
                : style.colors.disabled,
            hoverColor: inspectable
                ? (spec.hoverColor || style.colors.hover)
                : style.colors.disabled,
            color: style.colors.text,
            clickAble: inspectable,
            tooltip: spec.tooltip,
            onHover: () => {
                this.#onFocus(spec.key);
                return spec.tooltip;
            },
            onClick: () => {
                if (enabled) {
                    this.#activate(spec);
                }
            }
        });
        button.clickAble = inspectable;
        button.hoverScaleMultiplier = style.hoverScale;
        button.pressScaleMultiplier = style.pressScale;
        this.#buttons[spec.key] = { item: button, text: textElement };
    }

    /**
     * 논리 아이템 ID를 버튼 레이아웃이 그릴 수 있는 픽셀 이미지 자식으로 바꿉니다.
     * @param {string|null} itemId - 아이템 ID입니다.
     * @param {number} width - 버튼 내부 아이콘 폭입니다.
     * @returns {object|null} 버튼용 이미지 자식입니다.
     * @private
     */
    #createItemIconChild(itemId, width) {
        const image = itemId ? this.#assetPort.getItemIcon?.(itemId) : null;
        if (!image || !Number.isFinite(width) || width <= 0
            || typeof this.#renderPort.render !== 'function') {
            return null;
        }
        return {
            type: 'tutorial-item-icon',
            width,
            draw: (layer, x, y, w, h, scale, alpha) => {
                this.#renderPort.render(layer, {
                    shape: 'image',
                    image,
                    x: Math.round(x),
                    y: Math.round(y),
                    w: Math.round(w),
                    h: Math.round(h),
                    alpha,
                    smoothing: false
                });
            }
        };
    }

    /**
     * 버튼의 명령 의도 또는 씬 소유 로컬 UI 동작을 전달합니다.
     * @param {object} spec - 활성화된 버튼 사양입니다.
     * @private
     */
    #activate(spec) {
        if (typeof spec.onActivate === 'function') {
            spec.onActivate();
            return;
        }
        if (typeof spec.command?.type === 'string') {
            this.#onCommand(spec.command.type, spec.command.payload);
        }
    }

    /** 소유한 모든 버튼을 재귀적 UI 풀 반환 경로로 반납합니다. @private */
    #releaseButtons() {
        for (const button of Object.values(this.#buttons)) {
            releaseUIItem(button?.item);
        }
        this.#buttons = {};
    }
}
