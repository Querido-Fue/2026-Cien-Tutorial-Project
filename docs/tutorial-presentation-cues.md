# 튜토리얼 프레젠테이션 cue 계약

## 1. 경계

`TutorialBattlePresenter`는 모델 결과의 `events`, 이전 snapshot, 새 snapshot을 받아 직렬화
가능한 불변 cue 배열을 만든다. 모델 상태를 변경하지 않으며 장면, 모델 구현, 저장 또는
시뮬레이션 명령 큐를 import하지 않는다. 경로·실패 cue 뒤에서 각 모델 event의 cue 묶음은
입력 event 순서를 유지하며, 같은 입력은 항상 같은 cue를 만든다.

장면은 한 모델 결과를 다음 순서로 전달한다.

1. `TutorialBattlePresenter.createCues()`로 cue를 만든다.
2. `TutorialSpriteCueRouter.route()`가 배우 동작을 시작하고 피해 cue를 공격 impact까지 지연한다.
3. `TutorialFeedbackQueue.enqueue()`가 순번과 화면 피드백 수명을 부여한다.
4. `TutorialAnimationTimeline.applyCues()`가 HP·불안정도 표시값을 보간한다.
5. `TutorialAudioDirector`가 feedback queue에서 준비된 오디오 cue를 한 번 drain한다.
6. 모델 snapshot과 캐시를 즉시 확정하고, 시각 연출 완료는 별도 시간축에서 기다린다.

## 2. cue 종류와 소비자

| type | 필수·주요 필드 | 현재 소비자 | 의미 |
| --- | --- | --- | --- |
| `event-log` | `message`, `sourceEventType` | feedback queue | 중복을 줄인 전투 로그 |
| `floating-text` | `actorId` 또는 `tile`, `text`, `tone`, `duration` | feedback queue/view | 피해·회복 숫자 |
| `health-transition` | `actorId`, `from`, `to`, `duration` | animation timeline | 플레이어·로라 HP 보간; 몹은 향후 actor 표시 확장 계약 |
| `instability-transition` | `from`, `to`, `change`, `duration` | animation timeline | 로라 불안정도 표시 보간 |
| `actor-animation` | `animationId`, `actorId`, 선택적 `facing`·`waitForImpact` | sprite cue router | 배우 클립 시작 또는 공격 impact 시점의 피격·사망 예약 |
| `screen-shake` | `duration` | feedback queue/layout | 흔들림 남은 시간 |
| `flash` | `duration` | feedback queue/world view | 피격 플래시 남은 시간 |
| `stabilize` | `duration`, `actorId` | feedback queue/world view | 불안정도 감소 표시 |
| `path-particles` | `path`, `count`, `duration` | feedback queue/view | 결정론적 이동 경로 입자 |
| `audio` | `id`, `sourceEventType` | feedback queue → audio director | 매니페스트의 버스·파일 정책으로 재생할 안정 의미 ID |

`actor-animation`은 모델 의미를 보존하는 실행 계약이다. `TutorialSpriteCueRouter`는
`actorId`·`animationId`·`facing`만 재생기에 전달한다. 공격에 종속된 피격·사망 cue에는
`impactActorId`, `impactAnimationId`, `impactFacing`, `waitForImpact`를 기록하고, 같은 impact
지연을 떠오르는 글자·흔들림·플래시·오디오에도 `delaySeconds`로 전달한다. 경로 이동·층 전환
tween은 계속 `TutorialAnimationTimeline`이 담당해 중복 이동을 만들지 않는다.

모든 큐 진입 cue에는 `sequence`가 추가된다. 오디오 소비자는
`TutorialFeedbackQueue.drainAudioCues()`로 동일 순서의 ID를 한 번만 가져갈 수 있다.

## 3. 오디오 ID

| ID | 발생 의미 |
| --- | --- |
| `sfx.player.footstep` | 플레이어 걷기 클립의 지정 프레임 통과 |
| `sfx.player.melee`, `sfx.player.ranged` | 플레이어 공격 시작 |
| `sfx.player.heal/hurt/death` | 플레이어 회복·피격·사망 |
| `sfx.lora.melee`, `sfx.lora.area` | 로라 공격 시작 |
| `sfx.lora.hurt/death` | 로라 피격·사망 impact |
| `sfx.slime.hurt` | 슬라임 피격 impact |
| `sfx.item.equip`, `sfx.item.apply` | 아이템 획득/장착·사용 |
| `sfx.world.teleport`, `sfx.world.floor-break` | 포탈 이동·지하층 붕괴 |

