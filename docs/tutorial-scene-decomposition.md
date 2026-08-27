# TutorialScene 분해 경계

## 1. 목적과 기준선

이 문서는 `TutorialScene`을 동작 변경 없이 단계적으로 분리하기 위한 책임 지도다.
장면은 최종적으로 `BaseScene` 생명주기와 명령 조율만 소유하고, 입력·뷰·버튼·표현·에셋은
각각 한 책임을 가진 모듈로 이동한다.

| 항목 | 분리 전 기준 | Turn 03 결과 |
| --- | ---: | ---: |
| 기준 커밋 | `253507b` | Turn 03 작업 트리 |
| `_tutorial_scene.js` 줄 수 | 5,024 | 4,883 |
| private 메서드 수 | 136 | 136 |
| `this.*` 상태 이름 수 | 73 | 73 |
| 장면 내부 모드·명령·키 상수 | 있음 | 제거 |
| 장면 내부 좌표·복제 유틸 | 있음 | 제거 |

메서드와 상태 수가 아직 큰 이유는 이번 턴이 분리의 안전한 경계만 만들고 실제 뷰와
프레젠터 이동은 Turn 04~06에서 수행하기 때문이다. 다음 불변 조건은 모든 분리 단계에서
유지한다.

- 전투 판정은 `TutorialBattleModel`과 `TUTORIAL_GAME_DATA`만 결정한다.
- `update()`는 입력 의도를 명령 큐에 넣고, 상태 변경은 `applySimulationCommands()`에서 한다.
- 뷰는 읽기 전용 view model과 렌더 의존성만 받고 모델·저장·명령 큐를 직접 호출하지 않는다.
- 좌표, 레이아웃, 색상, 밸런스, 문구와 공개 모델 API를 분리 편의를 위해 변경하지 않는다.
- 새 클래스는 파일당 하나만 두고, 순수 값 모듈에는 불필요한 클래스 래퍼를 만들지 않는다.

## 2. 이번 턴에 만든 단방향 seam

```text
TutorialScene
├──> _tutorial_scene_constants.js
├──> _tutorial_input_bindings.js
├──> _tutorial_mode_policy.js
│    └──> _tutorial_scene_constants.js
└──> _tutorial_value_utils.js
```

새 모듈은 `_tutorial_scene.js`를 역참조하지 않는다. 상수·입력·값 유틸은 다른 모듈을
import하지 않고, 모드 정책만 모드 상수를 참조한다.

| 파일 | 단일 책임 | 현재 소비 지점 | 검증 |
| --- | --- | --- | --- |
| `_tutorial_scene_constants.js` | 화면 모드와 시뮬레이션 명령 어휘 | 장면 흐름·버튼·입력 | 정확한 키/값 집합, 값 중복 금지 |
| `_tutorial_input_bindings.js` | 의미 키, 선택 키 그룹, 방향 벡터, watched 목록 | 키 상승 에지와 명령 변환 | 네 방향, watched 포함·중복 검사 |
| `_tutorial_mode_policy.js` | 모드별 view·버튼·복귀·재시작·전투 입력 정책 | `draw`, 버튼 구성, 복귀·재시작 검증 | 전체 모드 표 기반 검사 |
| `_tutorial_value_utils.js` | 숫자·타일·컬렉션 정규화와 방어 복제 | 장면 전 영역 | 좌표, Map/Set/배열, 순환 참조 독립성 |

## 3. 현재 책임별 상태 읽기·쓰기

