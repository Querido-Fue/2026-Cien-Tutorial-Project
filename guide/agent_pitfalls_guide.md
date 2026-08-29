# Agent Pitfalls Guide

## 1. 파일을 부분적으로만 읽고 수정하는 실수

| 실수 | 예방 |
| --- | --- |
| `_base_overlay.js` 후반의 `_calculateGeometry()`, `_generateLayout()`, `_releaseElements()`를 보지 않고 overlay를 수정 | 수정 대상 파일은 반드시 전체를 읽습니다. |
| `display_system.js` 하단의 `getWW`, `getWH`, `render`, `renderGL`, `getCanvasPoolStats` export를 놓침 | 시스템 파일은 파일 하단의 모듈 레벨 export까지 확인합니다. |
| `system_handler.js`의 초기화 순서를 무시하고 시스템 추가 | 의존성 순서를 먼저 확인하고, 선택형 factory로 충분한지 검토합니다. |

## 2. 예전 게임 경로를 기준으로 판단하는 실수

| 실수 | 예방 |
| --- | --- |
| `project/game/script/module/...` 경로를 찾음 | 현재 런타임 루트는 `project/engine/script/...`입니다. |
| 전술 규칙이 엔진 코어에 고정되었다고 가정 | 현재 튜토리얼은 `scene/tutorial/`과 씬 factory로 분리되어 있습니다. 수동 진단도 별도 경로입니다. |
| `main.js`가 앱 루프를 직접 가진다고 가정 | 현재 `main.js`는 `tutorial_main.js`를 import하고, 앱 루프는 `app/engine_app.js`에 있습니다. |

## 3. 싱글톤과 초기화 순서 깨뜨리기

| 실수 | 예방 |
| --- | --- |
| 시스템 클래스를 임의 위치에서 `new`로 중복 생성 | 시스템은 `SystemHandler.init()`에서 1회 생성합니다. 접근은 기존 export 함수 또는 `systemHandler` 참조를 사용합니다. |
| `TimeHandler`, `MathUtil`, `ColorUtil`, `RuntimeTool` 초기화 전 유틸을 사용 | 기본 실행은 `tutorial_main.js`, 수동 진단은 `diagnostic_main.js`의 `window.onload` 초기화 순서를 확인합니다. |
| 선택형 시스템을 필수 시스템처럼 가정 | `objectSystem`과 `runtimeManager`는 null일 수 있으므로 optional call 패턴을 유지합니다. |

## 4. importmap 경로 오해

| 실수 | 예방 |
| --- | --- |
| `import { x } from './display/display_system.js'`를 엔진 내부에서 남발 | importmap 별칭을 우선 사용합니다. 예: `display/display_system.js` |
| `engine/`이 코어 폴더라고 착각 | `engine/`은 `./script/` 전체를 가리킵니다. 예: `engine/time_handler.js` |
| 예전 `game/` 별칭을 사용 | 현재 importmap에는 `game/` 별칭이 없습니다. |

## 5. 데이터/상수 직접 하드코딩

| 실수 | 예방 |
| --- | --- |
| 색상값을 사용부에 직접 입력 | `ColorSchemes` 또는 테마 데이터에서 가져옵니다. |
| 전술 화면 색상을 한 테마에만 추가 | 라이트/다크 테마의 `Tactics` 구조를 함께 유지하고 `ColorSchemes.Tactics`로 접근합니다. |
| 레이아웃 수치를 절대 픽셀로 입력 | `WW`, `WH`, `OW`, `OH`, `OX`, `OY`, `absolute` 단위와 `PositioningHandler`를 사용합니다. |
| 공유 상수를 `data/` 외부에서 정의 | `data/` 파일 추가 후 `data_handler.js`에 등록합니다. |

## 6. 오버레이 관련 실수

| 실수 | 예방 |
| --- | --- |
| 동적 canvas를 직접 만들고 DOM에 붙임 | `OverlayManager`와 `OverlaySession`의 동적 surface 생성/회수 경로를 사용합니다. |
| `BaseOverlay`를 열면서 마우스 포커스 복원을 직접 처리 | `close()` 흐름이 포커스 복원과 close handler 호출을 포함합니다. |
| `_generateLayout()`에서 기존 UI 요소를 회수하지 않음 | 레이아웃 재생성 전 `_releaseElements()` 패턴을 확인합니다. |
| 패널 좌표를 직접 중복 계산 | `getPanelLayoutParent()`와 `createPanelPositioningHandler()`를 사용합니다. |

## 7. 애니메이션/렌더 관련 실수

