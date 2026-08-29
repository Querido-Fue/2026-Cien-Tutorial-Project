# Module Architecture Guide

## 1. 시스템 개요

| 모듈 | 책임 | 세부 문서 |
| --- | --- | --- |
| `script/main.js` | 현재 전술 튜토리얼 런타임 진입 모듈 import | [`core_architecture_guide.md`](./core_architecture_guide.md) |
| `script/tutorial_main.js` | `TutorialScene`을 초기/플레이 씬 factory로 주입하고 `EngineApp` 시작 | [`core_architecture_guide.md`](./core_architecture_guide.md) |
| `script/release/` | 내장 릴리스 meta와 서버 `release.json` 정규화, 최신 여부 확인과 재접속 안전장치 | [`core_architecture_guide.md`](./core_architecture_guide.md) |
| `app/engine_app.js` | rAF 루프, 고정 스텝 accumulator, 창 활성/일시정지 정책 연결 | [`core_architecture_guide.md`](./core_architecture_guide.md) |
| `core/system_handler.js` | 시스템 생성, 초기화, fixed/update/draw 순서, pause policy 병합 | [`core_architecture_guide.md`](./core_architecture_guide.md) |
| `animation/` | 표준/지속/혼합 애니메이션, 고정/가변 tick 분리, 애니메이션 풀 | [`ui_overlay_guide.md`](./ui_overlay_guide.md) |
| `display/` | 정적 레이어, 동적 surface, 2D/WebGL 렌더 명령, 테마 반영, 비네팅 | [`reference/render_command_guide.md`](./reference/render_command_guide.md) |
| `input/` | 마우스/키보드 상태, 포커스 레이어, 디버그 토글, 입력 스냅샷 | - |
| `ui/` | UI 요소 팩토리, UI 풀, LayoutHandler, 커서, 툴팁, 다국어 | [`ui_overlay_guide.md`](./ui_overlay_guide.md) |
| `overlay/` | 동적 surface 기반 overlay session, BaseOverlay, glass blur, 패널 effect | [`ui_overlay_guide.md`](./ui_overlay_guide.md) |
| `scene/` | 활성 씬 보관, 튜토리얼/진단 씬, 씬 전환, resize/settings/simulation command 전달 | [`reference/scene_lifecycle_guide.md`](./reference/scene_lifecycle_guide.md) |
| `scene/tutorial/` | 두 층 순수 전투 모델과 선언형 effect 실행 계층, 전투 미리보기, 메타·콘텐츠 트리거·갤러리/체인지로그 상태, 피드백·애니메이션, 매니페스트 loader/asset port, 업적 판정·배너, 파일당 한 클래스의 비전투/전투 뷰와 버튼 호스트를 단방향 조합 | [`project_structure_guide.md`](./project_structure_guide.md) |
| `simulation/` | 메인 스레드 런타임 스냅샷, 입력/뷰포트/설정 조회, 프레임 경계 명령 큐 | [`reference/scene_lifecycle_guide.md`](./reference/scene_lifecycle_guide.md) |
| `save/` | NW.js 파일 기반 설정/진행도/런타임 상태 저장. 튜토리얼 메타는 `runtime_state.dat`의 `tutorialMeta` 단일 키를 사용 | - |
| `sound/` | BGM, 볼륨, 사용자 인터랙션 후 AudioContext 잠금 해제 | - |
| `debug/` | 에러 핸들링, 성능 샘플, 마우스/풀/성능 디버그 표시 | - |
| `object/` | 범용 `ObjectPool`과 활성 풀 디버그 레지스트리 | - |
| `data/` | 전투 규칙의 `TUTORIAL_GAME_DATA`, 원본·런타임 경로와 맵 격자 기준의 `TUTORIAL_ASSET_MANIFEST`, 공통/전술 테마 데이터 | [`reference/data_theme_guide.md`](./reference/data_theme_guide.md) |

## 2. 선택형 확장 포인트

`SystemHandler`는 엔진 코어와 게임별 런타임을 분리하기 위해 선택형 factory를 받습니다.

| 옵션 | 기대 인터페이스 |
| --- | --- |
| `sceneSystem.initialSceneFactory` | 초기 씬 인스턴스를 반환합니다. 씬은 `BaseScene` 계약을 따릅니다. |
| `sceneSystem.playSceneFactory` | `startPlayScene()`/`startBenchmarkScene()`에서 사용할 플레이 씬을 반환합니다. |
| `objectSystemFactory` | 필요 시 `init`, `resize`, `fixedUpdate`, `update`, `draw`를 가진 오브젝트 시스템을 반환합니다. |
| `runtimeManagerFactory` | 필요 시 `init`, `fixedUpdate` 등을 가진 런타임 관리자 시스템을 반환합니다. |
| `overlayManager` | 오버레이 매니저 생성 옵션을 덮어씁니다. 항상 `systemHandler`가 병합됩니다. |

