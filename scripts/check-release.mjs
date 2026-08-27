import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { TUTORIAL_META_VERSION } from '../project/engine/script/scene/tutorial/_tutorial_meta_progress.js';
import { NWJS_PACKAGE_CONTRACT } from './package/_nwjs_package_contract.mjs';
import { ProvenanceAuditor } from './release/_provenance_auditor.mjs';
import { RuntimeSourceAuditor } from './release/_runtime_source_auditor.mjs';
import { SourceGraphAuditor } from './release/_source_graph_auditor.mjs';

const execFileAsync = promisify(execFile);
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const errors = [];

const [graph, provenance, source] = await Promise.all([
    new SourceGraphAuditor({ repositoryRoot: REPOSITORY_ROOT }).audit(),
    new ProvenanceAuditor({ repositoryRoot: REPOSITORY_ROOT }).audit(),
    new RuntimeSourceAuditor({ repositoryRoot: REPOSITORY_ROOT }).audit()
]);

for (const unresolved of graph.unresolved) {
    errors.push(`${unresolved.from}: import를 해석할 수 없습니다 (${unresolved.specifier}).`);
}
for (const cycle of graph.cycles) {
    errors.push(`순환 import: ${cycle.join(' -> ')}`);
}
errors.push(...provenance.errors, ...source.errors);

if (TUTORIAL_META_VERSION !== 4) {
    errors.push(`튜토리얼 메타 버전이 릴리스 계약 4와 다릅니다: ${TUTORIAL_META_VERSION}`);
}
if (NWJS_PACKAGE_CONTRACT.version !== '0.108.0') {
    errors.push(`NW.js 고정 버전이 바뀌었습니다: ${NWJS_PACKAGE_CONTRACT.version}`);
}

for (const requiredPath of [
    'package-lock.json',
    '.github/workflows/ci.yml',
    'THIRD_PARTY_NOTICES.md',
    'manifests/asset-provenance.json'
]) {
    try {
        await access(join(REPOSITORY_ROOT, requiredPath));
    } catch {
        errors.push(`릴리스 필수 파일이 없습니다: ${requiredPath}`);
    }
}

try {
    const workflow = await readFile(
        join(REPOSITORY_ROOT, '.github', 'workflows', 'ci.yml'),
        'utf8'
    );
    for (const required of [
        "node-version: '22.18.0'",
        'npm ci --ignore-scripts',
        'npm test',
        'npm run simulate:balance -- --json --no-write'
    ]) {
        if (!workflow.includes(required)) {
            errors.push(`CI 필수 명령 또는 버전이 없습니다: ${required}`);
        }
    }
    if (/nwjs|package:nwjs/i.test(workflow)) {
        errors.push('CI는 NW.js GUI·바이너리 패키징을 실행하면 안 됩니다.');
    }
} catch {
    // 누락 오류는 위 필수 파일 검사에서 보고합니다.
}

try {
    const { stdout } = await execFileAsync('git', ['ls-files'], {
        cwd: REPOSITORY_ROOT,
        windowsHide: true
    });
    const runtimeBinaries = stdout.split(/\r?\n/).filter((path) => (
        /^project\/[^/]+\.(?:exe|dll|pak|dat|bin)$/i.test(path)
    ));
    if (runtimeBinaries.length > 0) {
        errors.push(`NW.js 런타임 바이너리가 추적됩니다: ${runtimeBinaries.join(', ')}`);
    }
} catch (error) {
    errors.push(`git 추적 파일 검사를 실행할 수 없습니다: ${error.message}`);
}

for (const warning of source.warnings) {
    console.warn(`[check:release] 검토: ${warning}`);
}
for (const blocker of provenance.blockers) {
    console.warn(`[check:release] 공개 릴리스 차단: ${blocker.id} — ${blocker.blocker}`);
}

if (errors.length > 0) {
    for (const error of errors) {
        console.error(`[check:release] 오류: ${error}`);
    }
    console.error(`[check:release] 실패: 오류 ${errors.length}개`);
    process.exitCode = 1;
} else {
    console.log(
        `[check:release] 구조 검사 성공: JS ${graph.fileCount}개, import ${graph.edgeCount}개, `
        + `에셋 ${provenance.assetFileCount}개, 공개 릴리스 차단 ${provenance.blockers.length}개`
    );
}
