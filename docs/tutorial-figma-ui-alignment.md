# Figma `<<최종 UI>>` 정합화 기준

이 문서는 Figma 파일 `zoYGZCDsEoMfKkaZstqNfL`, 페이지 `461:11`의 평면 참조 이미지와 NW.js 실측을 연결하는 구현 기준이다. Figma 노드는 내부 컴포넌트나 토큰이 없는 단일 이미지이므로 아래 좌표에는 화면별 약 ±1~2%의 관찰 오차가 있다.

## 기준과 제품 기본안

- 기준 디자인 캔버스는 `1280×720`이다. `UIWW` 안에 16:9 safe area를 중앙 배치하고 모든 좌표를 정수 픽셀로 반올림한다.
- 픽셀 에셋은 비율을 보존하고 `imageSmoothingEnabled = false` 경로를 유지한다. 울트라와이드 거터는 배경과 비네트만 채운다.
- 마우스 hit region은 화면별 layout builder가 반환한 그림 rect를 단일 원본으로 사용한다.
- `Continue`는 현재 v4 메타가 진행 중 전투 스냅샷을 저장하지 않으므로 비활성 상태로 표시한다. 저장 포맷과 전투 규칙은 이 UI 작업에서 확장하지 않는다.
- 전투 중 `Pause`는 모델을 파괴하지 않는 독립 모드이며 `Resume`, 스타터 선택으로 가는 `Restart`, 메인으로 가는 `Exit`를 제공한다.
- Figma의 영어 임시 문구는 저장소의 승인된 한국어 문구로 치환하고, 체크무늬는 투명 영역으로 취급한다.

## Figma 노드 매핑

| 화면 | Figma 노드 | 구현 소유자 |
| --- | --- | --- |
| 메인 | `466:33` | `TutorialMenuView` |
| 스타터 선택 | `461:19` | `TutorialStarterView` |
| Pause | `461:23` | `TutorialPauseView` 및 scene mode policy |
| 결과 | `461:18` | `TutorialResultView` |
| 기본 전투 | `466:24` | `TutorialBattleLayout`, world/HUD views |
| 상황별 전투 | `466:27` | battle HUD 및 achievement view |
| 전투 튜토리얼 | `466:30` | `TutorialBattleTutorialView` |
| 갤러리 책 | `464:25`, `464:28` | `TutorialGalleryView`의 미디어/상세 템플릿 |
| 갤러리 목록 | `464:31`, `464:34` | `TutorialGalleryView`의 목록/상세 템플릿 |
| 갤러리 업적 | `464:37`, `464:40` | `TutorialGalleryView`의 업적 grid/detail 템플릿 |

갤러리의 여섯 이미지는 다섯 섹션이 아니라 세 템플릿의 A/B 상태로 본다. 책갈피 의미는 기존 키를 유지해 업적=red-left, 로라의 일기=yellow-left, 개발자의 일기=yellow-right, 엔딩=red-right, 컷씬=blue-right로 매핑한다.

## 시각 검증 계약

- 구조 검사는 layout rect, z-order용 렌더 명령, 버튼 그림/hit rect 동일성, 월드 project/unproject 왕복을 결정론적으로 검증한다.
- 런타임 골든은 메인, 스타터 두 상태, Pause, 1층/지하 전투, 행동·아이템 포커스, 업적, 튜토리얼 단계, 갤러리 템플릿, 결과 대표 상태를 NW.js에서 캡처한다.
- Figma 원본 스크린샷은 런타임 에셋으로 복사하지 않는다. 배포 권리와 참조 정책이 확정되기 전에는 저장소 밖 감사 디렉터리에 보관한다.
- 픽셀 비교 시 커서, 애니메이션 sprite frame, 플로팅 텍스트, 시간 기반 pulse는 마스크한다. 고정 HUD는 엄격 비교하고 월드 애니메이션 영역은 구조 비교와 완화된 이미지 차이를 함께 사용한다.
- 실패 산출물은 expected/actual/diff 세 장과 정규화 bounding-box 오차를 남긴다.

## 2026-08-28 구현 결과

Figma의 13개 평면 참조와 현재 1538×900 NW.js 창을 기준으로 다음 구조를 실제 뷰에
반영했다. 전투 모델, presenter, feedback queue, asset loader/port, audio director와 분리된
battle/nonbattle view 경계는 유지했다.

- 메인은 로고와 `계속하기`·`새 게임`·`갤러리` 세로 버튼만 남겼다. 현재 저장 메타에는
  진행 중 전투 snapshot이 없으므로 `계속하기`는 의도적으로 disabled다.
