import { TUTORIAL_CHANGELOG_CATALOG } from '../data/game/tutorial_changelog_data.js';

const RELEASE_SCHEMA_VERSION = 1;
const RELEASE_FETCH_TIMEOUT_MS = 4000;
const RELEASE_ID_PATTERN = /^(?:development|\d{4}_\d{4}-(?:[0-9a-f]{7,12}|local))$/;
const RELEASE_VERSION_PATTERN = /^(?:dev|\d{4}_\d{4})$/;
const MAX_CHANGELOG_ENTRIES = 80;
const MAX_SUMMARY_LENGTH = 180;

/** @param {*} value @param {number} maxLength @returns {string} 제한된 한 줄 문자열입니다. */
function normalizeLine(value, maxLength) {
    return String(value ?? '')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, maxLength);
}

/** @param {object} value @returns {Readonly<object>|null} 검증된 릴리스 정보입니다. */
function normalizeReleaseInfo(value) {
    const id = normalizeLine(value?.id, 40);
    const version = normalizeLine(value?.version, 12);
    if (Number(value?.schemaVersion) !== RELEASE_SCHEMA_VERSION
        || !RELEASE_ID_PATTERN.test(id)
        || !RELEASE_VERSION_PATTERN.test(version)) {
        return null;
    }
    const changelog = Array.isArray(value?.changelog)
        ? value.changelog.slice(0, MAX_CHANGELOG_ENTRIES).flatMap((entry) => {
            const summary = normalizeLine(entry?.summary, MAX_SUMMARY_LENGTH);
            if (!summary) {
                return [];
            }
            return [Object.freeze({
                version: RELEASE_VERSION_PATTERN.test(entry?.version)
                    ? entry.version
                    : '기록',
                commit: /^[0-9a-f]{7}$/i.test(entry?.commit || '')
                    ? entry.commit.toLowerCase()
                    : '',
                summary
            })];
        })
        : [];
    return Object.freeze({
        schemaVersion: RELEASE_SCHEMA_VERSION,
        id,
        version,
        commit: /^[0-9a-f]{7,40}$/i.test(value?.commit || '')
            ? value.commit.toLowerCase()
            : '',
        builtAtKst: normalizeLine(value?.builtAtKst, 32),
        changelog: Object.freeze(changelog)
    });
}

/**
 * @class WebReleaseManager
 * @description 엔진 시작 전에 최신 웹 릴리스를 확인하고 오래된 문서를 한 번 갱신합니다.
 */
export class WebReleaseManager {
    #window;
    #document;
    #fetch;
    #now;

    /**
     * @param {object} options - 브라우저 의존성 포트입니다.
     * @param {Window|object} options.windowRef - location과 sessionStorage를 제공합니다.
     * @param {Document|object} options.documentRef - baseURI와 meta 조회를 제공합니다.
     * @param {Function} [options.fetchImpl] - same-origin release.json 조회 함수입니다.
     * @param {Function} [options.now] - 캐시 우회용 현재 시각 함수입니다.
     */
    constructor({
        windowRef,
        documentRef,
        fetchImpl = windowRef?.fetch?.bind(windowRef),
        now = () => Date.now()
    }) {
        this.#window = windowRef;
        this.#document = documentRef;
        this.#fetch = fetchImpl;
        this.#now = now;
    }

    /**
     * 최신 릴리스와 현재 문서를 비교하고 필요하면 새 문서로 재접속합니다.
     * @returns {Promise<Readonly<{releaseInfo:Readonly<object>,reloadScheduled:boolean}>>}
     */
    async ensureLatest() {
        const current = this.#readEmbeddedRelease();
        const bootstrapRelease = normalizeReleaseInfo(
            this.#window?.__NTHPLAYER_RELEASE_MANIFEST__
        );
        if (bootstrapRelease?.id === current.id) {
            this.#clearRefreshGuard(bootstrapRelease.id);
            return Object.freeze({
                releaseInfo: bootstrapRelease,
                reloadScheduled: false
            });
        }
        if (!this.#canCheckRemoteRelease()) {
            return Object.freeze({ releaseInfo: current, reloadScheduled: false });
        }
        let latest;
        try {
            latest = await this.#fetchLatestRelease();
        } catch (error) {
            console.warn('최신 웹 버전을 확인하지 못해 현재 버전으로 실행합니다.', error);
            return Object.freeze({ releaseInfo: current, reloadScheduled: false });
        }
        if (latest.id === current.id) {
            this.#clearRefreshGuard(latest.id);
            return Object.freeze({ releaseInfo: latest, reloadScheduled: false });
        }
        if (this.#scheduleRefresh(latest.id)) {
            return Object.freeze({ releaseInfo: latest, reloadScheduled: true });
        }
        console.warn('최신 웹 버전 재접속이 이미 시도되어 현재 문서로 실행합니다.', {
            current: current.id,
            latest: latest.id
        });
        return Object.freeze({ releaseInfo: current, reloadScheduled: false });
    }

