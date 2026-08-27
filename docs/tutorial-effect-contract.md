# 튜토리얼 조건→효과 계약

## 목적과 경계

아이템과 이벤트 타일의 수치 효과는 `TUTORIAL_GAME_DATA`의 `effects[]`, 안정 ID만 소유하는
`_tutorial_effect_contract.js`, 데이터를 검증·정규화하는 `TutorialEffectRegistry`, 계산만
수행하는 `TutorialEffectExecutor`가 함께 정의한다. 전투 모델은 executor가 만든 계획을 상태와
기존 모델 event로 반영하고, 화면은 효과를 다시 계산하지 않는다.

경로 탐색, 포탈 이동, 층 전환, 행동 충전 소비, 전투 종료 같은 상태 머신 불변식은 이
계약으로 옮기지 않는다. `onAcquire`도 예약된 트리거이지만 현재 아이템 획득·인벤토리 추가와
식별 지식 갱신은 모델 수명주기로 유지한다.

## 트리거

| ID | 실행 시점 | 현재 사용처 |
| --- | --- | --- |
| `onAcquire` | 아이템 획득 직후 | 예약. 인벤토리 수명주기는 모델에 유지 |
| `onUse` | 사용형 아이템 계획 | 안정, 평화, 추가 턴, 버섯, 타일 정화 |
| `onTurnStart` | 액터 턴 시작 계산 | 활, 오르골, 헤이스트 |
| `onTurnEnd` | 액터 턴 종료 계산 | 인형탈 |
| `onMoveEnter` | 이동 범위·벽 통과·타일 진입 | 버섯, 곡괭이, 네 이벤트 타일 |
| `onBeforeDamage` | 플레이어 피해 확정 전 | 인형탈, 낡은 곰인형, 버섯 종료 |
| `onBeforeInstabilityChange` | 불안정도 상하한 적용 전 | 오카리나 증가 억제 |
| `onAttack` | 플레이어·로라 공격 수치 계산 | 활, 낡은 곰인형, 버섯 |

## operation vocabulary

operation ID는 저장·표시용 문구가 아니라 계산 계약이다. 같은 ID의 의미를 바꾸지 않는다.

| 영역 | operation ID |
| --- | --- |
| 공격 | `set-ranged-damage`, `change-damage-flat`, `multiply-damage` |
| 방어 | `reduce-damage-flat`, `end-mushroom-on-damage`, `deal-player-damage` |
| 불안정도 | `change-instability-flat`, `scale-instability-current`, `suppress-positive-instability` |
| 턴·상태 | `set-peace-turns-min`, `add-extra-player-turns`, `set-mushroom-active`, `add-actions-per-turn` |
| 이동·타일 | `multiply-move-range`, `grant-wall-traversal`, `reduce-remaining-moves`, `replace-event-tile-type` |

각 effect는 전역에서 유일한 `id`, 알려진 `trigger`, 알려진 `operation`, 0 이상의 정수
`order`를 가져야 한다. 선택적인 `conditions[]`와 기존 모델 event의 `source`도 데이터에서
명시한다. 알 수 없는 ID, 중복 ID, 잘못된 값 형식, 존재하지 않는 이벤트 타일 치환 대상은
`TutorialBattleModel` 생성 중 registry 검사에서 예외로 드러나며 조용히 무시되지 않는다.
턴·행동·남은 이동 횟수 operation의 값은 0 이상의 정수만 허용한다.

## 순서와 preview/apply

효과는 `order` 오름차순, 데이터 원본 순서, 배열 선언 순서, effect ID 순으로 안정 정렬된다.
현재 공격은 원거리 원시 피해 설정(100), 고정 증감(200), 배율(300) 순서다. 피해 감소 뒤
버섯 종료 판정은 900에서 실행한다.

`mode: 'preview' | 'apply'`는 호출 목적만 기록한다. operation handler는 mode에 따라 다른
수치를 만들면 안 된다. 미리보기와 실제 행동은 모두 같은 executor 결과를 사용하며, apply
호출부만 계산 결과를 모델 상태와 기존 event에 반영한다.

## 명시적 context

executor에는 필요한 값만 전달한다. 대표 필드는 다음과 같다.

- `itemIds`, `actor`, `target`, `weapon`
- `baseDamage`, `playerHp`, `mushroomActive`
- `instability`, `maxInstability`, `requestedInstabilityChange`
- `peaceTurns`, `extraPlayerTurns`, `baseActionsPerTurn`
- `baseMoveRange`, `remainingMoves`, `eventTileType`

소비 뒤 유지되는 오르골·버섯은 활성 상태를 만든 operation을 기준으로 효과 원본을 다시
포함한다. 호출부에서 아이템 ID별 지속 효과 switch를 만들지 않는다.

## 새 콘텐츠 추가 예시

기존 vocabulary로 “플레이어 턴 종료 시 불안정도 7 감소” 패시브를 추가하는 예시다.

```js
{
    id: 'sample-charm',
    label: '샘플 부적',
    passive: true,
    effects: [
        {
            id: 'sample-charm-turn-end-instability',
            trigger: 'onTurnEnd',
            operation: 'change-instability-flat',
            order: 100,
            conditions: ['actor-player'],
            value: -7,
            source: 'sample-charm'
        }
    ]
}
```

이 경우 아이템 ID switch를 수정하지 않는다. 완전히 새로운 계산 의미가 필요할 때만 새
operation ID, 값 검사, 단일 handler와 preview/apply 동등성 사례를 함께 추가한다.

## 이벤트와 호환성

`damage`, `move-penalty`, `instability-up`, `instability-down`은
`EVENT_TILE_EFFECTS`에서 같은 operation을 사용한다. 층 데이터의 `eventTiles[].type`은 이
레지스트리 키를 참조한다.

외부에 노출되는 `item-used`, `player-damaged`, `instability-changed`,
`event-tile-triggered`, `event-tile-cleansed` 등 기존 모델 event 타입과 기존 reason ID는
유지한다. executor operation ID를 화면 문구나 사운드 ID로 직접 사용하지 않는다.

## 금지 패턴

- 아이템 ID별 거대한 `if`/`switch`에서 수치 재계산
- 미리보기 전용 피해·불안정도 공식 복제
- operation handler가 `mode`에 따라 다른 결과 생성
- 화면 또는 presenter에서 모델 효과 적용
- 알 수 없는 operation·condition을 기본값으로 무시
- 포탈, 경로 탐색, 턴 전이, 종료 조건을 범용 effect 언어로 이관
- 같은 수치를 `RULES`와 `effects[]`에 중복 보관