특정 게임의 오브젝트, 물리, AI, 규칙은 이 확장 포인트나 씬 내부에 둡니다. 범용 엔진 모듈에 직접 결합하지 않습니다.

현재 `tutorial_main.js`는 같은 `TutorialScene` factory를 `initialSceneFactory`와 `playSceneFactory`에 등록합니다. 재시작은 `#leaveRun(MODES.STARTER)`로 현재 런 상태를 정리하고 스타터 선택으로 돌아갑니다. 전체 씬 교체가 필요한 실행 경로에는 `startPlayScene()` factory가 남아 있습니다. 수동 엔진 진단은 별도 `diagnostic_main.js`/`DiagnosticScene` 경로를 사용합니다.

## 3. 풀 원칙

- `object/_object_pool.js`의 `ObjectPool`은 범용 재사용 풀입니다. 디버그가 필요한 풀은 이름을 넘겨 `activeObjectPools`에 등록합니다.
- UI 요소는 `ui/_ui_pool.js`의 `UIPool`에서 가져오고 `releaseUIItem()`으로 반환합니다.
- `TutorialButtonHost`는 레이아웃 사양 변경과 `destroy()`에서 튜토리얼 버튼을 `releaseUIItem()`으로 반환합니다. `TutorialScene`은 호스트를 조율하지만 `UIPool`을 직접 소유하지 않습니다.
- 동적 overlay/canvas surface는 `DisplaySystem.createDynamicSurface()`로 만들고 `releaseDynamicSurface()` 경로로 회수합니다.
- 애니메이션은 `AnimationSystem`이 표준 애니메이션 풀을 워밍업하고 완료 시 반환합니다.
- hot path에서 배열 제거가 필요하면 `filter()`보다 swap-and-pop, compaction, 명시적 큐 drain을 우선 검토합니다.

## 4. 렌더 surface와 레이어

정적 DOM 레이어 순서는 아래에서 위로 쌓입니다.

```text
background(WebGL)
-> object(WebGL)
-> effect(WebGL)
-> texteffect(2D)
-> ui(2D)
-> overlaylayerhost(동적 overlay surface)
-> vignette(2D)
-> top(2D)
```

- `background`, `object`, `effect`는 WebGL surface입니다.
- `texteffect`, `ui`, `vignette`, `top`은 2D Canvas surface입니다.
- 오버레이는 필요에 따라 `dimSurface`(2D), `effectSurface`(WebGL), `uiSurface`(2D)를 동적으로 점유합니다.
- `vignette`는 persistent 2D surface로 등록되어 일반 clear에서 제외됩니다.
- 렌더 명령 규격은 [`reference/render_command_guide.md`](./reference/render_command_guide.md)를 확인합니다.

## 5. 튜토리얼 입력과 모델 경계

