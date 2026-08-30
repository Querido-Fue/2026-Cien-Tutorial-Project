const MAP_SIZE = Object.freeze({ width: 970, height: 580 });
const GRID_SIZE = Object.freeze({ columns: 9, rows: 8 });
const GRID_QUAD = Object.freeze({
    top: Object.freeze({ x: 467, y: 136 }),
    right: Object.freeze({ x: 917, y: 316 }),
    bottom: Object.freeze({ x: 581, y: 540 }),
    left: Object.freeze({ x: 131, y: 360 }),
});
const ROUTE_TILES = Object.freeze([
    Object.freeze({ column: 2, row: 6, label: 'P', color: '#4f96e0' }),
    Object.freeze({ column: 3, row: 6, label: '1', color: '#f06d45' }),
    Object.freeze({ column: 3, row: 5, label: '2', color: '#f06d45' }),
    Object.freeze({ column: 4, row: 5, label: '3', color: '#f06d45' }),
    Object.freeze({ column: 4, row: 4, label: '4', color: '#f06d45' }),
    Object.freeze({ column: 7, row: 2, label: 'L', color: '#7450d7' }),
]);

export const PLAYER_PATH_REVEAL_TIMING = Object.freeze({
    initialDelayMs: 600,
    tileDurationMs: 540,
    maximumIntervalMs: 180,
    minimumIntervalMs: 72,
});

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

/** @param {number} progress - 0~1 진행률입니다. @returns {number} expo 감속값입니다. */
export function easeOutExpo(progress) {
    const normalized = clamp01(progress);
    return normalized === 1 ? 1 : 1 - (2 ** (-10 * normalized));
}

/**
 * 타일별 시작 간격이 easeOutExpo 곡선을 따라 짧아지는 누적 지연을 만듭니다.
 * @param {number} tileCount - 순서대로 드러낼 타일 수입니다.
 * @returns {number[]} 밀리초 단위 누적 지연입니다.
 */
export function createPlayerPathRevealDelays(tileCount) {
    const count = Math.max(0, Math.floor(Number(tileCount) || 0));
    const delays = [];
    let elapsed = PLAYER_PATH_REVEAL_TIMING.initialDelayMs;

    for (let index = 0; index < count; index += 1) {
        delays.push(Math.round(elapsed));
        if (index >= count - 1) {
            continue;
        }
        const intervalProgress = index / Math.max(1, count - 2);
        const interval = PLAYER_PATH_REVEAL_TIMING.maximumIntervalMs
            + (
                PLAYER_PATH_REVEAL_TIMING.minimumIntervalMs
                - PLAYER_PATH_REVEAL_TIMING.maximumIntervalMs
            ) * easeOutExpo(intervalProgress);
        elapsed += interval;
    }

    return delays;
}

/**
 * 게임의 970×580 맵과 동일한 cover 배치에서 격자 좌표를 화면 좌표로 투영합니다.
 * @param {number} column - 0~9 격자 x 좌표입니다.
 * @param {number} row - 0~8 격자 y 좌표입니다.
 * @param {number} viewportWidth - 보드의 CSS 폭입니다.
 * @param {number} viewportHeight - 보드의 CSS 높이입니다.
 * @returns {{x:number,y:number}} 보드 내부 화면 좌표입니다.
 */
export function projectPlayerGridPoint(column, row, viewportWidth, viewportHeight) {
    const width = Math.max(1, Number(viewportWidth) || 1);
    const height = Math.max(1, Number(viewportHeight) || 1);
    const scale = Math.max(width / MAP_SIZE.width, height / MAP_SIZE.height);
    const offsetX = (width - (MAP_SIZE.width * scale)) * 0.5;
    const offsetY = (height - (MAP_SIZE.height * scale)) * 0.5;
    const columnRatio = Number(column) / GRID_SIZE.columns;
    const rowRatio = Number(row) / GRID_SIZE.rows;
    const sourceX = GRID_QUAD.top.x
        + ((GRID_QUAD.right.x - GRID_QUAD.top.x) * columnRatio)
        + ((GRID_QUAD.left.x - GRID_QUAD.top.x) * rowRatio);
    const sourceY = GRID_QUAD.top.y
        + ((GRID_QUAD.right.y - GRID_QUAD.top.y) * columnRatio)
        + ((GRID_QUAD.left.y - GRID_QUAD.top.y) * rowRatio);

    return {
        x: offsetX + (sourceX * scale),
        y: offsetY + (sourceY * scale),
    };
}

