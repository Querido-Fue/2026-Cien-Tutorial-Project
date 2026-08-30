# 웹 배포

## 배포 구조

게임 소스는 NW.js와 브라우저가 같은 `project/engine/index.html`을 사용합니다.
`npm run build:web`은 `dist/web`에 정적 번들을 만들고 모든 런타임 에셋 URL을 문서 기준
상대 경로로 바꿉니다. 따라서 GitHub 프로젝트 Pages의 저장소 하위 경로와 Cloudflare가
제공하는 `/game/nthplayer/` 경로 모두에서 같은 빌드를 사용할 수 있습니다.

GitHub Pages 기준 원본 URL은 다음과 같습니다.

```text
https://querido-fue.github.io/2026-Cien-Tutorial-Project/
```

`.github/workflows/pages.yml`은 `main` push마다 의존성 설치, 전체 테스트·감사, 웹 빌드,
Pages artifact 업로드와 배포를 순서대로 수행합니다. `dist/web`은 생성물이므로 Git에서
추적하지 않습니다.

## 로컬 검증

```bash
npm ci --ignore-scripts
npm test
npm run build:web
python -m http.server 4173 --directory dist/web
```

브라우저에서 `http://127.0.0.1:4173/`을 엽니다. 웹 저장 데이터는
`jukchang.nthplayer.fs.v1` 네임스페이스 아래의 동일 출처 `localStorage`에 저장됩니다.
GitHub Pages 주소와 `jukchang.com` 주소는 서로 다른 출처이므로, Pages에서 먼저 만든
저장 데이터가 사용자 도메인으로 자동 이관되지는 않습니다.

## jukchang.com 경로 연결

GitHub Pages custom domain은 도메인 단위이고 임의의 중첩 경로만 지정할 수 없습니다.
현재 `jukchang.com` 루트의 준비 중 화면을 유지하면서 게임과 발표 경로를 제공하려면
Cloudflare Worker가 apex와 `www` 요청을 받아야 합니다. Worker는 `/game/nthplayer`를
프로젝트 Pages로 프록시하고, `/ppt/nthplayer/`는 Worker 정적 자산 바인딩의 발표 셸을
반환하며, 나머지 경로에는 기존과 같은 준비 중 화면을 반환합니다.

apex A 레코드는 프록시된 상태로 GoDaddy의 현재 외부 도메인 원본
`13.248.243.5`를 가리킵니다. 이전 `160.153.0.8`은 다른 Cloudflare 종단이어서 요청이
이 zone의 Worker Route보다 먼저 해당 서비스로 넘어갔고, 등록된 Route가 실행되지
않았습니다.

필요한 파일은 다음과 같습니다.

- `scripts/cloudflare/nthplayer-worker.js`: 안전한 GET/HEAD 프록시, Range 요청 전달,
  게임·발표 경로의 후행 슬래시 리다이렉트, 발표 자산 보안 헤더, 루트 준비 중 화면
- `scripts/cloudflare/wrangler.jsonc`: apex와 `www`의 HTTPS Route 및
  `project/presentation/public` 정적 자산 바인딩 선언
- `project/presentation/public/ppt/nthplayer/`: 15개 장면, 연속 파노라마 카메라와 텍스트
  전환, 동일 출처 게임 iframe 프리로드·슬롯/전체 화면 전환 API

Cloudflare 계정 인증 후 저장소 루트에서 Wrangler로 배포할 수 있습니다.

```bash
npx wrangler@4 deploy --config scripts/cloudflare/wrangler.jsonc
```

대시보드에서 수동 구성할 때는 Workers & Pages에서 Worker를 만든 뒤 Settings >
Domains & Routes에 아래 두 Route를 연결합니다.

```text
https://jukchang.com/*
https://www.jukchang.com/*
```

Worker 배포 후 다음을 확인합니다.

```bash
curl -I https://jukchang.com/game/nthplayer
curl -I https://jukchang.com/game/nthplayer/
curl -I https://jukchang.com/game/nthplayer/asset/font/OwnglyphParkDahyun.ttf
curl -I https://jukchang.com/ppt/nthplayer
curl -I https://jukchang.com/ppt/nthplayer/
```

슬래시가 없는 두 기준 경로는 각각 슬래시가 있는 URL로 308 응답해야 하고, 게임·발표
문서와 게임 폰트는 200이어야 합니다. 발표 문서는 첫 장부터
`/game/nthplayer/` iframe을 숨긴 상태로 한 번만 미리 로드하고, 12번째 프로토타입 장에서
같은 iframe을 드러냅니다. 전체화면 버튼은 0.6초 `easeOutExpo`로 뷰포트를 채우며 Escape는
원래 슬롯으로 복귀해야 합니다. 루트 `https://jukchang.com/`은 `Coming Soon!` 준비 중
화면을 반환해야 합니다. GoDaddy 본 사이트를 공개할 때는 Worker의 루트 응답 정책과 DNS
원본을 함께 재검토해야 합니다.

## 권리 확인

기술 배포가 성공해도 `npm run check:release`가 보고하는 코드 라이선스, 제공 아트·오디오,
런타임 복사본, 외부 참조 아이콘의 배포권 확인은 별도 완료 조건입니다. 공개 URL 운영 전
`manifests/asset-provenance.json`과 `docs/release-candidate-report.md`의 차단 항목을
소유자가 확정하거나 해당 에셋을 교체해야 합니다.
