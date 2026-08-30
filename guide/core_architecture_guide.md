# Core Architecture Guide

## 1. 엔진 코어 아키텍처 및 초기화 의존성

### 1.1 진입점

```text
project/engine/index.html
 ├── importmap 등록
 ├── 정적 canvas 레이어 생성
 └── release-bootstrap.js
      ├── HTTP(S): release.json no-store 조회
      ├── 구버전 문서: 최신 ID 쿼리로 1회 재접속
      └── 최신/NW.js/file: 배포별 script/main.js와 nw-setup.js 연결

script/main.js
 └── engine/tutorial_main.js import
```

웹 빌드는 `MMDD_HHmm-commit` 내부 ID의 모듈 디렉터리와 `release.json`을 함께 만듭니다. bootstrap이 엔진 모듈보다 먼저 실행되므로 오래 캐시된 HTML이 삭제된 구버전 모듈을 요청하지 않습니다. `WebReleaseManager`는 bootstrap 결과를 다시 정규화하고 직접 모듈 실행 시에도 같은 1회 재접속 폴백을 제공합니다. 현재 기본 런타임은 `N번째 플레이어` 전술 프로토타입이며, `TutorialScene`은 `SystemHandler`의 씬 factory로 주입되고 엔진 코어는 게임 규칙을 직접 참조하지 않습니다.

### 1.2 `tutorial_main.js` 초기화 순서

```text
문서 로드 완료 후 initializeTutorialRuntime()
 ├── 0. WebReleaseManager.ensureLatest() - 릴리스 검증/재접속 폴백
 ├── 1. TimeHandler()       - 가변/고정 델타와 보간 alpha
 ├── 2. MathUtil()          - 수학 유틸 싱글톤
 ├── 3. ColorUtil()         - 색상 유틸 싱글톤
 ├── 4. RuntimeTool()       - NW.js/브라우저 런타임 유틸
 ├── 5. createTutorialScene(sceneSystem, releaseInfo)
 ├── 6. new SystemHandler({
 │        sceneSystem: {
 │          initialSceneState: 'active',
 │          initialSceneFactory: createTutorialScene,
 │          playSceneFactory: createTutorialScene
 │        }
 │      })
 ├── 7. await SystemHandler.init()
 ├── 8. new EngineApp(systemHandler)
 └── 9. EngineApp.start()
```

`diagnostic_main.js`와 `DiagnosticScene`은 같은 조립 순서를 사용하는 수동 진단 경로로 남아 있으며 기본 `main.js`에서는 로드하지 않습니다.

### 1.3 `SystemHandler.init()` 순서

```text
SystemHandler.init()
 ├── 1.  SaveSystem       - 설정, 진행도와 런타임 상태 로드
 ├── 2.  SoundSystem      - 사운드 초기화, 설정 의존
 ├── 3.  DisplaySystem    - 화면/WebGL 초기화, 설정 의존
 ├── 4.  AnimationSystem  - 애니메이션 레지스트리
 ├── 5.  InputSystem      - 마우스/키보드 입력
 ├── 6.  UISystem         - 커서, 툴팁, 언어
 ├── 7.  ObjectSystem?    - 선택형 외부 objectSystemFactory
 ├── 8.  SceneSystem      - 초기 씬 factory 실행
 ├── 9.  RuntimeManager?  - 선택형 외부 runtimeManagerFactory
 ├── 10. OverlayManager   - 동적 overlay session 관리
 ├── 11. DebugSystem      - 디버그/성능 측정
 └── 12. 풀 워밍업        - Animation, UI, 동적 Canvas surface
```

선택형 시스템은 factory가 있을 때만 생성됩니다. 범용 엔진 코어에 특정 게임의 오브젝트, 물리, AI 클래스를 직접 고정하지 않습니다.

`SaveSystem`은 `SceneSystem`보다 먼저 초기화되므로 `TutorialScene`은 생성 이후 `tutorialMeta` 런타임 상태를 읽을 수 있습니다. 전투 씬 재생성과 무관하게 컷씬·업적·엔딩·획득 기록과 완료 횟수는 v5 단일 키에 유지됩니다. 기록을 밟으면 결과 화면까지 기다리지 않고 즉시 저장하므로 팝업을 닫거나 런을 중단해도 갤러리 해금이 남습니다. 과거 버전은 `TutorialMetaMigrator`가 순차 이관하고 미래 버전은 덮어쓰지 않습니다.

## 2. 메인 루프 구조

