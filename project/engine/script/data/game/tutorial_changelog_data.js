/**
 * 실제 Git 커밋과 사용자에게 보여 줄 한글 변경 요약을 연결합니다.
 * 빌드 시 저장소 기록에 존재하는 항목만 release.json에 포함됩니다.
 * @type {ReadonlyArray<Readonly<{commit?:string,subject?:string,summary:string}>>}
 */
export const TUTORIAL_CHANGELOG_CATALOG = Object.freeze([
    Object.freeze({
        subject: 'refactor: separate tutorial keyboard commands and view models',
        summary: '화면별 키 명령 해석과 비전투 표시 데이터 조립을 장면에서 분리했습니다.'
    }),
    Object.freeze({
        subject: 'refactor: extract tutorial input and meta sessions',
        summary: '키 입력 에지와 진행도 저장 책임을 튜토리얼 장면에서 분리했습니다.'
    }),
    Object.freeze({
        subject: 'chore: enforce source responsibility budgets',
        summary: '단일 책임 파일 기준과 장문·다중 클래스 자동 검사를 추가했습니다.'
    }),
    Object.freeze({
        subject: 'fix: preserve composed asset paths in web builds',
        summary: '동적 아이템·오디오 자산 경로를 보존하고 최신 파일 재검증을 보강했습니다.'
    }),
    Object.freeze({
        subject: 'feat: add automatic web release updates and changelog',
        summary: '최신 배포 자동 확인, 버전 표시와 한글 체인지로그를 추가했습니다.'
    }),
    Object.freeze({
        commit: '2b73ac5',
        summary: '마우스 휠 카메라 확대·축소와 연속 easeOutExpo 전환을 추가했습니다.'
    }),
    Object.freeze({
        commit: 'ac714c5',
        summary: '캐릭터의 양발과 맞닿는 동남향 투영 그림자로 개선했습니다.'
    }),
    Object.freeze({
        commit: 'dad2131',
        summary: '로라의 불안정 애니메이션을 느린 상하 부유 움직임으로 변경했습니다.'
    }),
    Object.freeze({
        commit: '1fad78f',
        summary: '화면 경계 유지로도 ESC 안내가 나타나도록 감지 조건을 완화했습니다.'
    }),
    Object.freeze({
        commit: '9f86a22',
        summary: '촛불을 물방울 모양의 픽셀 화염으로 다듬고 Bloom을 강화했습니다.'
    }),
    Object.freeze({
        commit: '3a91405',
        summary: '픽셀 아트용 WebGL 색보정·Bloom·그레인 후처리를 추가했습니다.'
    }),
    Object.freeze({
        commit: 'cc16143',
        summary: '전투 맵 바깥에 남던 짙은 남색 배경 사각형을 제거했습니다.'
    }),
    Object.freeze({
        commit: '5d71be2',
        summary: '주인공 추적·가장자리 이동 카메라와 마우스 고정 UX를 개선했습니다.'
    }),
    Object.freeze({
        commit: '21b1604',
        summary: '로라가 가능한 한 항상 정면을 바라보도록 방향 처리를 개선했습니다.'
    }),
    Object.freeze({
        commit: '4590de8',
        summary: '배경 촛대에 픽셀 WebGL 화염 파티클을 추가했습니다.'
    }),
    Object.freeze({
        commit: '7ffd61d',
        summary: '광원 방향을 반영한 캐릭터 바닥 투영 그림자를 추가했습니다.'
    }),
    Object.freeze({
        commit: '4b22dd2',
        summary: '맵에서 일기와 개발자 기록을 획득하고 즉시 열람할 수 있게 했습니다.'
    }),
    Object.freeze({
        commit: 'f1da1bc',
        summary: '여섯 가지 업적의 실제 게임 사건 기반 해금 조건을 구현했습니다.'
    }),
    Object.freeze({
        commit: 'c331650',
        summary: '아이템 설명 버튼 배경과 바깥으로 넘치던 문구를 정리했습니다.'
    }),
    Object.freeze({
        commit: '358959f',
        summary: '전투 화면의 불필요한 턴 표시 막대를 제거했습니다.'
    }),
    Object.freeze({
        commit: 'bcfa9c6',
        summary: '로라 초상화를 확대하고 장식 프레임 위아래 레이어를 분리했습니다.'
    }),
    Object.freeze({
        commit: '3faf72f',
        summary: '우하단 행동 메뉴를 마름모형 픽셀 UI로 다시 디자인했습니다.'
    }),
    Object.freeze({
        commit: 'afe86a4',
        summary: '가림 문제로 벽 높이 변경을 되돌리고 아이템을 시각 중심에 맞췄습니다.'
    }),
    Object.freeze({
        commit: '96f9875',
        summary: '벽 장애물 높이와 바닥 단차 표현을 일시적으로 강화했습니다.'
    }),
    Object.freeze({
        commit: '783fa35',
        summary: '각 캐릭터의 작은 HP 바를 머리 위로 옮겼습니다.'
    }),
    Object.freeze({
        commit: '25985e0',
        summary: '주인공을 부드럽게 따라가는 전투 카메라를 추가했습니다.'
    }),
    Object.freeze({
        commit: '5506b01',
        summary: '양쪽 마법진을 해당 타일의 정확한 중심에 정렬했습니다.'
    }),
    Object.freeze({
        commit: '95b1df0',
        summary: '로라 얼굴 이미지를 상태창 마름모 프레임에 맞췄습니다.'
    }),
    Object.freeze({
        commit: '381d861',
        summary: '낮은 벽과 가시 울타리 표현, 아이템 크기와 하이라이트를 조정했습니다.'
    }),
    Object.freeze({
        commit: 'd5fa26b',
        summary: '로라 숨소리를 1페이즈에서 끄고 2페이즈에서 절반으로 줄였습니다.'
    }),
    Object.freeze({
        commit: '53f6898',
        summary: '로라 상태창의 얼굴·HP·불안정 수치를 프레임 슬롯에 맞췄습니다.'
    }),
    Object.freeze({
        commit: '37e16b3',
        summary: '글자 벽 표식을 낮은 가시 장애물 이미지로 교체했습니다.'
    }),
    Object.freeze({
        commit: '81090e6',
        summary: '이동 미리보기의 각도를 바닥 타일 투영과 일치시켰습니다.'
    }),
    Object.freeze({
        commit: '946fd95',
        summary: '플레이어 HP 바와 인벤토리를 좌하단 상태 프레임에 맞췄습니다.'
    }),
    Object.freeze({
        commit: '0b60229',
        summary: '갤러리와 인게임 UI를 기준 이미지의 픽셀 좌표에 맞췄습니다.'
    }),
    Object.freeze({
        commit: '5a53781',
        summary: '메인 메뉴 버튼 크기를 20% 확대했습니다.'
    }),
    Object.freeze({
        commit: '1605bca',
        summary: '메뉴·갤러리·스타터 UI의 배경과 글자 정렬을 다듬었습니다.'
    }),
    Object.freeze({
        commit: 'e3d7a60',
        summary: '이동 타일 초기화와 페이즈별 음악 재생 순서를 조정했습니다.'
    }),
    Object.freeze({
        commit: '6cf4a79',
        summary: '커스텀 도메인에서 게임을 제공하는 사이트 경로를 연결했습니다.'
    }),
    Object.freeze({
        commit: '9b961a8',
        summary: 'GitHub Pages 자동 배포 워크플로를 추가했습니다.'
    }),
    Object.freeze({
        commit: '8c12499',
        summary: '브라우저 런타임과 정적 웹 빌드 기능을 추가했습니다.'
    }),
    Object.freeze({
        commit: '46d3822',
        summary: '게임 전체에 LanaPixel 픽셀 폰트를 적용했습니다.'
    }),
    Object.freeze({
        commit: '1da3049',
        summary: 'N번째 플레이어의 기반 게임 엔진을 구성했습니다.'
    })
]);
