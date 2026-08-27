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
npm run check:repo
npm run simulate:balance
```

- `npm test`: 현재 모델 회귀 테스트와 저장소 정적 검사를 한 번에 실행합니다.
- `npm run test:model`: 9×8 두 층 전투 모델의 기준 동작을 검사합니다.
- `npm run test:balance`: 결정론적 밸런스 하네스의 재현성·명령 상한·공개 API 경계를 검사합니다.
- `npm run check:repo`: 데이터 ID, 맵 좌표, 선언된 에셋 경로를 검사합니다.
- `npm run simulate:balance`: 두 스타터와 네 설명형 전략의 8개 시나리오를 실행하고
  무시되는 `reports/tutorial-balance-report.json`을 갱신합니다. 파일을 쓰지 않고
  JSON만 보려면 `npm run simulate:balance -- --json --no-write`를 사용합니다.

현재 선언 경로에서 찾지 못한 플레이스홀더 에셋은 `check:repo`가 경고로
보고합니다. 실제 아트·사운드 매니페스트와 엄격한 에셋 검사는 순차 통합의
후속 단계에서 도입할 예정입니다.

## 저장소 구조

| 경로 | 역할 |
| --- | --- |
| `project/engine/` | NW.js HTML 진입점, 엔진, 튜토리얼 런타임 |
| `project/asset/` | 게임 아트, 폰트, 사운드 원본 및 런타임 에셋 |
| `project/license/` | 배포 에셋 라이선스 |
| `test/` | Node 기반 회귀 테스트 |
| `scripts/` | 저장소·에셋 검증 및 공개 모델 API 기반 밸런스 시뮬레이션 도구 |
| `docs/` | 현재 빌드 기준선과 개발 문서 |

아트·사운드 스테이징 디렉터리와 안전한 런타임 파일명 매핑은 아직 도입하지
않았습니다. 원본 에셋을 임의로 이동하거나 이름을 바꾸지 마세요.
