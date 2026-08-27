# 현재 빌드 기준선

## 기준 정보

- 시작 브랜치: `main`
- 프롬프트 팩 기준 SHA: `82111990f8d22f267b3349416604e3443acdc719`
- 실제 작업 기준 SHA: `90d0e48602f2684983d565669e48e3564d851742`
- 기준선 확인일: 2026-08-27 (Asia/Seoul)
- 런타임: NW.js, 브라우저 Canvas 2D + WebGL, ESM

작업 시작 시 모델 회귀 테스트 12개가 모두 통과했습니다. 점검 도중 `main`에
새 에셋 커밋 `90d0e48`이 추가되어 작업 브랜치는 이 커밋을 기준으로 다시
만들었습니다. 이 커밋은 기존 런타임 에셋을 `project/asset/old`로 옮기고 실제
아트·사운드를 추가하지만, 런타임 선언 경로는 아직 바꾸지 않습니다.

## 실행 구조

```text
project/package.json
└─ project/engine/index.html
   ├─ project/engine/script/main.js
   │  └─ project/engine/script/tutorial_main.js
   │     └─ TutorialScene factory
   └─ project/engine/script/nw-setup.js
```

`TutorialScene`은 입력을 시뮬레이션 명령으로 변환하고,
`TutorialBattleModel`이 9×8 두 층의 결정론적 전투 상태를 소유합니다. 정적
전투 데이터는 `TUTORIAL_GAME_DATA`에 있으며 공용 런타임에서는
`getData(key)`를 통해 읽습니다.

## 기준 검사

```bash
npm test
npm run test:model
npm run check:repo
```

최초 기준 테스트는 다음 명령으로 실행했습니다.

```bash
node --experimental-default-type=module --test test/tutorial_battle_model.test.mjs
```

결과는 12개 통과, 실패 0개입니다. `check:repo`는 데이터 ID와 맵 좌표 오류를
실패로 처리합니다. 현재 선언 경로에 없는 플레이스홀더 에셋은 Turn 12의
매니페스트 통합 전까지 경고로 남기며, `--strict-assets` 또는
`CIEN_STRICT_ASSETS=1`을 사용하면 누락도 실패로 처리할 수 있습니다.

## 주요 파일 크기

| 파일 | 바이트 | 줄 |
| --- | ---: | ---: |
| `project/engine/script/scene/tutorial/_tutorial_scene.js` | 193,876 | 5,241 |
| `project/engine/script/scene/tutorial/_tutorial_battle_model.js` | 81,793 | 1,961 |
| `project/engine/script/data/game/tutorial_game_data.js` | 16,883 | 437 |
| `project/engine/script/sound/sound_system.js` | 10,392 | 289 |
| `test/tutorial_battle_model.test.mjs` | 20,178 | 477 |

## 알려진 위험

- `TutorialScene`이 메뉴, 전투, 결과, 갤러리, 입력, 저장, 렌더링과 에셋
  로딩을 함께 담당하는 5천 줄 이상의 거대 모듈입니다.
- 사용자용 Ctrl+Z/되돌리기 명령, 버튼, 문구와 체크포인트 상태가 여러 위치에
  흩어져 있습니다.
- `SoundSystem`과 `SOUND_CONSTANTS`는 단일 BGM 및 진단 샘플 중심이며 장면,
  사건, UI 버스가 없습니다.
- `FEATURES.CUTSCENES`는 `false`이고 호환 데이터와 컨트롤러만 남아 있습니다.
- 현재 코드의 로라·아이템 플레이스홀더와 단일 BGM 경로는 작업트리의 에셋
  이동 뒤 존재하지 않습니다. Turn 12~14에서 제공된 실제 에셋을 검증하고
  안전한 런타임 경로로 연결해야 합니다.
