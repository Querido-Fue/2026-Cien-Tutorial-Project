import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { BALANCE_REPORT_RELATIVE_PATH } from './balance_simulation_contract.mjs';

/** @param {object} counts @returns {string} 사람이 읽는 횟수 목록입니다. */
function formatCounts(counts) {
    const entries = Object.entries(counts);
    return entries.length > 0
        ? entries.map(([id, count]) => `${id}=${count}`).join(', ')
        : '없음';
}

/**
 * @class TutorialBalanceReporter
 * @description 보고서를 결정론적 JSON·CLI 요약으로 직렬화하고 고정 경로에 저장합니다.
 */
export class TutorialBalanceReporter {
    /** @param {object} report @returns {string} 개행으로 끝나는 JSON입니다. */
    toJson(report) {
        return `${JSON.stringify(report, null, 2)}\n`;
    }

    /** @param {object} report @returns {string} 터미널용 한국어 요약입니다. */
    toHumanSummary(report) {
        const lines = [
            `튜토리얼 밸런스 시뮬레이션: ${report.aggregate.scenarioCount}개 시나리오`,
            `종료 분류: ${formatCounts(report.aggregate.resolutions)}`,
            `엔딩: ${formatCounts(report.aggregate.endings)}`,
            `명령: 총 ${report.aggregate.commands.total}, 시나리오 최대 ${report.aggregate.commands.maximumInScenario}`,
            `preview: ${report.aggregate.preview.checks}회 확인, ${report.aggregate.preview.mismatches}회 불일치`,
            `하네스 구조 실패: ${report.aggregate.structuralFailures}개`,
            ''
        ];
        for (const scenario of report.scenarios) {
            lines.push([
                scenario.scenarioId,
                scenario.resolution,
                `ending=${scenario.endingId ?? 'none'}`,
                `HP=${scenario.finalState.playerHp}/${scenario.finalState.playerMaxHp}`,
                `instability=${scenario.finalState.instability}`,
                `commands=${scenario.commands.used}`,
                `mismatch=${scenario.preview.mismatchCount}`
            ].join(' | '));
        }
        return lines.join('\n');
    }

    /**
     * 무시되는 `reports/` 아래 고정 파일만 원자적이지 않은 단순 덮어쓰기로 갱신합니다.
     * @param {object} report @param {{rootDirectory:string}} options
     * @returns {Promise<string>} 저장한 절대 경로입니다.
     */
    async writeReport(report, { rootDirectory }) {
        const root = resolve(rootDirectory);
        const reportRoot = resolve(root, 'reports');
        const target = resolve(root, BALANCE_REPORT_RELATIVE_PATH);
        const traversal = relative(reportRoot, target);
        if (traversal.startsWith('..') || traversal === '') {
            throw new RangeError('TutorialBalanceReporter: 보고서 고정 경로가 reports/ 내부 파일이 아닙니다.');
        }
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, this.toJson(report), 'utf8');
        return target;
    }
}
