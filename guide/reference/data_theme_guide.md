# Data And Theme Guide

## 1. DATA_REGISTRY 원칙

`DATA_REGISTRY`는 정적 `Object.freeze()` 객체입니다. 런타임 동적 등록은 하지 않습니다.

상수를 추가할 때:

1. `project/engine/script/data/` 하위의 적절한 폴더에 상수 파일을 만듭니다.
2. `data/data_handler.js`에 import를 추가합니다.
3. `DATA_REGISTRY` 객체에 키를 등록합니다.
4. 사용부에서는 `getData(key)`로 접근합니다.

```javascript
export const FEATURE_CONSTANTS = Object.freeze({
    DEFAULT_SIZE: 12,
    MAX_COUNT: 100
});
```

```javascript
import { FEATURE_CONSTANTS } from 'data/feature/feature_constants.js';

const DATA_REGISTRY = Object.freeze({
    FEATURE_CONSTANTS
});
```

## 2. 현재 DATA_REGISTRY 키

| 키 | 출처 파일 |
| --- | --- |
| `GLOBAL_CONSTANTS` | `data/global/global_constants.js` |
| `APP_PAUSE_DATA` | `data/global/app_pause_data.js` |
| `SYSTEM_RUNTIME_POLICY_DATA` | `data/global/system_runtime_policy_data.js` |
| `LightTheme`, `DarkTheme` | `data/theme/light_theme.js`, `data/theme/dark_theme.js` |
| `THEMES`, `THEME_KEYS`, `THEME_OPTIONS`, `DEFAULT_THEME_KEY`, `getThemeByKey` | `data/theme/theme_registry.js` |
| `BUTTON_CONSTANTS` | `data/ui/layout/button_constants.js` |
| `UI_CONSTANTS` | `data/ui/layout/ui_constants.js` |
| `TEXT_CONSTANTS` | `data/ui/typography/text_constants.js` |
| `CURSOR_CONSTANTS` | `data/ui/cursor/cursor_constants.js` |
| `TOOLTIP_CONSTANTS` | `data/ui/tooltip/tooltip_constants.js` |
| `SIMULATION_RUNTIME_DEFAULTS` | `data/simulation/simulation_runtime_defaults.js` |
| `DEBUG_CONSTANTS` | `data/debug/debug_constants.js` |
| `SOUND_CONSTANTS` | `data/sound/sound_constants.js` |
| `DEFAULT_OVERLAY_ANIMATION_PRESET`, `OVERLAY_ANIMATION_PRESETS`, `getOverlayAnimationPreset` | `data/overlay/overlay_animation_presets.js` |
| `OVERLAY_LAYOUT_CONSTANTS` | `data/overlay/overlay_layout_constants.js` |
| `WEBGL_CONSTANTS` | `data/display/webgl_constants.js` |
| `EFFECT_RENDER_CONSTANTS` | `data/display/effect_render_constants.js` |
| `OVERLAY_RENDER_CONSTANTS` | `data/display/overlay_render_constants.js` |
| `VIGNETTE_CONSTANTS` | `data/display/vignette_constants.js` |
| `DISPLAY_SURFACE_DATA` | `data/display/display_surface_data.js` |
| `TEXT_RENDER_DATA` | `data/display/text_render_data.js` |
| `MOUSE_BUTTON_INPUT_DATA` | `data/input/mouse_button_input_data.js` |
| `TUTORIAL_GAME_DATA` | `data/game/tutorial_game_data.js` |
| `TUTORIAL_BATTLE_LIGHTING_DATA` | `data/game/tutorial_battle_lighting_data.js` |
| `TUTORIAL_RECORD_PRESENTATION_DATA` | `data/game/tutorial_record_presentation_data.js` |
| `TUTORIAL_GALLERY_PRESENTATION_DATA` | `data/game/tutorial_gallery_presentation_data.js` |

## 3. ColorSchemes

`ColorSchemes`는 현재 활성 테마의 색상을 전역으로 제공합니다. 테마 전환 시 `_theme_handler.js`가 값을 갱신합니다.

현재 테마의 최상위 구조:

```text
ColorSchemes
├── Background
├── Cursor
├── Overlay
│   ├── Text
│   ├── Panel
│   ├── Control
│   ├── Button
│   ├── Segment
│   ├── Toggle
│   └── Slider
├── Tactics
│   ├── Backdrop, BoardFrame
│   ├── Tile
│   ├── Entity
│   ├── UI
│   └── Effects
├── Vignette
└── Debug
```

```javascript
import { ColorSchemes } from 'display/_theme_handler.js';

const panelBg = ColorSchemes.Overlay.Panel.GlassBackground;
const buttonConfirm = ColorSchemes.Overlay.Button.Confirm;
const reachableTile = ColorSchemes.Tactics.Tile.Reachable;
```

튜토리얼 맵, 전투 규칙, 레이아웃, 연출 수치와 문구는 `TUTORIAL_GAME_DATA`에서 가져옵니다. 전술 화면 색상은 라이트/다크 테마가 같은 `Tactics` 구조를 제공하며 사용부는 `ColorSchemes.Tactics`로 접근합니다.

튜토리얼 아이템 수치는 `ITEMS[*].effects`의 안정된 `id`, `trigger`, `operation`, `order`, 선택적 `conditions`와 `value`로 선언합니다. 이벤트 타일 유형은 `EVENT_TILE_EFFECTS`에 같은 계약으로 등록하고 층의 `eventTiles[].type`이 이를 참조합니다. 효과 수치를 `RULES`나 모델 분기에 중복 보관하지 않으며, 새 데이터는 `TutorialEffectExecutor`의 생성 시 검사를 통과해야 합니다. 세부 계약과 예시는 `docs/tutorial-effect-contract.md`를 봅니다.

## 4. 런타임 정책 데이터

프레임 실행 정책은 `SYSTEM_RUNTIME_POLICY_DATA`에 있습니다.

- `DISPLAY_REFRESH_SETTING_KEYS`: 변경 시 `resize()`가 필요한 설정 키입니다.
- `SIMULATION_RUNTIME_SETTING_KEYS`: 시뮬레이션 스냅샷에 복제할 설정 키입니다.
- `DEFAULT_FRAME_EXECUTION_POLICY`: 기본 fixed/update/draw 실행 플래그입니다.
- `FRAME_EXECUTION_DISABLE_KEYS`: 일시정지 정책 병합 시 끌 수 있는 플래그 목록입니다.

## 5. 금지 사항

- 색상값을 사용부에 직접 하드코딩하지 않습니다.
- 레이아웃 수치를 코드 안에 흩어두지 않습니다.
- `data/` 외부에서 공유 상수를 새로 정의하지 않습니다.
- 테마별 분기가 필요한 값은 테마 파일에 둡니다.
- 전술 화면의 테마 색상을 `TUTORIAL_GAME_DATA`나 씬에 넣지 않습니다.
- 사용자 설정처럼 런타임에 변하는 값은 `DATA_REGISTRY`에 넣지 않습니다.
