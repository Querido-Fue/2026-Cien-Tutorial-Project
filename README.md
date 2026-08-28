# N번째 플레이어

NW.js·웹 브라우저와 Canvas/WebGL 기반의 2D 턴제 전술 프로토타입입니다. 기본 진입점은
`project/engine/index.html`이며 전투 규칙은 화면과 분리된
`TutorialBattleModel`이 담당합니다.

## 지원 환경과 실행

- 자동 검사: Node.js `22.18.0`(CI 고정 버전)과 npm
- 데스크톱 런타임·패키징: 공식 `nwjs-v0.108.0-win-x64`
- 웹 런타임: 최신 Chromium, Firefox, Safari와 GitHub Pages 정적 호스팅
- 지원 패키지: Windows x64만 해당합니다. macOS/Linux 결과물은 현재 계약과 검증기가
  없으므로 Windows 결과물을 이름만 바꿔 배포하지 않습니다.

개발 실행은 공식 NW.js `0.108.0` Windows x64 압축을 푼 뒤 저장소의 `project` 내용을
그 런타임 폴더에 두고 `nw.exe`를 실행합니다. `project/package.json`은 최소 1280×720 창과
`engine/index.html` 진입점을 선언합니다. NW.js 바이너리는 저장소에 커밋하지 않습니다.

웹 번들은 `npm run build:web`으로 `dist/web`에 생성합니다. `main` 브랜치 push는
`.github/workflows/pages.yml`을 통해 전체 검증 뒤 GitHub Pages에 자동 배포됩니다. 로컬
실행과 `jukchang.com/game/nthplayer` 경로 프록시 구성은
[`docs/web-deployment.md`](docs/web-deployment.md)를 확인합니다.

## 재현 가능한 Windows 패키징

PowerShell에서 공식 `nwjs-v0.108.0-win-x64.zip`을 새 폴더에 풀고 다음 중 하나를
사용합니다.

```powershell
$env:NWJS_HOME = 'C:\tools\nwjs-v0.108.0-win-x64'
npm run package:nwjs

# 또는
npm run package:nwjs -- --nwjs-home 'C:\tools\nwjs-v0.108.0-win-x64' --output 'dist\nth-player-win-x64'
```

입력 폴더 이름, `nw.exe` 제품 버전, 필수 DLL·PAK·locale 구조가 정확히 일치하지 않으면
패키징은 중단됩니다. 결과물은 기본적으로 `dist/nth-player-win-x64`에 생성되며 실행 파일은
`nth-player.exe`입니다. 기존 출력 폴더를 덮어쓰지 않고, 런타임에 필요한 엔진·안전 복사
에셋·폰트·아이콘·라이선스·제3자 고지만 allowlist로 복사합니다. 원본 작업 아트,
`project/save`, 저장소의 NW.js 바이너리는 포함하지 않습니다.

## 검사 방법

저장소 루트에서 Node.js와 npm을 사용합니다. 의존성은 lockfile 기준으로 설치합니다.

```bash
npm ci --ignore-scripts
npm test
npm run check:release
npm run test:release
npm run test:model
npm run test:balance
npm run test:contracts
npm run test:presentation
npm run test:assets
npm run test:audio
npm run import:assets
npm run check:assets
npm run check:repo
npm run simulate:balance
npm run test:web
npm run build:web
```

- `npm test`: 전체 Node 회귀 테스트와 에셋·저장소·릴리스 감사를 한 번에 실행합니다.
- `npm run check:release`: import 해석·순환, 런타임 경로, 임시 코드, 메타 버전,
  CI·lockfile·NW.js 고정 계약과 모든 에셋의 출처 상태를 검사합니다.
