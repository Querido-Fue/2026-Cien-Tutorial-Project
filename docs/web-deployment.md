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
현재 `jukchang.com` 루트 페이지를 유지하려면 Cloudflare Worker Route가
`/game/nthplayer` 요청만 프로젝트 Pages로 프록시해야 합니다.

필요한 파일은 다음과 같습니다.

- `scripts/cloudflare/nthplayer-worker.js`: 안전한 GET/HEAD 프록시, Range 요청 전달,
  후행 슬래시 리다이렉트
- `scripts/cloudflare/wrangler.jsonc`: `jukchang.com/game/nthplayer`와
  `jukchang.com/game/nthplayer/*` 두 Route 선언

Cloudflare 계정 인증 후 저장소 루트에서 Wrangler로 배포할 수 있습니다.

```bash
npx wrangler@4 deploy --config scripts/cloudflare/wrangler.jsonc
```

대시보드에서 수동 구성할 때는 Workers & Pages에서 Worker를 만든 뒤 Settings >
Domains & Routes에 아래 두 Route를 연결합니다.

```text
jukchang.com/game/nthplayer
jukchang.com/game/nthplayer/*
```

Worker 배포 후 다음을 확인합니다.

```bash
curl -I https://jukchang.com/game/nthplayer
curl -I https://jukchang.com/game/nthplayer/
curl -I https://jukchang.com/game/nthplayer/asset/font/LanaPixel.ttf
```

첫 요청은 `/game/nthplayer/`로 308 응답해야 하고, 나머지는 200이어야 합니다. 루트
`https://jukchang.com/` 응답은 기존 사이트 그대로여야 합니다.

## 권리 확인

기술 배포가 성공해도 `npm run check:release`가 보고하는 코드 라이선스, 제공 아트·오디오,
런타임 복사본, 외부 참조 아이콘의 배포권 확인은 별도 완료 조건입니다. 공개 URL 운영 전
`manifests/asset-provenance.json`과 `docs/release-candidate-report.md`의 차단 항목을
소유자가 확정하거나 해당 에셋을 교체해야 합니다.
