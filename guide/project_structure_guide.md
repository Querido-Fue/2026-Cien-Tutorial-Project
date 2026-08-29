# Project Structure Guide

## 1. 핵심 루트

| 경로 | 역할 |
| --- | --- |
| `project/package.json` | NW.js 앱 매니페스트. `main`은 `engine/index.html`입니다. |
| `project/engine/index.html` | 릴리스 meta/importmap, 정적 캔버스 레이어와 사전 버전 확인 bootstrap을 가진 엔진 HTML 진입점 |
| `project/engine/release-bootstrap.js` | HTTP(S)에서 `release.json`을 no-store로 확인하고 최신 문서로 재접속한 뒤 엔진 모듈을 연결하는 고전 스크립트 |
| `project/engine/style.css` | 전역 CSS, 캔버스/동적 오버레이 host/폰트 스타일 |
| `project/engine/script/main.js` | 현재 진입 모듈. 기본 런타임인 `tutorial_main.js`를 로드합니다. |
| `project/engine/script/tutorial_main.js` | `TutorialScene`을 초기 `active` 씬과 플레이 씬 factory로 주입하는 튜토리얼 런타임 진입점 |
| `project/engine/script/release/_web_release_manager.js` | bootstrap 결과 검증, 직접 실행 폴백 확인과 한 번만 수행하는 최신 릴리스 재접속을 담당하는 웹 경계 |
| `project/engine/script/diagnostic_main.js` | `DiagnosticScene`을 주입하는 수동 엔진 진단 런타임 진입점 |
| `project/engine/script/app/engine_app.js` | rAF 루프, 고정 스텝 accumulator, 창 활성/일시정지 정책 연결 |
| `project/engine/script/core/system_handler.js` | 엔진 서브시스템 생성, 초기화 순서, update/draw/fixedUpdate 오케스트레이션 |
| `project/asset/` | 튜토리얼과 수동 진단 런타임이 사용하는 아이콘, 폰트, 오디오 자산 |
| `test/tutorial_battle_model.test.mjs` | ver 3.5 맵 좌표, 직접 이동, 짝 포탈, 이벤트 타일, 아이템, 행동 충전, 몹, 층 전환, 12회 종료와 체크포인트 회귀 테스트 |
| `test/tutorial_effect_contract.test.mjs` | 선언형 아이템·이벤트 효과의 ID·조건·순서 검증과 preview/apply 동등성 계약 테스트 |
| `test/tutorial_scene_seams.test.mjs` | 튜토리얼 모드·명령·키·값 유틸·모드 정책과 scene seam의 비순환 의존성을 고정하는 계약 테스트 |
| `test/tutorial_content_meta.test.mjs` | 확정 기록·업적명·설명·사건 조건, 컷씬 트리거, 갤러리 잠금·재생, 메타 멱등성·손상 정규화·완료 횟수 경계를 검증하는 콘텐츠 계약 테스트 |
| `test/tutorial_records.test.mjs` | 안정된 기록 ID, 층별 배치, 해금 전후 갤러리, 직접 선택과 전투 팝업 큐 계약을 검증하는 기록 수집 테스트 |
| `test/tutorial_nonbattle_views.test.mjs` | 비전투 뷰의 기준·와이드·최소 높이 순수 레이아웃, 직렬화 가능한 버튼 명령, 단방향 의존 계약 테스트 |
| `test/web_release_manifest_builder.test.mjs` | KST 버전 형식과 실제 Git 기록→한글 체인지로그 매핑을 검증하는 빌드 계약 테스트 |
| `test/web_release_bootstrap.test.mjs` | 최신 확인 전 모듈 차단과 구버전 문서 재접속 순서를 검증하는 bootstrap 테스트 |
| `test/web_release_manager.test.mjs` | 최신/구버전/조회 실패 시 웹 릴리스 확인과 재접속 안전장치를 검증하는 테스트 |
| `test/tutorial_battle_views.test.mjs` | 전투 타일 투영·히트테스트 일치, HUD 경계·비중첩, 인벤토리 페이지 범위와 뷰 의존 방향 계약 테스트 |
| `test/tutorial_presentation.test.mjs` | 모델 event 목록, 결정론적 cue, 피드백 수명·순서, 겹친 잠금, 주입형 이미지 loader의 크기 검증과 단방향 의존 계약 테스트 |
| `test/tutorial_assets.test.mjs` | 매니페스트 유일성, PNG 원본/복사본 규격, loader crop·fallback, 맵 9×8 투영 왕복, 픽셀 보간 계약 테스트 |
| `test/tutorial_balance_simulation.test.mjs` | 스타터×전략 8개 시나리오의 재현성, 명령 상한, preview 일치와 공개 모델 API 경계 테스트 |
| `scripts/simulate-tutorial-balance.mjs` | 밸런스 시뮬레이션 CLI와 고정 `reports/` JSON 출력 진입점 |
| `scripts/import-tutorial-assets.mjs` | `project/asset` 원본을 보존하며 매니페스트의 ASCII 런타임 이름으로 안전 복사하는 CLI |
| `scripts/check-assets.mjs` | 원본·런타임 PNG IHDR 크기, 경로 충돌, 누락·폴백을 검사하는 CLI |
| `scripts/build-web.mjs` | KST 버전·Git 체인지로그 매니페스트와 배포별 모듈 경로를 만드는 정적 웹 빌드 CLI |
| `scripts/web/_web_release_manifest_builder.mjs` | Git 기록과 한글 카탈로그를 결합해 `release.json`을 생성하는 빌더 |
| `scripts/tutorial-assets/` | PNG 헤더, 경로 containment와 에셋 감사를 파일당 한 책임으로 분리한 Node 모듈 |
| `scripts/tutorial-balance/` | 전략 규약·판단, 공개 모델 API port, 지표 수집, 실행 조정과 보고를 파일당 한 책임으로 분리한 Node 하네스 |
| `docs/balance-baseline.md` | 결정론 규약, 네 agent 규칙, 지표, 실행 상태와 측정 기준선 |
| `docs/tutorial-scene-decomposition.md` | 거대 `TutorialScene`의 현재 책임 지도와 Turn 03~06 분리 결과·목표 |
| `docs/tutorial-presentation-cues.md` | 28개 모델 event와 cue 필드·소비자·오디오 ID·수명/취소 계약 |
| `docs/tutorial-smoke-checklist.md` | 씬 분리 전후에 반복할 핵심 메뉴·전투·결과 수동 확인표 |
| `docs/content-open-questions.md` | 확정 업적 조건과 남은 컷씬 트리거·일기 해금·엔딩 표시명의 임시 구현 경계 |
| `guide/` | 에이전트용 엔진 작업 가이드 |

