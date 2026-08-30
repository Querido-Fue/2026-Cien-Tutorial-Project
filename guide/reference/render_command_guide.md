# Render Command Guide

## 1. `render()` / `renderGL()`

`render(layerName, options)`는 2D 레이어에 그리기 명령을 전달합니다.

대표 2D 레이어:

- `texteffect`
- `ui`
- `vignette`
- `top`
- 동적 2D surface id

`renderGL(layerName, options)`는 WebGL 레이어에 그리기 명령을 전달합니다.

대표 WebGL 레이어:

- `background`
- `object`
- `effect`
- 동적 overlay effect surface id

`world-postprocess`는 엔진이 위 세 월드 레이어를 합성하는 출력 surface이므로 게임 코드에서 직접 `renderGL()` 대상으로 사용하지 않습니다. `texteffect`와 `ui`는 후처리 입력에서 제외됩니다.

## 2. 2D shape별 주요 프로퍼티

| shape | 필수 프로퍼티 | 선택 프로퍼티 |
| --- | --- | --- |
| `rect` | `x`, `y`, `w`, `h` | `fill`, `stroke`, `alpha`, `lineWidth`, `shadowBlur`, `shadowColor` |
| `roundRect` | `x`, `y`, `w`, `h`, `radius` | `fill`, `stroke`, `alpha`, `lineWidth` |
| `circle` | `x`, `y`, `radius` | `fill`, `stroke`, `alpha`, `lineWidth` |
| `line` | `x1`, `y1`, `x2`, `y2` | `stroke`, `lineWidth`, `lineCap`, `alpha` |
| `text` | `x`, `y`, `text` | `fill`, `font`, `align`, `baseline`, `alpha`, `rotation` |
| `image` | `x`, `y`, `w`, `h`, `image` | `alpha` |
| `arrow` | `x`, `y`, `w`, `h` | `fill`, `rotation`, `alpha` |

`TEXT_RENDER_DATA.PIXEL_PROFILES`에 등록된 폰트는 동일한 `text` 명령을 유지하되
`PixelTextRenderer`가 작은 문자열 Canvas로 래스터화한 뒤 최근접 확대합니다. 현재
`OwnglyphParkDahyun`은 22px 이하에서 1px 알파 임계 처리, 그보다 큰 크기에서 2px 도트
격자를 사용합니다. `measureText()`도 같은 저해상도 font 메트릭을 사용하므로 줄바꿈과 버튼
배치는 실제 도트 결과 폭을 기준으로 계산합니다. 프로필 밖의 폰트와 그라디언트 텍스트는
기존 `fillText()` 경로를 유지합니다.

## 3. 공통 스타일

| 프로퍼티 | 타입 | 설명 |
| --- | --- | --- |
| `fill` | `string` 또는 linear gradient 객체 또는 `false` | 채움 색상. `false`이면 stroke 중심 |
| `stroke` | `string` 또는 `false` | 외곽선 색상 |
| `alpha` | `number` | `globalAlpha` |
| `lineWidth` | `number` | 선 두께 |
| `lineCap` | `string` | 선 끝 모양 |
| `shadowBlur` | `number` | 그림자 블러 |
| `shadowColor` | `string` | 그림자 색상 |

## 4. WebGL 명령

WebGL batch 레이어는 기본 도형/이미지 명령을 배치 렌더러로 전달합니다. 기본 도형 아틀라스에는 `rect`, `square`, `diamond`, `circle`, `triangle`, `pentagon`, `hexagon`, `octagon`, `arrow`가 있으며, `diamond`는 쿼터뷰 타일처럼 `w`/`h`를 다르게 스케일할 수 있습니다. overlay effect surface는 `OverlaySession.renderGlassPanel()` 경로에서 `glassPanel` 명령을 사용합니다.

`background`, `object`, `effect` 명령은 프레임 끝에 그 순서로 공유 FBO에 지연 실행됩니다. 절차적 `flameParticles`, `magneticShield`, `ambientDust` 명령은 선택적 `pixelSize`를 받으며 기본값은 2픽셀입니다. `ambientDust`는 `bounds` 안에서만 소수의 WebGL point sprite를 그리며 `particleCount`, `pointSize`, `time`, `warmColor`, `coolColor`를 선택적으로 받습니다. 후처리 원본은 nearest-neighbor이고 Bloom 보조 텍스처만 linear filtering을 사용합니다.

맵 투영처럼 축 정렬 사각형으로 표현할 수 없는 경우에는 `vertices` 옵션으로 `[좌상 x, 좌상 y, 우상 x, 우상 y, 우하 x, 우하 y, 좌하 x, 좌하 y]` 순서의 네 꼭짓점을 전달할 수 있습니다. 유효한 `vertices` 값은 `x`/`y`/`w`/`h` 기하보다 우선합니다.

일반 코드에서 glass 패널을 직접 `renderGL()`로 구성하기보다 `BaseOverlay`/`OverlaySession` 경로를 우선합니다.

## 5. 그라디언트 예시

```javascript
render('ui', {
    shape: 'rect',
    x: 0,
    y: 0,
    w: 100,
    h: 50,
    fill: {
        type: 'linear',
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 0,
        stops: [
            { offset: 0, color: '#ff0000' },
            { offset: 1, color: '#0000ff' }
        ]
    }
});
```

## 6. `renderGL()` 레이어 별칭

| 입력 이름 | 실제 레이어 |
| --- | --- |
| `main` / `mainGL` | `object` |
| `backgroundGL` | `background` |
| `effectGL` | `effect` |

## 7. 지속 그림자

```javascript
shadowOn('ui', 12, 'rgba(0,0,0,0.3)');
// 여러 render 호출
shadowOff('ui');
```

지속 그림자는 레이어 상태이므로 반드시 `shadowOff()`로 되돌립니다.
