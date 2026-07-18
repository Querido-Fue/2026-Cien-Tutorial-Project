import { OVERLAY_BUTTON_COMMON } from './theme_shared.js';

/**
 * 다크 테마 오버레이 전용 색상 및 속성 정의
 */
const DARK_OVERLAY_THEME = Object.freeze({
    Text: Object.freeze({
        Title: '#e0e0e0',
        Sub: '#8a8f9a',
        Section: '#999999',
        Item: '#d5d5d5',
        Control: '#999999',
        Value: '#aaaaaa'
    }),
    Panel: Object.freeze({
        Background: '#05080eff',
        Border: '#0b1320ff',
        GlassBackground: 'rgba(6, 10, 18, 0.9)',
        GlassBorder: 'rgba(92, 112, 142, 0.34)',
        GlassTint: 'rgba(2, 4, 8, 1)',
        GlassTintStrength: 0.54,
        GlassEdge: 'rgba(76, 97, 130, 1)',
        GlassEdgeStrength: 0.13,
        Divider: 'rgba(255, 255, 255, 0.08)',
        Dim: 0.5
    }),
    Control: Object.freeze({
        Background: 'rgba(255, 255, 255, 0.06)',
        Accent: '#4fa3ff',
        Inactive: 'rgba(255, 255, 255, 0.06)',
        Hover: 'rgba(255, 255, 255, 0.12)'
    }),
    Button: Object.freeze({
        ...OVERLAY_BUTTON_COMMON,
        Link: Object.freeze({
            Idle: 'rgba(255, 255, 255, 0.06)',
            Hover: 'rgba(255, 255, 255, 0.12)',
            Text: '#d5d5d5'
        }),
        Option: Object.freeze({
            Active: '#3b82f6',
            ActiveText: '#ffffff'
        })
    }),
    Segment: Object.freeze({
        Background: 'rgba(255, 255, 255, 0.08)',
        Thumb: '#3b82f6',
        TextActive: '#ffffff',
        TextInactive: '#707070'
    }),
    Toggle: Object.freeze({
        Active: '#3b82f6',
        Inactive: 'rgba(255, 255, 255, 0.12)',
        Knob: '#ffffff',
        Shadow: 'rgba(0, 0, 0, 0.3)'
    }),
    Slider: Object.freeze({
        Track: 'rgba(255, 255, 255, 0.12)',
        ValueActive: '#4fa3ff',
        ValueInactive: '#707070',
        Knob: '#ffffff',
        Shadow: 'rgba(0, 0, 0, 0.3)'
    })
});

/**
 * 다크 테마 비네팅 전용 속성 정의
 */
const DARK_VIGNETTE_THEME = Object.freeze({
    WORLD: Object.freeze({
        RGB: Object.freeze([0, 0, 0]),
        AlphaMultiplier: 0.4416
    })
});

/**
 * 엔진 런타임에 적용되는 다크 테마 설정 모음
 */
export const DarkTheme = Object.freeze({
    Background: '#05030a',
    Cursor: Object.freeze({
        Fill: '#404040',
        Active: '#d8dde6',
        White: '#e0e0e0'
    }),
    Overlay: DARK_OVERLAY_THEME,
    Vignette: DARK_VIGNETTE_THEME,
    Debug: Object.freeze({
        Background: '#f0f0f0',
        Fill: '#f0f0f0'
    })
});
