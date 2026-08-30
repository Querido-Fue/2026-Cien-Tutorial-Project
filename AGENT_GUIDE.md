# JukChang Engine Agent Guide

## 시작 순서

- 작업을 시작하면 먼저 `guide/navigation.md`를 읽고, 작업 유형에 맞는 세부 가이드를 선택합니다.
- 프로젝트 구조를 추측하지 말고 현재 `project/engine` 트리를 기준으로 확인합니다.
- 수정 대상 파일은 변경 전에 항상 전체 내용을 읽습니다. 큰 파일은 핵심 메서드와 export가 하단에 있을 수 있습니다.
- 복잡한 작업도 별도의 사전 계획 공유나 승인 대기로 멈추지 않습니다. 안전하고 되돌릴 수 있는 범위에서 동작하는 초안을 먼저 구현·검증한 뒤 결과와 판단을 보고하며, 파괴적 변경·새 권한·결과를 크게 바꾸는 불명확성만 사용자 확인을 요청합니다.

## 프로젝트 기준선

- 이 저장소는 NW.js 기반 범용 게임 엔진에 `N번째 플레이어`의 2D 턴제 전술 최종 보스전 프로토타입을 씬 factory로 주입한 프로젝트입니다.
- 런타임 진입점은 `project/engine/index.html`과 `project/engine/script/main.js`입니다. HTTP(S)에서는 `release-bootstrap.js`가 엔진 모듈 요청 전에 `release.json`을 no-store로 확인해 구버전 문서를 캐시 우회 재접속하고, NW.js/file에서는 바로 같은 모듈을 연결합니다. `util/nw_bridge.js`가 이후 런타임을 판별합니다.
- NW.js 저장은 기존 `fs/promises`를, 웹 저장은 `_browser_file_system.js`의 동일 출처 `localStorage` 어댑터를 사용합니다. 브라우저에서는 `/nthplayer/save`가 가상 경로이고 창 크기·위치·개발자 도구 제어는 안전한 no-op입니다.
- `scripts/build-web.mjs`는 엔진과 런타임 allowlist 에셋만 `dist/web`에 복사하고, Git HEAD와 KST 빌드 시각으로 `release.json` 및 `releases/<MMDD_HHmm-commit>/script/`를 생성합니다. 표시 버전은 `MMDD_HHmm`, 내부 ID는 커밋을 포함하며 정적 자산에는 버전 쿼리를 붙입니다. 생성물은 추적하지 않고 GitHub Pages 워크플로의 업로드 입력으로만 사용합니다.
- 현재 `main.js`는 `tutorial_main.js`를 로드하고, `TutorialScene`을 초기 `active` 씬과 플레이 씬 factory로 등록합니다.
- 튜토리얼 전투 상태는 순수 `TutorialBattleModel`이 소유하고, 선언형 아이템·이벤트 효과의 안정 ID는 `_tutorial_effect_contract.js`, 검증·정규화는 `TutorialEffectRegistry`, 조건·순서·계산은 `TutorialEffectExecutor`, 공통 행동 검증은 `TutorialCombatRules`, 로라의 다음 행동은 `TutorialLoraIntentPlanner`, 플레이어 행동 이후 상태는 `TutorialPlayerActionPreviewer`에 위임합니다. 입력은 씬 `update()`에서 시뮬레이션 명령으로 변환한 뒤 `applySimulationCommands()`에서 적용합니다. 모델은 가로 9×세로 8 두 층과 층별 `floorStates`, 인벤토리, 영구 해금 기록 수집물, 공개 이벤트 타일, 짝 포탈, 고정 몹 상태를 소유합니다.
- 전체 흐름은 `메뉴/스타터 선택 -> player(move -> action 1..N) -> lora -> mobs -> player/result`입니다. 플레이어가 직접 지정한 최대 4칸 경로를 확정해야 행동 단계가 열리고, `actionsUsed/actionsPerTurn`이 헤이스트의 추가 행동까지 표현합니다. 대기는 남은 행동을 모두 포기합니다.
- 실제 완료된 로라 행동은 `loraActionsCompleted`로 별도 집계합니다. 여섯 번째 로라 행동과 몹 행동 완료 직후 같은 좌표로 지하층이 붕괴 전환되며, 거울 추가 플레이어 턴은 이 집계를 늘리지 않습니다. 전체 전투는 로라 행동 최대 12회입니다.
- 이동 판정은 현재 층의 벽, 로라와 몹을 통과시키지 않습니다. 아이템 자동 획득, 반복 발동 이벤트 타일, 양방향 짝 포탈, 몹 공격과 다른 월드 변화는 모델이 반환하는 event를 씬이 연출합니다. 타일 정화제만 이동 단계에서 이동/행동 자원과 별개로 사용합니다.
- 종료 조건은 로라 HP 0, 플레이어 HP 0, 로라 행동 12회 완료이며 게이트 탈출 단계는 없습니다. 고정 카드 컷씬은 `FEATURES.CUTSCENES: true`이며 첫 실행 오프닝, 실제 아이템 사용, 6회 뒤 층 전환과 엔딩 사건에만 연결합니다.
- 재시작은 같은 스타터로 즉시 새 전투를 만들지 않고 현재 런을 정리한 뒤 스타터 선택으로 돌아갑니다. 플레이어용 되돌리기 명령과 UI는 없으며, 모델 체크포인트는 테스트·저장·디버그 용도로만 사용합니다.
- `TutorialCutsceneController`는 카드 진행만, `TutorialCutsceneTriggerRouter`는 첫 실행 메타와 `item-used`·`floor-transition`·`battle-finished` 사건의 감사된 ID 변환만 맡습니다. 완료와 스킵은 같은 갤러리 해금 정책을 사용하며 AI 기반 채팅이나 생성형 대화 시스템은 사용하지 않습니다.
- 반복 플레이 메타 진행도는 v5 `tutorialMeta` 단일 런타임 상태 키를 사용합니다. `_tutorial_meta_schema.js`가 현재 shape, `TutorialMetaMigrator`가 v1→v5 순차 이관, `TutorialMetaVersionError`가 미래 버전 쓰기 차단, `_tutorial_meta_progress.js`가 저장과 진행 연산만 맡습니다. 이벤트 타일 공개 키는 `revealedEventTileIds`, 획득한 일기·개발자 기록 키는 `unlockedRecordIds`이며 구 `discoveredTrapIds`는 이관할 때만 읽습니다. 완료 횟수는 결과가 생긴 런에서만 증가하고 v2 점수 값은 읽기 호환만 유지합니다.
- 튜토리얼의 모드·명령 상수, 키 바인딩, 값 유틸, 모드별 UI 정책은 각각 별도 순수 모듈에 둡니다. 이 seam 모듈은 `TutorialScene`을 역으로 import하지 않으며, 씬만 이 모듈들을 조합합니다.
- `TutorialKeyboardEdgeTracker`는 현재 눌림과 프레임 사이 빠른 탭을 상승 에지로 정규화하고, `TutorialMetaSession`은 런 단위 staging·진행 연산·순차 저장·미래 버전 저장 차단을 소유합니다. `TutorialScene`은 이 상태를 중복 보관하거나 직접 저장 큐를 만들지 않습니다.
- `TutorialKeyboardCommandMapper`는 읽기 전용 장면 입력 snapshot과 상승 에지 목록을 명령 사양으로만 변환하고, `TutorialNonbattleViewModelFactory`는 비전투·안내 화면의 직렬화 가능한 표시 데이터만 조립합니다. 둘 다 모델을 변경하거나 장면을 역참조하지 않습니다.
- `TutorialBattleSelectionController`는 계획 경로, 도달 범위, 공격·정화 대상, 보드 호버와 이 상태에서 파생되는 입력 명령을 소유합니다. `TutorialInventoryPresenter`는 인벤토리 페이지·아이템 공개/사용 가능 표시를, `TutorialBattleViewModelFactory`는 모델의 읽기 API와 선택·표현 snapshot을 최종 BattleViewModel로 조립하는 책임을 맡습니다. `TutorialScene`은 선택 불변식, HUD용 아이템 메타나 행동 미리보기 표시값을 다시 계산하지 않습니다.
- `TutorialBattleCommandController`는 플레이어 이동·공격·회복·대기·정화·아이템 명령의 공통 입력 경계, 모델 API 호출과 해당 연출 시작만 맡습니다. 장면은 현재 모델·입력 가능 여부·결과 callback 같은 작은 포트만 주입하며 컨트롤러가 장면 전체를 역참조하지 않습니다.
- `TutorialLoraTurnController`는 로라 턴의 행동 전 대기, 행동 표시, 완료 명령을 타임라인 세대와 함께 한 번씩 예약합니다. 장면은 로라 턴 타이머나 중간 stage를 보관하지 않고 모드·잠금 포트와 모델 결과 callback만 제공합니다.
- `TutorialResultController`는 전투 종료 판정, 정규화된 엔딩 표시 데이터, 결과 1회 기록과 엔딩 컷씬 대기 상태를 소유합니다. `TutorialScene`은 결과 필드를 중복 보관하지 않고 컨트롤러의 방어 snapshot으로 오디오·결과 뷰를 구성합니다.
- `TutorialBattleOutcomeCoordinator`는 모델 결과를 presenter→sprite cue→feedback/timeline→업적/메타→기록→컷씬 트리거 순서로 배포하고 이전 표현 snapshot을 소유합니다. 화면 전환·층 교체는 장면에 남기며, 조정자는 장면 전체가 아닌 명시적 구독자와 투영 포트만 받습니다.
- `TUTORIAL_CONTENT_DATA`가 확정 업적명·설명·해금 조건, 일기 순서와 안정 기록 ID, 엔딩 표시명과 남은 미확정 상태를 소유합니다. `TutorialAchievementEvaluator`는 안정된 모델 사건으로 확정 조건을 판정하고 배너는 알림 수명만, `TutorialGalleryController`는 섹션·항목 선택과 메타 기반 열람 상태만 맡습니다. `TutorialRecordPopupQueue`는 한 경로에서 여러 기록을 획득한 경우의 순서만, `TutorialRecordPopupController`는 대기열과 0.6초 `easeOutExpo` 진입·0.4초 `easeInExpo` 퇴장 수명주기를 조율합니다. 기록 모드에서는 전투 장면을 유지한 채 vignette backdrop으로 블러·감광하고 책·버튼은 `top` 레이어에서 선명하게 그립니다. 곡괭이 업적은 획득이 아닌 실제 `wall-traversed`, 최초 사망 업적은 `battle-finished.defeatedBy === 'lora'`, 2페이즈 업적은 `floor-transition.floorIndex === 1`을 사용합니다.
- 로딩·메뉴·스타터·책 기반 갤러리·책 기반 체인지로그·책 기반 결과·컷씬 화면은 `scene/tutorial/view/`의 파일당 한 클래스가 그립니다. 메인 메뉴 왼쪽 아래는 현재 KST 버전을 표시하고 작은 체인지로그 버튼은 `release.json`에서 검증한 실제 Git 기반 한글 항목을 엽니다. 뷰는 직렬화 가능한 읽기 전용 view model과 작은 render/asset port만 받고 모델·저장·명령 큐·씬을 import하지 않습니다. 결과는 내부 엔딩 ID와 표시명을 분리하며 점수 UI를 만들지 않습니다.
- `TutorialTitleFlowController`는 메인 버튼 퇴장→같은 타이틀 무대의 스타터 카드 진입→선택 아이콘의 첫 인벤토리 슬롯 모핑→전투 공개 순서를 `easeOutExpo` 타임라인과 세대 취소로 소유합니다. `TutorialStarterView`는 카드만 그리고 `TutorialTitleTransitionView`는 모핑·공개 오버레이만 그리며, 오프닝 컷씬은 전투 공개가 끝난 뒤 엽니다.
- 전투 화면도 `TutorialBattleWorldView`, `TutorialBattleActorView`, `TutorialBattleHudView`, `TutorialBattleCommandMenuView`, `TutorialBattleFeedbackView`, `TutorialAchievementView`, `TutorialBattleTutorialView`의 파일당 한 클래스로 나뉩니다. 월드 뷰는 오브젝트 정렬을, 배우 뷰는 플레이어·로라·슬라임의 스프라이트와 도형 폴백을, 커맨드 메뉴 뷰는 이동 확정↔공격·대기·회복의 배치·플립 표현·동일 히트 영역을 소유합니다. `TutorialScene`이 한 프레임의 `BattleViewModel`을 조립하고, 이미지 객체는 `TutorialAssetPort`로 별도 주입합니다. 모델 미리보기의 표시 변환은 `TutorialCombatReadabilityPresenter`, 공통 조사 포커스는 `TutorialBattleFocusController`, 안내의 단일 단계·expo 전환 상태는 `TutorialGuidanceController`, UI와 `top` 사이의 선택 영역 아웃포커스 DOM은 `TutorialGuidanceBackdropView`가 맡습니다.
- `TutorialBattleLayout`이 보드·HUD 기하와 타일 투영·히트테스트를 함께 소유합니다. 맵 아트가 있으면 매니페스트의 원본 970×580 격자 네 꼭짓점으로 9×8 축을 만들고 실제 격자의 좌우 폭을 월드 뷰포트에 맞춥니다. 맵 프로필의 `ambientFire` 심지 좌표도 같은 `mapImageRect`로 화면에 투영하며, `FlameParticleEffectPass`가 작은 scissor 영역별 난류 화염·코어·불씨를 effect 레이어에 합성합니다. `TutorialBattleCameraController`는 가상 게임 커서의 화면 가장자리 침투량 역투영, 휠 클릭 중앙 복귀와 누적 휠 목표 줌을 소유합니다. `TutorialBattleCamera`는 추적점을 0.3초 감쇠로 따라가고, 진행 중 목표를 현재 배율에서 재지정하는 0.4초 `easeOutExpo` 줌을 적용합니다. 최소 줌은 맵 이미지 좌우가 뷰포트에 닿는 동적 배율이고 최대 줌은 기본의 1.2배이며, 렌더와 입력 판정은 같은 카메라 snapshot이 적용된 layout frame을 사용합니다.
- 정적 `world-postprocess` WebGL surface는 `effect`와 `texteffect` 사이에 위치합니다. `WorldPostProcessPipeline`이 `background`·`object`·`effect` 명령을 레이어 순서대로 하나의 nearest-filtered FBO에 지연 합성하고, 1/4 해상도 Bloom·색보정·디더/그레인·비네팅을 적용합니다. `texteffect`·`ui`·오버레이는 입력에서 제외하며, WebGL 초기화·프레임 오류나 context loss에서는 같은 프레임 명령을 기존 세 surface에 재생합니다. 절차적 화염·마그네틱 실드·인게임 먼지는 화면 좌표를 2픽셀 격자에 스냅하고, 먼지는 `effect` 레이어의 제한된 point sprite로 보드 위·UI 아래에 합성하며 Bloom만 선형 샘플링합니다.
- Figma UI 화면은 1280×720 기준의 `createTutorialDesignSpace()`와 `TUTORIAL_UI_LAYOUT_TOKENS`를 공통 좌표 원본으로 사용합니다. 16:9 safe area를 `UIWW` 안에서 aspect-fit하고 정수 픽셀로 투영하며, 맵과 HUD·비전투 뷰·버튼 hit region은 같은 layout rect를 공유합니다. 1538×900과 울트라와이드의 남는 영역은 배경으로 처리하고 픽셀 에셋은 nearest-neighbor를 유지합니다.
- 전투 중 `PAUSE`는 모델을 보존하는 실제 scene mode입니다. Pause에서는 simulation과 animation clock을 진행하지 않고 같은 전투 view model 위에 dim/panel을 그리며, resume은 동일 상태 복원, restart는 스타터 선택, exit는 메인 이동으로 고정합니다. 현재 v5 메타에는 전투 snapshot이 없으므로 메인 `Continue`는 disabled이며 UI 작업에서 가짜 이어하기나 저장 schema 확장을 만들지 않습니다. `RECORD` 모드는 획득한 기록을 기존 갤러리 책으로 열고 닫을 때 중단된 전투로 복귀합니다.
- 모델 event 해석은 `TutorialBattlePresenter`, cue 순서·일시 피드백·오디오 drain 대기열은 `TutorialFeedbackQueue`, 표시 보간·animation slot·입력 잠금은 `TutorialAnimationTimeline`이 각각 소유합니다. 배우 클립 폴백은 `TutorialSpriteClipResolver`, 델타 기반 재생·중단·프레임 이벤트는 `TutorialSpriteAnimator`, 표시 층 배우 투영은 `TutorialSpriteRoster`, 공격 impact 지연과 발걸음 cue 파생은 `TutorialSpriteCueRouter`가 맡습니다. `TutorialAudioDirector`는 작은 장면 상태와 drain된 cue를 전역 sound port로 변환합니다. 이 모듈들은 모델과 장면을 역참조하지 않으며, 동일 event를 뷰나 장면에서 다시 해석하지 않습니다.
- `TUTORIAL_ASSET_MANIFEST`와 `TUTORIAL_AUDIO_MANIFEST`가 `project/asset` 원본 이름·안전한 런타임 경로·필수 여부·폴백을 소유하며, 이미지 계약은 크기·레이어·용도, 오디오 계약은 bus·loop·gain·polyphony·cooldown을 추가로 선언합니다. `scripts/import-tutorial-assets.mjs`는 원본을 수정하지 않고 `project/asset/tutorial/`로 ASCII 이름 복사하며 `scripts/check-assets.mjs`가 PNG IHDR와 MP3 헤더·해시·충돌을 검사합니다.
- `SoundSystem`은 기존 공개 API를 보존하는 조립 파사드입니다. `AudioManifestResolver`는 fallback, `MusicBus`는 BGM crossfade와 중복 방지, `AudioBus`는 SFX/UI 동시 재생·cooldown·loop 수명, `AudioUnlockGate`는 자동재생 재시도 리스너를 각각 소유합니다. 파일 경로와 믹싱 정책을 장면·뷰·프레젠터에 하드코딩하지 않습니다.
- `TutorialAssetLoader`가 매니페스트 이미지 readiness, 크기 검증, 투명 여백 crop canvas, nearest-neighbor, 실패 폴백과 callback 정리를 소유하고 `TutorialAssetPort`가 논리 ID를 뷰에 노출합니다. 장면과 뷰는 `Image`/DOM 콜백이나 원본 파일명을 직접 알지 않습니다.
- `TUTORIAL_SPRITE_CLIPS`는 32×32 논리 프레임, 배우 앵커, 프레임별 좌·우 발 그림자 접점, source rect 레이어, FPS, 루프, impact 프레임과 명시적 폴백을 데이터로 소유합니다. 배우 그림자는 두 격자축을 합친 동남쪽 평면 투영을 사용하고 실측한 두 발에서 실루엣을 시작하며, 로라 부유 높이에 비례해 지면 이동·감쇠·픽셀 반그림자를 적용합니다. WebGL 이미지 명령은 선택적 `sourceRect`와 축 반전을 정규화 UV로 바꾸며, 픽셀 스프라이트는 정수 사각형과 nearest-neighbor로 그립니다.
- `TUTORIAL_GAME_DATA.ITEMS[*].effects`와 `EVENT_TILE_EFFECTS`는 안정된 trigger·operation·condition·order 계약을 사용합니다. `TutorialEffectRegistry`는 알 수 없는 효과 데이터와 이벤트 치환 참조를 모델 생성 중 실패시키며, 포탈·경로 탐색·턴 전이·종료 조건은 effect 언어로 옮기지 않습니다.
- 전투 의도와 행동 미리보기는 모델 상태를 임시 변경하거나 체크포인트로 되돌리지 않습니다. 계산 모듈은 독립 복제 상태만 받고 모델·씬을 역으로 import하지 않으며, 실제 행동과 미리보기가 같은 `TutorialEffectExecutor`와 `TutorialCombatRules` 결과를 사용합니다. 플레이어 턴 예고는 `getLoraIntent({ allowForecast: true })`로만 요청하고, UI가 피해나 범위를 재계산하지 않습니다.
- `TutorialButtonHost`가 튜토리얼 버튼의 `UIPool` 획득·갱신·그리기·반납과 포인터 포커스 전달을 소유합니다. 전투 조사 포커스는 버튼 key 하나로 키보드와 포인터가 공유합니다. 비전투 뷰는 `{ type, payload }` 형태의 command spec만 만들고, 씬이 전달받은 의도를 시뮬레이션 명령 큐에 넣습니다.
- `PointerLockInputHandler`는 튜토리얼 장면이 활성화한 기본 포인터 잠금, Escape 해제, 첫 재포커스 클릭의 DOM 캡처 단계 소비를 소유합니다. 최초 잠금 전에는 메뉴 버튼을 숨긴 무블러 클릭 안내를, 첫 잠금 이후 해제 상태에는 블러 복귀 안내를 사용합니다. 잠금 중 `MouseInputHandler`는 `movementX/Y`로 가상 게임 커서를 갱신하고 `PointerLockExitIntentDetector`는 이동 방향과 무관하게 1% 가장자리에서 1초간 유지된 의도를 판정합니다. Escape 안내는 화면 안으로 잘리며 한 번 표시되면 잠금이 유지되는 동안 최소 0.5초간 유지됩니다.
- 포커스 아웃/포인터 해제 일시정지는 게임 고정 스텝·씬·오브젝트·사운드만 멈추고 엔진 프레임 시간·입력·UI·애니메이션·오버레이·디버그·렌더 루프는 유지합니다. 따라서 NW.js 종료 요청처럼 포커스 외부에서 들어오는 앱 수명주기 이벤트와 엔진 오버레이가 계속 동작해야 하며, 활성 엔진 오버레이는 포인터 재잠금보다 클릭 소비 우선권을 가집니다.
- `test/fixtures/tutorial_visual_fixture_catalog.mjs`는 Figma `<<최종 UI>>` 13개 노드의 결정론적 화면 상태와 동적 mask를 일대일로 고정합니다. `npm run test:visual`은 design-space, 화면별 layout, render command, 그림/hit rect와 fixture 정책을 검사합니다. Figma screenshot은 런타임 에셋으로 사용하지 않으며 실제 bitmap golden은 권리·보관 정책을 확정한 캡처 runner에서만 관리합니다.
- Node 밸런스 하네스는 `scripts/tutorial-balance/`에서 전략 프로필·판단, 공개 모델 API port, 지표, 실행 조정, 보고를 파일당 한 책임으로 분리합니다. agent는 모델·체크포인트를 직접 참조하지 않으며 모든 변경 명령은 preview 검증과 시나리오별 명령 상한을 적용하는 port를 통과합니다. 생성 JSON은 무시되는 `reports/`에만 둡니다.
- 릴리스 감사는 `scripts/release/`의 source graph, provenance, runtime source auditor가 각각 담당하고 `scripts/check-release.mjs`가 조립합니다. Windows 패키징은 `scripts/package/`의 고정 계약, NW.js 검증기, allowlist packager로 분리합니다. NW.js `0.108.0` Windows x64 외 입력과 기존 출력 폴더는 거부하며, 원본 작업 에셋과 save는 배포물에 넣지 않습니다.
- display 배경색 쓰기는 `_display_background_port.js`로 역전해 theme/display/screen import 순환을 만들지 않습니다. 정적 그래프 감사가 미해결 import와 순환을 0으로 유지해야 합니다.
- `diagnostic_main.js`와 `DiagnosticScene`은 display/input/overlay/save/sound를 확인하는 수동 진단 경로로 보존합니다.
- 핵심 조립은 `EngineApp`과 `SystemHandler`가 담당하며, 게임별 로직은 씬 factory, 선택형 `objectSystemFactory`, 선택형 `runtimeManagerFactory`로 주입하는 구조를 우선합니다.

