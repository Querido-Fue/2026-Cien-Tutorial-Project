# TutorialScene 분해 경계

## 1. 목적과 기준선

이 문서는 `TutorialScene`을 동작 변경 없이 단계적으로 분리하기 위한 책임 지도다.
장면은 최종적으로 `BaseScene` 생명주기와 명령 조율만 소유하고, 입력·뷰·버튼·표현·에셋은
각각 한 책임을 가진 모듈로 이동한다.

| 항목 | 분리 전 기준 | Turn 03 결과 | Turn 04 결과 | Turn 05 결과 | Turn 06 결과 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 기준 커밋 | `253507b` | `1f0711e` | `cf9736a` | `cd8069e` | Turn 06 작업 트리 |
| `_tutorial_scene.js` 줄 수 | 5,024 | 4,883 | 4,458 | 3,119 | 2,426 |
| private 메서드 수 | 136 | 136 | 128 | 100 | 81 |
| 장면 내부 모드·명령·키 상수 | 있음 | 제거 | 제거 유지 | 제거 유지 | 제거 유지 |
| 장면 내부 좌표·복제 유틸 | 있음 | 제거 | 제거 유지 | 제거 유지 | 제거 유지 |
| 장면 내부 비전투 draw 구현 | 6개 | 6개 | 0개 | 0개 | 0개 |
| 장면 내부 전투 draw 구현 | 있음 | 있음 | 있음 | 0개 | 0개 |
| 장면의 전투 투영·HUD 좌표 소유 | 있음 | 있음 | 있음 | 제거 | 제거 유지 |
| 장면의 UI 풀 소유 | 있음 | 있음 | 제거 | 제거 유지 | 제거 유지 |
| 장면의 모델 event 해석 | 있음 | 있음 | 있음 | 있음 | 제거 |
| 장면의 이미지 로딩·atlas 분할 | 있음 | 있음 | 있음 | 있음 | 제거 |

Turn 04에서 비전투 렌더링과 버튼 풀 수명주기를 이동했고, Turn 05에서 전투 레이아웃,
월드, HUD, 피드백 렌더링을 실제 클래스로 이동했다. Turn 06에서는 모델 event 해석,
피드백 큐, 애니메이션 타임라인, 이미지·atlas 수명주기를 각각 전용 모듈로 옮겼다. 장면에
남은 큰 책임은 입력 변환, 모델 명령 조율, 메타 저장, view model 조립이다. Turn 12에서는
개별 PNG 매니페스트와 논리 에셋 포트를 도입하고 더 이상 사용하지 않는 atlas 책임을
로더에서 제거했다. Turn 13에서는 월드 뷰의 배우 렌더를 `TutorialBattleActorView`로 옮기고,
스프라이트 clip 해석·재생·roster·cue 연결을 각각 한 책임의 클래스로 분리했다.
Turn 14에서는 장면의 지속 BGM·호흡 loop·UI/cue 변환을 `TutorialAudioDirector`로 옮기고,
전역 사운드 구현을 resolver와 음악/SFX/UI 버스로 분리했다. 다음 불변
조건은 모든 분리 단계에서 유지한다.

- 전투 판정은 `TutorialBattleModel`과 `TUTORIAL_GAME_DATA`만 결정한다.
- `update()`는 입력 의도를 명령 큐에 넣고, 상태 변경은 `applySimulationCommands()`에서 한다.
- 뷰는 읽기 전용 view model과 렌더 의존성만 받고 모델·저장·명령 큐를 직접 호출하지 않는다.
- 좌표, 레이아웃, 색상, 밸런스, 문구와 공개 모델 API를 분리 편의를 위해 변경하지 않는다.
- 새 클래스는 파일당 하나만 두고, 순수 값 모듈에는 불필요한 클래스 래퍼를 만들지 않는다.

## 2. 기초 단방향 seam

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
| 프레젠테이션 | 모델 결과·전후 snapshot, cue, floor view | 장면은 floor snapshot 교체만 조율 | presenter, feedback queue, animation timeline |
| 배우 스프라이트 | 표시 층 배우·actor-animation cue·clip 데이터 | 장면은 roster 동기화와 snapshot 전달만 조율 | clip resolver, sprite animator, cue router, actor view |
| 오디오 조율 | 화면 모드·층·결과·불안정 상태·drain audio cue | 장면은 작은 상태 snapshot과 명령 타입만 전달 | audio director, global sound port |
| 렌더·레이아웃 | 읽기 전용 모델/표현 상태, viewport, 데이터 | viewport 파생값과 렌더 명령만 | display, theme, font util |
| 에셋 | 데이터의 asset 경로 | 장면은 loader 생성·조회·정리만 조율 | `TutorialAssetLoader`, asset port |
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
- 공간 판정: `TutorialBattleLayout.hitTestTile(#createBattleLayoutFrame(), x, y)`

