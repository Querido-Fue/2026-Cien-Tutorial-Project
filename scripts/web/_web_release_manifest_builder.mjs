import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { TUTORIAL_CHANGELOG_CATALOG } from '../../project/engine/script/data/game/tutorial_changelog_data.js';

const execFileAsync = promisify(execFile);
const KST_TIME_ZONE = 'Asia/Seoul';
const MAX_CHANGELOG_ENTRIES = 80;

/** @param {Date} date @returns {Record<string,string>} KST 날짜 구성값입니다. */
function getKstParts(date) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: KST_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    });
    return Object.fromEntries(formatter.formatToParts(date).map(
        ({ type, value }) => [type, value]
    ));
}

/** @param {Date} date @returns {string} 화면 표시용 MMDD_HHmm 버전입니다. */
export function formatKstReleaseVersion(date) {
    const parts = getKstParts(date);
    return `${parts.month}${parts.day}_${parts.hour}${parts.minute}`;
}

/** @param {Date} date @returns {string} 사람이 읽을 수 있는 KST ISO 유사 문자열입니다. */
function formatKstTimestamp(date) {
    const parts = getKstParts(date);
    return `${parts.year}-${parts.month}-${parts.day}`
        + `T${parts.hour}:${parts.minute}:${parts.second}+09:00`;
}

/**
 * @class WebReleaseManifestBuilder
 * @description Git 기록과 한글 카탈로그를 결합해 정적 웹 릴리스 정보를 생성합니다.
 */
export class WebReleaseManifestBuilder {
    #repositoryRoot;
    #now;
    #gitLogReader;

    /**
     * @param {object} options - 저장소와 테스트 가능한 시간·Git 포트입니다.
     * @param {string} options.repositoryRoot - Git 저장소 루트입니다.
     * @param {Function} [options.now] - 현재 Date를 반환합니다.
     * @param {Function} [options.gitLogReader] - Git 기록을 반환하는 대체 포트입니다.
     */
    constructor({
        repositoryRoot,
        now = () => new Date(),
        gitLogReader = null
    }) {
        this.#repositoryRoot = repositoryRoot;
        this.#now = now;
        this.#gitLogReader = gitLogReader;
    }

    /** @returns {Promise<object>} release.json에 기록할 직렬화 가능한 정보입니다. */
    async create() {
        const builtAt = this.#now();
        const records = await this.#readGitLog();
        const headCommit = records[0]?.commit
            || String(process.env.GITHUB_SHA || 'local').toLowerCase();
        const version = formatKstReleaseVersion(builtAt);
        const safeCommit = /^[0-9a-f]{7,40}$/i.test(headCommit)
            ? headCommit.toLowerCase()
            : 'local';
        const id = `${version}-${safeCommit.slice(0, 12)}`;
        const catalogByCommit = new Map(TUTORIAL_CHANGELOG_CATALOG
            .filter((entry) => entry.commit)
            .map((entry) => [entry.commit.toLowerCase(), entry]));
        const catalogBySubject = new Map(TUTORIAL_CHANGELOG_CATALOG
            .filter((entry) => entry.subject)
            .map((entry) => [entry.subject, entry]));
        const changelog = records.flatMap((record) => {
            const byCommit = [...catalogByCommit.entries()].find(
                ([prefix]) => record.commit.startsWith(prefix)
            )?.[1];
            const catalogEntry = byCommit || catalogBySubject.get(record.subject);
            if (!catalogEntry) {
                return [];
            }
            const authoredAt = new Date(record.authoredAt);
            return [Object.freeze({
                version: Number.isNaN(authoredAt.getTime())
                    ? '기록'
                    : formatKstReleaseVersion(authoredAt),
                commit: record.commit.slice(0, 7),
                summary: catalogEntry.summary
            })];
        }).slice(0, MAX_CHANGELOG_ENTRIES);

        return Object.freeze({
            schemaVersion: 1,
            id,
            version,
            commit: safeCommit,
            builtAtKst: formatKstTimestamp(builtAt),
            changelog: Object.freeze(changelog)
        });
    }

    /** @returns {Promise<Array<{commit:string,authoredAt:string,subject:string}>>} 최신순 Git 기록입니다. @private */
    async #readGitLog() {
        if (typeof this.#gitLogReader === 'function') {
            return this.#gitLogReader();
        }
        try {
            const { stdout } = await execFileAsync('git', [
                'log',
                '--date=iso-strict',
                '--pretty=format:%H%x09%aI%x09%s',
                '--max-count=300'
            ], {
                cwd: this.#repositoryRoot,
                encoding: 'utf8',
                maxBuffer: 4 * 1024 * 1024
            });
            return stdout.split(/\r?\n/).flatMap((line) => {
                const [commit, authoredAt, ...subjectParts] = line.split('\t');
                if (!/^[0-9a-f]{7,40}$/i.test(commit || '')) {
                    return [];
                }
                return [{
                    commit: commit.toLowerCase(),
                    authoredAt,
                    subject: subjectParts.join('\t')
                }];
            });
        } catch (error) {
            console.warn('[build:web] Git 변경 기록을 읽지 못해 빈 체인지로그를 사용합니다.', error);
            return [];
        }
    }
}