| 책임 | 주로 읽는 상태 | 주로 쓰는 상태 | 외부 의존성 |
| --- | --- | --- | --- |
| 흐름·생명주기 | `mode`, `timelineRevision`, `cutscenes`, `resultData` | `mode`, `model`, 런 선택·결과·컷씬 상태 | `BaseScene`, 모드 정책, 명령 상수 |
| 입력 | 모드 정책, 모델 phase, 선택 대상, 마우스 focus | 키 latch/edge, hover, 대상 index, 명령 큐 | `input_system`, 입력 바인딩, command queue |
| 모델 조율 | `model`, 계획 경로, 선택 상태, 캐시 | 모델 공개 API를 통한 상태 변경, 캐시, 결과 진입 | `TutorialBattleModel` 공개 API |
| 저장·메타 | `meta`, 모델 snapshot, 결과 | `meta`, `committedMeta`, `metaStaging`, `saveSequence` | `_tutorial_meta_progress.js` |
| 프레젠테이션 | 모델 결과·event, `presentation`, 타임라인 | 애니메이션 slot, 잠금, 피드백 수명, floor view | `animation_system`, 향후 presenter/queue |
| 렌더·레이아웃 | 읽기 전용 모델/표현 상태, viewport, 데이터 | viewport 파생값과 렌더 명령만 | display, theme, font util |
| 에셋 | 데이터의 asset 경로, `destroyed` | 이미지 readiness, atlas canvas cache | `Image`, DOM canvas |
| 버튼 | 모드·모델·선택·인벤토리, viewport | 풀 소유 목록, 서명, page, UI 소비 플래그 | `UIPool`, `releaseUIItem` |

### 3.1 흐름·생명주기 메서드

- 공개 생명주기: `constructor`, `update`, `draw`, `applySimulationCommands`, `resize`,
  `applyRuntimeSettings`, `destroy`
- 모드 흐름: `#applyMetaReady`, `#applyStart`, `#applyOpenGallery`,
  `#applyReturnMenu`, `#applyStarterShift`, `#applyChooseStarter`, `#applyRestart`,
  `#leaveRun`, `#beginRun`, `#applyGalleryShift`, `#applyGalleryPlay`
- 컷씬 흐름: `#applyCutsceneNext`, `#applyCutsceneClose`, `#resumeAfterCutscene`,
  `#openCutscene`, `#isCutsceneUnlocked`

주요 읽기 상태는 `mode`, `data.FEATURES`, `starterIndex`, `galleryIndex`, `cutscenes`다.
주요 쓰기 상태는 `mode`, `timelineRevision`, `model`, `resultData`, `resultRecorded`,
`starterItemId`, `pendingCutscenes`, `runCutsceneIds`와 런 초기화 상태다.

### 3.2 입력 메서드

- `#handleKeyboardInput`, `#updatePointerState`, `#handlePointerInput`, `#queueUiCommand`
- `#wasKeyPressed`, `#wasAnyKeyPressed`, `#prepareKeyboardEdges`, `#captureKeyboardLatch`
- 공간 판정: `#hitTestTile`

입력은 `mode`, `presentationLocked`, `cutscenes`, 모델 phase, 계획 경로와 선택 대상을 읽는다.
`keyboardLatch`, `keyboardPressObserved`, `frameKeyEdges`, `lastKeyboardEventTimestamp`,
`hoveredTile`, `hoveredTileKey`, `targetIndex`, `cleanseTargetIndex`, `uiActionHandled`를 쓰고
실제 게임 의도는 `enqueueSimulationCommand()`로만 내보낸다.

### 3.3 모델 조율 메서드

- 이동·행동: `#applyPlanStep`, `#applyPlanBack`, `#applyCommitPath`, `#commitModelPath`,
  `#applySelectAttack`, `#applyAttack`, `#applyHeal`, `#applyIdle`, `#applySelectCleanse`,
  `#applyCleanseEventTile`, `#applyUseItem`
- 적 단계·후처리: `#applyLoraAction`, `#applyLoraCompletion`, `#afterModelChange`,
  `#collectRunCutscenes`, `#updateLoraTurn`
- 읽기 캐시: `#getSnapshot`, `#captureFloorActorView`, `#refreshBattleCache`,
  `#normalizeReachability`, `#normalizePath`, `#resetPlannedPath`, `#shiftAttackTarget`,
  `#shiftCleanseTarget`, `#canAcceptBattleInput`
- 인벤토리 조회: `#getInventoryEntries`, `#getInventoryPaging`, `#isItemUsable`,
  `#isItemKnown`

