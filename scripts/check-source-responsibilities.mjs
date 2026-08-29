import { readdir, readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SourceResponsibilityAuditor } from './architecture/_source_responsibility_auditor.mjs';
import { SOURCE_RESPONSIBILITY_POLICY } from './architecture/source_responsibility_policy.mjs';

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * 지정한 디렉터리 아래의 감사 대상 소스를 재귀적으로 수집합니다.
 * @param {string} directory - 탐색할 절대 경로입니다.
 * @returns {Promise<Array<{path:string,source:string}>>}
 */
async function collectSourceEntries(directory) {
    const output = [];
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
        const absolutePath = resolve(directory, entry.name);
        if (entry.isDirectory()) {
            output.push(...await collectSourceEntries(absolutePath));
            continue;
        }
        if (!SOURCE_RESPONSIBILITY_POLICY.extensions.includes(extname(entry.name))) {
            continue;
        }
        output.push({
            path: relative(REPOSITORY_ROOT, absolutePath),
            source: await readFile(absolutePath, 'utf8')
        });
    }

    return output;
}

const sourceEntries = [];
for (const root of SOURCE_RESPONSIBILITY_POLICY.sourceRoots) {
    sourceEntries.push(...await collectSourceEntries(resolve(REPOSITORY_ROOT, root)));
}

const auditor = new SourceResponsibilityAuditor(SOURCE_RESPONSIBILITY_POLICY);
const report = auditor.audit(sourceEntries);

for (const violation of report.violations) {
    const label = violation.code === 'classes-per-file' ? '클래스 수' : '줄 수';
    console.error(
        `[check:responsibilities] 오류: ${violation.path} ${label} `
        + `${violation.actual} > ${violation.maximum}`
    );
}

if (report.violations.length > 0) {
    console.error(`[check:responsibilities] 실패: 위반 ${report.violations.length}개`);
    process.exitCode = 1;
} else {
    console.log(
        `[check:responsibilities] 성공: 소스 ${sourceEntries.length}개, `
        + `500줄 초과 ${report.largeFiles.length}개, 기존 부채 ${report.legacyDebts.length}개`
    );
}
