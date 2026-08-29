# Coding Conventions Guide

## 1. 데이터 및 상수 분리

| 규칙 | 설명 |
| --- | --- |
| 상수는 `data/` 폴더에 격리 | 매직넘버, 테마 색상, 레이아웃 수치, 정책 플래그는 `data/` 하위 파일에 `Object.freeze()`로 선언 |
| `DATA_REGISTRY` 단일 접점 | `data/data_handler.js`의 `getData(key)`를 통해 공유 상수에 접근 |
| 테마 데이터 흐름 준수 | 테마 정의는 `theme_registry.js`와 `_theme_handler.js`의 전역 반영 흐름을 따릅니다. |
| 런타임 상태와 정적 데이터 분리 | 사용자 설정/진행도는 `save/` 경로, 정적 튜닝값은 `data/` 경로를 사용합니다. |

세부 등록 절차와 주요 키는 [`reference/data_theme_guide.md`](./reference/data_theme_guide.md)를 확인합니다.

## 2. 접두사 규칙

| 접두사 | 의미 | 예시 |
| --- | --- | --- |
| `_` | 외부 공개 진입점이 아닌 구현 세부사항 파일 또는 내부 메서드 | `_base_overlay.js`, `_layout_handler.js`, `_calculateGeometry()` |
| `#` | ES private 클래스 필드/메서드 | `#syncSimulationRuntime()`, `#panelMap` |
| 접두사 없음 | 시스템 파일 또는 공개 모듈 진입점 | `animation_system.js`, `display_system.js`, `scene_system.js` |

## 3. JSDoc과 주석

- 새로 추가하거나 의미 있게 수정하는 클래스, 함수, 메서드에는 JSDoc을 작성합니다.
- JSDoc과 코드 주석은 한국어로 작성합니다.
- 인라인 주석은 복잡한 알고리즘, 의존성 순서, 의도가 불분명한 분기처럼 필요한 곳에만 둡니다.
- 임시 설명, 변경 이력형 주석, 자명한 주석은 남기지 않습니다.

## 4. 반응형 UI 단위

모든 UI 수치는 절대 픽셀보다 엔진 단위와 `PositioningHandler`를 우선합니다.

| 단위 | 의미 | 기준 |
| --- | --- | --- |
| `WW` | UI 기준 너비 대비 퍼센트 | `getUIWW()` |
| `WH` | 화면 높이 대비 퍼센트 | `getWH()` |
| `OW` | 부모 영역 너비 대비 퍼센트 | `parent.scaledW` 또는 `parent.width` |
| `OH` | 부모 영역 높이 대비 퍼센트 | `parent.scaledH` 또는 `parent.height` |
| `OX` | 부모 X 기준점 + 너비 퍼센트 | `parent.scaledX + %` |
| `OY` | 부모 Y 기준점 + 높이 퍼센트 | `parent.scaledY + %` |
| `parent` | 전달된 참조 크기 대비 퍼센트 | `parseUnit()`의 `refSize` |
| `absolute` | 절대 픽셀 x `uiScale` | 고정 크기가 필요한 경우 |

화면 영역별 함수 차이는 [`reference/display_viewport_guide.md`](./reference/display_viewport_guide.md)를 확인합니다.

## 5. 파일 책임과 싱글톤

- 1파일 1클래스/모듈 원칙을 우선합니다.
- 책임은 하나의 변경 이유와 하나의 상태 소유권을 기준으로 나눕니다. 입력·상태 변경·저장·레이아웃·렌더·자원 수명주기를 편의를 이유로 한 클래스에 합치지 않습니다.
- 새 파일과 의미 있게 수정하는 파일은 500줄 이하를 목표로 하며 700줄을 하드 상한으로 둡니다. 선언형 데이터·셰이더 원문 예외는 `source_responsibility_policy.mjs`에 사유와 함께 명시해야 합니다.
- 조립 파사드는 협력 객체의 순서와 연결만 소유합니다. 도메인 계산을 함께 수행하거나, 분리한 모듈에 거대한 context/callback 묶음을 전달하지 않습니다.
- `*_system.js`는 해당 모듈의 공개 진입점이자 싱글톤 인스턴스 관리 지점입니다.
- `_*.js`는 시스템 파일이나 같은 모듈 내부에서 사용하는 구현 세부사항입니다.
- 시스템 인스턴스는 `SystemHandler.init()`에서 1회 생성하고, 외부 접근은 기존 `getSomeSystem()` 또는 모듈 export 함수를 사용합니다.

```javascript
let instance = null;

export class SomeSystem {
    constructor() {
        instance = this;
    }
}

export const getSomeSystem = () => instance;
```

## 6. 검증

코드 또는 문서 수정 후에는 최소한 아래를 실행합니다.

```bash
git diff --check
npm run check:responsibilities
```

문법 검사가 필요한 JavaScript 파일은 프로젝트의 기존 NW.js/Node 확인 방식에 맞춰 추가 검증합니다.