## 2. 엔진 스크립트 하위 경로

| 작업 | 경로 |
| --- | --- |
| 앱 루프 | `project/engine/script/app/` |
| 시스템 조립 | `project/engine/script/core/` |
| 시간 델타/보간 alpha | `project/engine/script/time_handler.js` |
| 디스플레이, 2D/WebGL surface | `project/engine/script/display/` |
| WebGL 배치, effect, overlay-effect 렌더러 | `project/engine/script/display/webgl/` |
| 입력 상태, 마우스/키보드 핸들러 | `project/engine/script/input/` |
| UI 시스템, 요소, 풀, 레이아웃, 다국어, 툴팁 | `project/engine/script/ui/` |
| 오버레이 세션, 패널, effect, 기본 오버레이 | `project/engine/script/overlay/` |
| 씬 시스템과 튜토리얼/진단 씬 | `project/engine/script/scene/` |
| 메인 스레드 시뮬레이션 스냅샷과 명령 큐 | `project/engine/script/simulation/` |
| 설정/진행도/런타임 상태 저장 | `project/engine/script/save/` |
| 사운드 | `project/engine/script/sound/` |
| 디버그/성능 측정 | `project/engine/script/debug/` |
| 범용 객체 풀 | `project/engine/script/object/` |
| 수학, 색상, 폰트, NW.js, 런타임 유틸 | `project/engine/script/util/` |
| 웹 릴리스 확인과 정규화 | `project/engine/script/release/` |
| 정적 상수와 테마 레지스트리 | `project/engine/script/data/` |

## 3. 튜토리얼 런타임 경로

