import { OVERLAY_BUTTON_COMMON } from './theme_shared.js';

/**
 * 라이트 테마 오버레이 전용 색상 및 속성 정의
 */
const LIGHT_OVERLAY_THEME = Object.freeze({
    Text: Object.freeze({
        Title: '#242424',
        Sub: '#666666',
        Section: '#666666',
        Item: '#2d2d2d',
        Control: '#666666',
        Value: '#4d4d4d'
    }),
    Panel: Object.freeze({
        Background: '#d2d2d2ff',
        Border: '#c8c8c8ff',
        GlassBackground: 'rgba(236, 237, 239, 0.88)',
        GlassBorder: 'rgba(222, 224, 228, 0.56)',
        GlassTint: 'rgba(236, 236, 236, 1)',
        GlassTintStrength: 0.18,
        GlassEdge: 'rgba(207, 213, 222, 1)',
        GlassEdgeStrength: 0.1,
        Divider: 'rgba(70, 70, 70, 0.08)',
        Dim: 0.5,
        Shadow: 'rgba(0, 0, 0, 0.3)'
    }),
    Control: Object.freeze({
        Background: 'rgba(0, 0, 0, 0.045)',
        Accent: '#166ffb',
        Inactive: 'rgba(0, 0, 0, 0.045)',
        Hover: 'rgba(0, 0, 0, 0.08)'
    }),
    Button: Object.freeze({
        ...OVERLAY_BUTTON_COMMON,
        Link: Object.freeze({
            Idle: 'rgba(0, 0, 0, 0.045)',
            Hover: 'rgba(0, 0, 0, 0.08)',
            Text: '#2d2d2d'
        }),
        Option: Object.freeze({
            Active: '#166ffb',
            ActiveText: '#f4f7ff'
        })
    }),
    Segment: Object.freeze({
        Background: 'rgba(0, 0, 0, 0.05)',
        Thumb: '#ececec',
        TextActive: '#166ffb',
        TextInactive: '#666666'
    }),
    Toggle: Object.freeze({
        Active: '#166ffb',
        Inactive: 'rgba(0, 0, 0, 0.1)',
        Knob: '#ececec',
        Shadow: 'rgba(0, 0, 0, 0.3)'
    }),
    Slider: Object.freeze({
        Track: 'rgba(0, 0, 0, 0.16)',
        ValueActive: '#166ffb',
        ValueInactive: '#888888',
        Knob: '#ececec',
        Shadow: 'rgba(0, 0, 0, 0.3)'
    })
});

/**
 * 라이트 테마 비네팅 전용 속성 정의
 */
const LIGHT_VIGNETTE_THEME = Object.freeze({
    WORLD: Object.freeze({
        RGB: Object.freeze([32, 32, 32]),
        AlphaMultiplier: 0.58
    })
});

/**
 * 엔진 런타임에 적용되는 라이트 테마 설정 모음
 */
export const LightTheme = Object.freeze({
    Background: '#cececeff',
    Cursor: Object.freeze({
        Fill: '#cccccc',
        Active: '#2d2d2d',
        White: '#ececec'
    }),
    Overlay: LIGHT_OVERLAY_THEME,
    Vignette: LIGHT_VIGNETTE_THEME,
    Debug: Object.freeze({
        Background: '#101010',
        Fill: '#101010'
    })
});