입력은 `mode`, `presentationTimeline.isLocked()`, `cutscenes`, 모델 phase, 계획 경로와 선택 대상을 읽는다.
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
- 인벤토리 조회·명령 적용: `#getInventoryEntries`, `#getInventoryPaging`,
  `#applyInventoryPageShift`, `#isItemUsable`, `#isItemKnown`

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

- 장면 조율: `#afterModelChange`, `#startFloorTransitionPresentation`, `#appendEvent`
- event→cue: `TutorialBattlePresenter`
- cue→배우 클립·impact 예약: `TutorialSpriteCueRouter`
- 표시 층 actor 투영·델타 재생: `TutorialSpriteRoster`, `TutorialSpriteAnimator`
- cue 순서·수명·오디오 대기열: `TutorialFeedbackQueue`
- 준비된 audio cue·지속 BGM·호흡 loop 소비: `TutorialAudioDirector`
- 표시 상태·animation slot·입력 잠금: `TutorialAnimationTimeline`

장면은 모델 결과와 전후 snapshot을 프레젠터에 전달하고, 생성된 cue를 스프라이트 라우터,
피드백 큐와 타임라인에 순서대로 전달한다. 이벤트 문구·피해/회복·불안정도 해석, 일시적
피드백 배열, clip 프레임, 애니메이션 ID와 잠금 토큰은 장면이 소유하지 않는다. 층 전환의
`floorView`/`floorActorView` 교체만 모델 캐시와 연결되는 작은 callback으로 남긴다. cue 계약은
`tutorial-presentation-cues.md`, clip 계약은 `tutorial-sprite-animation.md`, 오디오 정책은
`tutorial-audio.md`에 둔다.

### 3.6 렌더·레이아웃 메서드

- viewport: `#syncViewport`, `#uwh`, `#getCurrentFloor`
- 공통 배경: `#drawBackdrop`
- 비전투 view model: `#createNonbattleViewFrame`, `#createLoadingViewModel`,
  `#createMenuViewModel`, `#createStarterViewModel`, `#createGalleryViewModel`,
  `#createResultViewModel`, `#createCutsceneViewModel`
- 전투 view model: `#createBattleLayoutFrame`, `#createBattleViewModel`

장면은 viewport를 `TutorialBattleLayout.resize()`에 전달하고, 같은 레이아웃 프레임을
월드 렌더링·피드백·마우스 히트테스트에 사용한다. 전투 오브젝트 정렬은
`TutorialBattleWorldView`, 배우 스프라이트·도형 폴백은 `TutorialBattleActorView`, HUD draw와
버튼 사양은 `TutorialBattleHudView`, 입자와 떠오르는 텍스트는
`TutorialBattleFeedbackView`가 각각 소유한다. 뷰는 장면이나 모델을 변경하지 않는다.

### 3.7 에셋 메서드와 상태

- 장면 조율: 생성자에서 `TutorialAssetPort.loadAll()`을 호출하고 `destroy()`에서 loader를
  정리한다.
- loader 소유: 매니페스트 PNG 로드, 원본 크기 검증, source rect 크롭, 이미지 캐시,
  `onload`/`onerror`, 실패 상태와 cleanup
- 포트 소유: UI·아이템·스프라이트의 의미 기반 조회와 1F/B1 분리 레이어 우선·합성본 폴백 정책
- 뷰 연결: `getUiAsset()`/`getItemIcon()`/`getMapArtwork()` 등 작은 의미 기반 asset port

장면에는 `new Image()`, DOM canvas 생성, source rect 크롭 또는 이미지 콜백이 없다.
`TutorialAssetLoader`는 Image/Canvas 팩토리를 주입받을 수 있으며 실패 시 매니페스트의
폴백 체인을 순환 없이 탐색하고 직렬화 가능한 진단 상태를 제공한다.

### 3.8 버튼 메서드와 상태

- 장면 조율: `#ensureButtons`, `#getButtonSignature`, `#getButtonSpecs`,
  `#createButtonHostStyle`, `#getBattleButtonSpecs`, `#applyInventoryPageShift`
