(function bootstrapNthPlayerRelease() {
    'use strict';

    const loader = document.currentScript;
    const currentReleaseId = document.querySelector(
        'meta[name="nthplayer-release-id"]'
    )?.content || 'development';
    let runtimeStarted = false;

    /** 현재 문서에 실제 엔진 모듈을 한 번만 연결합니다. */
    function startRuntime() {
        if (runtimeStarted) {
            return;
        }
        runtimeStarted = true;
        for (const source of [loader?.dataset.mainSrc, loader?.dataset.nwSetupSrc]) {
            if (!source) {
                continue;
            }
            const script = document.createElement('script');
            script.type = 'module';
            script.src = source;
            document.body.appendChild(script);
        }
    }

    /** 최신 배포 ID로 캐시 우회 재접속을 한 번만 수행합니다. @param {string} releaseId */
    function refreshToRelease(releaseId) {
        const guardKey = `nthplayer-release-bootstrap:${releaseId}`;
        try {
            if (sessionStorage.getItem(guardKey) === 'attempted') {
                startRuntime();
                return;
            }
            sessionStorage.setItem(guardKey, 'attempted');
        } catch {
            // 저장소가 막혀도 현재 탐색에서 한 번 갱신합니다.
        }
        const nextUrl = new URL(location.href);
        nextUrl.searchParams.set('release', releaseId);
        nextUrl.searchParams.set('refresh', String(Date.now()));
        location.replace(nextUrl.href);
    }

    /** 엔진 모듈 요청 전 최신 release.json을 확인합니다. */
    async function checkRelease() {
        if (!/^https?:$/.test(location.protocol)) {
            startRuntime();
            return;
        }
        try {
            const releaseUrl = new URL('./release.json', document.baseURI);
            releaseUrl.searchParams.set('check', String(Date.now()));
            const response = await fetch(releaseUrl.href, {
                cache: 'no-store',
                credentials: 'same-origin',
                headers: { 'cache-control': 'no-cache' }
            });
            const latest = response.ok ? await response.json() : null;
            const latestId = String(latest?.id || '');
            if (!/^\d{4}_\d{4}-(?:[0-9a-f]{7,12}|local)$/.test(latestId)) {
                startRuntime();
                return;
            }
            if (latestId !== currentReleaseId) {
                refreshToRelease(latestId);
                return;
            }
            window.__NTHPLAYER_RELEASE_MANIFEST__ = latest;
            try {
                sessionStorage.removeItem(`nthplayer-release-bootstrap:${latestId}`);
            } catch {
                // 저장소가 차단된 환경에서는 정리할 값도 유지되지 않습니다.
            }
            startRuntime();
        } catch (error) {
            console.warn('배포 버전 사전 확인을 건너뜁니다.', error);
            startRuntime();
        }
    }

    void checkRelease();
}());
