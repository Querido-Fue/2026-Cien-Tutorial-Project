/** 페이지 앞·뒷면의 실제 콘텐츠 UV를 3D 곡면과 함께 투영합니다. */
export const PAGE_VERTEX_SHADER = `
    precision highp float;
    attribute vec2 a_unit;
    uniform vec2 u_resolution;
    uniform vec4 u_pageRect;
    uniform vec4 u_backPageRect;
    uniform float u_progress;
    uniform float u_direction;
    uniform float u_curlStrength;
    uniform float u_depthRatio;
    uniform float u_perspectiveRatio;
    varying vec2 v_sourceUv;
    varying vec2 v_backUv;
    varying float v_light;
    varying float v_facing;
    varying float v_edge;

    void main() {
        const float PI = 3.14159265359;
        float progress = clamp(u_progress, 0.0, 1.0);
        float sourceWidth = max(1.0, u_pageRect.z);
        float backWidth = max(1.0, u_backPageRect.z);
        float pageWidth = mix(sourceWidth, backWidth, progress);
        float pageHeight = mix(u_pageRect.w, u_backPageRect.w, progress);
        float pageY = mix(u_pageRect.y, u_backPageRect.y, progress);
        float spineX = u_direction > 0.0 ? u_pageRect.x : u_pageRect.x + sourceWidth;
        float radius = a_unit.x * pageWidth;
        float activity = sin(progress * PI);
        float curl = sin(a_unit.x * PI) * activity * u_curlStrength * (0.68 - a_unit.x);
        float localAngle = (progress * PI) + curl;
        float localX = u_direction * radius * cos(localAngle);
        float depth = radius * sin(localAngle) * u_depthRatio;
        float vertical = (a_unit.y - 0.5) * pageHeight;
        vertical += sin(a_unit.x * PI) * activity
            * (a_unit.y - 0.5) * pageHeight * 0.075;

        float perspective = pageWidth * u_perspectiveRatio;
        float perspectiveScale = perspective / max(pageWidth * 0.8, perspective - depth);
        vec2 projected = vec2(
            spineX + (localX * perspectiveScale),
            pageY + (pageHeight * 0.5) + (vertical * perspectiveScale)
        );
        vec2 clipSpace = ((projected / u_resolution) * 2.0) - 1.0;
        float clipW = max(0.25, 1.0 - (depth / perspective));
        gl_Position = vec4(
            clipSpace * vec2(1.0, -1.0) * clipW,
            (-depth / (pageWidth * 1.2)) * clipW,
            clipW
        );

        float sourceX = spineX + (u_direction * a_unit.x * sourceWidth);
        float backSpineX = u_direction > 0.0
            ? u_backPageRect.x + backWidth : u_backPageRect.x;
        float backX = backSpineX - (u_direction * a_unit.x * backWidth);
        v_sourceUv = vec2(sourceX, u_pageRect.y + (a_unit.y * u_pageRect.w)) / u_resolution;
        v_backUv = vec2(backX, u_backPageRect.y + (a_unit.y * u_backPageRect.w)) / u_resolution;
        v_facing = cos(localAngle);
        float grazing = 1.0 - abs(v_facing);
        v_light = 1.0 - (activity * ((grazing * 0.24) + (a_unit.x * 0.06)));
        float edgeDistance = min(
            min(a_unit.x, 1.0 - a_unit.x),
            min(a_unit.y, 1.0 - a_unit.y)
        );
        v_edge = 1.0 - smoothstep(0.0, 0.018, edgeDistance);
    }
`;