## 코딩 원칙

- 상수, 테마 색상, 레이아웃 수치는 코드에 흩어두지 말고 `project/engine/script/data/`와 `getData(key)` 경로를 사용합니다.
- 테마 색상은 `ColorSchemes`를 사용하고, 테마 파일과 `_theme_handler.js`의 갱신 흐름을 우회하지 않습니다.
- UI 위치와 크기는 `WW`, `WH`, `OW`, `OH`, `OX`, `OY`, `absolute` 같은 엔진 단위와 `PositioningHandler`/`LayoutHandler`를 우선합니다.
- 새로 추가하거나 의미 있게 수정하는 클래스, 함수, 메서드에는 한국어 JSDoc을 작성합니다.
- 내부 구현 파일은 `_` 접두사를 사용하고, 클래스 내부 구현은 가능하면 ES private 필드/메서드(`#`)를 사용합니다.
- 이미 있는 엔진 시스템, 풀, 렌더 명령, 애니메이션, 오버레이, UI 빌더를 먼저 찾고 재사용합니다.
- 새 클래스를 추가할 때는 기본적으로 파일 하나에 클래스 하나와 단일 책임을 유지합니다. 여러 화면이 공유하는 상태를 거대한 context 객체로 우회 전달하거나 순환 import를 만들지 않습니다.