- 아이콘 어댑터: `TutorialButtonHost.#createItemIconChild`

`TutorialButtonHost`가 `UIPool` 획득·갱신·그리기·반납과 구성 서명을 소유한다. 모든 화면은
직렬화 가능한 command button spec만 반환하고, 호스트가 `onCommand(type, payload)`로 씬에
전달한다. 전투 버튼 좌표·활성 조건·인벤토리 페이지 범위는 HUD 뷰가 계산하고, 페이지
변경은 `INVENTORY_PAGE_SHIFT` 명령을 거쳐 장면에서 적용한다. 아이콘 spec의 논리 ID는
호스트가 asset/render port로 이미지 자식으로 변환하므로 장면은 UI 자식 구현을 알지 못한다.

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
| Turn 05 | `TutorialBattleLayout` | viewport별 보드·HUD 좌표와 타일 투영·히트테스트 | 정적 레이아웃 데이터, 순수 viewport 값 |
| Turn 05 | 장면 `#createBattleViewModel` | 한 프레임의 직렬화 가능한 전투 view model 생성 | model snapshot·장면 선택 상태 읽기 |
| Turn 05 | `TutorialBattleWorldView` | 타일·경로·오브젝트·액터 렌더 | battle view model, layout, render/asset port |
| Turn 05 | `TutorialBattleHudView` | 턴·게이지·행동·인벤토리 렌더 | battle view model, render port |
| Turn 05 | `TutorialBattleFeedbackView` | cue의 화면 표시 | feedback snapshot, render port |
| Turn 06 | `TutorialBattlePresenter` | 모델 event와 snapshot을 결정론적 cue로 변환 | 순수 값만 |
| Turn 06 | `TutorialFeedbackQueue` | cue 순서·수명·시간 경과 | delta와 cue만 |
| Turn 06 | `TutorialAnimationTimeline` | 표시 보간·slot·겹친 입력 잠금·취소 | 주입된 animation port와 cue |
| Turn 06→12 | `TutorialAssetLoader` | 매니페스트 이미지 로드·검증·크롭·폴백·정리 | 주입된 Image/Canvas 팩토리 |
| Turn 12 | `TutorialAssetPort` | 논리 ID 조회와 맵 레이어 선택 정책 | loader, asset manifest |
| Turn 12 | `TutorialAchievementBanner` | 런 단위 최초 발견 배너의 큐와 수명 | item ID, delta |
| Turn 12 | `TutorialAchievementView` | 업적 배너 렌더 | read-only view model, render/asset port |
| Turn 13 | `TutorialSpriteClipResolver` | 동작·방향·색상 variant와 명시적 폴백 해석 | clip 데이터 |
| Turn 13 | `TutorialSpriteAnimator` | actor별 델타 프레임·우선순위·이벤트·수명 | clip resolver |
| Turn 13 | `TutorialSpriteRoster` | 표시 층 배우를 animator 입력으로 투영 | animator |
| Turn 13 | `TutorialSpriteCueRouter` | actor cue 실행, impact 예약, 발걸음 cue 파생 | animator, cue callback |
| Turn 13 | `TutorialBattleActorView` | 배우 스프라이트와 도형 폴백 렌더 | battle view model, render/asset port |
| Turn 14 | `TutorialAudioDirector` | 화면 BGM·호흡 loop·UI 명령·drain cue 변환 | 작은 장면 snapshot, sound port |
| Turn 14 | `AudioManifestResolver` | cue ID와 비순환 fallback 해석 | audio manifest |
| Turn 14 | `MusicBus` | BGM 중복 방지·crossfade·pause/resume | resolver, Audio factory |
| Turn 14 | `AudioBus` | SFX/UI cooldown·polyphony·loop·수명 | resolver, Audio factory, clock |
| Turn 14 | `AudioUnlockGate` | 최초 사용자 입력 재시도 리스너 수명 | window-like event target |

`TutorialScene`은 위 모듈을 조립하되 모듈 전체가 다시 장면을 받는 God context는 만들지
않는다. 각 생성자/메서드에는 필요한 작은 포트와 읽기 전용 값만 전달한다.

## 5. 분리 과정에서 바꾸지 않은 부분