`EngineApp.loop(now)`는 rAF 하나에서 고정 스텝과 가변 프레임을 순차 처리합니다.

```text
EngineApp.loop(now)
 ├── frameDeltaSeconds 계산, 최대 0.1초 cap
 ├── frameExecutionPolicy 확인
 ├── fixed step 필요 시 accumulator에 delta 누적
 ├── accumulator >= 1/60 동안 fixedStepCount 계산, 프레임당 최대 6회
 ├── fixedAlpha = accumulator / fixedStepSeconds
 └── SystemHandler.tick({
      frameDeltaSeconds,
      fixedStepSeconds,
      fixedStepCount,
      fixedAlpha
    })
```

`SystemHandler.tick()`의 실제 실행 순서:

```text
SystemHandler.tick(frameContext)
 ├── SimulationRuntime 동기화
 ├── [고정 스텝 반복]
 │    ├── TimeHandler.updateFixed(1/60)
 │    ├── AnimationSystem.update({ useFixedTick: true })
 │    ├── ObjectSystem?.fixedUpdate()
 │    ├── SceneSystem.fixedUpdate()
 │    └── RuntimeManager?.fixedUpdate()
 ├── TimeHandler.setFixedInterpolationAlpha(fixedAlpha)
 ├── renderFrame이면 2D/WebGL 레이어 clear
 ├── [가변 업데이트]
 │    ├── TimeHandler.update(frameDeltaSeconds)
 │    ├── SoundSystem.update()
 │    ├── AnimationSystem.update({ useFixedTick: false })
 │    ├── InputSystem.update()
 │    ├── UISystem.update()
 │    ├── OverlayManager.update()
 │    ├── ObjectSystem?.update()
 │    ├── SceneSystem.update()
 │    ├── SceneSystem.applySimulationCommands(drainSimulationCommands())
 │    └── DebugSystem.update()
 └── [렌더]
      ├── InputSystem.draw()
      ├── ObjectSystem?.draw()
      ├── SceneSystem.draw()
      ├── overlay 합성이 필요하면 WebGL 중간 flush
      ├── UISystem.draw()
      ├── DisplaySystem.drawVignettes()
      ├── OverlayManager.draw()
      ├── DebugSystem.draw()
      ├── SoundSystem.draw()
      └── WebGLHandler.flushAll()
           ├── background → object → effect 명령을 공유 world FBO에 순차 합성
           ├── 1/4 Bloom·색보정·디더/그레인·비네팅 후 world-postprocess 출력
           └── WebGL 오류 시 기존 세 월드 surface에 현재 명령 재생
```

`world-postprocess`는 `effect`와 `texteffect` 사이의 정적 WebGL surface입니다. 월드 영상만 후처리하며 `texteffect`, `ui`, overlay, `top`은 별도 surface로 남아 픽셀 폰트와 HUD 선명도를 보존합니다. 원본 월드 FBO는 nearest-neighbor, Bloom 보조 버퍼만 1/4 해상도 linear filtering을 사용합니다.

튜토리얼 입력과 전투 상태 변경은 아래 경계를 따릅니다.

```text
TutorialScene.update()
 └── 키보드/마우스/UI 의도를 enqueueSimulationCommand()로 적재
SystemHandler.update()
 └── drainSimulationCommands()
     └── TutorialScene.applySimulationCommands()
         ├── TutorialBattleModel 전투 명령 검증 및 상태 변경
         ├── 모델이 반환한 event를 화면 연출로 변환
         ├── (기능 플래그 활성 시에만) TutorialCutsceneController 고정 카드 진행
         └── 순수 메타 갱신 후 saveTutorialMeta()로 기록 즉시 해금 또는 결과 저장
```

