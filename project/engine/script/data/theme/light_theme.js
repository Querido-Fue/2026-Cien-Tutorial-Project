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
 * 라이트 테마 전술 프로토타입 전용 색상 정의
 */
const LIGHT_TACTICS_THEME = Object.freeze({
    Backdrop: '#dce6ec',
    WorldBackdrop: '#101010',
    BoardFrame: '#8fa5b5',
    Tile: Object.freeze({
        Low: '#c8d5de',
        High1: '#9ebccc',
        High2: '#78a8ba',
        Edge: '#617f91',
        Side1: '#8ca5b5',
        Side2: '#6f8798',
        Hover: '#00a9d6',
        Reachable: 'rgba(0, 170, 205, 0.28)',
        Path: '#007fa6',
        Attack: 'rgba(224, 72, 91, 0.38)',
        Item: 'rgba(222, 158, 25, 0.34)',
        Stair: '#73a8ad',
        Wall: '#617181',
        Trap: '#cf6e57',
        Teleport: '#7968c8',
        Gate: '#41a477'
    }),
    Entity: Object.freeze({
        Player: '#00a9d6',
        PlayerDark: '#16506b',
        PlayerAccent: '#effcff',
        Lora: '#ed667b',
        LoraDark: '#8d3049',
        LoraHair: '#d8a85c',
        LoraAccent: '#fff3f5',
        Shadow: 'rgba(49, 65, 76, 0.26)',
        Box: '#aa7856',
        BoxBand: '#744d35',
        Mob: '#7362a8',
        MobDark: '#45386d',
        Item: '#d39a2e',
        Wall: '#63717b',
        Trap: '#cf604f',
        Teleport: '#7661c8'
    }),
    UI: Object.freeze({
        Panel: 'rgba(247, 251, 253, 0.94)',
        PanelStrong: '#eaf1f5',
        Border: 'rgba(61, 91, 111, 0.28)',
        Text: '#1c3444',
        Muted: '#657b89',
        Accent: '#008eb8',
        Primary: '#EC6565',
        PrimaryHover: '#F17A7A',
        OnPrimary: '#ffffff',
        Card: '#ffffff',
        CardIconBackground: '#ffffff',
        CardHeader: '#d9d9d9',
        GaugeTrack: '#d9d9d9',
        GaugeHp: '#EC6565',
        GaugeValue: '#2b2025',
        GaugeInstability: '#E9A44C',
        Danger: '#d9485f',
        Success: '#168f62',
        Warning: '#b87500',
        ButtonIdle: '#d4e2ea',
        ButtonHover: '#b8d9e5',
        ButtonDisabled: '#dbe2e6',
        HpFull: '#e85369',
        HpEmpty: '#a8b6bf',
        OverlayDim: 'rgba(53, 70, 82, 0.26)',
        ButtonShadow: 'rgba(0, 0, 0, 0.18)',
        CardShadow: 'rgba(0, 0, 0, 0.13)'
    }),
    Effects: Object.freeze({
        Move: '#00a9d6',
        Hit: '#ef5f54',
        Debris: '#a97450',
        Stabilize: '#d49513',
        FlameOuter: '#ff5a1f',
        FlameCore: '#ffc04d',
        FlameEmber: '#fff0a3',
        CandleLight: '#f28a32',
        UpperAmbient: '#2a1107',
        BasementAmbient: '#071a35',
        BasementMoteWarm: '#b7e5ff',
        BasementMoteCool: '#4d8fc9'
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
    Background: '#101010',
    Cursor: Object.freeze({
        Fill: '#cccccc',
        Active: '#2d2d2d',
        White: '#ececec'
    }),
    Overlay: LIGHT_OVERLAY_THEME,
    Tactics: LIGHT_TACTICS_THEME,
    Vignette: LIGHT_VIGNETTE_THEME,
    Debug: Object.freeze({
        Background: '#101010',
        Fill: '#101010'
    })
});
