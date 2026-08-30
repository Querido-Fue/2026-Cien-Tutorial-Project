# SRP 리팩터링 진행 인계서

작성 기준: 2026-08-30 KST  
브랜치: `main`  
원격: `origin/main`  
마지막 기능 체크포인트: `44d312a feat: polish pickups and tutorial guidance`
현재 SRP 체크포인트: `refactor: extract tutorial cutscene session` 작업 블록

## 1. 작업 목표와 현재 상태

게임 코드 전체를 단일 책임 원칙(SRP)에 맞게 점진적으로 분리하고, 각 블록마다 회귀 검증,
커밋과 GitHub 푸시를 수행하는 장기 작업이다. 사용자의 명시적 요청으로 현재 블록까지만
완료하고 인계한다. 전체 목표 기준 진행률은 보수적으로 약 30%다.

- 자동 SRP 정책, 가이드와 회귀 기반은 완료했다.
- 가장 큰 `TutorialScene`의 입력·메타·표시 데이터·전투 선택·플레이어 명령·로라 턴·결과와
  컷씬 런 세션 상태를 분리했다.
- `TutorialScene`은 3,206줄에서 1,889줄로 1,317줄(약 41%) 줄었다.
- 전투 모델, Actor/HUD/Layout 뷰와 엔진의 장문 WebGL·오버레이 파일은 아직 분리하지 않았다.
- 기능/밸런스/저장 schema/픽셀 좌표는 의도적으로 변경하지 않았다.
- 작업 트리는 이 문서 커밋 뒤 깨끗해야 하며 모든 기능 체크포인트는 `origin/main`에 있다.

## 2. 반드시 먼저 읽을 파일

다음 작업자는 수정 전에 아래 파일을 전체 읽는다.

1. `AGENT_GUIDE.md`
2. `guide/navigation.md`
3. `guide/coding_conventions_guide.md`
4. `guide/project_structure_guide.md`
5. `guide/module_architecture_guide.md`
6. `docs/tutorial-scene-decomposition.md`
7. `scripts/architecture/source_responsibility_policy.mjs`
8. 실제로 수정할 소스 파일 전체

`AGENT_GUIDE.md`에는 앞으로 생성되는 코드에도 적용할 SRP 기준이 이미 반영되어 있다.
핵심은 권장 500줄 이하, 절대 상한 700줄, 파일당 클래스 하나, 변경 이유가 둘 이상이면 분리,
God context 대신 작은 포트/읽기 전용 snapshot 주입이다. 기존 부채 예산은 낮출 수만 있고
절대로 늘리지 않는다.

## 3. 완료된 체크포인트

모두 `origin/main`에 푸시됐다.

| 커밋 | 내용 |
| --- | --- |
| `cb0ab73` | 소스 책임 예산과 파일당 클래스 자동 감사 추가 |
| `22f231b` | 키보드 상승 에지와 메타 저장 세션 분리 |
| `eb62ccd` | 화면별 키 명령 매퍼와 비전투 뷰 모델 팩토리 분리 |
| `fa36748` | 인벤토리 프레젠터와 전투 뷰 모델 조립 분리 |
| `54b9811` | 경로·공격·정화·호버 선택 상태 분리 |
| `5a5d770` | 플레이어 전투 명령 적용 분리 |
| `e329b6f` | 로라 턴 대기·행동·완료 예약 수명주기 분리 |
| `460676e` | 종료 판정·엔딩 표시·엔딩 컷씬 대기 상태 분리 |
| `fb9e572` | 모델 결과의 cue·진행도·기록·컷씬 배포 흐름 분리 |
| 현재 블록 | 컷씬 런 중복 방지·대기열·복귀 모드 세션 분리 |

새 모듈은 모두 파일당 클래스 하나이며 현재 권장 500줄 아래다.