| 실수 | 예방 |
| --- | --- |
| 고정 틱과 가변 프레임 혼동 | 고정 로직은 `fixedUpdate()`/`getFixedDelta()`, 프레젠테이션은 `update()`/`getDelta()`를 사용합니다. |
| 2D 레이어에 `renderGL()` 또는 WebGL 레이어에 `render()` 사용 | `background/object/effect`는 WebGL, `texteffect/ui/vignette/top`과 동적 2D surface는 2D입니다. |
| overlay glass 합성 전에 WebGL flush 필요성을 무시 | `SystemHandler.draw()`의 overlay composite flush 조건을 확인합니다. |

## 8. 레이아웃 관련 실수

| 실수 | 예방 |
| --- | --- |
| `endGroup()` 호출 누락 | `group()`을 열면 반드시 `endGroup()`으로 닫습니다. 빌드 시 강제 정리되지만 레이아웃 의도가 깨질 수 있습니다. |
| `spacer()`를 그룹 바깥에서 사용 | `spacer()`는 `group()` 내부 수평 배치에서만 유효합니다. |
| `bottomItem()`과 일반 `item()` 순서 혼동 | `bottomItem()`은 하단에서 위로 누적됩니다. 일반 `item()`은 상단에서 아래로 누적됩니다. |
| `width('fill')`과 `width('content')`의 의미 혼동 | `fill`은 남은 폭 채움, `content`는 요소 내용 크기 기반입니다. |

## 9. UI 요소의 static/dynamic 분류 오해

| 분류 | 타입 | 설명 |
| --- | --- | --- |
| `dynamic` | button, slider, toggle, segment_control, dropdown, progress_bar | `update()` 호출 필요 |
| `static` | text, icon, line, spacing, raw render item | 직접 render만 수행 |

`LayoutHandler.build()` 결과의 `dynamicItems`와 `staticItems`는 이 기준으로 자동 분류됩니다.

## 10. 튜토리얼 씬 경계 무시

