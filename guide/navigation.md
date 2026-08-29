# JukChang Engine AI Agent Guide

> 버전: 0.5 | 런타임: NW.js 데스크톱 | 렌더링: Canvas 2D + WebGL
> 이 문서는 진입 인덱스입니다. 작업에 필요한 문서만 골라 읽고, 수정 대상 파일은 반드시 전체 내용을 확인한 뒤 변경합니다.

---

## 1. 항상 먼저 확인할 것

1. 요청을 수행하기 전에 버그 가능성, 확장성 한계, 안티패턴, 보안/치명 결함, 모호성을 짧게 점검합니다.
2. 작업 유형에 맞는 세부 가이드를 이 문서에서 고릅니다.
3. 코드 수정 전에는 수정 대상 파일 전체를 읽습니다.
4. 코드 수정 후에는 `git diff --check`로 공백 오류와 충돌 마커를 확인합니다.
5. 가이드 변경은 구조, 핵심 로직, 아키텍처 패턴이 바뀔 때만 반영합니다.

---

## 2. 작업별 가이드 라우팅

| 작업 | 먼저 읽을 문서 |
| --- | --- |
| 프로젝트 경로와 현재 엔진 디렉터리 파악 | [`project_structure_guide.md`](./project_structure_guide.md) |
| 시스템 책임, 풀, 렌더 surface, 모듈 경계 파악 | [`module_architecture_guide.md`](./module_architecture_guide.md) |
| 초기화, `EngineApp`, `SystemHandler`, 고정 스텝, importmap 수정 | [`core_architecture_guide.md`](./core_architecture_guide.md) |
| 코딩 컨벤션, 데이터 상수, 테마, 주석 규칙 | [`coding_conventions_guide.md`](./coding_conventions_guide.md), [`reference/data_theme_guide.md`](./reference/data_theme_guide.md) |
| 오버레이, UI 요소, `LayoutHandler`, `PositioningHandler` 수정 | [`ui_overlay_guide.md`](./ui_overlay_guide.md), [`reference/overlay_contract_guide.md`](./reference/overlay_contract_guide.md) |
| 2D/WebGL 렌더 명령과 레이어 선택 | [`reference/render_command_guide.md`](./reference/render_command_guide.md) |
| 화면 좌표계, UI 기준 폭, 오브젝트 월드 높이 | [`reference/display_viewport_guide.md`](./reference/display_viewport_guide.md) |
| 씬 전환, `BaseScene`, 시뮬레이션 명령 큐, `destroy()` 정리 | [`reference/scene_lifecycle_guide.md`](./reference/scene_lifecycle_guide.md) |
| 튜토리얼 두 층 전투, 직접 경로/행동 충전, 이벤트 타일·짝 포탈·몹, 메타 진행도, 입력 명령과 재시작 흐름 | [`project_structure_guide.md`](./project_structure_guide.md), [`core_architecture_guide.md`](./core_architecture_guide.md) |
| 릴리스 감사, NW.js 패키징, 에셋 권리·출처, RC 판정 | [`../README.md`](../README.md), [`../docs/release-candidate-report.md`](../docs/release-candidate-report.md), [`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) |
| 에이전트 실수 방지 체크 | [`agent_pitfalls_guide.md`](./agent_pitfalls_guide.md) |

---

## 3. 현재 엔진 기준 빠른 판단

- `project/engine`이 현재 런타임 루트입니다. 예전 `project/game` 경로를 기준으로 판단하지 않습니다.
- 현재 기본 실행은 `tutorial_main.js`가 구성하는 `N번째 플레이어` 전술 프로토타입입니다. `TutorialScene`은 초기 `active` 씬과 플레이 씬 factory로 주입되며, 엔진 코어에는 게임 규칙을 고정하지 않습니다.
- 전투 상태와 이동 규칙은 순수 `TutorialBattleModel`, 가로 9×세로 8 두 층과 정적 튜닝값은 `TUTORIAL_GAME_DATA`, 전술 색상은 테마의 `Tactics` 영역을 기준으로 확인합니다.
- 모델은 직접 지정하는 최대 4칸 이동 뒤 1~2회 행동, 고정 로라와 몹의 순차 행동, 여섯 번째 로라 행동 후 지하 전환, 공개 이벤트 타일·짝 포탈과 최대 12회 로라 행동 결과를 관리합니다.
- 고정 카드 컷씬과 자동 트리거는 활성 상태이며 첫 오프닝, 실제 아이템 사용, 층 전환과 엔딩 사건에만 연결합니다. AI 기반 채팅이나 생성형 대화 경로는 없습니다.
- 메타는 v5이며 `TutorialMetaMigrator`가 v1의 `discoveredTrapIds`를 `revealedEventTileIds`로 이관하고 v5의 `unlockedRecordIds`를 안전하게 추가합니다. 미래 버전 저장은 읽기·쓰기를 중단해 원본을 보호합니다.
- 릴리스 감사와 패키징 클래스는 `scripts/release/`, `scripts/package/`에 파일당 하나씩 둡니다. `check:release`의 import 순환·미해결 경로는 0이어야 하며 권리 차단 경고를 검사 성공과 혼동하지 않습니다.
- `diagnostic_main.js`와 `DiagnosticScene`은 기본 진입점이 아닌 수동 엔진 진단 경로입니다.
- 고정 시간축이 필요한 로직은 `fixedUpdate()`와 `getFixedDelta()`를 기준으로 판단합니다.
- UI, 오버레이, 렌더링 프레젠테이션은 가변 프레임 `update()`/`draw()`와 표시 좌표계를 기준으로 판단합니다.
- 상수와 테마는 코드에 직접 쓰지 않고 `data/`와 레지스트리 경로를 사용합니다.
- 계획서 성격의 임시 문서는 안정 가이드나 진행 문서로 흡수한 뒤 남기지 않습니다.
