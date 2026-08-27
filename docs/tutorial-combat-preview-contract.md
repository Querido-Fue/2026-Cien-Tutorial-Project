# 튜토리얼 전투 의도·행동 미리보기 계약

## 1. 목적과 경계

전투 미리보기는 현재 모델 상태를 바꾸지 않고 다음 로라 행동 또는 플레이어 행동 이후의
핵심 상태를 계산한다. 실제 행동과 미리보기는 같은 원자 규칙을 사용하며, 뷰는 피해나
불안정도를 다시 계산하지 않는다.

역할은 다음 세 클래스로 나눈다.

- `TutorialCombatRules`: 행동 가능 여부, 대상, 피해, 불안정도, 아이템 효과의 원자 계산
- `TutorialLoraIntentPlanner`: 턴 시작 패시브와 불안정 상태를 반영한 로라 의도 결정
- `TutorialPlayerActionPreviewer`: 플레이어 행동 계획을 독립 상태에 적용한 이후 상태 예측

`TutorialBattleModel`은 세 클래스를 생성하고 공개 API 및 실제 상태 적용을 조정한다. 세
계산 클래스는 모델을 import하지 않으므로 순환 의존성이 없다.

## 2. 공개 API

### `getLoraIntent()`

다음 정보를 반환한다.

- 현재와 턴 시작 패시브 적용 후의 불안정 상태 ID·라벨
- `none`, `melee`, `area` 중 표시용 `actionType`
- 실제 모델 분기용 `executionAction`
- 단일 대상과 타일 또는 전역 범위를 뜻하는 `affectsAll`
- 피해 단계와 플레이어 예상 HP
- 활·오르골에 의한 불안정도 변경 목록
- 분기마다 고정된 `reason` ID

피해 필드의 의미는 다음과 같다.

| 필드 | 의미 |
| --- | --- |
| `rawDamage` | 현재 로라 불안정 상태가 정한 패시브 적용 전 피해 |
| `passiveDamageBonus` | 활 보유로 로라에게 추가되는 피해 |
| `passiveAdjustedDamage` | 공격 패시브 적용 후, 방어 패시브 적용 전 피해 |
| `damageReduction` | 인형탈·사용 전 낡은 곰인형의 고정 피해 감소 |
| `calculatedDamage` | 공격·방어 패시브를 모두 적용한 피해 |
| `finalDamage` | 현재 플레이어 HP를 상한으로 한 실제 적용 예정 피해 |

근접 공격은 플레이어 타일을 `affectedTiles`에 넣는다. 전역 공격은 개별 타일을 열거하지
않고 `affectsAll: true`로 표시한다. 평화와 무피해 상태는 `actionType: 'none'`이다.

### `previewPlayerAction(action, options)`

`attack`, `heal`, `use-item`, `wait`를 받는다. 성공·실패 모두 호출 전 `before`와 예상
`expected` 상태를 반환하며, 성공 시 HP, 로라 HP, 불안정도, 소모 아이템, 효과, 남은 행동,
추가 턴과 턴 전환을 `changes`에 요약한다.

### `getPlayerActionPreviews()`

근접·활 공격 대상별 미리보기, 회복, 현재 실제 사용 가능한 아이템, 대기를 한 번에 반환한다.
패시브 아이템과 이동 단계 전용 정화제는 아이템 목록에서 제외된다.

## 3. 안정된 reason ID

| 범위 | reason ID |
| --- | --- |
| 공통 성공 | `action-available` |
| 행동 단계 아님 | `action-unavailable` |
| 평화 중 공격 | `peace-active` |
| 잘못된 공격 대상 | `invalid-target` |
| 미보유 아이템 | `item-not-owned` |
| 자동 패시브 아이템 직접 사용 | `passive-item` |
| 이동 단계 전용 아이템 | `movement-item` |
| 이미 사용한 1회성 아이템 | `item-already-used` |
| 지원하지 않는 효과·행동 | `unsupported-item-effect`, `unsupported-action` |
| 로라 단계 아님·이미 수행 | `not-lora-turn`, `lora-turn-already-performed` |
| 로라 평화·무피해 | `peace-active`, `state-no-damage` |
| 로라 근접·전역 판정 | `player-in-melee-range`, `player-outside-melee-range` |

같은 잘못된 단계·대상·아이템은 실제 행동과 미리보기가 같은 reason ID를 사용한다.

## 4. 비변이 보장

계산 경계에서 객체, 배열, `Map`, `Set`을 독립 상태로 복제한다. 미리보기는 모델의
`restoreCheckpoint()`를 호출하거나 실제 모델을 임시 변경한 뒤 되돌리는 방식을 사용하지
않는다. 미리보기 전후의 공개 스냅샷과 전체 체크포인트가 동일해야 한다.

## 5. 회귀 명세

`test/tutorial_combat_preview.test.mjs`는 다음 동등성 표를 정의한다.

- 활 원거리 공격
- 인형탈 피해 감소
- 낡은 곰인형 사용 전·후
- 오르골 평화 턴
- 버섯 활성화와 강화 공격
- 로라의 다섯 불안정 상태
- 회복, 대기, 사용 가능한 아이템 목록
- 잘못된 단계·대상·아이템 reason ID
- 모든 미리보기 전후의 스냅샷·체크포인트 동일성

Turn 07에서는 사용자의 테스트 중단 요청에 따라 이 명세를 작성만 했고 실행하지 않았다.