/** @param {CanvasRenderingContext2D} context @param {{x:number,y:number}[]} points */
function tracePolygon(context, points) {
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.closePath();
}

/**
 * 플레이어 시스템 슬라이드의 격자와 경로 타일을 실제 맵 투영에 맞춰 그립니다.
 */
export class PlayerPathOverlay {
    #active = false;
    #canvas;
    #context;
    #frame = 0;
    #resizeObserver = null;
    #stage = null;
    #startedAt = 0;
    #tileDelays = createPlayerPathRevealDelays(ROUTE_TILES.length);

    /** @param {HTMLCanvasElement} canvas - 경로를 합성할 투명 캔버스입니다. */
    constructor(canvas) {
        if (!canvas || canvas.tagName !== 'CANVAS') {
            throw new TypeError('PlayerPathOverlay requires a canvas element.');
        }
        this.#canvas = canvas;
        this.#context = canvas.getContext('2d');
    }

    /** @param {HTMLElement} stage - 슬라이드 변경 이벤트를 내보내는 발표 루트입니다. */
    connect(stage) {
        if (!this.#context || !stage) {
            return;
        }
        this.#stage = stage;
        this.#stage.addEventListener('nthplayer:slide-change', this.#handleSlideChange);
        if (typeof ResizeObserver === 'function') {
            this.#resizeObserver = new ResizeObserver(() => this.#redrawCurrentFrame());
            this.#resizeObserver.observe(this.#canvas);
        }
    }

    /** 이벤트와 애니메이션 프레임을 정리합니다. */
    disconnect() {
        this.#stage?.removeEventListener('nthplayer:slide-change', this.#handleSlideChange);
        this.#resizeObserver?.disconnect();
        this.#resizeObserver = null;
        this.#stage = null;
        this.#stop();
    }