| 경로 | 역할 |
| --- | --- |
| `script/scene/tutorial/_tutorial_scene.js` | 입력을 시뮬레이션 명령으로 변환하고 직접 경로/대상 선택, 모델 결과→cue 전달, 기록 즉시 저장·팝업 복귀, 메타 진행도와 view model·버튼 명령을 조율하는 씬 |
| `script/scene/tutorial/view/_tutorial_*_view.js` | 로딩·메뉴·스타터·책 기반 갤러리·체인지로그·결과·컷씬을 직렬화 가능한 view model과 render/asset port로 그리는 파일당 한 클래스의 비전투 뷰 |
| `script/scene/tutorial/view/_tutorial_battle_layout.js` | 전투 보드·HUD 기하와 흔들림이 적용된 타일 투영·히트테스트를 같은 프레임으로 제공하는 순수 레이아웃 클래스 |
| `script/scene/tutorial/_tutorial_battle_camera.js` | 플레이어 표시 좌표를 0.3초 `easeOutExpo` 감쇠로 추적해 레이아웃에 카메라 snapshot을 제공하는 전투 표현 컨트롤러 |
| `script/scene/tutorial/view/_tutorial_battle_world_view.js` | 읽기 전용 BattleViewModel로 타일·경로·월드 오브젝트·액터를 그리는 전투 월드 뷰 |
| `script/scene/tutorial/view/_tutorial_battle_hud_view.js` | 전투 상태·미션·인벤토리 HUD와 직렬화 가능한 전투 버튼 사양을 만드는 HUD 뷰 |
| `script/scene/tutorial/view/_tutorial_battle_feedback_view.js` | 장면이 조립한 피드백 snapshot으로 입자와 떠오르는 텍스트를 그리는 피드백 뷰 |
| `script/scene/tutorial/view/_tutorial_battle_tutorial_view.js` | 첫 플레이 전투 안내 오버레이와 다시 열기/닫기 버튼 사양만 그리는 안내 뷰 |
| `script/scene/tutorial/view/_tutorial_achievement_view.js` | 판정된 업적 해금을 에셋 기반 배너로 표시하는 뷰 |
| `script/scene/tutorial/view/_tutorial_asset_view_helpers.js` | 픽셀 UI 이미지를 비율 유지·정수 좌표·nearest 옵션으로 그리는 순수 함수 |
| `script/scene/tutorial/view/_tutorial_battle_view_helpers.js` | 전투 뷰가 공유하는 텍스트·목록·숫자 처리 순수 함수 |
| `script/scene/tutorial/view/_tutorial_button_host.js` | 버튼 사양을 `UIPool` 요소로 변환하고 갱신·그리기·반납한 뒤 command 의도와 포인터 focus key를 씬으로 전달하는 UI 수명주기 호스트 |
| `script/scene/tutorial/view/_tutorial_nonbattle_view_helpers.js` | 비전투 뷰가 공유하는 좌표 변환·패널·텍스트·줄바꿈·경계 확인 순수 함수 |
| `script/scene/tutorial/_tutorial_presentation_contract.js` | 모델 event 타입, presentation cue 타입과 향후 사운드 ID의 불변 값 계약 |
| `script/scene/tutorial/_tutorial_battle_presenter.js` | 모델 event와 전후 snapshot을 결정론적 불변 cue 배열로 변환하는 순수 프레젠터 |
| `script/scene/tutorial/_tutorial_feedback_queue.js` | cue 순번, 로그, 떠오르는 글자·입자·화면 반응 수명과 오디오 ID 대기열 소유 |
| `script/scene/tutorial/_tutorial_animation_timeline.js` | 표시 상태 보간, animation slot·소유 ID, 겹친 입력 잠금과 취소 세대 소유 |
| `script/scene/tutorial/_tutorial_asset_loader.js` | 주입형 Image/Canvas 팩토리 기반 매니페스트 로드, 크기 검증, 투명 여백 crop, nearest와 실패 폴백 |
| `script/scene/tutorial/_tutorial_asset_port.js` | 뷰에 UI·아이템·인물 논리 ID와 분리 맵 우선/합성본 폴백만 노출하는 읽기 포트 |
| `script/scene/tutorial/_tutorial_achievement_evaluator.js` | 안정된 모델 사건과 확정 업적 조건을 대조해 새 해금 ID·알림만 만드는 순수 판정 클래스 |
| `script/scene/tutorial/_tutorial_achievement_banner.js` | 판정이 끝난 업적 알림의 중복 제거, 큐와 표시 수명만 소유하는 상태 클래스 |
| `script/scene/tutorial/_tutorial_cutscene_trigger_router.js` | 첫 실행 메타와 실제 모델 사건을 기존 컷씬 ID로만 변환하는 런 단위 라우터 |
| `script/scene/tutorial/_tutorial_gallery_controller.js` | 업적·일기·엔딩·컷씬 섹션 선택과 메타 기반 열람·재생 스냅샷을 소유하는 클래스 |
| `script/scene/tutorial/_tutorial_record_popup_queue.js` | 한 경로에서 여러 기록을 획득해도 순서대로 갤러리 책을 열도록 활성·대기 기록과 중복 제거를 소유하는 클래스 |
| `script/scene/tutorial/_tutorial_combat_rules.js` | 행동 가능 여부, 대상, 피해·불안정도와 아이템 효과를 실제 행동·미리보기에 공통 제공하는 순수 규칙 클래스 |
| `script/scene/tutorial/_tutorial_effect_contract.js` | 선언형 효과가 공유하는 안정된 trigger·operation·condition·mode ID의 단일 원본 |
| `script/scene/tutorial/_tutorial_effect_registry.js` | 아이템·이벤트 effect 데이터와 참조를 검증·정규화하고 원본 순서의 레코드를 제공하는 순수 레지스트리 클래스 |
| `script/scene/tutorial/_tutorial_effect_executor.js` | 검증된 선언형 효과의 조건·order를 평가해 preview/apply에 같은 계산을 제공하는 순수 실행 클래스 |
| `script/scene/tutorial/_tutorial_lora_intent_planner.js` | 활·오르골 턴 시작 패시브와 불안정 상태를 반영해 다음 로라 행동·범위·피해를 비변이로 결정하는 클래스 |
| `script/scene/tutorial/_tutorial_player_action_previewer.js` | 공격·회복·아이템·대기 계획을 독립 상태에 적용해 HP·불안정도·소모·효과·추가 턴을 예측하는 클래스 |
| `script/scene/tutorial/_tutorial_combat_readability_presenter.js` | 모델 의도·행동 미리보기를 다음 행동, 현재→예상 수치, 소모·지속 효과 표시값으로만 변환하는 클래스 |
| `script/scene/tutorial/_tutorial_battle_focus_controller.js` | 마우스와 키보드가 공유하는 조사 가능한 전투 버튼 key와 순환 순서만 관리하는 클래스 |
| `script/scene/tutorial/_tutorial_guidance_controller.js` | 첫 플레이 자동 안내와 재플레이 수동 다시 보기의 열림 상태만 관리하는 클래스 |
| `script/scene/tutorial/_tutorial_battle_model.js` | 강제 이동→행동 단계, 행동 충전, 층별 `floorStates`, 인벤토리와 아이템·기록, 벽·이벤트 타일·짝 포탈·몹, 6회 층 전환과 12회 종료를 소유하고 전투 계산 클래스를 조합하는 순수 전투 모델 |
| `script/scene/tutorial/_tutorial_cutscene_controller.js` | 고정 스크립트 컷씬의 카드 진행과 완료 ID를 관리하는 순수 컨트롤러 |
| `script/scene/tutorial/_tutorial_meta_progress.js` | v5 `tutorialMeta`의 컷씬·업적·엔딩·기록 해금과 완료 횟수를 정규화하고 불변 갱신 함수·SaveSystem I/O를 제공하는 메타 진행도 모듈 |
| `script/scene/tutorial/_tutorial_meta_session.js` | 장면 한 개의 메타 staging·진행 연산·순차 저장과 미래 버전 저장 차단 상태를 소유하는 클래스 |
| `script/scene/tutorial/_tutorial_keyboard_edge_tracker.js` | 현재 키 상태와 프레임 사이 빠른 탭을 상승 에지로 정규화하는 입력 상태 클래스 |
| `script/scene/tutorial/_tutorial_keyboard_command_mapper.js` | 읽기 전용 화면·선택 상태와 키 상승 에지를 시뮬레이션 명령 사양으로 변환하는 클래스 |
| `script/scene/tutorial/_tutorial_nonbattle_view_model_factory.js` | 비전투·전투 안내 화면의 직렬화 가능한 표시 데이터를 조립하는 클래스 |
| `script/scene/tutorial/_tutorial_inventory_presenter.js` | 전투 인벤토리 페이지와 아이템 공개·사용 가능 표시 정책을 소유하는 클래스 |
| `script/scene/tutorial/_tutorial_battle_view_model_factory.js` | 모델 읽기 결과와 선택·표현 snapshot을 월드·HUD·피드백 공용 BattleViewModel로 조립하는 클래스 |
| `script/scene/tutorial/_tutorial_scene_constants.js` | 씬 모드와 시뮬레이션 명령의 단일 상수 원본 |
| `script/scene/tutorial/_tutorial_input_bindings.js` | 방향·선택·명령 키 코드와 감시 키 목록의 단일 원본 |
| `script/scene/tutorial/_tutorial_value_utils.js` | 타일·목록·체크포인트 값 복제 및 직렬화 비교를 담당하는 순수 함수 |
| `script/scene/tutorial/_tutorial_mode_policy.js` | 모드별 view/button 정책과 메뉴 복귀·재시작·전투 입력 허용 판정 |
| `script/data/game/tutorial_game_data.js` | 가로 9×세로 8 두 층, 유닛, 공개 이벤트 타일·짝 포탈·기록 배치, `ITEMS[*].effects`·`EVENT_TILE_EFFECTS`, 활성 고정 컷씬, 규칙, 레이아웃과 문구를 제공하는 `TUTORIAL_GAME_DATA` |
| `script/data/game/tutorial_content_data.js` | 확정 업적명·설명·사건 조건, 안정된 기록 ID와 본문, 엔딩 표시명, 갤러리 순서를 제공하는 `TUTORIAL_CONTENT_DATA` |
| `script/data/game/tutorial_changelog_data.js` | 실제 Git 커밋/제목과 사용자에게 표시할 한글 변경 요약을 연결하는 카탈로그 |
| `script/data/game/tutorial_asset_manifest.js` | 맵·UI·아이템·정적 인물 에셋 선언과 실제 맵 격자 꼭짓점을 조합하는 단일 매니페스트 |
| `script/data/game/tutorial_assets/` | 매니페스트 항목 생성을 맵·UI·아이템·레거시 도메인으로 분리한 데이터 모듈 |
| `script/data/theme/light_theme.js`, `script/data/theme/dark_theme.js` | `ColorSchemes.Tactics`로 노출되는 전술 화면 색상 |