## 단일 책임과 파일 분리 기준

- 책임은 “이 코드를 바꿔야 하는 이유”로 정의합니다. 입력 해석, 상태 변경, 저장, 레이아웃 계산, 렌더링, 자원 수명주기처럼 변경 이유가 다른 코드는 같은 클래스에 두지 않습니다.
- 새 파일과 의미 있게 수정하는 파일은 500줄 이하를 목표로 하고 700줄을 하드 상한으로 사용합니다. 500줄을 넘으면 새 코드를 더하기 전에 상태 소유권과 의존성 방향을 기준으로 협력 객체 추출을 먼저 검토합니다.
- 선언형 데이터나 셰이더 원문처럼 줄 수와 책임 수가 일치하지 않는 파일만 명시적 사유와 별도 예산을 둘 수 있습니다. 조립 파사드라는 이유만으로 도메인 계산·입력 처리·렌더 구현을 함께 소유할 수 없습니다.
- 한 파일에는 클래스를 하나만 선언합니다. 작은 보조 클래스도 독립적으로 이름 붙일 책임이 있으면 `_` 접두사의 별도 구현 파일로 이동하고, 상태가 없는 변환은 순수 함수 모듈로 둡니다.
- 파일을 단순히 줄 범위로 나누지 않습니다. 이동하는 코드와 함께 그 코드가 소유하는 상태·불변식·정리 수명주기를 옮기고, 소비자에는 필요한 snapshot 또는 작은 port만 노출합니다.
- 분리한 모듈이 기존 거대 클래스 전체를 context/callback 묶음으로 받거나 상위 조립 클래스를 역으로 import하면 분리가 완료된 것으로 보지 않습니다. 의존 방향은 조립자에서 작은 협력 객체 쪽으로만 흐르게 합니다.
- 공개 API, 저장 형식, 시뮬레이션 결과와 렌더 좌표를 보존하는 회귀 테스트를 책임 이동 전에 먼저 확인합니다. 한 책임 묶음 단위로 검증·커밋하며 서로 무관한 분리를 한 커밋에 섞지 않습니다.
- `npm run check:responsibilities`는 새 장문 파일, 파일당 다중 클래스와 기존 장문 파일의 증가를 차단합니다. 기존 부채 예산을 늘려 검사를 통과시키지 말고 추출 후 해당 예산 항목을 삭제합니다.

## 검증

- 코드 또는 문서 수정 후 최소한 `git diff --check`를 실행해 공백 오류와 충돌 마커를 확인합니다.
- 릴리스 후보 변경은 Node `22.18.0` 기준 `npm ci --ignore-scripts`, `npm test`, `npm run simulate:balance -- --json --no-write`를 실행하고 `docs/release-candidate-report.md`의 차단 상태를 확인합니다.
- 튜토리얼 모델 변경 후 `node --experimental-default-type=module --test test/tutorial_battle_model.test.mjs test/tutorial_combat_preview.test.mjs`를 실행합니다.
- 실행 검증이 필요한 변경은 NW.js 튜토리얼 런타임 또는 해당 시스템의 수동 진단 경로로 확인합니다.
- `AGENT_GUIDE.md`와 `guide/` 문서는 구조, 핵심 로직, 아키텍처 패턴이 바뀔 때만 갱신하고, 사소한 스타일 변경은 기록하지 않습니다.
