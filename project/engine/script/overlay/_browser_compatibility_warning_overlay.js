import { BaseOverlay } from './_base_overlay.js';
import { getLangString } from 'ui/ui_system.js';
import { ColorSchemes } from 'display/_theme_handler.js';
import { LayoutHandler } from 'ui/layout/_layout_handler.js';
import { getData } from 'data/data_handler.js';
import { applyOverlayConfirmButtonIcon } from './_overlay_confirm_icon.js';

const EXIT_LAYOUT_CONSTANTS = getData('OVERLAY_LAYOUT_CONSTANTS').EXIT;

/**
 * @class BrowserCompatibilityWarningOverlay
 * @description 비 Chromium 브라우저의 실행 호환성 안내 오버레이입니다.
 */
export class BrowserCompatibilityWarningOverlay extends BaseOverlay {
    constructor() {
        super({
            layer: 100,
            dim: 0.28,
            transparent: true,
            blurUpdateMode: 'always'
        });
    }

    /** @override 권장 브라우저 안내를 종료 오버레이와 같은 크기로 맞춥니다. */
    _onResize() {
        this.width = this.UIWW * EXIT_LAYOUT_CONSTANTS.WIDTH_UIWW_RATIO;
        this.height = this.WH * EXIT_LAYOUT_CONSTANTS.HEIGHT_WH_RATIO;
    }

    /** @override 안내 문구와 단일 확인 버튼을 생성합니다. */
    _generateLayout() {
        this._releaseElements();
        const handler = new LayoutHandler(this, this.positioningHandler)
            .paddingX('WW', 1.5)
            .space('WH', 2.5)
            .item('text').stylePreset('h2')
            .text(getLangString('browser_compatibility_warning_title'))
            .fill(ColorSchemes.Overlay.Text.Title)
            .space('WH', 1.4)
            .item('text').stylePreset('h4')
            .text(getLangString('browser_compatibility_warning_body_first'))
            .fill(ColorSchemes.Overlay.Text.Item)
            .space('WH', 0.4)
            .item('text').stylePreset('h4')
            .text(getLangString('browser_compatibility_warning_body_second'))
            .fill(ColorSchemes.Overlay.Text.Item)
            .bottomSpace('WH', 2.5)
            .bottomGroup().justifyContent('right', 'WW', 1).align('right')
            .item('button').stylePreset('overlay_interact_button')
            .buttonText(getLangString('browser_compatibility_warning_confirm'))
            .onClick(this.close.bind(this))
            .prop('activateOnPress', true);

        applyOverlayConfirmButtonIcon(handler);
        handler.endGroup();
        const buildResult = handler.build();
        this.dynamicItems = buildResult.dynamicItems;
        this.staticItems = buildResult.staticItems;
    }
}