- 스타터 화면은 1층 맵 위에 두루마리 제목과 카드 전체가 hit region인 세로 카드 두 장을
  배치했다. Figma에 없는 상시 설명·메뉴 버튼은 제거하고 `Esc` 계약만 유지했다.
- `PAUSE` 모드와 `TutorialPauseView`를 추가했다. Pause 중 모델과 전투 화면을 유지하고
  simulation·animation clock 진행을 멈춘다. `계속하기`는 같은 상태로 복귀하고,
  `재시작하기`는 스타터 선택, `나가기`는 메인으로 이동한다.
- 전투는 aspect-fit 맵을 화면 대부분에 두고 턴=좌상단, 로라=우상단, 플레이어=좌하단,
  행동=우하단 anchor로 재배치했다. 행동 preview·pending gauge·플로팅 피드백은 제거하지
  않고 선택 시 context/item 패널과 월드 overlay로 점진 노출한다.
- 튜토리얼은 중앙 단일 모달 대신 HUD 주변 일곱 콜아웃과 하단 확인/건너뛰기로 구성했다.
- 갤러리는 중앙 열린 책, 양측 다섯 책갈피, 우상단 닫기, 하단 페이지 화살표로 구성했다.
  좌측 화살표는 별도 원본이 없어 같은 source image를 Canvas 2D에서 수평 반전한다.
- 결과는 지하 맵 위 열린 책, 왼쪽 레터링, 오른쪽 페이지 안 세로 버튼으로 구성했다.
  Figma 기본 화면에 없는 통계 본문은 상시 그리지 않고 두 버튼 tooltip에서만 제공한다.

관찰한 주요 정규화 목표는 다음과 같다. 이는 평면 이미지 직접 측정값이므로 화면별
약 ±0.5~2% 오차를 허용하며 숨은 padding이나 내부 레이어를 확정하지 않는다.

| 영역 | 정규화 목표 |
| --- | --- |
| 공통 맵 | `x≈2.7%`, `y≈2.5%`, `w≈94.6%`, `h≈95%` |
| 메인 로고 | `x≈38.5%`, `y≈21.5%`, `w≈27%`, `h≈22%` |
| 메인 버튼 그룹 | `x≈42.5~45%`, `y≈55~56%`, `w≈15%`, `h≈18%` |
| 스타터 제목 | `x≈43.5%`, `y≈18.5%`, `w≈13%`, `h≈9%` |
| 스타터 카드 | 왼쪽 `x≈34.2%`, 오른쪽 `x≈50.8%`, `y≈38%`, `w≈15%`, `h≈37%` |
| Pause 패널 | `x≈39.5%`, `y≈35.5%`, `w≈21%`, `h≈29%` |
| 턴 / 로라 | 좌상단 `x≈4.8%, y≈6%`; 우상단 `x≈71%, y≈6%` |
| 플레이어 / 행동 | 좌하단 `x≈4.8%, y≈81.5%`; 우하단 `x≈82%, y≈77%` |
| 업적 알림 | `x≈39%`, `y≈7%`, `w≈15.5%`, `h≈6.5%` |

`test/fixtures/tutorial_visual_fixture_catalog.mjs`는 Figma 13개 노드와 정확히 일대일인
결정론적 상태 목록을 고정한다. `npm run test:visual`은 design-space, 화면별 layout,
버튼 hit rect와 fixture 정책을 검사한다. 현재 CI는 구조·좌표 계약까지 자동화했고 실제 PNG
획득과 픽셀 diff는 아직 수동 단계다. 향후 capture runner는 1280×720, device scale 1,
animation clock 0, nearest-neighbor로 캡처하고 고정 HUD 0.4%, 동적 월드 mask 포함 3.5%,
anchor 7px를 초기 경계로 사용한다.

## 실측 범위와 남은 한계

Codexpal Computer Use 허용 상태에서 NW.js 0.108.0, 1538×900 창을 직접 조작해 메인,
스타터, 1층 전투, Pause와 resume, 아이템 포커스, 일곱 튜토리얼 콜아웃, 갤러리,
6번째 로라 행동 뒤 지하 전환, 12번째 행동 뒤 결과까지 확인했다. 결과까지의 전체 흐름은
마우스로 완주했다. 업적 알림은 이번 실행에서 실제 조건을 만들지 못해 코드·asset·layout
테스트로만 확인했고, 합성 키보드는 NW.js 입력 수신을 화면으로 입증하지 못해 source contract
검증 상태로 남긴다. 갤러리 좌측 화살표 반전과 아이템 설명 줄바꿈의 마지막 미세 수정은
자동 layout/render command 테스트 후 반영했지만 같은 인스턴스에서 다시 캡처하지 않았다.