이 그룹은 `model`의 공개 API만 호출한다. 장면 캐시인 `floorView`, `floorActorView`,
`reachability`, `plannedPath`, `actionTargets`, `cleanseTargets`와 선택 index를 갱신하지만
벽·포탈·아이템·피해를 별도로 계산하지 않는다.

### 3.4 저장·메타 메서드

- `#syncMetaFromModel`, `#enterResultIfNeeded`, `#calculateScore`, `#replaceMeta`,
  `#commitStagedMeta`, `#saveMeta`

`meta`, `committedMeta`, `metaStaging`, `saveSequence`, `resultData`, `resultRecorded`를
소유한다. 완료 결과만 `recordTutorialResult()`로 기록하고, 중단 재시작은 발견 정보만
확정한 뒤 스타터 선택으로 돌아간다.

### 3.5 프레젠테이션 메서드

- 애니메이션: `#animateSlot`, `#clearOwnedAnimations`, `#startSelectionAnimation`,
  `#animateHudToModel`, `#startActionPresentation`, `#startPlayerPathPresentation`,
  `#animatePlayerRoute`, `#animateTeleportTo`, `#animateFloorSwapTo`,
  `#startFloorTransitionPresentation`, `#isTeleportTransition`, `#finishPresentationLock`
- 피드백: `#consumeEvents`, `#formatEvent`, `#formatReason`, `#spawnEventEffect`,
  `#spawnPathParticles`, `#updatePresentation`, `#appendEvent`

`presentation`, `presentationLocked`, `ownedAnimationIds`, `animationSlots`,
`floatingTexts`, `particles`, `screenShakeSeconds`, `stabilizeSeconds`, `flashSeconds`,
`eventLog`를 읽고 쓴다. Turn 06에서 event→cue 변환, cue 수명, 애니메이션 실행을 각각
별도 클래스로 분리한다.

### 3.6 렌더·레이아웃 메서드

- viewport·투영: `#syncViewport`, `#uww`, `#uwh`, `#getBoardShake`, `#projectTile`,
  `#getCurrentFloor`
- 비전투: `#drawBackdrop`, `#drawLoading`, `#drawMenu`, `#drawStarterSelect`,
  `#drawGallery`, `#drawResult`, `#drawCutscene`, `#getCutsceneRect`
- 전투 월드: `#drawBattle`, `#drawQuarterViewBoard`, `#drawWorldObjects`, `#drawWall`,
  `#drawWorldItem`, `#drawEventTile`, `#drawTeleport`, `#drawMob`, `#drawPlayer`,
  `#drawLora`, `#drawShadow`, `#drawWorldHp`, `#drawWorldGlyph`, `#getItemGlyph`,
  `#drawWorldEffects`
- HUD: `#drawBattleHud`, `#drawBattleStageHeader`, `#drawLoraStatusCard`,
  `#drawMissionCard`, `#drawPlayerStatus`, `#drawInventoryCard`, `#drawHudCard`,
  `#drawGauge`
- 공통 텍스트: `#wrapText`, `#truncateText`, `#drawText`

이 그룹은 `WW`, `WH`, `UIWW`, `UIOffsetX`, `fonts`, `boardRect`, `hudRects`,
`tileWidth`, `tileHeight`, `tileElevation`, `tileSide`, `tileGap`, `isoOriginX`,
`isoOriginY`와 읽기 전용 모델·표현 상태를 사용한다. 렌더 메서드는 모델을 변경하지 않는다.

### 3.7 에셋 메서드와 상태

- `#isImageReady`, `#sliceItemAtlas`
- 상태: `loraPortrait`, `itemAtlasImage`, `itemIconCanvases`, `loraSprite`,
  `loraSpriteReady`, `destroyed`

현재 생성자와 `destroy()`가 이미지 이벤트 수명까지 직접 관리한다. Turn 06에서 주입 가능한
이미지 팩토리와 명시적 `destroy()`를 가진 `TutorialAssetLoader` 한 클래스로 이동한다.