| 파일 | 줄 수 | 책임 |
| --- | ---: | --- |
| `_tutorial_keyboard_edge_tracker.js` | 93 | 키 상승 에지 정규화 |
| `_tutorial_meta_session.js` | 178 | 런 staging·순차 저장·쓰기 차단 |
| `_tutorial_keyboard_command_mapper.js` | 212 | 키 상태를 명령 사양으로 변환 |
| `_tutorial_nonbattle_view_model_factory.js` | 115 | 비전투 표시 데이터 조립 |
| `_tutorial_inventory_presenter.js` | 154 | 인벤토리 페이지·공개/사용 가능 표시 |
| `_tutorial_battle_view_model_factory.js` | 279 | 최종 전투 뷰 모델 조립 |
| `_tutorial_battle_selection_controller.js` | 406 | 경로·대상·호버 선택 상태와 입력 명령 파생 |
| `_tutorial_battle_command_controller.js` | 219 | 플레이어 전투 명령 검증·모델 호출·연출 시작 |
| `_tutorial_lora_turn_controller.js` | 127 | 로라 턴 2단계 예약 수명주기 |
| `_tutorial_result_controller.js` | 108 | 종료·엔딩 데이터·결과 기록·컷씬 대기 |
| `_tutorial_battle_outcome_coordinator.js` | 87 | 결과 구독자 고정 순서 배포·이전 표현 snapshot |
| `_tutorial_cutscene_session.js` | 207 | 컷씬 런 중복 방지·대기열·닫힘 뒤 복귀 결정 |

집중 회귀는 `test/tutorial_scene_collaborators.test.mjs`와
`test/tutorial_cutscene_session.test.mjs`에 추가했다. 소스 seam과 단방향 의존은
`test/tutorial_scene_seams.test.mjs`가 계속 검사한다.

## 4. 현재 장문 부채

`scripts/architecture/source_responsibility_policy.mjs`의 `legacyBudgets`가 아래 파일의 현재
상한을 고정한다. 어떤 리팩터링에서도 수치를 늘리지 않는다.

| 우선순위 | 파일 | 현재 줄 수 |
| ---: | --- | ---: |
| 1 | `project/engine/script/scene/tutorial/_tutorial_scene.js` | 1,889 |
| 2 | `project/engine/script/scene/tutorial/_tutorial_battle_model.js` | 2,185 |
| 3 | `project/engine/script/ui/layout/_layout_handler.js` | 1,180 |
| 4 | `project/engine/script/scene/tutorial/view/_tutorial_battle_actor_view.js` | 1,156 |
| 5 | `project/engine/script/scene/tutorial/view/_tutorial_battle_hud_view.js` | 653 |
| 6 | `project/engine/script/overlay/_diagnostic_test_overlay.js` | 944 |
| 7 | `project/engine/script/display/webgl/_overlay_effect_renderer.js` | 914 |
| 8 | `project/engine/script/scene/tutorial/_tutorial_combat_rules.js` | 753 |
| 9 | `project/engine/script/display/display_system.js` | 713 |
| 10 | `project/engine/script/overlay/_base_overlay.js` | 709 |

`project/engine/script/data/game/tutorial_game_data.js`는 선언형 튜닝 데이터 단일 원본이므로
사유가 명시된 900줄 예외다. 동작 코드처럼 임의로 분리하지 않는다.

## 5. 다음 권장 작업 순서

### A. `TutorialScene` 분리 마무리

먼저 장면을 조립·수명주기 파사드로 줄인다. 다음 경계가 비교적 안전하다.

1. 컷씬 대기열·복귀·런 중복 방지 상태 분리는 `TutorialCutsceneSession`으로 완료했다.
2. 다음 블록은 비전투 화면 전환·갤러리·Pause 명령을 화면 흐름 컨트롤러로 묶는다.
   - 타이틀 스타터 전환은 신설된 `TutorialTitleFlowController`와 중복되지 않게 경계를 다시 잡는다.
3. 버튼 signature/spec/style 조립을 별도 프레젠터로 옮긴다.
4. 포인터 히트테스트/카메라 업데이트/스프라이트 roster 동기화는 각각 기존 전용 객체의
   어댑터로 축소한다.

목표는 장면을 700줄 이하로 만든 뒤 `legacyBudgets`에서 제거하는 것이다. 한 번에 전부 옮기지
말고 위 경계마다 테스트·커밋·푸시한다.

### B. `TutorialBattleModel` 분리

장면이 안정된 뒤 모델 공개 API, 체크포인트 shape와 event 순서를 보존하며 다음 순서로 나눈다.

1. 생성 데이터 검증·정규화
2. 이동/도달 범위/포탈/경로 확정
3. 층별 월드·이벤트 타일·아이템/기록 수집
4. 턴 전이·몹 행동·종료 판정
5. 체크포인트 생성·복원