/** 뒷면도 단색 종이가 아닌 다음 페이지의 글·그림을 그대로 샘플링합니다. */
export const PAGE_FRAGMENT_SHADER = `
    precision highp float;
    varying vec2 v_sourceUv;
    varying vec2 v_backUv;
    varying float v_light;
    varying float v_facing;
    varying float v_edge;
    uniform sampler2D u_pageTexture;
    uniform sampler2D u_backTexture;
    uniform float u_progress;
    uniform float u_alpha;
    uniform vec3 u_backColor;
    uniform vec3 u_edgeColor;

    void main() {
        bool backFacing = v_facing < 0.0;
        vec4 sampled = backFacing
            ? texture2D(u_backTexture, v_backUv)
            : texture2D(u_pageTexture, v_sourceUv);
        if (sampled.a <= 0.002) {
            discard;
        }
        float alpha = sampled.a * u_alpha;
        float activity = sin(clamp(u_progress, 0.0, 1.0) * 3.14159265359);
        vec3 surfaceColor = sampled.rgb * max(0.55, v_light);
        if (backFacing) {
            float paperGrain = 1.0 - (0.005 * activity) + (0.005 * activity * sin(
                (v_backUv.x * 1733.0) + (v_backUv.y * 977.0)
            ));
            surfaceColor = mix(surfaceColor, u_backColor, 0.025 * activity) * paperGrain;
        }
        surfaceColor = mix(surfaceColor, u_edgeColor, v_edge * activity * 0.14);
        gl_FragColor = vec4(surfaceColor * alpha, alpha);
    }
`;

/** 고정 페이지는 이전 목적 면과 새로 드러날 출발 면을 각각 한 번만 그립니다. */
export const SPREAD_FRAGMENT_SHADER = `
    precision highp float;
    varying vec2 v_uv;
    uniform vec2 u_resolution;
    uniform vec4 u_pageRect;
    uniform float u_direction;
    uniform float u_alpha;
    uniform sampler2D u_pageTexture;
    uniform sampler2D u_backTexture;

    void main() {
        vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
        float spineX = u_direction > 0.0
            ? u_pageRect.x : u_pageRect.x + u_pageRect.z;
        float revealed = step(0.0, ((uv.x * u_resolution.x) - spineX) * u_direction);
        vec4 sampled = mix(
            texture2D(u_pageTexture, uv),
            texture2D(u_backTexture, uv),
            revealed
        );
        float alpha = sampled.a * u_alpha;
        gl_FragColor = vec4(sampled.rgb * alpha, alpha);
    }
`;

/** 움직이는 페이지 가장자리와 책등의 낙하 그림자를 합성합니다. */
export const SHADOW_FRAGMENT_SHADER = `
    precision highp float;
    varying vec2 v_uv;
    uniform vec2 u_resolution;
    uniform vec4 u_pageRect;
    uniform float u_progress;
    uniform float u_direction;
    uniform float u_shadowAlpha;
    uniform vec3 u_shadowColor;

    void main() {
        const float PI = 3.14159265359;
        vec2 point = vec2(v_uv.x * u_resolution.x, (1.0 - v_uv.y) * u_resolution.y);
        float pageWidth = max(1.0, u_pageRect.z);
        float pageHeight = max(1.0, u_pageRect.w);
        float spineX = u_direction > 0.0 ? u_pageRect.x : u_pageRect.x + pageWidth;
        float activity = sin(clamp(u_progress, 0.0, 1.0) * PI);
        float edgeX = spineX + (u_direction * pageWidth * cos(u_progress * PI));
        float shadowWidth = pageWidth * (0.025 + (activity * 0.12));
        float edgeDistance = (point.x - edgeX) / max(1.0, shadowWidth);
        float edgeShadow = exp(-(edgeDistance * edgeDistance) * 1.8);
        float spineDistance = abs(point.x - spineX) / max(1.0, shadowWidth * 1.4);
        float spineShadow = exp(-(spineDistance * spineDistance) * 1.35) * 0.34;
        float top = u_pageRect.y - (pageHeight * 0.12);
        float bottom = u_pageRect.y + pageHeight + (pageHeight * 0.12);
        float verticalMask = smoothstep(top, top + (pageHeight * 0.08), point.y)
            * (1.0 - smoothstep(bottom - (pageHeight * 0.08), bottom, point.y));
        float horizontalMask = 1.0 - smoothstep(
            pageWidth * 1.02, pageWidth * 1.32, abs(point.x - spineX)
        );
        float alpha = (edgeShadow + spineShadow) * activity
            * verticalMask * horizontalMask * u_shadowAlpha;
        if (alpha <= 0.002) {
            discard;
        }
        gl_FragColor = vec4(u_shadowColor * alpha, alpha);
    }
`;
