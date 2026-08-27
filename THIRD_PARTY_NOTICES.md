# Third-party notices and release-rights status

이 문서는 저장소와 Windows 패키징 결과에 포함되는 코드·폰트·아트·오디오의
현재 출처 상태를 기록한다. 상세한 기계 판독 목록은
`manifests/asset-provenance.json`에 있다. “차단”은 파일을 숨기거나 삭제했다는
뜻이 아니라, 공개 릴리스 전에 권리 증빙 또는 교체가 필요하다는 뜻이다.

## Pretendard Variable

- 파일: `project/asset/old/font/PretendardVariable.woff2`
- 출처: Pretendard 프로젝트
- 라이선스: SIL Open Font License 1.1
- 상태: 배포 가능
- 전체 저작권 고지와 라이선스: `project/license/pretendard.txt`

패키징 결과에는 위 라이선스 파일을 `license/pretendard.txt`로 함께 넣는다.

## NW.js v0.108.0 Windows x64

NW.js 바이너리는 저장소에 커밋하지 않는다. `package:nwjs`는 사용자가 별도로
준비한 공식 `nwjs-v0.108.0-win-x64` 배포본만 입력으로 받으며, 배포본의
`credits.html`을 결과물에 그대로 보존한다. NW.js와 그 안의 Chromium, Node.js,
FFmpeg 등 구성 요소의 고지는 해당 `credits.html`이 기준이다.

## 프로젝트 제공 아트 — 공개 릴리스 차단

다음 범주의 개별 저작자, 원본 URL, 라이선스 또는 양도·사용 허가 문서가
저장소와 제공된 기획 자료에서 확인되지 않았다.

- `project/asset/img/**`
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
