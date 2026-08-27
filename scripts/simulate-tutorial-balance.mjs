#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    BALANCE_MAX_COMMAND_LIMIT,
    DEFAULT_BALANCE_MAX_COMMANDS
} from './tutorial-balance/balance_simulation_contract.mjs';
import { TutorialBalanceReporter } from './tutorial-balance/_tutorial_balance_reporter.mjs';
import { TutorialBalanceRunner } from './tutorial-balance/_tutorial_balance_runner.mjs';

const HELP = `사용법: npm run simulate:balance -- [옵션]

옵션:
  --json                사람용 요약 대신 JSON을 표준 출력에 기록합니다.
  --no-write            reports/tutorial-balance-report.json을 생성하지 않습니다.
  --max-commands=<수>   시나리오별 모델 변경 명령 상한입니다. 기본 ${DEFAULT_BALANCE_MAX_COMMANDS}, 최대 ${BALANCE_MAX_COMMAND_LIMIT}
  --help                이 도움말을 표시합니다.`;

/** @param {string[]} args @returns {{json:boolean,write:boolean,maxCommands:number,help:boolean}} */
function parseArguments(args) {
    const options = {
        json: false,
        write: true,
        maxCommands: DEFAULT_BALANCE_MAX_COMMANDS,
        help: false
    };
    for (const argument of args) {
        if (argument === '--json') {
            options.json = true;
            continue;
        }
        if (argument === '--no-write') {
            options.write = false;
            continue;
        }
        if (argument === '--help') {
            options.help = true;
            continue;
        }
        if (argument.startsWith('--max-commands=')) {
            const value = Number(argument.slice('--max-commands='.length));
            if (!Number.isInteger(value)
                || value <= 0
                || value > BALANCE_MAX_COMMAND_LIMIT) {
                throw new RangeError(
                    `--max-commands는 1~${BALANCE_MAX_COMMAND_LIMIT}여야 합니다.`
                );
            }
            options.maxCommands = value;
            continue;
        }
        throw new RangeError(`지원하지 않는 옵션입니다: ${argument}`);
    }
    return options;
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
        process.stdout.write(`${HELP}\n`);
        return;
    }
    const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const runner = new TutorialBalanceRunner();
    const reporter = new TutorialBalanceReporter();
    const report = runner.runSuite({ maxCommands: options.maxCommands });
    if (options.write) {
        await reporter.writeReport(report, { rootDirectory });
    }
    process.stdout.write(options.json
        ? reporter.toJson(report)
        : `${reporter.toHumanSummary(report)}\n`);
    if (report.aggregate.structuralFailures > 0
        || report.aggregate.preview.mismatches > 0) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    process.stderr.write(`밸런스 시뮬레이션 실패: ${error.message}\n`);
    process.exitCode = 1;
});
