# Overlay Contract Guide

## 1. BaseOverlay 서브클래스 계약

`BaseOverlay`는 기본 구현을 제공하지만, 실제 콘텐츠 overlay는 아래 훅을 필요에 맞게 오버라이드합니다.

| 메서드 | 필수/선택 | 호출 시점 | 설명 |
| --- | --- | --- | --- |
| `_onResize()` | 선택 | `resize()` 시작 시 | 화면 크기 변경에 따른 overlay `width`, `height`, `dx`, `dy` 재설정 |
| `_calculateGeometry()` | 선택 | `resize()` 중 | 기본 중앙 배치와 패널 좌표 계산을 완전히 바꿀 때만 오버라이드 |
| `_getPanelDefinitions()` | 선택 | `_calculateGeometry()` 중 | 패널 배열 반환. 기본값은 `root` 패널 1개 |
| `_generateLayout()` | 사실상 필수 | `resize()` 후 | `LayoutHandler`로 UI 요소를 생성하고 `dynamicItems`/`staticItems`를 저장 |
| `_drawOverlayDecorations()` | 선택 | `draw()` 중 | 패널과 UI 요소 사이의 추가 장식 |
| `onCloseComplete()` | 선택 | close 애니메이션 완료 후 | 닫기 후 정리 로직 |
| `applyRuntimeSettings(changedSettings)` | 선택 | 설정 변경 시 | 기본 구현은 `uiScale`, `disableTransparency`에 반응 |

`_releaseElements()`는 `destroy()`에서 자동 호출되는 내부 정리 메서드입니다. 단, `_generateLayout()`에서 레이아웃을 재생성할 때는 기존 요소를 먼저 반환하는 패턴을 유지합니다.

## 2. 생성 옵션

`BaseOverlay` 생성자 옵션은 `OverlaySession` 생성 옵션으로 전달됩니다.

| 옵션 | 기본값 | 의미 |
| --- | --- | --- |
| `layer` | `0` | overlay 정렬 레이어 |
| `dim` | `0.32` | 배경 dim 강도 |
| `transparent` | `true` | glass/투명 효과 사용 요청 |
| `glOverlay` | `false` | WebGL effect surface 요청 |
| `blurUpdateMode` | `dirty` | blur 갱신 정책 |
| `effects` | `{}` | overlay effect registry 옵션 |

현재 등록된 패널 interaction effect 이름:

- `hoverTilt`
- `hoverSpotlight`
- `hoverBorder`
- `clickRipple`
- `hoverParticle`

## 3. 패널 정의 주요 필드

| 필드 | 의미 |
| --- | --- |
| `id` | 패널 식별자 |
| `x`, `y`, `w`, `h` | 패널 위치와 크기. 숫자, `{ unit, value }`, UI 데이터 경로 문자열을 허용 |
| `radius` | 코너 반경 |
| `blur` | glass blur 강도 |
| `fill`, `stroke`, `lineWidth` | 기본 채움, 테두리, 선 두께 |
| `shadowBlur`, `shadowColor` | flat panel fallback 그림자 |
| `tintColor`, `tintStrength` | glass tint |
| `edgeColor`, `edgeStrength` | glass edge |
| `refractionStrength` | glass 굴절 강도 |
| `onClick` | 패널 클릭 콜백 |
| `visible` | 표시 여부 |

## 4. 최소 구현 예시

```javascript
class MyOverlay extends BaseOverlay {
    constructor() {
        super({ layer: 0, dim: 0.32, transparent: true, glOverlay: true });
    }

    _onResize() {
        this.width = this.UIWW * 0.5 / this.uiScale;
        this.height = this.WH * 0.6 / this.uiScale;
    }

    _getPanelDefinitions() {
        return [{
            id: 'root',
            fill: ColorSchemes.Overlay.Panel.GlassBackground,
            stroke: ColorSchemes.Overlay.Panel.GlassBorder,
            tintColor: ColorSchemes.Overlay.Panel.GlassTint,
            tintStrength: ColorSchemes.Overlay.Panel.GlassTintStrength
        }];
    }

    _generateLayout() {
        this._releaseElements();
        const layout = new LayoutHandler(
            this.getPanelLayoutParent('root'),
            this.createPanelPositioningHandler('root')
        );
        const result = layout.build();
        this.dynamicItems = result.dynamicItems;
        this.staticItems = result.staticItems;
        this.components = result.components;
    }
}
```

## 5. 오버레이 사용 규칙

- `BaseOverlay` 서브클래스 인스턴스는 `OverlayManager.openOverlay(controller)`로 엽니다.
- 패널 좌표는 가능하면 `getPanelLayoutParent()`와 `createPanelPositioningHandler()`를 기준으로 계산합니다.
- glass 효과를 쓰는 overlay는 `transparent: true`, `glOverlay: true`, `effectSurface` 경로를 함께 고려합니다.
- `disableTransparency` 설정이 켜질 수 있으므로 flat panel fallback 색상도 정상이어야 합니다.
- close 흐름은 마우스 포커스 복원과 surface 회수를 포함하므로 임의로 우회하지 않습니다.
