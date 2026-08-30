# 튜토리얼 스프라이트 애니메이션 기준

## 1. 데이터와 책임 경계

`TUTORIAL_SPRITE_CLIPS`는 배우 동작을 32×32 논리 프레임으로 선언한다. 실제 PNG를 재가공하지
않고 각 프레임의 원본 픽셀 `sourceRect`, 레이어 미세 오프셋과 그림자 여부, FPS, 루프 여부,
impact 프레임, 프레임 이벤트, 발 앵커와 타일 대비 크기를 데이터로 보존한다.

런타임 책임은 다음처럼 분리한다.

| 클래스 | 단일 책임 |
| --- | --- |
| `TutorialSpriteClipResolver` | 동작·방향·슬라임 색상 요청을 실제 클립과 순환 없는 명시적 폴백으로 해석 |
| `TutorialSpriteAnimator` | 배우별 델타 프레임 진행, 루프, 우선순위 중단, impact/footstep 1회 이벤트와 수명 정리 |
| `TutorialSpriteRoster` | 현재 표시 층의 플레이어·로라·슬라임을 재생기 actor 입력으로 투영 |
| `TutorialSpriteCueRouter` | 프레젠터 cue를 클립 시작과 배우/effect impact 지연으로 연결하고 발걸음 오디오 cue 파생 |
| `TutorialSpriteFrameRenderer` | 몸·머리 같은 프레임 레이어를 오프셋이 반영된 정수 좌표와 nearest로 합성 |
| `TutorialBattleEffectAnimator` | 화살 이동·폭발 프레임과 effect impact·reset/destroy 수명 소유 |
| `TutorialBattleAnimationCoordinator` | roster, 배우 재생기, cue router와 월드 effect를 단일 `route/update/snapshot/isBusy` 경계로 조립 |
| `TutorialBattleActorView` | 배우 기하·발 그림자·HP와 이미지 실패 도형 폴백을 소유하고 실제 이미지 합성은 frame renderer에 위임 |

모델은 스프라이트나 시간을 알지 않고 기존 의미 event만 반환한다. 프레젠터도 프레임 번호를
계산하지 않으며, cue router가 clip resolver에서 impact 시간을 조회한다.

## 2. 제공 시트 해석

| 배우/시트 | 셀 | 사용 프레임 |
| --- | --- | --- |
| 플레이어 Walking | 64×64, 4×4 | 행 left/right/up/down, 열 0 대기·0~3 걷기 |
| 플레이어 Breathing | 64×64, 19×1 | 열 0/1 좌/우 머리, 열 2/3 좌/우 몸. 좌우 idle에서 몸은 고정하고 머리를 `0,-1,-1,0px` 이동 |
| 플레이어 Melee | 64×64, 19×4 | 행 0/2 배우와 1/3 검격을 같은 열 0~3에 겹쳐 렌더 |
| 플레이어 Range | 64×64, 19×3 | 행 0/1 좌/우 공격 열 0~6, 행 2의 좌/우 화살 crop은 별도 월드 투사체로 사용 |
| 플레이어 Hit | 64×64, 19×2 | 좌/우 행의 열 0~3 |
| 플레이어 Heal | 64×64, 19×2 | 좌/우 행의 열 0~18 |
| 플레이어 Item | 64×64, 19×2 | 좌/우 행의 열 0~4 |
| 로라 Breathing 수정본 | 64×64, 4×1 | 열 0 좌 몸, 1 좌 머리, 2 우 머리, 3 우 몸. 몸 고정·머리 `0,-1,-1,0px` 호흡 루프 |
| 로라 Melee | 64×64, 5×2 | 좌/우 행의 열 0~4 |
| 로라 Range Magic | 64×64, 6×2 | 좌/우 행의 열 0~5 |
| 로라 Hit / Unstable / Collapsed | 64×64, 각 4×2 | 좌/우 행의 열 0~3; 불안정도 61~80은 unstable, 81~100은 collapse 루프 |
| 파랑·초록 Slime | 64×64, 10×4 | 행 0 대기, 행 2 공격, 행 3 피격, 행 1 사망 |

