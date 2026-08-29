# Display Viewport Guide

## 1. 화면 영역 함수

`display_system.js`의 화면 크기 함수들은 서로 다른 좌표 영역을 나타냅니다.

```text
getWW() x getWH()
전체 내부 렌더 타깃

getUIWW() x getWH()
16:9 UI 기준 영역

getWW() x getObjectWH()
확장 가능한 오브젝트/월드 좌표 영역
```

| 함수 | 반환값 | 용도 |
| --- | --- | --- |
| `getWW()` | 내부 렌더 해상도 전체 너비 | 전체 배경, WebGL/Canvas 렌더 좌표 |
| `getWH()` | 내부 렌더 해상도 전체 높이 | 전체 배경, WebGL/Canvas 렌더 좌표 |
| `getUIWW()` | 16:9 비율 기준 UI 너비 | UI 요소 크기/위치 |
| `getUIOffsetX()` | UI 영역 시작 X 오프셋 | 와이드 화면 UI 중앙 정렬 |
| `getObjectWH()` | 16:9 기반 확장 높이 | 월드/오브젝트 좌표계 |
| `getObjectOffsetY()` | 오브젝트 Y 오프셋 | 와이드 화면 월드 중심 보정 |
| `getBaseWW()` / `getBaseWH()` | 렌더 스케일 적용 전 기본 크기 | 네이티브 2D surface backing store |
| `getScaleRatio()` | 내부 해상도 / CSS 표시 너비 | 마우스 좌표 변환 |
| `getCanvasOffset()` | CSS 표시 오프셋 | DOM/CSS 좌표와 내부 좌표 보정 |

## 2. 선택 기준

| 작업 | 사용할 함수 |
| --- | --- |
| UI 요소 크기/위치 | `getUIWW()` + `getWH()` |
| 오버레이 패널 위치 | `getWW()` + `getWH()` 또는 패널 parent의 `OW`/`OH` |
| 월드/오브젝트 좌표 | `getWW()` + `getObjectWH()` |
| 월드/오브젝트 렌더링 Y 보정 | `getObjectOffsetY()` |
| 뷰포트 전체 채움 | `getWW()` + `getWH()` |
| DOM/CSS 좌표 변환 | `getScaleRatio()` + `getCanvasOffset()` |

## 3. UI 단위와의 관계

- `WW`는 UI 기준 너비인 `getUIWW()` 기반입니다.
- `WH`는 화면 높이인 `getWH()` 기반입니다.
- `OW`/`OH`는 현재 부모 영역 기반입니다.
- `OX`/`OY`는 부모 원점에 비율 오프셋을 더한 좌표입니다.
- 월드/오브젝트 좌표는 UI 기준 폭이 아니라 object 영역 기준으로 계산해야 합니다.

## 4. 렌더 스케일과 2D UI 레이어

- `renderScale`은 내부 렌더 타깃 해상도를 낮출 수 있습니다.
- 2D UI/오버레이/커서 surface는 `getBaseWW()` x `getBaseWH()` backing store를 유지할 수 있습니다.
- 2D UI surface는 내부 transform으로 기존 `getWW()`/`getWH()` 좌표계를 보존하므로 UI 코드는 별도 보정 없이 기존 단위를 사용합니다.
- 이 처리는 렌더 해상도 변경 시 UI와 커서가 브라우저 업스케일로 커지거나 흐려지는 현상을 줄이기 위한 것입니다.

## 5. viewport mode

`ScreenHandler`는 설정과 창 비율에 따라 내부 상태를 갱신합니다.

| 상태 | 의미 |
| --- | --- |
| `native16by9` | 16:9 기본 화면 |
| `widescreen` | 16:9보다 가로가 긴 화면을 전체 사용 |
| `letterboxTall` | 16:9보다 세로가 긴 화면에서 상하 레터박스 |
| `letterboxWide` | 와이드 지원이 꺼진 상태에서 좌우 레터박스 |

## 6. 픽셀 에셋

- 튜토리얼 PNG는 원본 종횡비를 유지해 UI 유효 영역이나 보드 사각형 안에 aspect-fit하고, 계산된 대상 사각형을 정수 좌표·크기로 반올림합니다.
- 2D 이미지 명령은 `smoothing: false`, WebGL 이미지 명령도 `smoothing: false`를 사용합니다. WebGL batch는 이 옵션을 `NEAREST` 텍스처 변형으로 분리 캐시합니다.
- `TutorialBattleLayout`의 `mapImageRect`와 격자 축은 같은 프레임에서 맵 렌더와 타일 hit test가 공유합니다. 이미지가 실패해 도형 폴백을 그려도 투영 좌표는 바꾸지 않습니다.