- `TutorialBattleModel` 공개 API, 체크포인트 형식과 전투 밸런스
- `TUTORIAL_GAME_DATA`, 테마 색상, 레이아웃 수치와 콘텐츠 문구
- Canvas/WebGL 레이어와 렌더 명령 형식
- 메타 스키마, 저장 키와 컷씬 기능 플래그
- 버튼 배치, 타일 투영, hit test와 애니메이션 시간
- 실제 비전투/전투 렌더 메서드와 이미지 로더의 클래스 이동

내부 모듈 이름과 정책 필드명은 현재 코드 책임을 기준으로 정했다. 기획 콘텐츠나 미확정
점수·이름을 새로 확정한 결정은 없으므로 외부 회의 문서 조회는 필요하지 않았다.

## 6. Turn 04 비전투 뷰 결과

```text
TutorialScene
├──> TutorialLoadingView
├──> TutorialMenuView ─────┐
├──> TutorialStarterView ──┤
├──> TutorialGalleryView ──┼──> nonbattle view helpers
├──> TutorialResultView ───┤
├──> TutorialCutsceneView ─┘
└──> TutorialButtonHost ───────> UIPool
```

- 여섯 뷰 클래스는 파일당 하나이며 모델, 메타 저장, 시뮬레이션 명령 큐와 장면을 import하지
  않는다. 상수 모듈과 순수 공통 레이아웃/렌더 도우미만 참조한다.
- 장면이 전달하는 뷰 모델은 뷰포트·글꼴·테마 색상과 화면별 표시값으로 제한하며 모두
  직렬화 가능한 값이다. 렌더 함수는 생성자 포트로 별도 주입한다.
- 비전투 버튼 사양은 좌표, 표시 상태와 `{ type, payload }` 명령 의도만 포함한다. 실제
  mouse consume과 enqueue는 장면의 `#queueUiCommand()` 경계를 유지한다.
- `TutorialButtonHost`는 전투와 비전투 버튼의 풀 수명주기를 함께 소유하지만 전투 모델,
  저장, 명령 큐를 알지 못한다.
- 화면 문구, 좌표 비율, 테마 키, 기능 플래그와 전투 규칙은 변경하지 않았다. 외부 기획
  자료가 필요한 새 콘텐츠 결정도 없었다.

## 7. Turn 05 전투 뷰 결과

```text
TutorialScene
├──> TutorialBattleLayout <──── 월드 렌더·히트테스트 공유 좌표
├──> TutorialBattleWorldView ──> battle view helpers
├──> TutorialBattleHudView ────> battle view helpers
├──> TutorialBattleFeedbackView
└──> TutorialButtonHost ───────> UIPool
```

- 장면의 `#createBattleViewModel()`이 snapshot, 현재 층, 도달 가능 타일, 계획 경로, 행동·정화
  대상과 선택, 보간 상태, 아이템 메타데이터, HUD 상태를 한 번에 조립한다.
- 네 전투 클래스는 파일당 하나이며 모델, 메타 저장, 시뮬레이션 명령 큐와 장면을 import하지
  않는다. 공용 도우미는 상태 없는 순수 함수만 제공한다.
- `TutorialBattleLayout`이 보드/HUD 크기와 타일 투영을 소유한다. 월드 뷰와 장면의
  히트테스트가 동일 프레임을 소비하므로 렌더 좌표와 입력 좌표가 별도로 어긋나지 않는다.
- HUD 뷰는 전투 버튼을 직접 실행하지 않고 `{ type, payload }`만 반환한다. 인벤토리 페이지
  이동도 명령 경계를 거치므로 뷰가 장면 상태를 변경하지 않는다.
- 이미지·atlas canvas는 직렬화 가능한 view model에 섞지 않고 작은 asset port로 주입했다.
  에셋 로드·실패·정리 수명주기는 다음 분리 대상이다.
- 화면 문구, 수치, 자산 경로와 전투 규칙을 새로 결정하지 않았으므로 외부 회의 문서 조회는
  필요하지 않았다.

## 8. Turn 06 프레젠테이션·에셋 결과

```text
TutorialBattleModel result + previous/next snapshot
                         │
                         v
              TutorialBattlePresenter
                         │ ordered immutable cues
            ┌────────────┴─────────────┐
            v                          v
 TutorialFeedbackQueue      TutorialAnimationTimeline
 log/transient/audio        gauges/route/floor/lock

TUTORIAL_GAME_DATA asset paths
              │
              v
    TutorialAssetLoader ──> view asset port
```