- `TutorialScene.update()`는 키보드, 마우스, UI 의도를 시뮬레이션 명령 큐에 넣습니다.
- 프레임 경계의 `applySimulationCommands()`가 명령을 재검증해 `TutorialBattleModel`에 적용합니다.
- `TutorialBattleModel`은 렌더링, 입력과 저장에 의존하지 않습니다. 가로 9×세로 8 두 층의 `floorStates`가 벽, 아이템, 공개 이벤트 타일, 양방향 짝 포탈과 고정 몹의 런 상태를 소유하고, `TutorialBattlePresenter`가 모델이 반환한 event와 전후 snapshot만 cue로 변환합니다.
- `_tutorial_effect_contract.js`는 안정된 effect ID를, `TutorialEffectRegistry`는 `ITEMS[*].effects`와 `EVENT_TILE_EFFECTS`의 값·참조 검증과 정규화를, `TutorialEffectExecutor`는 preview/apply가 공유하는 조건·순서·순수 계산을 각각 소유합니다. `TutorialCombatRules`는 이 결과를 행동 계획으로 구성하며, `TutorialLoraIntentPlanner`와 `TutorialPlayerActionPreviewer`는 독립 복제 상태에 계획을 적용합니다. 모델에서 시작하는 의존 방향은 contract→registry→executor 순으로만 흐릅니다.
- `getLoraIntent()`와 `previewPlayerAction()`은 체크포인트 복원 없이 비변이로 동작합니다. 플레이어 턴 HUD는 `getLoraIntent({ allowForecast: true })`로 현재 상태 기준 예고를 요청하되 실제 로라 실행은 기본 턴 검증을 유지합니다. `rawDamage`는 로라 상태의 원시 피해, `passiveAdjustedDamage`는 공격 패시브 적용값, `calculatedDamage`는 방어 패시브까지 적용한 값, `finalDamage`는 현재 HP로 제한한 실제 적용 예정값입니다.
- 플레이어는 `move -> action` 순서를 지키며 `previewPath()`/`extendPath()`로 직접 경로를 구성합니다. 행동은 `actionsUsed/actionsPerTurn` 충전으로 관리하고, 헤이스트는 두 번의 행동을 열며 대기는 남은 충전을 모두 포기합니다.
- 전투 모델 흐름은 `player(move -> action 1..N) -> lora -> mobs -> player/result`입니다. 여섯 번째 로라 행동 완료 직후 같은 좌표로 지하층을 전환하고, `loraActionsCompleted` 12회 또는 어느 한쪽 HP 0에서 즉시 종료합니다. 거울 추가 플레이어 턴은 로라 행동 수를 늘리지 않습니다.
- `TutorialCutsceneController`는 `TUTORIAL_GAME_DATA.CUTSCENES`의 고정 카드를 진행합니다. `TutorialCutsceneTriggerRouter`는 첫 실행 메타와 `item-used`, `floor-transition`, `battle-finished` 같은 실제 사건을 감사된 컷씬 ID로만 변환하며 전투 모델에 대화 phase를 추가하지 않습니다. AI 기반 채팅이나 생성형 대화 경로도 없습니다.
- `_tutorial_meta_progress.js`의 순수 함수는 입력 메타를 변경하지 않고 v3 새 객체를 반환합니다. `combatGuideSeen`이 첫 플레이 자동 안내와 재플레이 수동 다시 보기를, `openingWatched`가 오프닝 자동 재생과 갤러리 재생을 구분합니다. 컷씬·업적·엔딩 ID는 중복 없이 저장하며 실제 I/O는 지연 SaveSystem 접근을 쓰는 `loadTutorialMeta()`와 `saveTutorialMeta()`로 제한합니다. 미확정 점수는 v2 호환 값만 읽고 새 결과로 갱신하지 않습니다.
- 모드·명령 상수, 키 바인딩, 값 유틸은 서로와 씬을 import하지 않습니다. 모드 정책만 상수를 import하고 `TutorialScene`이 이 seam들을 소비하므로 의존 방향은 항상 씬 쪽으로 향합니다.
- `TutorialAchievementEvaluator`는 `TUTORIAL_CONTENT_DATA`의 임시 조건과 모델 사건을 대조하고, `TutorialAchievementBanner`는 판정된 알림 수명만 관리합니다. `TutorialGalleryController`는 업적·일기·엔딩·컷씬 섹션의 선택과 메타 기반 열람·재생 상태만 소유합니다. 이 세 클래스는 모델이나 장면을 역참조하지 않습니다.
- 로딩·메뉴·스타터·책 기반 갤러리·책 기반 체인지로그·책 기반 결과·컷씬 뷰는 파일 하나에 클래스 하나이며 직렬화 가능한 읽기 전용 view model과 작은 render/asset port만 받습니다. 체인지로그는 정규화된 릴리스 snapshot만 받아 페이지를 나누고 Git이나 네트워크를 직접 참조하지 않습니다. 모델·메타 저장·명령 큐·`TutorialScene`을 역으로 import하지 않습니다. 결과 화면은 내부 엔딩 ID와 표시명을 분리하며 점수를 표시하지 않습니다.
- 전투 월드·HUD·피드백·발견 업적·안내 뷰도 같은 단방향 규칙을 따릅니다. `TutorialBattleCommandMenuView`는 이동 단계의 초기화/동적 `n칸 이동 확정`과 행동 단계의 공격·회복·대기 배치, 정·역순 expo 플립 표현과 동일 히트 영역만 소유하고 HUD 뷰가 이를 조합합니다. `TutorialCombatReadabilityPresenter`는 모델 의도·행동 미리보기의 표시값만 만들고, `TutorialBattleFocusController`와 `TutorialGuidanceController`는 각각 공통 조사 포커스와 안내 열림 상태만 맡습니다. `TutorialScene`이 이 결과를 하나의 읽기 전용 BattleViewModel로 조립하고 이미지 객체만 `TutorialAssetPort`로 제공합니다.
- `TutorialBattleLayout`이 보드·HUD 기하와 타일 투영·히트테스트를 소유합니다. 에셋 맵에서는 매니페스트의 970×580 원본 격자 네 꼭짓점으로 두 타일 축을 구하고 aspect-fit된 맵 사각형에 투영합니다. 월드 렌더링과 입력 판정은 같은 layout frame을 사용합니다.
- 카메라 줌은 장치별 휠을 정규화한 누적값의 차분만 한 번 소비하고, 최신 목표를 기본 배율의 1.2배와 맵 이미지 좌우 맞춤 배율 사이로 제한합니다. `TutorialBattleCamera`는 진행 중 줌을 현재 표시값에서 0.4초 `easeOutExpo`로 재지정하며, 레이아웃이 같은 줌으로 맵·격자·오브젝트·히트테스트 축을 함께 계산합니다.
- 맵 프로필의 `ambientFire`는 원본 이미지의 촛불 심지 좌표와 크기만 소유합니다. `TutorialBattleLayout`이 이를 현재 `mapImageRect` 화면 좌표로 변환하고, 전투 월드 뷰는 `flameParticles` 명령 하나만 effect 레이어에 전달합니다. `FlameParticleEffectPass`는 촛불별 작은 scissor 영역에서 난류 화염과 상승 불씨를 GPU로 합성합니다.
- `TutorialFeedbackQueue`는 cue 순번과 로그·일시 피드백·오디오 ID 대기열을, `TutorialAnimationTimeline`은 표시 보간·animation slot·잠금 토큰과 취소 세대를 소유합니다. 장면은 모델 결과 적용 시점과 연출 완료 시점을 분리해 조율합니다.
- `TUTORIAL_ASSET_MANIFEST`는 원본·런타임 경로, PNG 크기, crop, layer/usage/required/fallback과 맵 격자 기준을 소유합니다. `TutorialAssetLoader`는 readiness·크기 검증·crop canvas·nearest·fallback과 callback 정리를, `TutorialAssetPort`는 도메인별 논리 조회와 분리 맵 우선 정책을 소유합니다. 뷰는 원본 이름이나 브라우저 로드 콜백을 알지 않습니다.
- 플레이어와 로라 스프라이트 클립은 원본 셀에서 실측한 프레임별 좌·우 발 접점을 함께 소유합니다. 배우 뷰는 이 접점을 기준으로 실루엣을 두 메시로 나눠 격자 동남쪽 지면에 투영하며, 부유 높이는 그림자 이동 거리·농도·픽셀 반그림자 폭으로만 변환합니다. 접점이 없는 몹·폴백은 기존 단일 앵커 투영을 유지합니다.
- 모든 뷰의 버튼 사양은 좌표·표시 상태와 `{ type, payload }` command만 포함합니다. `TutorialButtonHost`가 이를 풀 요소로 만들고 `onCommand` 포트로 씬에 전달하며, 조사 가능한 버튼의 포인터 진입은 `onFocus` 포트로 같은 key를 보냅니다. UI는 시뮬레이션 큐나 포커스 상태 구현을 알지 못합니다.
- 분리 모듈은 필요한 snapshot, 정적 설정과 작은 callback/port만 받습니다. 씬의 모든 private 상태를 노출하는 공용 context 객체는 만들지 않습니다.

## 6. fixed step과 가변 프레임 책임

- 결정론적이거나 고정 시간축이 필요한 로직은 `fixedUpdate()`에서 처리합니다.
- 렌더 표시용 보간, UI 상태, 오버레이 프레젠테이션은 가변 프레임 `update()`에서 처리합니다.
- `draw()`는 표시 좌표와 현재 surface 선택을 기준으로 그립니다.
- 고정 스텝 상세 흐름은 [`core_architecture_guide.md`](./core_architecture_guide.md)를 확인합니다.

## 7. 현재 주의할 특수 영역

| 영역 | 기준 문서 |
| --- | --- |
| 오버레이 패널 계약 | [`reference/overlay_contract_guide.md`](./reference/overlay_contract_guide.md) |
| 시뮬레이션 런타임/명령 큐 | [`reference/scene_lifecycle_guide.md`](./reference/scene_lifecycle_guide.md) |
| Display surface와 좌표계 | [`reference/display_viewport_guide.md`](./reference/display_viewport_guide.md) |
| 데이터/테마 레지스트리 | [`reference/data_theme_guide.md`](./reference/data_theme_guide.md) |
