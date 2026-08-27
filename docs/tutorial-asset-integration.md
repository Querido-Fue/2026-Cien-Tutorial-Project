# 튜토리얼 에셋 통합 기준

## 1. 원본과 런타임 복사본

- 이 저장소에는 프롬프트가 예시한 `incoming_assets/`가 없고, 사용자 지시에 따라 `project/asset/`을 원본의 단일 기준으로 사용한다.
- 원본 파일은 이름 변경·덮어쓰기·삭제하지 않는다. `npm run import:assets`가 `TUTORIAL_ASSET_MANIFEST`를 읽고 `project/asset/tutorial/` 아래 ASCII 파일명으로 `COPYFILE_EXCL` 복사한다.
- 이미 같은 파일이 있으면 SHA-256이 같을 때만 멱등 성공으로 처리하고, 내용이 다른 파일은 충돌 오류로 중단한다.
- `npm run check:assets`는 원본과 런타임 복사본의 PNG IHDR 실제 크기, 선언된 기대/실제 크기, 경로 containment, 중복 ID와 폴백 참조를 검사한다.

## 2. 런타임 계약

`project/engine/script/data/game/tutorial_asset_manifest.js`가 다음 네 도메인을 조합한다.

| 도메인 | 데이터 모듈 | 런타임 정책 |
| --- | --- | --- |
| 두 층 맵 | `_tutorial_map_asset_entries.js` | 배경+격자가 모두 준비되면 분리 레이어를 사용하고, 하나라도 실패하면 `full` 합성본으로 폴백 |
| 메뉴·HUD·팝업 | `_tutorial_ui_asset_entries.js` | 투명 여백은 manifest `sourceRect`로 한 번 crop하고 빈 도안 위 문구·수치는 런타임 한글 텍스트로 표시 |
| 아이템 | `_tutorial_item_asset_entries.js` | 16×16 개별 PNG를 월드와 인벤토리가 같은 논리 ID로 사용 |
| 정적 로라 | `_tutorial_legacy_asset_entries.js` | 초상화와 정적 월드 이미지만 사용하며 캐릭터 애니메이션은 13턴 범위로 남김 |

로더는 PNG 자연 크기가 계약과 다르면 `image-dimensions-mismatch`로 실패시키며, crop canvas와 2D/WebGL 확대 모두 nearest-neighbor를 사용한다. 뷰는 실제 경로나 `Image.onload`를 알지 않고 `TutorialAssetPort`만 조회한다.

## 3. 맵 정렬

두 맵은 모두 970×580이지만 방 실루엣과 9×8 카펫의 사각 투영이 층별로 조금 다르다. 따라서 기존 대칭 쿼터뷰 공식을 이미지 위에 단순히 겹치지 않는다.

| 층 | top | right | bottom | left |
| --- | --- | --- | --- | --- |
| 1층 | (461, 133) | (927, 321) | (591, 544) | (120, 356) |
| 지하층 | (468, 136) | (917, 316) | (581, 540) | (131, 360) |

이 값은 원본 카펫 alpha hull의 바깥 꼭짓점을 픽셀 단위로 확인해 정한 값이다. `TutorialBattleLayout`은 맵을 보드 안에 aspect-fit한 뒤 네 꼭짓점에서 X축 9등분·Y축 8등분 벡터를 계산한다. 타일 렌더, 오브젝트, 경로 강조, 마우스 hit test는 같은 layout frame을 사용한다. 에셋이 실패해 도형 보드로 돌아가도 클릭 좌표 원본은 유지한다.

## 4. 아이템 대응과 폴백

Google Drive의 UI 폴더에 있는 `ingame_item_*.png` 파일명과 `시스템 기획 3차`,
`아이템 3개 추가`의 아이템 명칭을 교차 확인해 다음 대응을 결정했다.

| 게임 아이템 | 원본 아이콘 stem |
| --- | --- |
| 활과 화살 | `arrow` |
| 인형탈 | `mask` |
| 낡은 곰인형 | `bear` |
| 오르골 | `music box` |
| 아이라인 | `eyeliner` |
| 다이아몬드 곡괭이 | `minecraft` |
| 거울 | `mirror` |
| 마리오의 버섯 | `mario` |
| 링크의 오카리나 | `zelda` |
| 메이플스토리의 헤이스트 | `maplestory` |
| 알파와 같이 찍은 사진 | `picture` |
| 타일 정화제 | 대응 PNG 없음 → 기존 `정` 글리프 |

`tile-cleanser`는 누락을 숨기지 않고 `generated-fallback`, `required: false` 항목으로 매니페스트에 기록했다.

## 5. 임의 결정과 후속 범위

- 제공된 UI 매뉴얼 DOCX는 현재 환경에 LibreOffice/`soffice`가 없어 표준 렌더 검증을 수행하지 못했다. 문서 구조와 포함 이미지 수를 확인한 뒤 실제 PNG를 직접 시각 검사하고 alpha bbox를 측정해 crop을 정했다.
- Drive의 `A. UI manual [[[[ Read me ]]]]`에는 업적 달성 시 알림 영역에 표시한다는 문구만 있고,
  `10차 회의`에는 업적 이름·간단 설명 작성이 미완료 과제로 남아 있다. `시스템 기획 3차`도
  서브 도전과제를 아이디어 수준으로만 언급하며 트리거·지속시간·저장 규칙은 정하지 않았다.
  따라서 영구 진행도를 새로 만들지 않고, 한 전투에서 각 아이템을 처음 주운 순간 3초간
  표시하는 세션 한정 `발견 업적` 알림으로 임시 연결했다. 정식 조건·저장은 기획 확정 시
  `TutorialAchievementBanner` 정책만 교체해야 한다.
- 메인 타이틀처럼 글자가 포함된 완성 로고는 그대로 쓰되, 버튼·턴·상태·아이템 설명·튜토리얼·업적의 빈 프레임에는 현재 상태에서 계산한 한글 텍스트를 얹는다.
- 13턴 전까지 로라는 기존 정적 PNG로만 표시한다. 캐릭터 시트 프레임 분할과 상태 애니메이션은 이 통합에 포함하지 않는다.
- 사운드는 14턴 범위이므로 이번 매니페스트와 로더가 오디오 파일을 읽지 않는다.

## 6. 검증 명령

```text
npm run import:assets
npm run check:assets
npm run test:assets
npm test
```

수동 확인에서는 1층의 따뜻한 보라·주황 색과 지하층의 어두운 회보라 색이 필터 없이 보이는지, 두 층의 네 모서리 타일을 클릭했을 때 강조와 오브젝트 중심이 맞는지, 16:9·와이드·최소 높이에서 UI가 safe area 안에 있는지 확인한다.

### 2026-08-28 검증 기록

- 전체 `npm test`와 PNG 31개 원본/복사본 검사는 통과했다.
- 지정된 Drive의 기획·회의록·UI 폴더를 확인했다. 아이템 파일명 대응은 자료와 일치했고,
  업적의 구체 규칙은 여전히 미확정이어서 위 임시 정책을 유지했다.
- 저장소와 PATH에 NW.js 실행 파일이 없어 NW 전용 런타임은 실행하지 못했다.
- 로컬 정적 서버를 Firefox에서 확인하려 했으나 Computer Use가 현재 Windows 브라우저의 로컬 URL 정책을 지원하지 않아 입력 전에 강제 종료됐다. 우회하지 않았으며 수동 스크린샷은 남기지 않았다.
- 따라서 실제 픽셀 배치의 사람 눈 검수와 네 모서리 클릭은 NW.js 배포본이 준비된 환경에서 위 체크리스트로 다시 확인해야 한다.