## 4. 데이터 경로

| 경로 | 역할 |
| --- | --- |
| `script/data/data_handler.js` | `DATA_REGISTRY` 단일 접점 |
| `script/data/global/` | 전역 상수, 앱 일시정지 이유, 프레임 실행 정책 |
| `script/data/display/` | WebGL, effect, overlay render, vignette, display surface 상수 |
| `script/data/overlay/` | 오버레이 애니메이션 프리셋과 레이아웃 비율 |
| `script/data/simulation/` | 시뮬레이션 런타임 기본 스냅샷 |
| `script/data/input/` | 마우스 버튼 상태 상수 |
| `script/data/game/` | 튜토리얼 두 층 맵·전투 규칙·문구와 원본→런타임 에셋 매니페스트·격자 투영 데이터 |
| `script/data/theme/` | 라이트/다크 테마, `Tactics` 색상과 테마 레지스트리 |
| `script/data/ui/` | 버튼, UI 레이아웃, 텍스트, 커서, 툴팁 상수 |
| `script/data/sound/` | 사운드 경로와 기본 볼륨/입력 이벤트 상수 |
| `script/data/debug/` | 성능 표시와 디버그 출력 상수 |

상수 추가 절차는 [`reference/data_theme_guide.md`](./reference/data_theme_guide.md)를 확인합니다.

## 5. 세부 구조를 읽는 순서

1. 진입점과 초기화 순서는 [`core_architecture_guide.md`](./core_architecture_guide.md)를 봅니다.
2. 모듈 책임과 렌더 surface는 [`module_architecture_guide.md`](./module_architecture_guide.md)를 봅니다.
3. UI/오버레이는 [`ui_overlay_guide.md`](./ui_overlay_guide.md)를 봅니다.
4. 씬과 시뮬레이션 명령 큐는 [`reference/scene_lifecycle_guide.md`](./reference/scene_lifecycle_guide.md)를 봅니다.
