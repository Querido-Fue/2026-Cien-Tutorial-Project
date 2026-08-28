const PUBLIC_PATH_PREFIX = '/game/nthplayer';
const UPSTREAM_ORIGIN = 'https://querido-fue.github.io';
const UPSTREAM_PATH_PREFIX = '/2026-Cien-Tutorial-Project';
const ALLOWED_REQUEST_HEADERS = Object.freeze([
    'accept',
    'accept-encoding',
    'if-modified-since',
    'if-none-match',
    'range',
]);

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

export default {
    async fetch(request) {
        const publicUrl = new URL(request.url);

        if (publicUrl.pathname === PUBLIC_PATH_PREFIX) {
            publicUrl.pathname = `${PUBLIC_PATH_PREFIX}/`;
            return Response.redirect(publicUrl.href, 308);
        }

        if (!publicUrl.pathname.startsWith(`${PUBLIC_PATH_PREFIX}/`)) {
            return new Response('Not Found', { status: 404 });
        }

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return new Response('Method Not Allowed', {
                status: 405,
                headers: { allow: 'GET, HEAD' },
            });
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

        return new Response(upstreamResponse.body, {
            status: upstreamResponse.status,
            statusText: upstreamResponse.statusText,
            headers: responseHeaders,
        });
    },
};
