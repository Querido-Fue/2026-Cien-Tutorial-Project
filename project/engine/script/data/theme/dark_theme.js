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
 * 다크 테마 전술 프로토타입 전용 색상 정의
 */
const DARK_TACTICS_THEME = Object.freeze({
    Backdrop: '#07111f',
    WorldBackdrop: '#101010',
    BoardFrame: '#13283d',
    Tile: Object.freeze({
        Low: '#183047',
        High1: '#24506a',
        High2: '#2f6a7d',
        Edge: '#4d8398',
        Side1: '#10263a',
        Side2: '#091a2b',
        Hover: '#59ddff',
        Reachable: 'rgba(56, 207, 232, 0.38)',
        Path: '#a0f3ff',
        Attack: 'rgba(255, 105, 118, 0.56)',
        Item: 'rgba(255, 199, 92, 0.52)',
        Stair: '#3d8792',
        Wall: '#40536a',
        Trap: '#a54e5d',
        Teleport: '#765fd2',
        Gate: '#3bc78c'
    }),
    Entity: Object.freeze({
        Player: '#53ddff',
        PlayerDark: '#123d59',
        PlayerAccent: '#dcfbff',
        Lora: '#ff7789',
        LoraDark: '#70273d',
        LoraHair: '#f4c987',
        LoraAccent: '#ffe8ec',
        Shadow: 'rgba(0, 5, 14, 0.48)',
        Box: '#9b6749',
        BoxBand: '#e0a867',
        Mob: '#9a82dc',
        MobDark: '#4c397c',
        Item: '#ffd15c',
        Wall: '#45566b',
        Trap: '#ff6979',
        Teleport: '#a886ff'
    }),
    UI: Object.freeze({
        Panel: 'rgba(9, 22, 38, 0.90)',
        PanelStrong: '#0d2136',
        Border: 'rgba(111, 213, 237, 0.28)',
        Text: '#e9f7fb',
        Muted: '#8da7b5',
        Accent: '#52dbff',
        Primary: '#EC6565',
        PrimaryHover: '#F17A7A',
        OnPrimary: '#ffffff',
        Card: '#0d2136',
        CardIconBackground: '#ffffff',
        CardHeader: '#183047',
        GaugeTrack: '#3a4a58',
        GaugeHp: '#EC6565',
        GaugeInstability: '#F0B35A',
        Danger: '#ff6979',
        Success: '#61e6ad',
        Warning: '#ffc75c',
        ButtonIdle: '#173650',
        ButtonHover: '#225a76',
        ButtonDisabled: '#263645',
        HpFull: '#ff6678',
        HpEmpty: '#3a4a58',
        OverlayDim: 'rgba(1, 7, 16, 0.58)',
        ButtonShadow: 'rgba(0, 0, 0, 0.38)',
        CardShadow: 'rgba(0, 0, 0, 0.34)'
    }),
    Effects: Object.freeze({
        Move: '#5ce5ff',
        Hit: '#ff8b78',
        Debris: '#d19a67',
        Stabilize: '#ffd875',
        FlameOuter: '#ff6524',
        FlameCore: '#ffd05c',
        FlameEmber: '#fff3b0'
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
    Background: '#101010',
    Cursor: Object.freeze({
        Fill: '#404040',
        Active: '#d8dde6',
        White: '#e0e0e0'
    }),
    Overlay: DARK_OVERLAY_THEME,
    Tactics: DARK_TACTICS_THEME,
    Vignette: DARK_VIGNETTE_THEME,
    Debug: Object.freeze({
        Background: '#f0f0f0',
        Fill: '#f0f0f0'
    })
});
