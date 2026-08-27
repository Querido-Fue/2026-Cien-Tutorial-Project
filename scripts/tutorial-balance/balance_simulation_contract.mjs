/** 밸런스 보고서의 기계 판독 스키마 버전입니다. */
export const BALANCE_REPORT_SCHEMA_VERSION = 1;

/** 한 시나리오가 사용할 수 있는 기본 모델 변경 명령 수입니다. */
export const DEFAULT_BALANCE_MAX_COMMANDS = 256;

/** CLI 오입력이나 진행 정지 버그가 과도한 메모리를 쓰지 않게 하는 절대 상한입니다. */
export const BALANCE_MAX_COMMAND_LIMIT = 4096;

/** 기획에서 확정된 두 스타터의 안정된 실행 순서입니다. */
export const BALANCE_STARTER_IDS = Object.freeze([
    'bow',
    'mascot-costume'
]);

/** CLI가 생성하는 보고서의 저장소 기준 고정 경로입니다. */
export const BALANCE_REPORT_RELATIVE_PATH = 'reports/tutorial-balance-report.json';

/** 모델 결과와 하네스 종료 상태를 합친 안정된 분류 ID입니다. */
export const BALANCE_RESOLUTION_IDS = Object.freeze({
    COMPLETED: 'completed',
    DEFEATED: 'defeated',
    TURN_LIMIT: 'turn-limit',
    COMMAND_LIMIT: 'command-limit',
    INVARIANT_FAILURE: 'invariant-failure',
    UNKNOWN: 'unknown'
});

/** 완벽한 플레이 AI로 오해하지 않도록 모든 보고서에 포함할 한계입니다. */
export const BALANCE_SIMULATION_LIMITATIONS = Object.freeze([
    'agent는 현재 공개 snapshot과 preview만 보고 미래 로라·몹 행동을 탐색하지 않는다.',
    '경로는 공개 getReachability() 후보만 평가하며 여러 턴짜리 전역 최단 경로를 계획하지 않는다.',
    '동점은 점수, 이동 칸 수, 남은 이동력, 좌표, 직렬화한 경로와 ID 순으로 고정한다.',
    '화면 연출, 입력 숙련도, 플레이어의 서사적 선택과 탐색 호기심은 측정하지 않는다.',
    '결과는 네 개의 설명 가능한 휴리스틱 비교이며 최적 플레이나 실제 승률을 뜻하지 않는다.'
]);
