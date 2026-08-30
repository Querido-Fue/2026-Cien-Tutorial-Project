const GAME_PATH_PREFIX = '/game/nthplayer';
const PRESENTATION_PATH_PREFIX = '/ppt/nthplayer';
const PRESENTATION_EMBED_QUERY = 'presentation';
const PRESENTATION_INPUT_BRIDGE_PATH = `${PRESENTATION_PATH_PREFIX}/embed-input-bridge.js?v=6`;
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
    const suffix = publicUrl.pathname.slice(GAME_PATH_PREFIX.length);
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
    rewrittenUrl.pathname = `${GAME_PATH_PREFIX}${locationUrl.pathname.slice(UPSTREAM_PATH_PREFIX.length)}`;
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

/**
 * 발표 셸 정적 자산에 경로별 캐시와 브라우저 보안 헤더를 적용합니다.
 * @param {Request} request - 원본 공개 요청입니다.
 * @param {object} environment - Cloudflare Worker 바인딩입니다.
 * @returns {Promise<Response>} 발표 셸 또는 안전한 오류 응답입니다.
 */
const createPresentationResponse = async (request, environment) => {
    const assetBinding = environment?.PRESENTATION_ASSETS;
    if (!assetBinding || typeof assetBinding.fetch !== 'function') {
        return new Response('Presentation assets unavailable', {
            status: 503,
            headers: {
                'cache-control': 'no-store',
                'content-type': 'text/plain; charset=utf-8',
            },
        });
    }

    const assetResponse = await assetBinding.fetch(request);
    const responseHeaders = new Headers(assetResponse.headers);
    const contentType = responseHeaders.get('content-type') || '';
    const isDocument = contentType.includes('text/html');

    responseHeaders.set(
        'cache-control',
        isDocument ? 'no-store, max-age=0' : 'no-cache, max-age=0, must-revalidate'
    );
    responseHeaders.set('referrer-policy', 'no-referrer');
    responseHeaders.set('x-content-type-options', 'nosniff');
    responseHeaders.set('cross-origin-resource-policy', 'same-origin');

    if (isDocument) {
        responseHeaders.set(
            'content-security-policy',
            "default-src 'none'; script-src 'self'; "
                + "style-src 'self' https://cdn.jsdelivr.net; frame-src 'self'; "
                + "connect-src 'self'; img-src 'self' data:; "
                + "font-src 'self' https://cdn.jsdelivr.net; "
                + "base-uri 'none'; form-action 'none'; frame-ancestors 'self'"
        );
        responseHeaders.set(
            'permissions-policy',
            'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
        );
    }

    return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers: responseHeaders,
    });
};

/**
 * 발표 iframe 요청에만 포인터 잠금 대체 입력을 게임 부트스트랩보다 먼저 연결합니다.
 * @param {Response} upstreamResponse - GitHub Pages 원본 응답입니다.
 * @param {URL} publicUrl - jukchang.com 게임 요청 URL입니다.
 * @param {Headers} responseHeaders - 공개 응답 헤더입니다.
 * @param {string} requestMethod - 원본 요청 메서드입니다.
 * @returns {Promise<BodyInit|null>} 변환된 HTML 또는 원본 스트림입니다.
 */
export const resolveGameResponseBody = async (
    upstreamResponse,
    publicUrl,
    responseHeaders,
    requestMethod
) => {
    const isPresentationEmbed = publicUrl.pathname === `${GAME_PATH_PREFIX}/`
        && publicUrl.searchParams.get('embed') === PRESENTATION_EMBED_QUERY;
    const isHtml = (responseHeaders.get('content-type') || '').includes('text/html');
    if (!isPresentationEmbed || !isHtml || requestMethod === 'HEAD') {
        return upstreamResponse.body;
    }

    const source = await upstreamResponse.text();
    const bridgeTag = `<script src="${PRESENTATION_INPUT_BRIDGE_PATH}"></script>`;
    const transformed = source.includes('</head>')
        ? source.replace('</head>', `  ${bridgeTag}\n</head>`)
        : `${bridgeTag}\n${source}`;
    responseHeaders.delete('content-length');
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('etag');
    return transformed;
};

export default {
    async fetch(request, environment) {
        const publicUrl = new URL(request.url);

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return new Response('Method Not Allowed', {
                status: 405,
                headers: { allow: 'GET, HEAD' },
            });
        }

        if (publicUrl.pathname === GAME_PATH_PREFIX) {
            publicUrl.pathname = `${GAME_PATH_PREFIX}/`;
            return Response.redirect(publicUrl.href, 308);
        }

        if (publicUrl.pathname === PRESENTATION_PATH_PREFIX) {
            publicUrl.pathname = `${PRESENTATION_PATH_PREFIX}/`;
            return Response.redirect(publicUrl.href, 308);
        }

        if (publicUrl.pathname.startsWith(`${PRESENTATION_PATH_PREFIX}/`)) {
            return createPresentationResponse(request, environment);
        }

        if (!publicUrl.pathname.startsWith(`${GAME_PATH_PREFIX}/`)) {
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
        const responseBody = await resolveGameResponseBody(
            upstreamResponse,
            publicUrl,
            responseHeaders,
            request.method
        );

        return new Response(responseBody, {
            status: upstreamResponse.status,
            statusText: upstreamResponse.statusText,
            headers: responseHeaders,
        });
    },
};