- 프레젠터는 모델의 26개 event 타입을 명시적 계약으로 고정하고 동일 입력에 동일한 불변 cue
  배열을 만든다. 모델·장면·저장·명령 큐를 import하거나 입력 snapshot을 변경하지 않는다.
- 피드백 큐는 cue에 단조 증가 순번을 부여하고 로그, 떠오르는 글자, 결정론적 경로 입자,
  흔들림·플래시·안정화 시간과 재생 전 오디오 ID 대기열을 소유한다.
- 타임라인은 HUD 보간, 선택·행동·경로·텔레포트·층 전환 애니메이션과 animation ID 정리를
  소유한다. 겹친 연출은 개별 잠금 토큰을 사용해 모두 완료되기 전에 입력이 풀리지 않으며,
  `cancel()`은 이전 세대 완료 callback을 무효화한다.
- 에셋 로더는 이미지 상태와 atlas canvas를 ID별로 캐시하고, 실패·팩토리 부재 시 null
  폴백을 제공한다. 장면과 뷰는 로더의 브라우저 콜백이나 DOM 구현을 알지 못한다.
- 새 클래스는 파일당 하나이고 프레젠테이션 계약은 클래스 없는 값 모듈이다. 새 모듈은
  `TutorialScene`, `TutorialBattleModel`, 메타 저장 또는 시뮬레이션 명령 큐를 역참조하지 않는다.
- 자동 테스트와 NW.js 수동 확인은 사용자의 중단 요청으로 실행하지 않았다. cue 계약,
  queue 수명, 겹친 잠금, 에셋 성공·실패·정리를 다루는 테스트 소스만 추가했다.
- 화면 문구, 애니메이션 시간, 자산 경로와 전투 규칙을 새로 결정하지 않아 외부 회의 문서
  조회는 필요하지 않았다.

## 9. Turn 12 매니페스트·실제 아트 결과

```text
TUTORIAL_ASSET_MANIFEST
          │ logical ID + dimensions + layer + fallback
          v
TutorialAssetPort ───────> TutorialAssetLoader
     │ semantic lookup          │ load / validate / crop / cache
     ├──> map artwork policy
     ├──> UI views
     └──> TutorialButtonHost item icons

item-picked event ──> TutorialAchievementBanner ──> TutorialAchievementView
```

- 31개 PNG는 `project/asset` 원본을 변경하지 않고 ASCII 런타임 경로로 복사하며, 파일명,
  PNG 헤더 크기, 용도, 레이어, 필수 여부와 폴백을 분리된 매니페스트 값 모듈에 기록한다.
- 맵 포트는 배경과 격자가 모두 준비된 경우에만 분리 레이어를 사용하고, 하나라도 없으면
  합성본을 사용한다. 두 경로 모두 없을 때만 기존 도형 월드 폴백으로 내려간다.
- `TutorialBattleLayout`은 각 층 아트의 실제 사변형 축으로 9×8 타일을 투영하고 같은 역변환을
  히트테스트에 사용한다. 월드 렌더와 입력은 동일 레이아웃 프레임을 공유한다.
- UI 원본 시트는 매니페스트 source rect에서 nearest-neighbor canvas로 한 번만 크롭한다.
  원본에 없는 동적 한글 문구는 런타임 텍스트로 겹치며, 버튼은 논리 아이콘 ID만 전달한다.
- 아이템 최초 발견 업적은 기획 규칙이 별도로 확인되지 않아 한 런에서 항목당 한 번, 3초
  노출로 구현했다. `TutorialAchievementBanner`가 규칙·시간을, 뷰가 렌더링만 소유한다.
- `TutorialAssetLoader`에서 사용되지 않는 atlas API와 셀 캐시를 제거했다. 아이템마다 독립된
  PNG를 사용하므로 로더는 이미지 수명과 검증 책임에만 집중한다.

## 10. Turn 13 스프라이트 애니메이션 결과

```text
TutorialBattlePresenter cues
             │
             v
 TutorialSpriteCueRouter ── impact delay ──> TutorialFeedbackQueue
             │
             v
  TutorialSpriteAnimator <── TutorialSpriteRoster
             │ read-only frame snapshot
             v
 TutorialBattleActorView ──> WebGL sourceRect UV
             ^
             │
 TutorialSpriteClipResolver <── TUTORIAL_SPRITE_CLIPS
```

- 플레이어 5개, 로라 1개, 슬라임 2개 원본 시트를 매니페스트에 추가해 현재 PNG 계약은
  39개다. 논리 32×32 frame과 실제 64/74픽셀 source rect를 분리해 원본 파일은 재가공하지 않는다.
