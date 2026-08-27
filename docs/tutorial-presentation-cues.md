# 튜토리얼 프레젠테이션 cue 계약

## 1. 경계

`TutorialBattlePresenter`는 모델 결과의 `events`, 이전 snapshot, 새 snapshot을 받아 직렬화
가능한 불변 cue 배열을 만든다. 모델 상태를 변경하지 않으며 장면, 모델 구현, 저장 또는
시뮬레이션 명령 큐를 import하지 않는다. 경로·실패 cue 뒤에서 각 모델 event의 cue 묶음은
입력 event 순서를 유지하며, 같은 입력은 항상 같은 cue를 만든다.

장면은 한 모델 결과를 다음 순서로 전달한다.

1. `TutorialBattlePresenter.createCues()`로 cue를 만든다.
2. `TutorialFeedbackQueue.enqueue()`가 순번과 화면 피드백 수명을 부여한다.
3. `TutorialAnimationTimeline.applyCues()`가 HP·불안정도 표시값을 보간한다.
4. 모델 snapshot과 캐시를 즉시 확정하고, 시각 연출 완료는 별도 시간축에서 기다린다.

## 2. cue 종류와 소비자

| type | 필수·주요 필드 | 현재 소비자 | 의미 |
| --- | --- | --- | --- |
| `event-log` | `message`, `sourceEventType` | feedback queue | 중복을 줄인 전투 로그 |
| `floating-text` | `actorId` 또는 `tile`, `text`, `tone`, `duration` | feedback queue/view | 피해·회복 숫자 |
| `health-transition` | `actorId`, `from`, `to`, `duration` | animation timeline | 플레이어·로라 HP 보간; 몹은 향후 actor 표시 확장 계약 |
| `instability-transition` | `from`, `to`, `change`, `duration` | animation timeline | 로라 불안정도 표시 보간 |
| `actor-animation` | `animationId`, 선택적 `actorId`·`from`·`to` | 장면/timeline 확장 계약 | 행동·피해·텔레포트·층·결과 연출 의도 |
| `screen-shake` | `duration` | feedback queue/layout | 흔들림 남은 시간 |
| `flash` | `duration` | feedback queue/world view | 피격 플래시 남은 시간 |
| `stabilize` | `duration`, `actorId` | feedback queue/world view | 불안정도 감소 표시 |
| `path-particles` | `path`, `count`, `duration` | feedback queue/view | 결정론적 이동 경로 입자 |
| `audio` | `id`, `sourceEventType` | feedback queue | 향후 사운드 구독용 ID; Turn 06에서는 재생하지 않음 |

`actor-animation`은 모델 의미를 보존하는 확장 계약이다. 기존 행동·경로·층 전환 실행은
`TutorialAnimationTimeline`의 명시적 메서드가 계속 담당하며, cue를 이유로 중복 실행하지
않는다. 피해·회복·결과처럼 기존에 독립 actor tween이 없던 항목도 향후 소비자가 모델 event를
다시 해석하지 않도록 ID만 제공한다.

모든 큐 진입 cue에는 `sequence`가 추가된다. 오디오 소비자는
`TutorialFeedbackQueue.drainAudioCues()`로 동일 순서의 ID를 한 번만 가져갈 수 있다.

## 3. 오디오 ID

| ID | 발생 의미 |
| --- | --- |
| `tutorial.damage` | 플레이어·로라·몹의 양수 피해 |
| `tutorial.heal` | 플레이어의 양수 회복 |
| `tutorial.item.pickup` | 아이템 획득 |
| `tutorial.item.use` | 아이템 사용 |
| `tutorial.teleport` | 포탈 이동 |
| `tutorial.event-tile` | 이벤트 타일 발동 |
| `tutorial.floor-transition` | 지하층 전환 |
| `tutorial.battle-result` | 전투 판정 완료 |

이 ID는 경로가 아니다. 실제 파일 선택, 볼륨, 중복 재생 정책과 AudioContext 연결은 향후
사운드 어댑터가 결정한다.

## 4. 모델 event 목록과 현재 cue

모델이 생성하는 전체 26개 타입은 `_tutorial_presentation_contract.js`의
`TUTORIAL_MODEL_EVENT_TYPES`가 단일 문서화 목록이다.

| 모델 event | 현재 생성 cue |
| --- | --- |
| `battle-finished` | log, actor-animation(`battle-result`), audio |
| `event-tile-cleansed` | log |
| `event-tile-triggered` | log, audio |
| `extra-player-turn` | log |
| `floor-transition` | log, actor-animation(`floor-transition`), audio |
| `instability-changed` | log, instability-transition, 감소 시 stabilize |
| `item-dropped` | log |
| `item-picked` | log, audio |
| `item-used` | log, actor-animation(`item-use`), audio |
| `lora-attack` | log, actor-animation(`attack`) |
| `lora-damaged` | log, health-transition, floating-text, actor-animation(`damage`), shake, flash, audio |
| `mob-attack` | log, actor-animation(`attack`) |
| `mob-damaged` | log, health-transition, floating-text, actor-animation(`damage`), shake, flash, audio |
| `mob-defeated` | log |
| `mob-waited` | log |
| `movement-step` | 직접 cue 없음; 확정 경로의 `path-particles`와 timeline 이동이 표현 |
| `mushroom-activated` | log |
| `mushroom-ended` | log |
| `peace` | log |
| `player-damaged` | log, health-transition, floating-text, actor-animation(`damage`), shake, flash, audio |
| `player-healed` | log, health-transition, floating-text, actor-animation(`heal`), audio |
| `player-turn-complete` | 직접 cue 없음; 모델 phase가 HUD를 갱신 |
| `player-turn-started` | 직접 cue 없음; 모델 turn/phase가 HUD를 갱신 |
| `player-waited` | log |
| `teleported` | log, actor-animation(`teleport`), audio |
| `wall-destroyed` | log |

event가 누락됐거나 HP·불안정도 event의 값이 불완전해도 이전/새 snapshot 차이는
`sourceEventType: 'snapshot-sync'` transition cue로 보완한다. 실패한 모델 명령은
`sourceEventType: 'action-failed'`의 log cue만 만들고 모델 상태를 되돌리거나 추측하지 않는다.

## 5. 수명과 취소

- 로그는 설정된 최대 개수까지만 보존하고 연속 중복 문구를 추가하지 않는다.
- 떠오르는 글자와 입자는 가변 프레임 `deltaSeconds`로 수명을 줄인다.
- 흔들림·플래시·안정화는 같은 종류가 겹치면 더 긴 남은 시간을 유지한다.
- 경로 입자 속도는 cue 순번·입자 index·타일 좌표로 계산해 `Math.random()`에 의존하지 않는다.
- 애니메이션 타임라인은 소유 ID와 slot을 정리한다. 겹친 연출의 잠금은 토큰별로 해제하고,
  `cancel()` 이후 도착한 이전 세대 Promise callback은 새 런 상태를 변경하거나 잠금을 풀지 않는다.
- feedback queue의 `destroy()`는 잔여 cue 상태를 비우고, asset loader의 `destroy()`는 잔여
  상태와 이미지 callback을 함께 제거한다.
