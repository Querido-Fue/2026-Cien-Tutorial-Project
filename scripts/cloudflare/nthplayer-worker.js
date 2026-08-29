const PUBLIC_PATH_PREFIX = '/game/nthplayer';
const UPSTREAM_ORIGIN = 'https://querido-fue.github.io';
const UPSTREAM_PATH_PREFIX = '/2026-Cien-Tutorial-Project';
const LANDING_PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex, nofollow">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coming Soon!</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container { text-align: center; padding: 2rem; }
    h1 { color: #333; font-size: 2.5rem; margin-bottom: 1rem; }
    p { color: #666; font-size: 1.125rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Coming Soon!</h1>
    <p>Your application is being prepared. Please check back soon.</p>
  </div>
</body>
</html>`;
const ALLOWED_REQUEST_HEADERS = Object.freeze([
    'accept',
    'accept-encoding',
    'cache-control',
    'if-modified-since',
    'if-none-match',
    'range',
]);

/**
 * 공개 파일 성격에 맞는 브라우저 캐시 정책을 반환합니다.
 * @param {URL} publicUrl - jukchang.com 요청 URL입니다.
 * @returns {string} 응답 Cache-Control 값입니다.
 */
export const resolvePublicCacheControl = (publicUrl) => {
    if (publicUrl.pathname.endsWith('/release.json')
        || publicUrl.pathname.endsWith('/')
        || publicUrl.pathname.endsWith('.html')) {
        return 'no-store, max-age=0';
    }
    if (publicUrl.pathname.includes('/releases/')
        || publicUrl.searchParams.has('v')) {
        return 'public, max-age=31536000, immutable';
    }
    if (/\.(?:js|css|json)$/i.test(publicUrl.pathname)
        || publicUrl.pathname.includes('/asset/')) {
        return 'no-cache, max-age=0, must-revalidate';
    }
    return 'public, max-age=3600';
};

/**
 * 공개 URL을 GitHub Pages 프로젝트 URL로 변환합니다.
 * @param {URL} publicUrl - jukchang.com 요청 URL입니다.
 * @returns {URL} GitHub Pages 업스트림 URL입니다.
 */
export const createUpstreamUrl = (publicUrl) => {
    const suffix = publicUrl.pathname.slice(PUBLIC_PATH_PREFIX.length);
    const upstreamUrl = new URL(UPSTREAM_ORIGIN);
    upstreamUrl.pathname = `${UPSTREAM_PATH_PREFIX}${suffix}`;
    upstreamUrl.search = publicUrl.search;
    return upstreamUrl;
};

const createUpstreamHeaders = (requestHeaders) => {
    const upstreamHeaders = new Headers();
    for (const headerName of ALLOWED_REQUEST_HEADERS) {
        const headerValue = requestHeaders.get(headerName);
        if (headerValue !== null) {
            upstreamHeaders.set(headerName, headerValue);
        }
    }
    return upstreamHeaders;
};

const rewriteRedirectLocation = (location, publicUrl) => {
    if (!location) {
        return null;
    }

    const locationUrl = new URL(location, UPSTREAM_ORIGIN);
    const upstreamPrefix = `${UPSTREAM_ORIGIN}${UPSTREAM_PATH_PREFIX}`;
    if (!locationUrl.href.startsWith(upstreamPrefix)) {
        return locationUrl.href;
    }

    const rewrittenUrl = new URL(publicUrl.origin);
    rewrittenUrl.pathname = `${PUBLIC_PATH_PREFIX}${locationUrl.pathname.slice(UPSTREAM_PATH_PREFIX.length)}`;
    rewrittenUrl.search = locationUrl.search;
    rewrittenUrl.hash = locationUrl.hash;
    return rewrittenUrl.href;
};

/**
 * 기존 루트 도메인의 준비 중 화면을 정적 응답으로 보존합니다.
 * @param {string} requestMethod - 원본 HTTP 메서드입니다.
 * @returns {Response} 루트 도메인용 응답입니다.
 */
const createLandingPageResponse = (requestMethod) => new Response(
    requestMethod === 'HEAD' ? null : LANDING_PAGE_HTML,
    {
        status: 200,
        headers: {
            'cache-control': 'public, max-age=300',
            'content-type': 'text/html; charset=utf-8',
            'referrer-policy': 'strict-origin-when-cross-origin',
            'x-content-type-options': 'nosniff',
        },
    },
);

export default {
    async fetch(request) {
        const publicUrl = new URL(request.url);

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return new Response('Method Not Allowed', {
                status: 405,
                headers: { allow: 'GET, HEAD' },
            });
        }

        if (publicUrl.pathname === PUBLIC_PATH_PREFIX) {
            publicUrl.pathname = `${PUBLIC_PATH_PREFIX}/`;
            return Response.redirect(publicUrl.href, 308);
        }

        if (!publicUrl.pathname.startsWith(`${PUBLIC_PATH_PREFIX}/`)) {
            return createLandingPageResponse(request.method);
        }

        const upstreamUrl = createUpstreamUrl(publicUrl);
        const upstreamResponse = await fetch(new Request(upstreamUrl, {
            method: request.method,
            headers: createUpstreamHeaders(request.headers),
            redirect: 'manual',
        }));
        const responseHeaders = new Headers(upstreamResponse.headers);
        const rewrittenLocation = rewriteRedirectLocation(responseHeaders.get('location'), publicUrl);
        if (rewrittenLocation) {
            responseHeaders.set('location', rewrittenLocation);
        }
        responseHeaders.set('x-content-type-options', 'nosniff');
        responseHeaders.set('referrer-policy', 'strict-origin-when-cross-origin');
        responseHeaders.set('cache-control', resolvePublicCacheControl(publicUrl));

        return new Response(upstreamResponse.body, {
            status: upstreamResponse.status,
            statusText: upstreamResponse.statusText,
            headers: responseHeaders,
        });
    },
};