    /** @returns {Readonly<object>} HTML에 주입된 현재 배포 정보입니다. @private */
    #readEmbeddedRelease() {
        const releaseId = this.#document?.querySelector?.(
            'meta[name="nthplayer-release-id"]'
        )?.content;
        const releaseVersion = this.#document?.querySelector?.(
            'meta[name="nthplayer-release-version"]'
        )?.content;
        const normalized = normalizeReleaseInfo({
            schemaVersion: RELEASE_SCHEMA_VERSION,
            id: releaseId,
            version: releaseVersion,
            changelog: TUTORIAL_CHANGELOG_CATALOG.map((entry) => ({
                version: '기록',
                commit: entry.commit || '',
                summary: entry.summary
            }))
        });
        return normalized || Object.freeze({
            schemaVersion: RELEASE_SCHEMA_VERSION,
            id: 'development',
            version: 'dev',
            commit: '',
            builtAtKst: '',
            changelog: Object.freeze([])
        });
    }

    /** @returns {boolean} HTTP(S) 정적 웹에서 최신 매니페스트를 조회할 수 있는지 여부입니다. @private */
    #canCheckRemoteRelease() {
        if (typeof this.#fetch !== 'function') {
            return false;
        }
        try {
            const protocol = new URL(
                this.#document?.baseURI || this.#window?.location?.href
            ).protocol;
            return protocol === 'http:' || protocol === 'https:';
        } catch {
            return false;
        }
    }

    /** @returns {Promise<Readonly<object>>} 캐시를 우회해 받은 최신 릴리스입니다. @private */
    async #fetchLatestRelease() {
        const releaseUrl = new URL(
            './release.json',
            this.#document?.baseURI || this.#window.location.href
        );
        releaseUrl.searchParams.set('check', String(this.#now()));
        const AbortControllerClass = this.#window?.AbortController
            || globalThis.AbortController;
        const controller = AbortControllerClass ? new AbortControllerClass() : null;
        const timeoutId = setTimeout(
            () => controller?.abort(),
            RELEASE_FETCH_TIMEOUT_MS
        );
        try {
            const response = await this.#fetch(releaseUrl.href, {
                cache: 'no-store',
                credentials: 'same-origin',
                signal: controller?.signal,
                headers: { 'cache-control': 'no-cache' }
            });
            if (!response?.ok) {
                throw new Error(`release.json 응답 코드 ${response?.status}`);
            }
            const latest = normalizeReleaseInfo(await response.json());
            if (!latest || latest.id === 'development') {
                throw new Error('release.json 형식이 올바르지 않습니다.');
            }
            return latest;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /** @param {string} releaseId @returns {boolean} 새 문서 재접속을 예약했는지 여부입니다. @private */
    #scheduleRefresh(releaseId) {
        const guardKey = `nthplayer-release-refresh:${releaseId}`;
        try {
            if (this.#window.sessionStorage?.getItem(guardKey) === 'attempted') {
                return false;
            }
            this.#window.sessionStorage?.setItem(guardKey, 'attempted');
        } catch {
            // 저장소를 쓸 수 없어도 현재 탐색에서는 한 번 재접속합니다.
        }
        const nextUrl = new URL(this.#window.location.href);
        nextUrl.searchParams.set('release', releaseId);
        nextUrl.searchParams.set('refresh', String(this.#now()));
        this.#window.location.replace(nextUrl.href);
        return true;
    }

    /** @param {string} releaseId 현재 릴리스의 재접속 안전장치를 제거합니다. @private */
    #clearRefreshGuard(releaseId) {
        try {
            this.#window.sessionStorage?.removeItem(
                `nthplayer-release-refresh:${releaseId}`
            );
        } catch {
            // 저장소가 차단된 환경에서는 별도 정리가 필요하지 않습니다.
        }
    }
}
