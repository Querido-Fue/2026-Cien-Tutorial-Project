# N번째 플레이어

NW.js와 Canvas/WebGL 기반의 2D 턴제 전술 프로토타입입니다. 기본 진입점은
`project/engine/index.html`이며 전투 규칙은 화면과 분리된
`TutorialBattleModel`이 담당합니다.

## 실행 방법

1. NW.js 배포본을 내려받아 압축을 풉니다.
2. 이 저장소의 `project` 폴더 안에 있는 `asset`, `engine`, `license`,
   `package.json`을 NW.js 실행 파일과 같은 디렉터리에 복사합니다.
3. Windows에서는 `nw.exe`를 실행합니다.

`project/package.json`은 최소 1280×720 창과
`engine/index.html` 진입점을 선언합니다. NW.js 바이너리는 저장소에 포함하지
않습니다.

## 검사 방법

저장소 루트에서 Node.js와 npm을 사용합니다. 별도 런타임 패키지를 설치하지
않아도 됩니다.

```bash
npm test
npm run test:model
npm run test:balance
npm run test:assets
npm run test:audio
npm run import:assets
npm run check:assets
npm run check:repo
npm run simulate:balance
```

- `npm test`: 현재 모델 회귀 테스트와 저장소 정적 검사를 한 번에 실행합니다.
- `npm run test:model`: 9×8 두 층 전투 모델의 기준 동작을 검사합니다.
- `npm run test:balance`: 결정론적 밸런스 하네스의 재현성·명령 상한·공개 API 경계를 검사합니다.
- `npm run test:assets`: 매니페스트, loader crop/fallback, 맵 투영과 픽셀 보간 계약을 검사합니다.
- `npm run test:audio`: Fake Audio로 세 버스, crossfade, 중복·동시 재생 제한, 일시정지와 설정 이관을 검사합니다.
- `npm run import:assets`: 원본을 보존하며 `project/asset/tutorial/`에 ASCII 런타임 이름으로 안전 복사합니다.
- `npm run check:assets`: 원본·복사본 PNG 39개와 MP3 26개의 헤더·해시·경로·폴백 계약을 검사합니다.
- `npm run check:repo`: 데이터 ID, 맵 좌표, 선언된 에셋 경로를 검사합니다.
- `npm run simulate:balance`: 두 스타터와 네 설명형 전략의 8개 시나리오를 실행하고
  무시되는 `reports/tutorial-balance-report.json`을 갱신합니다. 파일을 쓰지 않고
  JSON만 보려면 `npm run simulate:balance -- --json --no-write`를 사용합니다.

아트와 사운드는 각각 `TUTORIAL_ASSET_MANIFEST`, `TUTORIAL_AUDIO_MANIFEST`와
`check:assets`가 엄격하게 검사합니다. 제공되지 않은 지하층 BGM은 1층 곡으로 명시적
폴백하며 누락 파일을 런타임 경로로 가장하지 않습니다.

## 저장소 구조

| 경로 | 역할 |
| --- | --- |
| `project/engine/` | NW.js HTML 진입점, 엔진, 튜토리얼 런타임 |
| `project/asset/` | 게임 아트, 폰트, 사운드 원본 및 런타임 에셋 |
| `project/license/` | 배포 에셋 라이선스 |
| `test/` | Node 기반 회귀 테스트 |
| `scripts/` | 저장소·에셋 검증 및 공개 모델 API 기반 밸런스 시뮬레이션 도구 |
| `docs/` | 현재 빌드 기준선과 개발 문서 |

아트 원본은 `project/asset/img`과 `project/asset/old`에 보존하고,
안전한 런타임 복사본은 `project/asset/tutorial`에 둡니다. 매핑과 임의 결정은
[`docs/tutorial-asset-integration.md`](docs/tutorial-asset-integration.md)에 기록합니다.
오디오 버스, cue, 폴백과 임의 믹싱 결정은
[`docs/tutorial-audio.md`](docs/tutorial-audio.md)에 기록합니다.
