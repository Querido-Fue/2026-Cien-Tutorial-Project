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

