/**
 * @class TutorialBattleLayout
 * @description 전투 보드 투영, HUD 사각형과 타일 히트테스트의 단일 좌표 원본입니다.
 */
export class TutorialBattleLayout {
    #config;
    #geometry;

    /**
     * @param {object} config - 맵·층·레이아웃·흔들림 정적 설정입니다.
     */
    constructor(config) {
        this.#config = config;
        this.#geometry = null;
    }

    /**
     * 현재 뷰포트로 보드와 HUD의 고정 기하를 다시 계산합니다.
     * @param {{WW:number,WH:number,UIWW:number,UIOffsetX:number}} viewport - 화면 크기입니다.
     * @returns {object} 직렬화 가능한 전투 기하입니다.
     */
    resize(viewport) {
        const safeViewport = Object.freeze({
            WW: Number(viewport?.WW) || 0,
            WH: Number(viewport?.WH) || 0,
            UIWW: Number(viewport?.UIWW) || 0,
            UIOffsetX: Number(viewport?.UIOffsetX) || 0
        });
        const uww = (value) => safeViewport.UIWW * (Number(value) / 100);
        const uwh = (value) => safeViewport.WH * (Number(value) / 100);
        const boardLayout = this.#config.board;
        const boardRect = Object.freeze({
            x: safeViewport.UIOffsetX + uww(boardLayout.X_UIWW),
            y: uwh(boardLayout.Y_WH),
            w: uww(boardLayout.MAX_WIDTH_UIWW),
            h: uwh(boardLayout.MAX_HEIGHT_WH)
        });
        const minBoardSide = Math.min(boardRect.w, boardRect.h);
        const boardPadding = Math.min(
            Math.max(4, minBoardSide * boardLayout.FRAME_PADDING_RATIO),
            boardRect.w * 0.08,
            boardRect.h * 0.08
        );
        const mapWidth = Math.max(1, Number(this.#config.map?.WIDTH) || 1);
        const mapHeight = Math.max(1, Number(this.#config.map?.HEIGHT) || 1);
        const innerW = boardRect.w - (boardPadding * 2);
        const innerH = boardRect.h - (boardPadding * 2);
        const diagonalSpan = mapWidth + mapHeight;
        const maxTileHeight = Math.max(
            0,
            ...this.#config.floors.flatMap((floor) => floor.heights.flat())
        );
        const tileWidth = Math.max(2, Math.floor(Math.min(
            (innerW * 2) / diagonalSpan,
            innerH / ((diagonalSpan / 4) + (maxTileHeight * 0.14))
        )));
        const tileHeight = tileWidth * 0.5;
        const tileElevation = tileHeight * 0.28;
        const tileSide = tileWidth * (
            Number(boardLayout.ENTITY_SCALE_RATIO) || 0.64
        );
        const tileGap = tileWidth * Math.max(
            0,
            Number(boardLayout.TILE_GAP_RATIO) || 0
        );
        const gridW = diagonalSpan * tileWidth * 0.5;
        const gridH = (diagonalSpan * tileHeight * 0.5)
            + (maxTileHeight * tileElevation);
        const gridRect = Object.freeze({
            x: boardRect.x + ((boardRect.w - gridW) * 0.5),
            y: boardRect.y + ((boardRect.h - gridH) * 0.5),
            w: gridW,
            h: gridH
        });
        const hudRects = Object.freeze(Object.fromEntries(
            Object.entries(this.#config.hud).map(([key, layout]) => ([key, Object.freeze({
                x: safeViewport.UIOffsetX + uww(layout.X_UIWW),
                y: uwh(layout.Y_WH),
                w: uww(layout.WIDTH_UIWW),
                h: uwh(layout.HEIGHT_WH)
            })]))
        ));
        this.#geometry = Object.freeze({
            viewport: safeViewport,
            mapWidth,
            mapHeight,
            boardRect,
            boardPadding,
            gridRect,
            tileWidth,
            tileHeight,
            tileElevation,
            tileSide,
            tileGap,
            isoOriginX: boardRect.x + (boardRect.w * 0.5)
                - ((mapWidth - mapHeight) * tileWidth * 0.25),
            isoOriginY: gridRect.y
                + (maxTileHeight * tileElevation)
                + (tileHeight * 0.5),
            hudRects
        });
        return this.#geometry;
    }

    /**
     * 현재 고정 기하에 층 높이와 화면 흔들림을 결합합니다.
     * @param {object} options - 현재 층과 피드백 시간입니다.
     * @returns {object} 한 프레임에서 공유할 투영 레이아웃입니다.
     */
    createFrame({ floor, elapsedSeconds = 0, screenShakeSeconds = 0 } = {}) {
        if (!this.#geometry) {
            throw new Error('TutorialBattleLayout.resize()를 먼저 호출해야 합니다.');
        }
        const ratio = Number(this.#config.shakeTileRatio) || 0.055;
        const shaking = Number(screenShakeSeconds) > 0;
        const shake = Object.freeze(shaking ? {
            x: Math.sin(Number(elapsedSeconds) * 74) * this.#geometry.tileSide * ratio,
            y: Math.cos(Number(elapsedSeconds) * 61) * this.#geometry.tileSide * ratio
        } : { x: 0, y: 0 });
        return Object.freeze({
            ...this.#geometry,
            heights: floor?.heights || [],
            shake
        });
    }

    /** @returns {object|null} 마지막으로 계산한 고정 기하입니다. */
    getGeometry() {
        return this.#geometry;
    }

    /**
     * 타일 좌표를 쿼터뷰 화면 좌표로 변환합니다.
     * @param {object} frame - `createFrame()` 결과입니다.
     * @param {number} x - 타일 X입니다.
     * @param {number} y - 타일 Y입니다.
     * @returns {{x:number,y:number,height:number}} 화면 좌표입니다.
     */
    static projectTile(frame, x, y) {
        const height = Number(frame?.heights?.[y]?.[x]) || 0;
        return {
            x: Number(frame?.isoOriginX)
                + ((Number(x) - Number(y)) * Number(frame?.tileWidth) * 0.5)
                + Number(frame?.shake?.x || 0),
            y: Number(frame?.isoOriginY)
                + ((Number(x) + Number(y)) * Number(frame?.tileHeight) * 0.5)
                - (height * Number(frame?.tileElevation))
                + Number(frame?.shake?.y || 0),
            height
        };
    }

    /**
     * 포인터 좌표가 포함된 가장 앞쪽 타일을 찾습니다.
     * @param {object} frame - 렌더와 동일한 투영 프레임입니다.
     * @param {number} px - 화면 X입니다.
     * @param {number} py - 화면 Y입니다.
     * @returns {{x:number,y:number}|null} 선택 타일입니다.
     */
    static hitTestTile(frame, px, py) {
        if (!Number.isFinite(px) || !Number.isFinite(py)) {
            return null;
        }
        const candidates = [];
        for (let y = 0; y < Number(frame?.mapHeight || 0); y++) {
            for (let x = 0; x < Number(frame?.mapWidth || 0); x++) {
                const point = TutorialBattleLayout.projectTile(frame, x, y);
                const distance = Math.abs(px - point.x) / (Number(frame.tileWidth) * 0.5)
                    + Math.abs(py - point.y) / (Number(frame.tileHeight) * 0.5);
                if (distance <= 1) {
                    candidates.push({ x, y, distance, depth: x + y });
                }
            }
        }
        candidates.sort((left, right) => (
            right.depth - left.depth || left.distance - right.distance
        ));
        const hit = candidates[0];
        return hit ? { x: hit.x, y: hit.y } : null;
    }
}