`test/tutorial_battle_model.test.mjs`, `test/tutorial_effect_contract.test.mjs`와 밸런스 시뮬레이션을
공개 API 계약으로 사용한다. 저장 필드명, 사건 ID와 순서를 바꾸지 않는다.

### C. 뷰와 엔진 장문 파일

1. `TutorialBattleActorView`: 그림자 투영, sprite layer 조립, HP bar, 도형 fallback 분리
2. `TutorialBattleHudView`: 상태 프레임, 인벤토리, 행동 메뉴, 설명 패널 분리
3. `LayoutHandler`: 레이아웃 등록/계산/갱신/직렬화 경계 분리
4. 진단 overlay, WebGL overlay renderer, combat rules, display facade, base overlay 순서

픽셀 좌표와 draw 순서는 시각 계약이므로 계산 helper를 옮길 때 숫자를 재조정하지 않는다.

## 6. 블록별 필수 절차

각 분리 블록에서 다음 순서를 지킨다.

1. 수정할 파일을 끝까지 읽고 메서드/상태 사용처를 `rg`로 감사한다.
2. 새 책임 클래스와 집중 단위 테스트를 먼저 만든다.
3. 기존 공개 API와 직렬화 형식을 유지한 채 호출부를 연결한다.
4. 원본 중복 상태·메서드를 제거하고 역참조가 없는지 검사한다.
5. 원본 줄 수를 다시 측정해 `source_responsibility_policy.mjs`의 예산을 정확히 낮춘다.
6. `AGENT_GUIDE.md`, `guide/project_structure_guide.md`, 관련 설계 문서를 갱신한다.
7. 게임 변경이면 실제 커밋 subject와 일치하는 한글 항목을
   `tutorial_changelog_data.js` 맨 앞에 추가한다.
8. `npm test`, `git diff --check`를 통과시킨다.
9. 하나의 응집된 커밋으로 만들고 즉시 `git push origin main` 한다.

권장 커밋 제목 예시는 `refactor: extract tutorial cutscene session`이다.

## 7. 마지막 검증 기준선

현재 컷씬 세션 분리 블록 검증 결과:

- Node 테스트: 228/228 통과
- `check:assets`: PNG 84개, MP3 26개, 경고 0
- `check:repo`: 오류 0, 경고 0
- `check:responsibilities`: 소스 283개, 기존 부채 11개
- `check:release`: 구조 검사 성공

`fb9e572` 기준 전체 검증 결과:

- Node 테스트: 196/196 통과
- `check:assets`: PNG 80개, MP3 26개, 경고 0
- `check:repo`: 오류 0, 경고 0
- `check:responsibilities`: 소스 265개, 기존 부채 11개
- `check:release`: 구조 검사 성공

`check:release`의 공개 배포 차단 5개는 기존 권리 증빙 문제이며 SRP 작업으로 해결하거나 숨기지
않는다: 저장소 코드 라이선스, 제공 아트, 제공 오디오, 런타임 복사본, 외부 참조 아이콘.

## 8. 주의할 회귀 지점

- 장면 타임라인 revision이 바뀌면 같은 command drain의 나머지 명령을 중단해야 한다.
- 포커스 아웃/Pause/기록 팝업에서는 모델 시간만 멈추고 엔진 overlay 입력 우선순위를 보존한다.
- 결과는 기록 팝업, 컷씬 대기열과 sprite impact가 모두 끝난 뒤 한 번만 확정한다.
- `TutorialResultController`의 결과 snapshot은 방어 복제이므로 외부에서 직접 수정하지 않는다.
- 로라 턴 컨트롤러는 action callback 안에서 다시 arm될 수 있으므로 stage 설정 순서를 바꾸지 않는다.
- 전투 선택 snapshot과 view model은 방어 복제 경계를 유지한다.
- 메타 미래 버전 쓰기 차단과 런 staging/즉시 기록 저장 정책을 합치지 않는다.
- 기존 dirty 변경이 생기면 사용자 작업으로 간주하고 덮어쓰거나 reset하지 않는다.

## 9. 현재 작업 상태

기술적 차단은 없다. 컷씬 세션 분리와 전체 Node 회귀는 완료됐고, 같은 goal의 브라우저 기능
검증과 루트 `bug_report.md` 작성이 이어진다. 다음 SRP 블록은 비전투 화면 흐름 경계다.
