# Third-party notices and release-rights status

이 문서는 저장소와 Windows 패키징 결과에 포함되는 코드·폰트·아트·오디오의
현재 출처 상태를 기록한다. 상세한 기계 판독 목록은
`manifests/asset-provenance.json`에 있다. “차단”은 파일을 숨기거나 삭제했다는
뜻이 아니라, 공개 릴리스 전에 권리 증빙 또는 교체가 필요하다는 뜻이다.

## PF 스타더스트 3.0

- 파일: `project/asset/font/PFStardustS.ttf`, `PFStardustBold.ttf`, `PFStardustExtraBold.ttf`
- 원본 파일명: `PF스타더스트 3.0 S.ttf`, `PF스타더스트 3.0 Bold.ttf`, `PF스타더스트 3.0 ExtraBold.ttf`
- 저작권: Copyright © 2018 Pinnata, All Rights Reserved.
- 출처: https://m.blog.naver.com/campanula913/221366697603
- 사용 조건: 개인·기업의 상업적 사용과 웹·프로그램 임베딩 가능(사용자 확인, 2026-08-31)
- 제한: 제작자 허가 없는 폰트 파일 수정·재배포·유상 판매 금지(웹·프로그램 임베딩은 별도 허용)
- 상태: 원본 바이트를 수정하지 않고 게임과 배포 결과에 임베딩
- 상세 고지: `project/license/pf-stardust-notice.txt`

현재 게임은 S를 본문, Bold를 강조·버튼, ExtraBold를 제목·핵심 정보에 사용한다.

## 프로젝트 생성 아트

- 파일: `project/asset/generated/tutorial/world/low-spike-barricade.png`
- 런타임 복사본: `project/asset/tutorial/world/low-spike-barricade.png`
- 출처: 2026-08-29 OpenAI 내장 `image_gen` 도구로 프로젝트 전용 생성
- 후처리: 같은 도구로 기둥 높이 축소와 투명 배경 추출
- 상태: 프로젝트 사용 가능

외부 게임 에셋을 입력으로 사용하지 않았으며, 생성 과정과 적용 범위는
`manifests/asset-provenance.json`의 `imagegen-low-spike-barricade` 항목에 기록한다.

## NW.js v0.108.0 Windows x64

NW.js 바이너리는 저장소에 커밋하지 않는다. `package:nwjs`는 사용자가 별도로
준비한 공식 `nwjs-v0.108.0-win-x64` 배포본만 입력으로 받으며, 배포본의
`credits.html`을 결과물에 그대로 보존한다. NW.js와 그 안의 Chromium, Node.js,
FFmpeg 등 구성 요소의 고지는 해당 `credits.html`이 기준이다.

## 프로젝트 제공 아트 — 공개 릴리스 차단

다음 범주의 개별 저작자, 원본 URL, 라이선스 또는 양도·사용 허가 문서가
저장소와 제공된 기획 자료에서 확인되지 않았다.

- `project/asset/img/**`
- `project/asset/img2/**` (교체 완료 뒤 삭제 예정인 중복 원본 포함)
- `project/asset/old/ui/**`
- `project/asset/old/icon/**`
- 위 파일에서 만든 `project/asset/tutorial/**/*.png` 런타임 복사본

따라서 공개 릴리스 전에 원본별 권리 증빙을 확보하거나 권리가 명확한 아트로
교체해야 한다.

특히 다음 아이템 표현은 외부 게임·브랜드를 직접 참조하므로 별도 법무·권리
검토가 필요하다.

- Minecraft 다이아몬드 곡괭이
- Mario 버섯
- The Legend of Zelda 오카리나
- MapleStory 헤이스트

## 프로젝트 제공 오디오 — 공개 릴리스 차단

`project/asset/audio/**`, `project/asset/old/audio/**`의 BGM·효과음과 그
`project/asset/tutorial/audio/**` 복사본에는 개별 제작자와 배포 허가 증빙이
없다. 원본별 작곡가·음향 제작자·라이선스를 확인하거나 대체하기 전에는 공개
릴리스를 차단한다.

## 프로젝트 코드 라이선스 — 공개 릴리스 차단

Git 이력으로 프로젝트 팀의 코드 작성·수정 사실은 확인되지만, 저장소 루트에
공개 배포 라이선스가 선언되어 있지 않다. 저장소 소유자가 코드 배포 조건을
확정하기 전까지 이 릴리스 후보는 내부 검증용으로만 취급한다.