    /** @param {CustomEvent} event - 현재 활성 슬라이드 변경 이벤트입니다. */
    #handleSlideChange = (event) => {
        const active = Boolean(event.detail?.slide?.contains(this.#canvas));
        if (active) {
            this.#start();
            return;
        }
        this.#active = false;
        this.#stop();
        this.#clear();
    };

    /** 배경이 먼저 보인 뒤 오버레이를 처음부터 재생합니다. */
    #start() {
        this.#stop();
        this.#active = true;
        this.#startedAt = performance.now();
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.#draw(this.#totalDuration());
            return;
        }
        this.#frame = requestAnimationFrame(this.#renderFrame);
    }

    /** @param {number} timestamp - requestAnimationFrame 시각입니다. */
    #renderFrame = (timestamp) => {
        if (!this.#active) {
            return;
        }
        const elapsed = Math.max(0, timestamp - this.#startedAt);
        this.#draw(elapsed);
        if (elapsed < this.#totalDuration()) {
            this.#frame = requestAnimationFrame(this.#renderFrame);
            return;
        }
        this.#frame = 0;
    };

    /** 크기 변경 시 현재 진행 지점을 새 투영으로 다시 그립니다. */
    #redrawCurrentFrame() {
        if (!this.#active) {
            return;
        }
        this.#draw(Math.max(0, performance.now() - this.#startedAt));
    }

    /** @returns {number} 마지막 타일이 완전히 안착하는 시각입니다. */
    #totalDuration() {
        return (this.#tileDelays.at(-1) || 0) + PLAYER_PATH_REVEAL_TIMING.tileDurationMs;
    }

    /** 실행 중인 프레임 요청을 취소합니다. */
    #stop() {
        if (this.#frame) {
            cancelAnimationFrame(this.#frame);
            this.#frame = 0;
        }
    }

    /** 캔버스 합성을 비웁니다. */
    #clear() {
        const width = this.#canvas.clientWidth;
        const height = this.#canvas.clientHeight;
        this.#context?.clearRect(0, 0, width, height);
    }

    /** @param {number} elapsed - 슬라이드 진입 후 경과 밀리초입니다. */
    #draw(elapsed) {
        const surface = this.#prepareSurface();
        if (!surface) {
            return;
        }
        const { width, height } = surface;
        this.#context.clearRect(0, 0, width, height);

        const gridProgress = easeOutExpo(
            (elapsed - PLAYER_PATH_REVEAL_TIMING.initialDelayMs) / 420
        );
        if (gridProgress > 0) {
            this.#drawGrid(width, height, gridProgress);
        }

        ROUTE_TILES.forEach((tile, index) => {
            const progress = clamp01(
                (elapsed - this.#tileDelays[index]) / PLAYER_PATH_REVEAL_TIMING.tileDurationMs
            );
            if (progress > 0) {
                this.#drawTile(tile, width, height, easeOutExpo(progress));
            }
        });
    }

    /** @returns {{width:number,height:number}|null} CSS 픽셀 기준 그리기 표면입니다. */
    #prepareSurface() {
        const width = Math.round(this.#canvas.clientWidth);
        const height = Math.round(this.#canvas.clientHeight);
        if (width <= 0 || height <= 0) {
            return null;
        }
        const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
        const outputWidth = Math.round(width * pixelRatio);
        const outputHeight = Math.round(height * pixelRatio);
        if (this.#canvas.width !== outputWidth || this.#canvas.height !== outputHeight) {
            this.#canvas.width = outputWidth;
            this.#canvas.height = outputHeight;
        }
        this.#context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        return { width, height };
    }

    /** 실제 9×8 맵 축을 따라 안내 격자를 그립니다. */
    #drawGrid(width, height, progress) {
        const context = this.#context;
        context.save();
        context.globalAlpha = 0.5 * progress;
        context.strokeStyle = 'rgba(255, 255, 255, 0.72)';
        context.lineWidth = Math.max(0.75, width / 1600);

        for (let column = 0; column <= GRID_SIZE.columns; column += 1) {
            const start = projectPlayerGridPoint(column, 0, width, height);
            const end = projectPlayerGridPoint(column, GRID_SIZE.rows, width, height);
            context.beginPath();
            context.moveTo(start.x, start.y);
            context.lineTo(end.x, end.y);
            context.stroke();
        }
        for (let row = 0; row <= GRID_SIZE.rows; row += 1) {
            const start = projectPlayerGridPoint(0, row, width, height);
            const end = projectPlayerGridPoint(GRID_SIZE.columns, row, width, height);
            context.beginPath();
            context.moveTo(start.x, start.y);
            context.lineTo(end.x, end.y);
            context.stroke();
        }
        context.restore();
    }

    /** @param {{column:number,row:number,label:string,color:string}} tile */
    #drawTile(tile, width, height, progress) {
        const context = this.#context;
        const quad = [
            projectPlayerGridPoint(tile.column, tile.row, width, height),
            projectPlayerGridPoint(tile.column + 1, tile.row, width, height),
            projectPlayerGridPoint(tile.column + 1, tile.row + 1, width, height),
            projectPlayerGridPoint(tile.column, tile.row + 1, width, height),
        ];
        const center = quad.reduce((point, vertex) => ({
            x: point.x + (vertex.x / quad.length),
            y: point.y + (vertex.y / quad.length),
        }), { x: 0, y: 0 });
        const scale = 0.76 + (0.24 * progress);
        const lift = -(1 - progress) * Math.max(8, height * 0.018);
        const animatedQuad = quad.map((vertex) => ({
            x: center.x + ((vertex.x - center.x) * scale),
            y: center.y + ((vertex.y - center.y) * scale) + lift,
        }));
        const labelCenter = {
            x: center.x,
            y: center.y + lift,
        };

        context.save();
        context.globalAlpha = 0.88 * progress;
        context.shadowColor = tile.color;
        context.shadowBlur = Math.max(8, width * 0.012) * (1 - progress);
        context.fillStyle = tile.color;
        tracePolygon(context, animatedQuad);
        context.fill();
        context.shadowBlur = 0;
        context.strokeStyle = 'rgba(255, 255, 255, 0.84)';
        context.lineWidth = Math.max(0.9, width / 1300);
        context.stroke();

        context.globalAlpha = progress;
        context.fillStyle = '#ffffff';
        context.font = `700 ${Math.min(22, Math.max(11, width * 0.016))}px "SUIT Variable", sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(tile.label, labelCenter.x, labelCenter.y);
        context.restore();
    }
}