전투 흐름은 `메뉴/스타터 선택 -> player(move -> action 1..N) -> lora -> mobs -> player/result`입니다. 플레이어는 `extendPath()`로 최대 4칸의 순서를 직접 지정하고 `commitPath()`로 확정한 뒤에만 행동할 수 있습니다. 새 런의 기록은 미해금 10개 풀에서 중복 없이 최대 두 개를 뽑아 각 층의 기존 다섯 후보 좌표 중 하나에 별도로 배치하므로 페이즈당 최대 한 개만 등장합니다. 이동 중 기록 타일을 통과하면 모델이 `record-picked`를 내고, 씬은 메타를 즉시 저장한 뒤 `RECORD` 모드에서 기존 갤러리 책을 엽니다. 이 모드에서는 전투 시뮬레이션·애니메이션 시간이 멈추지만 직전 전투 장면은 그대로 그린 뒤 `vignette` 레이어에서 블러·감광합니다. 책과 버튼은 선명한 `top` 레이어에서 0.6초 `easeOutExpo` 확대·페이드·페이지 넘김으로 열리고, 0.4초 `easeInExpo` 역순 연출로 닫힙니다. 헤이스트는 행동 충전을 두 개로 늘리고 대기는 남은 충전을 모두 포기합니다. 여섯 번째 로라 행동과 몹 행동 완료 직후 같은 좌표로 지하층이 붕괴 전환되며, 로라 HP 0·플레이어 HP 0·실제 로라 행동 12회 중 하나에서 즉시 결과가 확정됩니다. 거울의 추가 플레이어 턴은 로라 행동 수를 늘리지 않습니다. AI 기반 채팅이나 생성형 대화 시스템은 없습니다.

재시작 명령은 `applySimulationCommands()`에서 `TutorialScene.#leaveRun(MODES.STARTER)`으로 수렴해 현재 런의 임시 상태를 정리하고 스타터 선택 화면으로 돌아갑니다. 같은 스타터를 즉시 재사용하지 않으며, 중단된 런은 완료 결과로 기록하지 않습니다. 플레이어용 되돌리기는 없고 모델 체크포인트 API는 테스트·저장·디버그 계약으로만 유지합니다. `tutorialMeta`는 씬 런 상태와 분리되어 재시작 뒤에도 이어집니다. 전체 씬을 교체하는 다른 실행 경로에서는 `SceneSystem.startPlayScene()`과 `destroy()` 계약을 사용합니다.

## 3. 런타임 일시정지 정책

- `EngineApp`은 창 focus/blur와 `document.visibilitychange`를 감지해 `app-inactive` 일시정지 이유를 `SystemHandler`에 반영합니다.
- `SystemHandler`는 이유별 정책을 병합해 `keepLoopRunning`, `runFixedStep`, `runSceneUpdate`, `renderOverlay`, `pauseBgm` 같은 플래그를 결정합니다.
- `keepLoopRunning: false`가 되면 rAF를 끊고, 복귀 시 accumulator와 타임스탬프를 초기화한 뒤 재개합니다.
- `runFixedStep: false`가 되면 accumulator를 누적하지 않아 일시정지 해제 직후 고정 스텝 catch-up이 몰리지 않습니다.
- 포커스 상실 시 입력 상태를 리셋할 수 있도록 정책에 `resetInputOnEnter`, `setMouseInactiveOnEnter`를 둡니다.

## 4. 고정 스텝과 보간 책임

이 엔진은 고정 시간축이 필요한 런타임 로직을 `fixedUpdate()`에서 처리하고, 표시용 보간과 UI 프레젠테이션은 가변 프레임 `update()`/`draw()`에서 처리하는 구조를 지원합니다.

확장 시스템 또는 씬에서 움직임 보간을 구현할 때의 기본 흐름:

1. `fixedUpdate()` 시작 시 이전 상태를 저장합니다.
2. 고정 스텝에서 상태, 물리, 타이머, 결정론적 로직을 갱신합니다.
3. 가변 `update()`에서 `getFixedInterpolationAlpha()`를 사용해 표시 좌표를 계산합니다.
4. `draw()`는 표시 좌표를 기준으로 그립니다.
5. 게임별 물리/AI 구현은 엔진 코어가 아니라 선택형 시스템 또는 씬 내부에 둡니다.

## 5. importmap 기반 모듈 해석

`project/engine/index.html`의 importmap이 모듈 별칭을 정의합니다.

| import 경로 | 실제 경로 |
| --- | --- |
| `engine/` | `./script/` |
| `core/` | `./script/core/` |
| `display/` | `./script/display/` |
| `scene/` | `./script/scene/` |
| `simulation/` | `./script/simulation/` |
| `ui/` | `./script/ui/` |
| `util/` | `./script/util/` |
| `animation/` | `./script/animation/` |
| `input/` | `./script/input/` |
| `sound/` | `./script/sound/` |
| `save/` | `./script/save/` |
| `data/` | `./script/data/` |
| `object/` | `./script/object/` |
| `debug/` | `./script/debug/` |
| `overlay/` | `./script/overlay/` |

상대 경로가 불필요한 엔진 내부 import는 이 별칭을 우선 사용합니다.
