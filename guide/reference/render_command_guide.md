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
| `image` | `x`, `y`, `w`, `h`, `image` | `alpha`, `sourceRect`, `smoothing`, `flipX`, `flipY`, `clipVertices` |
| `arrow` | `x`, `y`, `w`, `h` | `fill`, `rotation`, `alpha` |

텍스트 명령은 Canvas 기본 `fillText()` 경로로 그리며 `measureText()`도 같은 네이티브 폰트
메트릭을 사용합니다. 현재 `PFStardust`는 폰트 자체가 도트 디자인이므로 별도의 저해상도
래스터화나 알파 임계 처리를 적용하지 않습니다. `_pixel_text_renderer.js`는 이전 실험 구현을
보존하지만 `DrawHandler2D`와 연결되어 있지 않습니다.

2D `image`의 `sourceRect`는 `{ x, y, w, h }` 원본 픽셀 사각형이며, 유효하면 Canvas 2D
9인자 `drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)`로 현재 crop만 그립니다. `flipX`와
`flipY`를 함께 써도 crop은 그대로 유지되고, `smoothing: false`는 명령 동안만 nearest를
적용한 뒤 이전 컨텍스트 상태를 복원합니다. 로라의 12610×580 폭발처럼 WebGL 최대 텍스처
크기를 넘을 수 있는 대형 시트는 이 2D crop 경로를 사용합니다.

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

`background`, `object`, `effect` 명령은 프레임 끝에 그 순서로 공유 FBO에 지연 실행됩니다. 절차적 `flameParticles`, `magneticShield`, `ambientDust` 명령은 선택적 `pixelSize`를 받으며 기본값은 2픽셀입니다. `ambientDust`는 `bounds` 안에서만 소수의 WebGL point sprite를 그리며 `particleCount`, `pointSize`, `time`, `warmColor`, `coolColor`를 선택적으로 받습니다. `sceneLighting`은 월드 노출·암부 색상과 화면 좌표 점광원 배열을 받고, 광원별 scissor 원형 감쇠를 스크린 합성한 뒤 같은 불꽃 위상의 미세 떨림과 느린 호흡을 적용합니다. `spatialDistortion`은 `effect` surface에 제출하되 일반 배치 렌더러가 그리지 않는 월드 후처리 전용 명령입니다. 화면 좌표 `x`/`y`, `radius`, `ringWidth`, `strength`를 받고 한 프레임에 최대 4개만 full-resolution 굴절 패스에서 소비합니다. 명령이 없으면 패스를 건너뛰고, WebGL 폴백은 이 명령만 생략하므로 기존 월드 렌더링은 유지됩니다. 후처리 원본과 왜곡 중간 텍스처는 nearest-neighbor이고 Bloom 보조 텍스처만 linear filtering을 사용합니다.

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