- clip resolver는 제공되지 않은 Range·Breathing·로라 action sheet를 숨기지 않고 데이터의
  `available: false`와 비순환 `fallbackClipId`로 표현한다. 폴백 결정과 근거는
  `tutorial-sprite-animation.md`에 기록한다.
- animator는 delta 기반 루프, 비루프 완료, impact·footstep 1회 이벤트, 우선순위 중단과
  terminal 수명을 소유한다. cue router가 피해 표시를 공격 impact에 맞춰 예약하며 reset과
  destroy가 남은 예약과 트랙을 함께 정리한다. 전투 결과 화면은 router의 예약·비루프 동작이
  모두 끝난 다음 열려 마지막 피격·사망 프레임을 생략하지 않는다.
- 월드 뷰에서 플레이어·로라·몹 렌더를 배우 뷰로 옮겼다. 배우 뷰는 정수 크기·위치,
  nearest-neighbor, 발 앵커와 다중 레이어 합성을 적용하고 이미지 실패 때만 기존 도형을 그린다.
- 전체 74개 테스트, PNG 39개 감사와 저장소 검사가 통과했다. 저장소 검사의 미연결 오디오
  경고 2개는 Turn 14 사운드 통합 범위로 남긴다.

## 11. Turn 14 오디오 버스·큐 결과

```text
TutorialScene ── small state/cues ──> TutorialAudioDirector
                                         │ sound port
                                         v
                                    SoundSystem facade
                      ┌──────────────────┼──────────────────┐
                      v                  v                  v
                  MusicBus          AudioBus(SFX)      AudioBus(UI)
                      └──────────────────┬──────────────────┘
                                         v
                              AudioManifestResolver
                                         ^
                                         │
                            TUTORIAL_AUDIO_MANIFEST
```

- 장면은 실제 경로, Audio 객체, 볼륨·동시 재생 수치 또는 자동재생 리스너를 소유하지 않는다.
  `#createAudioState()`가 모드·층·결과·로라 HP/불안정도만 방어 snapshot으로 전달하고,
  feedback queue의 준비 cue를 한 번 drain한다.
- `SoundSystem`은 기존 공개 함수를 보존하는 파사드로 축소했다. resolver, 음악 버스, SFX/UI
  버스와 unlock gate는 파일당 한 클래스이며 장면을 역참조하지 않는다.
- 원본 26개 MP3는 PNG와 같은 원본 보존·ASCII 안전 복사 정책을 공유한다. 지하층 BGM은
  누락을 숨기지 않는 manifest fallback이고, `check:assets`가 MP3 헤더와 해시까지 검사한다.
- Fake Audio 회귀는 crossfade·중복·cooldown/polyphony·loop·pause/resume·실패·설정 이관을
  검사한다. 세부 ID, 기획 추론과 초기 믹싱값은 `tutorial-audio.md`에 기록했다.

## 12. Turn 16 저장·릴리스 경계 결과

```text
tutorialMeta raw
      │
      v
TutorialMetaMigrator ──> meta schema ──> meta progress storage/operations

source/imports ──> SourceGraphAuditor ──┐
asset rights ────> ProvenanceAuditor ───┼─> check-release
runtime source ──> RuntimeSourceAuditor ┘

official NW.js ──> NwjsRuntimeValidator ──> NwjsPackager ──> Windows RC folder
```

- 메타 shape, 단계별 이관, 미래 버전 오류, 저장·진행 연산을 네 파일로 나눴다. v1의 함정
  용어는 v4 이벤트 타일 용어로 이관하고 미래 버전은 덮어쓰지 않는다.
- release auditor와 package validator/packager는 파일당 한 클래스이며 서로의 세부 구현을
  소유하지 않는다. 조립 스크립트는 명령행 입출력과 종료 코드만 담당한다.
- theme가 display 파사드를 역참조하던 순환은 작은 background write port로 끊었다. 정적
  import map 감사 결과는 순환·미해결 import 0이다.
- `TutorialBattlePresenter`의 cue 동결은 좌표형과 숫자형 `from/to`를 구분한다. 수동 스모크에서
  발견한 HP `0/100` 표시 회귀를 프레젠터→타임라인 테스트로 고정했다.
- 전체 릴리스 결과와 임의 결정, 미확인 항목, 공개 배포 차단은
  `release-candidate-report.md`가 단일 인수 문서로 소유한다.