### 3.8 버튼 메서드와 상태

- 수명·dispatch: `#ensureButtons`, `#getButtonSignature`, `#buildButtons`,
  `#releaseButtons`, `#updateButtons`, `#drawButtons`, `#changeInventoryPage`
- 화면별 구성: `#buildMenuButtons`, `#buildStarterButtons`, `#buildGalleryButtons`,
  `#buildBattleButtons`, `#buildResultButtons`, `#buildCutsceneButtons`
- 생성: `#createButton`, `#createItemIconChild`

`buttons`, `buttonSignature`, `inventoryPage`, `uiActionHandled`를 쓰고 `UIPool`을 소유한다.
화면 모듈은 앞으로 button spec과 `onCommand(type, payload)` 의도만 제공하며, 실제 풀
반납과 command enqueue는 `TutorialButtonHost`가 담당한다.

## 4. 목표 모듈과 이동 순서

| 순서 | 파일당 클래스/모듈 | 책임 | 허용 의존성 |
| --- | --- | --- | --- |
| Turn 04 | `TutorialLoadingView` | 로딩 화면 렌더 | read-only view model, render port |
| Turn 04 | `TutorialMenuView` | 메인 메뉴 렌더·button spec | view model, `onCommand` |
| Turn 04 | `TutorialStarterView` | 스타터 선택 렌더·button spec | view model, `onCommand` |
| Turn 04 | `TutorialGalleryView` | 갤러리 렌더·button spec | view model, `onCommand` |
| Turn 04 | `TutorialResultView` | 결과 렌더·button spec | view model, `onCommand` |
| Turn 04 | `TutorialCutsceneView` | 컷씬 카드 렌더·button spec | controller snapshot, `onCommand` |
| Turn 04 | `TutorialButtonHost` | `UIPool` 획득·갱신·그리기·반납 | button spec, UI API |
| Turn 05 | `TutorialBattleViewModelBuilder` | 한 프레임의 직렬화 가능한 전투 view model 생성 | model snapshot·장면 선택 상태 읽기 |
| Turn 05 | `TutorialBattleWorldView` | 타일·경로·오브젝트·액터 렌더와 hit region | battle view model, render port |
| Turn 05 | `TutorialBattleHudView` | 턴·게이지·행동·인벤토리 렌더 | battle view model, render port |
| Turn 05 | `TutorialBattleFeedbackView` | cue의 화면 표시 | feedback snapshot, render port |
| Turn 06 | `TutorialBattlePresenter` | 모델 event와 snapshot을 결정론적 cue로 변환 | 순수 값만 |
| Turn 06 | `TutorialFeedbackQueue` | cue 순서·수명·시간 경과 | delta와 cue만 |
| Turn 06 | `TutorialAssetLoader` | 이미지 캐시·atlas 분할·실패·정리 | 주입된 Image/Canvas 팩토리 |

`TutorialScene`은 위 모듈을 조립하되 모듈 전체가 다시 장면을 받는 God context는 만들지
않는다. 각 생성자/메서드에는 필요한 작은 포트와 읽기 전용 값만 전달한다.

## 5. 이번 턴에서 바꾸지 않는 부분

- `TutorialBattleModel` 공개 API, 체크포인트 형식과 전투 밸런스
- `TUTORIAL_GAME_DATA`, 테마 색상, 레이아웃 수치와 콘텐츠 문구
- Canvas/WebGL 레이어와 렌더 명령 형식
- 메타 스키마, 저장 키와 컷씬 기능 플래그
- 버튼 배치, 타일 투영, hit test와 애니메이션 시간
- 실제 비전투/전투 렌더 메서드와 이미지 로더의 클래스 이동

내부 모듈 이름과 정책 필드명은 현재 코드 책임을 기준으로 정했다. 기획 콘텐츠나 미확정
점수·이름을 새로 확정한 결정은 없으므로 외부 회의 문서 조회는 필요하지 않았다.
