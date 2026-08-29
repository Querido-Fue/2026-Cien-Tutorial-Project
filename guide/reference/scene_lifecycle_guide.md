# Scene Lifecycle Guide

## 1. 씬 생성과 전환

`SceneSystem`은 현재 활성 씬을 보관하고, 씬 전환 시 기존 씬을 정리한 뒤 새 씬을 설정합니다.

초기 씬은 `SystemHandler` 생성 옵션으로 주입합니다.

```javascript
new SystemHandler({
    sceneSystem: {
        initialSceneState: 'diagnostic',
        initialSceneFactory: (sceneSystem) => new DiagnosticScene(sceneSystem)
    }
});
```

플레이 씬 전환은 `playSceneFactory`가 등록된 경우에만 동작합니다.

```javascript
new SystemHandler({
    sceneSystem: {
        playSceneFactory: (sceneSystem, options) => new PlayScene(sceneSystem, options)
    }
});

systemHandler.sceneSystem.startPlayScene();
systemHandler.sceneSystem.startBenchmarkScene();
```

## 2. BaseScene 계약

| 메서드 | 호출 주체 | 설명 |
| --- | --- | --- |
| `update(options)` | `SystemHandler.update()` | 가변 프레임 업데이트 |
| `fixedUpdate()` | `SystemHandler.#runFixedStep()` | 고정 스텝 업데이트 |
| `draw()` | `SystemHandler.draw()` | 현재 씬 렌더 |
| `resize()` | `SystemHandler.resize()` | 화면 크기 변경 |
| `applyRuntimeSettings(changedSettings)` | 설정 저장 직후 | 런타임 설정 변경 반영 |
| `applySimulationCommands(commands)` | 프레임 경계 | 명령 큐에서 drain된 시뮬레이션 명령 처리 |
| `destroy()` | 씬 전환 또는 정리 | 리소스 반환 |

## 3. `destroy()` 정리 체크리스트

| 항목 | 방법 | 미정리 시 문제 |
| --- | --- | --- |
| 진행 중인 애니메이션 | `remove(animId)` 호출 | 완료 콜백이 해제된 객체를 참조 |
| UI 요소 풀 | `releaseUIItem(item)` | UI 풀 고갈, 이전 상태 잔류 |
| 오브젝트 풀 | 소유 시스템의 release 계열 호출 | 풀 고갈, 메모리 누수 |
| 동적 surface | 소유 session/system의 release 경로 사용 | DOM/canvas 누수 |
| 이벤트 리스너 | 등록한 리스너 제거 | 해제된 객체에 이벤트 전달 |
| 오버레이 | `OverlayManager.closeByKey()` 또는 씬별 close 경로 | 이전 씬 overlay 잔류 |
| 서브 컴포넌트 | 각 컴포넌트의 `destroy()` 호출 | 내부 애니메이션/리스너 누수 |

## 4. 시뮬레이션 명령 큐

- `enqueueSimulationCommand(command)`는 `{ type: string }` 형태의 명령을 큐에 추가합니다.
- `drainSimulationCommands()`는 프레임 경계에서 모든 명령을 꺼내고 큐를 비웁니다.
- `SystemHandler.update()`는 drain 결과를 `SceneSystem.applySimulationCommands()`로 전달합니다.
- 씬 전환 직전에는 `clearSimulationCommands()`로 이전 씬의 지연 명령을 제거합니다.

예시:

```javascript
enqueueSimulationCommand({
    type: 'open-panel',
    payload: { id: 'debug' }
});

class PlayScene extends BaseScene {
    applySimulationCommands(commands) {
        for (const command of commands) {
            if (command.type === 'open-panel') {
                this.openPanel(command.payload.id);
            }
        }
    }
}
```

## 5. 시뮬레이션 런타임 스냅샷

`SimulationRuntime`은 메인 스레드 전용 싱글톤을 직접 읽지 않도록 뷰포트, 입력, 설정 스냅샷을 제공합니다.

대표 조회 함수:

- `getSimulationRuntimeSnapshot()`
- `getSimulationWW()`, `getSimulationWH()`
- `getSimulationObjectWH()`, `getSimulationObjectOffsetY()`
- `getSimulationUIWW()`, `getSimulationUIOffsetX()`
- `getSimulationMouseInput(key)`
- `hasSimulationMouseState(button, state)`
- `getSimulationMouseFocus()`
- `getSimulationSetting(key, fallback)`