슬라임 색은 1층 파랑, 지하층 초록으로 정했다. 두 원본은 같은 좌표 계약을 공유한다.
WebGL 배치는 원본 텍스처를 한 번만 올리고 프레임마다 정규화 UV만 바꾼다. 확대 사각형과
위치는 정수로 반올림하고 smoothing을 끈다. 몸 레이어만 `castsShadow: true`이고 호흡 머리와
검격 레이어는 그림자를 만들지 않는다. 기존 74×74 로라 Walking은 호환 원본으로만 남고
현재 전투 idle/action 클립에는 사용하지 않는다.

## 3. 타이밍과 중단

- 걷기는 8 FPS 루프이며 프레임 1·3을 지날 때 `sfx.player.footstep` cue를 한 번씩 만든다.
- 플레이어 근접 공격은 10 FPS, 프레임 2가 impact다. 원거리는 12 FPS의 7프레임이며 프레임
  4에서 화살을 발사한다. 아이템은 10 FPS 프레임 3, 로라 근접·범위 공격은 10 FPS 프레임
  3이 배우 impact다. 로라 피격은 12 FPS, unstable/collapse는 4 FPS 루프다.
- 활 피해는 배우 impact와 화살의 `발사 지연 + 실제 타일 이동 시간` 중 큰 값을 사용한다.
  로라 범위 피해는 폭발 재생 프레임 5에 맞춘다. 배우 또는 월드 effect가 남아 있는 동안
  입력과 결과 전환을 잠근다.
- 슬라임 공격은 12 FPS, 프레임 4가 impact다. 피해 숫자·피격/사망·흔들림·플래시·피해
  오디오는 이 시점까지 함께 지연된다.
- 우선순위는 사망 > 피격 > 공격 > 회복/아이템 > 이동/상태다. 높은 우선순위 동작은 낮은
  우선순위 비루프 동작을 중단할 수 있고, 비터미널 동작은 완료 후 ambient 클립으로 복귀한다.
- 큰 delta에서도 비루프 클립 완료와 impact는 한 번만 발생한다. 터미널 클립은 완료 상태를
  유지하거나 `hideOnComplete`에 따라 숨고, reset/destroy는 트랙·예약·이벤트를 모두 비운다.
- 전투 결과가 확정돼도 animation coordinator에 impact 예약, 비루프 배우 동작이나 월드 effect가
  남아 있으면 전투 화면을 유지한다. 마지막 동작과 effect가 완료되면 다음 update에서 결과
  화면으로 전환한다.

## 4. 누락 자료와 명시적 폴백

`img2`에서 검토한 Range·Breathing과 로라 action sheet는 정식 `img` 원본으로 이동해 실제
클립으로 적용했다. 수정된 `rora breathing.png`에는 머리뿐 아니라 좌우 몸 레이어도 있어 더
이상 보류하지 않는다. 현재 남은 자료 누락만 다음처럼 명시적으로 폴백한다.

| 요청 | 실제 폴백 | 보조 표현 |
| --- | --- | --- |
| 플레이어 사망 | 같은 방향 Hit 4프레임 | 축소·alpha 감소, 터미널 상태 유지 |
| 상/하 방향의 좌우 전용 플레이어 동작 | 상→left, 하→right의 실제 같은 동작 | `directional` 또는 원거리 의미 메타 |
| 로라 사망 | 같은 방향 Breathing idle | 축소·alpha 감소, 터미널 상태 유지 |

사망 시트나 플레이어 상·하 전용 action 시트가 추가되면 clip 데이터의 `available`, `assetId`,
`frames`만 교체한다. 모델·프레젠터·재생기·뷰의 계약은 바꾸지 않는다.

## 5. 검증

자동 검증은 클립 필수 동작과 시트 경계, 폴백 비순환, 델타 진행, 루프, impact 1회, 우선순위
중단, 큰 delta 잠금 해제, 터미널 완료 1회, destroy, sourceRect UV, 정수 좌표, nearest와 발
앵커를 확인한다.

```text
npm run test:presentation
npm run check:assets
npm test
```

2026-08-28 Turn 16에는 전체 105개 테스트와 PNG 55개 검사가 통과했다. NW.js `0.108.0`
1538×900 화면에서 두 스타터 진입과 활 전투의 첫 로라 공격·HP 게이지를 확인했다. 걷기 네
방향, 검격 두 레이어 정렬, 사망 후 표시 상태와 장시간 층 전환은 실제 키보드 수동 검수로
남긴다.