| 실수 | 예방 |
| --- | --- |
| 입력 처리 중 전투 모델 상태를 직접 바꿈 | `update()`에서는 시뮬레이션 명령을 적재하고 `applySimulationCommands()`에서 검증 후 적용합니다. |
| 행동을 이동보다 먼저 허용하거나 목적지만 넘겨 BFS 경로로 바꿈 | `move` 단계에서 `extendPath()`로 입력 순서를 보존하고 `commitPath()`가 성공한 뒤에만 `action` 단계를 엽니다. 제자리 이동도 명시적으로 확정할 수 있습니다. |
| 헤이스트를 `actionUsed` boolean 하나로 표현 | `actionsUsed/actionsPerTurn`을 사용하며 대기는 남은 행동 충전을 전부 포기합니다. |
| 로라 이동이나 구형 함정/1회 텔레포트를 다시 구현 | 로라는 층별 고정 좌표를 유지하고 벽·아이템·반복 이벤트 타일·양방향 짝 포탈·고정 몹은 모델의 `floorStates`를 기준으로 처리합니다. |
| 여섯 번째 로라 행동 전후에 잘못 층을 바꾸거나 런 상태를 초기화 | 여섯 번째 로라 행동과 몹 행동 완료 직후 같은 좌표로 전환하고 HP·불안정도·인벤토리를 유지합니다. 착지 벽/몹/아이템/이벤트는 모델 event 순서로 처리합니다. |
| 모델 event와 별도로 씬에서 아이템 획득, 이벤트 타일, 포탈이나 몹 공격을 재계산 | 전투 결과는 순수 모델이 확정하고 씬은 반환된 event만 연출합니다. |
| 플레이어 라운드 수를 12회 제한으로 사용하거나 거울 추가 턴에서 카운트를 증가 | 실제 완료 로라 행동은 `loraActionsCompleted`로만 집계하며 거울 추가 플레이어 턴은 카운트하지 않습니다. |
| 로라 HP 0 뒤 게이트 단계를 추가하거나 남은 적 행동을 계속 실행 | 로라 HP 0에서 즉시 결과로 전환합니다. 다른 종료 조건은 플레이어 HP 0과 로라 행동 12회 완료입니다. |
| 프로토타입에 컷씬/갤러리를 다시 노출 | 아트가 준비될 때까지 `TUTORIAL_GAME_DATA.FEATURES.CUTSCENES`를 `false`로 유지합니다. |
| 맵 크기를 세로 9×가로 8로 뒤집음 | `MAP.WIDTH: 9`, `MAP.HEIGHT: 8`인 가로 9×세로 8 좌표계를 유지합니다. |
| 재시작 때 모델만 초기화해 경로·연출·컷씬 대기 상태를 남김 | `TutorialScene.#leaveRun(MODES.STARTER)`로 모델과 모든 런 표시 상태를 함께 정리하고 스타터 선택으로 돌아갑니다. 전체 씬 교체가 필요할 때만 `SceneSystem.startPlayScene()`과 `destroy()` 흐름을 사용합니다. |
| 씬 재생성 전에 풀 기반 버튼을 남김 | `TutorialButtonHost.destroy()`와 버튼 사양 변경 시 `releaseUIItem()` 반환 경로를 유지하고, 씬 `destroy()`가 호스트를 정리하게 합니다. |
| 비전투 뷰에서 모델·저장·명령 큐·씬을 직접 읽음 | 뷰는 직렬화 가능한 view model과 render port만 받고, 버튼은 `{ type, payload }` command spec으로 의도를 반환합니다. |
| 전투 월드/HUD 뷰에서 모델을 다시 조회하거나 선택·인벤토리 상태를 직접 변경 | 장면이 한 번 조립한 읽기 전용 BattleViewModel만 소비하고, 버튼은 command spec을 반환해 명령 경계에서 적용합니다. |
| 전투 렌더와 마우스 판정에 타일 투영 공식을 각각 구현 | `TutorialBattleLayout.createFrame()`과 정적 `projectTile()`/`hitTestTile()`을 함께 사용해 동일 좌표계를 공유합니다. |
| 모델 event 문구·피해·불안정도 해석을 장면이나 뷰에 다시 추가 | event→cue는 `TutorialBattlePresenter` 한 곳에 두고, feedback queue와 animation timeline은 cue만 소비합니다. |
| 겹친 애니메이션 중 하나가 끝났다고 전체 입력 잠금을 해제 | `TutorialAnimationTimeline`의 세대와 활성 잠금 토큰을 유지하고, 재시작·이탈에서는 `cancel()`로 이전 callback을 무효화합니다. |
| 장면이나 뷰에서 `new Image()`, crop canvas와 onload/onerror를 직접 관리 | 이미지 수명·검증·크롭은 `TutorialAssetLoader`에 두고 뷰에는 `getUiAsset()`/`getItemIcon()`/`getMapArtwork()` 의미 기반 asset port만 전달합니다. |
| 분리한 모듈이 다시 `TutorialScene`을 import하거나 거대한 context를 받음 | 상수·키·값·정책 seam, presenter/queue/timeline/loader와 view/button host는 씬을 모르게 유지하고 필요한 snapshot과 작은 port만 받습니다. 파일 하나에 클래스 하나를 기본으로 합니다. |
| 행동 미리보기를 위해 실제 모델을 변경한 뒤 체크포인트로 복원하거나 피해 공식을 복제 | 모델은 읽기 전용 전투 상태를 넘기고, 실제 행동과 미리보기 모두 `TutorialCombatRules` 계획을 사용합니다. 로라 의도와 플레이어 이후 상태 시뮬레이션은 각각 전용 클래스에 둡니다. |

## 11. 튜토리얼 메타 진행도와 컷씬 경계 무시

| 실수 | 예방 |
| --- | --- |
| 메타 배열을 직접 변경하거나 여러 런타임 상태 키에 흩어 저장 | `_tutorial_meta_progress.js`의 불변 갱신 함수를 사용하고 `tutorialMeta` 단일 키에 저장합니다. |
| 아이템 사용 기록과 반복 플레이 메타를 모델 상태에 직접 섞음 | 모델은 `usedItems`/knowledge를 반환하고 씬이 `identifyTutorialItem()`으로 메타를 갱신합니다. 전투 판정은 메타 저장 성공 여부에 의존하지 않습니다. |
| 메타 모듈 최상단에서 `save_system.js`를 정적 import | 순수 정규화 함수의 Node 검증이 가능하도록 기존 지연 import/의존성 주입 경계를 유지합니다. |
| 비활성 컷씬 호환 코드를 런 중 자동 재생 | `FEATURES.CUTSCENES`가 `true`일 때만 갤러리와 `TutorialCutsceneController`를 노출합니다. |
| 전투 재시작 때 `tutorialMeta`까지 초기화 | 씬 런 상태만 재생성하고 기존 식별/컷씬 호환 메타, 엔딩과 최고 점수는 유지합니다. |

## 12. 사용자 변경 덮어쓰기

- 코드 수정 전 해당 파일을 다시 읽어서 최신 상태를 확인합니다.
- 작업 중 보이는 대량 삭제/이동은 사용자 또는 이전 작업의 결과일 수 있으므로 임의로 되돌리지 않습니다.
- 파일 전체를 교체할 때 `// ... skipped` 같은 생략을 넣지 않습니다.