- `npm run test:release`: 릴리스 감사기와 격리된 가짜 NW.js 패키징 계약을 검사합니다.
- `npm run test:model`: 9×8 두 층 전투 모델의 기준 동작을 검사합니다.
- `npm run test:balance`: 결정론적 밸런스 하네스의 재현성·명령 상한·공개 API 경계를 검사합니다.
- `npm run test:contracts`: 장면 seam, 비전투 화면, 콘텐츠·메타 계약을 검사합니다.
- `npm run test:presentation`: 전투 cue, 애니메이션 타임라인과 스프라이트 계약을 검사합니다.
- `npm run test:assets`: 매니페스트, loader crop/fallback, 맵 투영과 픽셀 보간 계약을 검사합니다.
- `npm run test:audio`: Fake Audio로 세 버스, crossfade, 중복·동시 재생 제한, 일시정지와 설정 이관을 검사합니다.
- `npm run import:assets`: 원본을 보존하며 `project/asset/tutorial/`에 ASCII 런타임 이름으로 안전 복사합니다.
- `npm run check:assets`: 원본·복사본 PNG 55개와 MP3 26개의 헤더·해시·경로·폴백 계약을 검사합니다.
- `npm run check:repo`: 데이터 ID, 맵 좌표, 선언된 에셋 경로를 검사합니다.
- `npm run simulate:balance`: 두 스타터와 네 설명형 전략의 8개 시나리오를 실행하고
  무시되는 `reports/tutorial-balance-report.json`을 갱신합니다. 파일을 쓰지 않고
  JSON만 보려면 `npm run simulate:balance -- --json --no-write`를 사용합니다.
- `npm run test:web`: 브라우저 저장 어댑터, Pages 정적 번들, Cloudflare 경로 프록시를 검사합니다.
- `npm run build:web`: Pages와 경로 프록시에서 실행할 상대 URL 기반 정적 번들을 생성합니다.

아트와 사운드는 각각 `TUTORIAL_ASSET_MANIFEST`, `TUTORIAL_AUDIO_MANIFEST`와
`check:assets`가 엄격하게 검사합니다. 제공되지 않은 지하층 BGM은 1층 곡으로 명시적
폴백하며 누락 파일을 런타임 경로로 가장하지 않습니다.

## 저장소 구조

| 경로 | 역할 |
| --- | --- |
| `project/engine/` | NW.js·브라우저 공용 HTML 진입점, 엔진, 튜토리얼 런타임 |
| `project/asset/` | 게임 아트, 폰트, 사운드 원본 및 런타임 에셋 |
| `project/license/` | 배포 에셋 라이선스 |
| `test/` | Node 기반 회귀 테스트 |
| `scripts/` | 저장소·에셋·릴리스 검증, NW.js·웹 패키징, Cloudflare 프록시, 밸런스 도구 |
| `manifests/` | 에셋 출처·권리 상태의 기계 판독 매니페스트 |
| `.github/workflows/` | Node 22.18.0 CI와 GitHub Pages 자동 배포 |
| `docs/` | 현재 빌드 기준선과 개발 문서 |

아트 원본은 `project/asset/img`과 `project/asset/old`에 보존하고,
안전한 런타임 복사본은 `project/asset/tutorial`에 둡니다. 매핑과 임의 결정은
[`docs/tutorial-asset-integration.md`](docs/tutorial-asset-integration.md)에 기록합니다.
오디오 버스, cue, 폴백과 임의 믹싱 결정은
[`docs/tutorial-audio.md`](docs/tutorial-audio.md)에 기록합니다.

## 공개 릴리스 상태

코드의 내부 RC 검증, Windows 패키징과 웹 배포 계약은 준비됐지만 공개 배포권 감사는 미완료입니다.
프로젝트 코드 라이선스, 제공 아트·오디오의 원본별 배포 권리, 외부 게임을 참조한 네 아이템
표현을 먼저 확정하거나 교체해야 합니다. 상세 근거와 완료 조건은
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md),
[`manifests/asset-provenance.json`](manifests/asset-provenance.json),
[`docs/release-candidate-report.md`](docs/release-candidate-report.md)를 확인합니다.