이 ID는 경로가 아니다. 실제 파일, 버스, 볼륨, cooldown/polyphony와 fallback은
`TUTORIAL_AUDIO_MANIFEST`가 결정하고 세부 계약은 `tutorial-audio.md`에 둔다.

## 4. 모델 event 목록과 현재 cue

모델이 생성하는 전체 28개 타입은 `_tutorial_presentation_contract.js`의
`TUTORIAL_MODEL_EVENT_TYPES`가 단일 문서화 목록이다.

| 모델 event | 현재 생성 cue |
| --- | --- |
| `battle-finished` | log, actor-animation(`battle-result`); 결과 BGM은 장면 상태가 선택 |
| `event-tile-cleansed` | log |
| `event-tile-triggered` | log; 제공 전용 효과음이 없어 오디오 없음 |
| `extra-player-turn` | log |
| `floor-transition` | log, actor-animation(`floor-transition`), floor-break audio |
| `instability-changed` | log, instability-transition, 감소 시 stabilize |
| `item-dropped` | log |
| `item-picked` | log, item-equip audio |
| `record-picked` | log, item-equip audio; scene이 해당 기록의 갤러리 책 팝업을 연다 |
| `item-used` | log, actor-animation(`item`), item-apply audio |
| `lora-attack` | log, actor-animation(`melee`/`area`/`idle`), 비대기 시 공격 audio |
| `lora-damaged` | log, health-transition, 플레이어 공격 audio, impact 지연 floating-text·actor-animation(`hit`/`death`)·shake·flash·hurt/death audio |
| `mob-attack` | 피해 event와 결합해 공격 source actor-animation(`attack`) |
| `mob-damaged` | log, health-transition, 플레이어 공격 시작/audio, impact 지연 floating-text·actor-animation(`hit`/`death`)·shake·flash·slime-hurt audio |
| `mob-defeated` | log |
| `mob-waited` | log |
| `movement-step` | 직접 cue 없음; 확정 경로의 `path-particles`와 timeline 이동이 표현 |
| `mushroom-activated` | log |
| `mushroom-ended` | log |
| `peace` | log |
| `player-damaged` | log, health-transition, 로라/몹 공격과 결합한 impact 지연 floating-text·actor-animation(`hit`/`death`)·shake·flash·hurt/death audio |
| `player-healed` | log, health-transition, floating-text, actor-animation(`heal`), audio |
| `player-turn-complete` | 직접 cue 없음; 모델 phase가 HUD를 갱신 |
| `player-turn-started` | 직접 cue 없음; 모델 turn/phase가 HUD를 갱신 |
| `player-waited` | log |
| `teleported` | log, actor-animation(`teleport`), audio |
| `wall-destroyed` | log |
| `wall-traversed` | 직접 cue 없음; 업적 판정기가 실제 곡괭이 벽 통과를 식별 |

event가 누락됐거나 HP·불안정도 event의 값이 불완전해도 이전/새 snapshot 차이는
`sourceEventType: 'snapshot-sync'` transition cue로 보완한다. 실패한 모델 명령은
`sourceEventType: 'action-failed'`의 log cue만 만들고 모델 상태를 되돌리거나 추측하지 않는다.

## 5. 수명과 취소

- 로그는 설정된 최대 개수까지만 보존하고 연속 중복 문구를 추가하지 않는다.
- 떠오르는 글자와 입자는 가변 프레임 `deltaSeconds`로 수명을 줄인다.
- 흔들림·플래시·안정화는 같은 종류가 겹치면 더 긴 남은 시간을 유지한다.
- 지연 cue는 가변 프레임 `deltaSeconds`로 impact까지 대기하며, reset·destroy 시 context와 함께 제거한다.
- 경로 입자 속도는 cue 순번·입자 index·타일 좌표로 계산해 `Math.random()`에 의존하지 않는다.
- 애니메이션 타임라인은 소유 ID와 slot을 정리한다. 겹친 연출의 잠금은 토큰별로 해제하고,
  `cancel()` 이후 도착한 이전 세대 Promise callback은 새 런 상태를 변경하거나 잠금을 풀지 않는다.
- feedback queue의 `destroy()`는 잔여 cue 상태를 비우고, asset loader의 `destroy()`는 잔여
  상태와 이미지 callback을 함께 제거한다.
