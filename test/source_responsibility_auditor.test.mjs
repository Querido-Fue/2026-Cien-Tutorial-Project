import assert from 'node:assert/strict';
import test from 'node:test';

import { SourceResponsibilityAuditor } from '../scripts/architecture/_source_responsibility_auditor.mjs';

const createPolicy = (overrides = {}) => ({
    targetFileLines: 3,
    maximumFileLines: 5,
    maximumClassesPerFile: 1,
    exceptions: {},
    legacyBudgets: {},
    ...overrides
});

test('소스 책임 감사는 새 장문 파일을 차단한다', () => {
    const auditor = new SourceResponsibilityAuditor(createPolicy());
    const report = auditor.audit([{
        path: 'project/engine/script/example.js',
        source: '1\n2\n3\n4\n5\n6\n'
    }]);

    assert.deepEqual(report.violations, [{
        code: 'file-line-budget',
        path: 'project/engine/script/example.js',
        actual: 6,
        maximum: 5
    }]);
});

test('소스 책임 감사는 파일당 다중 클래스 선언을 차단한다', () => {
    const auditor = new SourceResponsibilityAuditor(createPolicy());
    const report = auditor.audit([{
        path: 'project/engine/script/example.js',
        source: 'class First {}\nexport class Second {}'
    }]);

    assert.deepEqual(report.violations, [{
        code: 'classes-per-file',
        path: 'project/engine/script/example.js',
        actual: 2,
        maximum: 1
    }]);
});

test('기존 부채 예산은 현재 크기만 허용하고 증가를 차단한다', () => {
    const path = 'project/engine/script/legacy.js';
    const auditor = new SourceResponsibilityAuditor(createPolicy({
        legacyBudgets: {
            [path]: { maximumFileLines: 6 }
        }
    }));

    const current = auditor.audit([{ path, source: '1\n2\n3\n4\n5\n6' }]);
    const grown = auditor.audit([{ path, source: '1\n2\n3\n4\n5\n6\n7' }]);

    assert.equal(current.violations.length, 0);
    assert.equal(current.legacyDebts.length, 1);
    assert.equal(grown.violations[0].code, 'file-line-budget');
});

test('명시적 예외에는 검토 가능한 사유가 필요하다', () => {
    assert.throws(
        () => new SourceResponsibilityAuditor(createPolicy({
            exceptions: {
                'project/engine/script/data.js': { maximumFileLines: 10 }
            }
        })),
        /사유/
    );
});
