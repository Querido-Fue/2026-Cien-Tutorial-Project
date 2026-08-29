# UI Overlay Guide

## 1. 언제 읽는가

- 오버레이 패널, 확인창, 진단 overlay, 설정류 UI를 수정할 때
- `LayoutHandler`, `PositioningHandler`, UI 요소 풀을 사용할 때
- glass blur, tilt, spotlight, ripple, hover border, hover particle 같은 오버레이 effect를 조정할 때

패널 오버라이드 계약은 [`reference/overlay_contract_guide.md`](./reference/overlay_contract_guide.md)를 함께 확인합니다.

## 2. LayoutHandler

`LayoutHandler`는 오버레이/씬 내부 UI 요소를 선언적으로 배치하는 빌더입니다.

핵심:

- 상단에서 아래로 누적하는 일반 배치와 하단에서 위로 누적하는 `bottomItem()` 배치를 지원합니다.
- `group()`/`endGroup()`은 수평 배치를 만들고 `spacer()`로 남는 공간을 분배합니다.
- `width('fill')`, `width('content')`, `height('fill')`, `height('content')` 키워드를 지원합니다.
- `.build()` 결과는 `dynamicItems`, `staticItems`, `components`로 나뉩니다.

```javascript
const layout = new LayoutHandler(overlay, overlay.positioningHandler);

layout
    .layoutSize('OW', 100, 'OH', 100)
    .layoutStartPos('OX', 0, 'OY', 0)
    .paddingX('WW', 2)
    .item('text', 'title').text('설정').stylePreset('H1').align('left')
    .space('WH', 2)
    .group('volume-row')
        .item('text').text('볼륨').stylePreset('H4').width('WW', 8)
        .spacer()
        .item('slider', 'volume-slider').width('WW', 15).valueRange(0, 100).setValue(80).onChange(cb)
    .endGroup()
    .bottomItem('button', 'confirm-btn').stylePreset('OVERLAY_INTERACT_BUTTON')
        .buttonText('확인').buttonColor(ColorSchemes.Overlay.Button.Confirm).onClick(onConfirm);

const { dynamicItems, staticItems, components } = layout.build();
```

## 3. BaseOverlay 흐름

```text
new CustomOverlay(options)
 -> OverlayManager.openOverlay(controller)
 -> OverlaySession 생성
 -> controller.attach(session)
    ├── 마우스 포커스 전환
    ├── resize() -> _onResize() -> _calculateGeometry() -> _generateLayout()
    └── open() -> alpha/dim/scale 애니메이션
 -> update()
    ├── session effect 갱신
    ├── 패널 interaction 갱신
    └── dynamicItems update
 -> draw()
    ├── dim surface
    ├── glass/flat panel
    ├── _drawOverlayDecorations()
    ├── staticItems render
    └── dynamicItems draw
 -> close()
    └── 포커스 복원 -> onCloseComplete() -> surface 회수
```

오버레이는 직접 DOM canvas를 만들지 않고 `OverlayManager.openOverlay(controller)` 경로를 사용합니다.

## 4. OverlaySession surface

| Surface | 타입 | 역할 |
| --- | --- | --- |
| `dimSurface` | 2D | 배경 dim 처리 |
| `effectSurface` | WebGL | glass blur, panel effect, hover transform |
| `uiSurface` | 2D | 텍스트, 버튼 등 UI 요소 |

blur 갱신 정책:

- `dirty`: 변경 시에만 blur 재계산
- `always`: 매 프레임 blur 재계산

`disableTransparency` 설정이 켜지면 glass 경로가 비활성화될 수 있으므로 flat panel fallback도 고려합니다.

## 5. PositioningHandler

```javascript
const handler = new PositioningHandler(parentOverlay, uiScale);
const px = handler.parseUnit('WW', 8);
const px2 = handler.parseUnit('OW', 50);
const px3 = handler.parseUIData({ BASE: 'WH', VALUE: 3.5 });
const px4 = handler.parseUIData('BUTTON_CONSTANTS.OVERLAY_INTERACT_BUTTON.WIDTH');
```

UI 단위 규칙은 [`coding_conventions_guide.md`](./coding_conventions_guide.md), 화면 영역 함수는 [`reference/display_viewport_guide.md`](./reference/display_viewport_guide.md)를 확인합니다.

## 6. AnimationSystem 사용 예

```javascript
const { id, promise } = animate(owner, {
    variable: 'alpha',
    startValue: 0,
    endValue: 1,
    duration: 0.5,
    type: 'easeOutCubic',
    delay: 0.2
});
await promise;

const { promise: mixedPromise } = animateMixed(owner, [
    { variable: 'x', animations: [{ startValue: 0, endValue: 100, duration: 0.5, type: 'easeOut' }] },
    { variable: 'alpha', animations: [{ startValue: 0, endValue: 1, duration: 0.3, type: 'linear' }] }
]);
await mixedPromise;

const animId = animatePersist(owner, {
    variable: 'progress',
    startValue: 0,
    endValue: 1,
    easings: ['easeInOut'],
    duration: 0.5
});
forward(animId, 0.5);
backward(animId, 0.5);
```

고정 스텝 애니메이션이 필요하면 생성 옵션에 `useFixedTick: true`를 명시합니다.
