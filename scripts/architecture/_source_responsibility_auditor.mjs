const CLASS_DECLARATION_PATTERN = /^\s*(?:export\s+)?class\s+[A-Za-z_$][\w$]*/gm;

/**
 * 운영 소스의 파일 길이와 클래스 선언 수를 단일 정책으로 감사합니다.
 */
export class SourceResponsibilityAuditor {
    /**
     * @param {object} policy - 소스 책임 예산 정책입니다.
     */
    constructor(policy) {
        this.policy = policy;
        this.#validatePolicy();
    }

    /**
     * 주어진 소스 항목을 감사합니다.
     * @param {Array<{path:string,source:string}>} entries - 저장소 상대 경로와 소스입니다.
     * @returns {{violations:Array<object>,legacyDebts:Array<object>,largeFiles:Array<object>}}
     */
    audit(entries) {
        const violations = [];
        const legacyDebts = [];
        const largeFiles = [];

        for (const entry of entries) {
            const path = this.#normalizePath(entry.path);
            const source = typeof entry.source === 'string' ? entry.source : '';
            const lineCount = this.#countLines(source);
            const classCount = [...source.matchAll(CLASS_DECLARATION_PATTERN)].length;
            const exception = this.policy.exceptions[path] ?? null;
            const legacyBudget = this.policy.legacyBudgets[path] ?? null;
            const maximumFileLines = exception?.maximumFileLines
                ?? legacyBudget?.maximumFileLines
                ?? this.policy.maximumFileLines;
            const maximumClassesPerFile = exception?.maximumClassesPerFile
                ?? legacyBudget?.maximumClassesPerFile
                ?? this.policy.maximumClassesPerFile;

            if (lineCount > this.policy.targetFileLines) {
                largeFiles.push({ path, lineCount, maximumFileLines });
            }
            if (legacyBudget) {
                legacyDebts.push({ path, lineCount, classCount });
            }
            if (lineCount > maximumFileLines) {
                violations.push({
                    code: 'file-line-budget',
                    path,
                    actual: lineCount,
                    maximum: maximumFileLines
                });
            }
            if (classCount > maximumClassesPerFile) {
                violations.push({
                    code: 'classes-per-file',
                    path,
                    actual: classCount,
                    maximum: maximumClassesPerFile
                });
            }
        }

        return { violations, legacyDebts, largeFiles };
    }

    /** 정책 필수값과 예외 사유를 검증합니다. */
    #validatePolicy() {
        const positiveIntegers = [
            this.policy?.targetFileLines,
            this.policy?.maximumFileLines,
            this.policy?.maximumClassesPerFile
        ];
        if (positiveIntegers.some((value) => !Number.isInteger(value) || value <= 0)) {
            throw new TypeError('소스 책임 정책의 기본 예산은 양의 정수여야 합니다.');
        }
        if (this.policy.targetFileLines > this.policy.maximumFileLines) {
            throw new RangeError('목표 줄 수는 하드 상한보다 클 수 없습니다.');
        }
        for (const [path, exception] of Object.entries(this.policy.exceptions ?? {})) {
            if (typeof exception?.reason !== 'string' || exception.reason.trim().length === 0) {
                throw new TypeError(`${path}: 책임 예외에는 사유가 필요합니다.`);
            }
        }
    }

    /** 저장소 경로 구분자를 POSIX 형식으로 통일합니다. */
    #normalizePath(path) {
        return String(path ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
    }

    /** 마지막 개행을 별도 빈 줄로 세지 않고 실제 줄 수를 반환합니다. */
    #countLines(source) {
        if (source.length === 0) {
            return 0;
        }
        return source.replace(/\r?\n$/, '').split(/\r?\n/).length;
    }
}
