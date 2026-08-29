import { createTutorialDesignSpace } from './_tutorial_design_space.js';

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
        const designSpace = createTutorialDesignSpace(safeViewport);
        const uww = (value) => designSpace.w * (Number(value) / 100);
        const uwh = (value) => designSpace.h * (Number(value) / 100);
        const boardLayout = this.#config.board;
        const boardRect = Object.freeze({
            x: Math.round(designSpace.x + uww(boardLayout.X_UIWW)),
            y: Math.round(designSpace.y + uwh(boardLayout.Y_WH)),
            w: Math.round(uww(boardLayout.MAX_WIDTH_UIWW)),
            h: Math.round(uwh(boardLayout.MAX_HEIGHT_WH))
        });
        const worldRect = Object.freeze({
            x: 0,
            y: 0,
            w: Math.max(1, Math.round(safeViewport.WW)),
            h: Math.max(1, Math.round(safeViewport.WH))
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
                x: Math.round(designSpace.x + uww(layout.X_UIWW)),
                y: Math.round(designSpace.y + uwh(layout.Y_WH)),
                w: Math.round(uww(layout.WIDTH_UIWW)),
                h: Math.round(uwh(layout.HEIGHT_WH))
            })]))
        ));
        this.#geometry = Object.freeze({
            viewport: safeViewport,
            designSpace,
            mapWidth,
            mapHeight,
            boardRect,
            worldRect,
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
    createFrame({
        floor,
        camera = null,
        elapsedSeconds = 0,
        screenShakeSeconds = 0
    } = {}) {
        if (!this.#geometry) {
            throw new Error('TutorialBattleLayout.resize()를 먼저 호출해야 합니다.');
        }
        const ratio = Number(this.#config.shakeTileRatio) || 0.055;
        const shaking = Number(screenShakeSeconds) > 0;
        const shake = Object.freeze(shaking ? {
            x: Math.sin(Number(elapsedSeconds) * 74) * this.#geometry.tileSide * ratio,
            y: Math.cos(Number(elapsedSeconds) * 61) * this.#geometry.tileSide * ratio
        } : { x: 0, y: 0 });
        const artworkProjection = this.#createArtworkProjection(floor?.id, camera);
        return Object.freeze({
            ...this.#geometry,
            ...(artworkProjection || {}),
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
        if (frame?.gridAxisX && frame?.gridAxisY) {
            return {
                x: Number(frame.isoOriginX)
                    + (Number(x) * Number(frame.gridAxisX.x))
                    + (Number(y) * Number(frame.gridAxisY.x))
                    + Number(frame?.shake?.x || 0),
                y: Number(frame.isoOriginY)
                    + (Number(x) * Number(frame.gridAxisX.y))
                    + (Number(y) * Number(frame.gridAxisY.y))
                    - (height * Number(frame?.tileElevation))
                    + Number(frame?.shake?.y || 0),
                height
            };
        }
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
     * 타일 중심과 같은 투영 축으로 임의 배율의 네 꼭짓점을 계산합니다.
     * 반환 순서는 위→오른쪽→아래→왼쪽이며 WebGL 사각형 정점 순서와 같습니다.
     * @param {object} frame - `createFrame()` 결과입니다.
     * @param {number} x - 타일 X입니다.
     * @param {number} y - 타일 Y입니다.
     * @param {number} [scale=1] - 타일 중심을 기준으로 한 배율입니다.
     * @returns {number[]} 네 꼭짓점의 평면 좌표 배열입니다.
     */
    static projectTileQuad(frame, x, y, scale = 1) {
        const point = TutorialBattleLayout.projectTile(frame, x, y);
        const axisX = frame?.gridAxisX || {
            x: Number(frame?.tileWidth) * 0.5,
            y: Number(frame?.tileHeight) * 0.5
        };
        const axisY = frame?.gridAxisY || {
            x: Number(frame?.tileWidth) * -0.5,
            y: Number(frame?.tileHeight) * 0.5
        };
        const numericScale = Number(scale);
        const halfScale = Math.max(
            0,
            Number.isFinite(numericScale) ? numericScale : 1
        ) * 0.5;
        const halfAxisX = {
            x: Number(axisX.x) * halfScale,
            y: Number(axisX.y) * halfScale
        };
        const halfAxisY = {
            x: Number(axisY.x) * halfScale,
            y: Number(axisY.y) * halfScale
        };
        return [
            point.x - halfAxisX.x - halfAxisY.x,
            point.y - halfAxisX.y - halfAxisY.y,
            point.x + halfAxisX.x - halfAxisY.x,
            point.y + halfAxisX.y - halfAxisY.y,
            point.x + halfAxisX.x + halfAxisY.x,
            point.y + halfAxisX.y + halfAxisY.y,
            point.x - halfAxisX.x + halfAxisY.x,
            point.y - halfAxisX.y + halfAxisY.y
        ];
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
        const axisX = frame?.gridAxisX;
        const axisY = frame?.gridAxisY;
        const determinant = axisX && axisY
            ? (Number(axisX.x) * Number(axisY.y))
                - (Number(axisX.y) * Number(axisY.x))
            : 0;
        for (let y = 0; y < Number(frame?.mapHeight || 0); y++) {
            for (let x = 0; x < Number(frame?.mapWidth || 0); x++) {
                const point = TutorialBattleLayout.projectTile(frame, x, y);
                let distance;
                let inside;
                if (Math.abs(determinant) > 0.0001) {
                    const dx = px - point.x;
                    const dy = py - point.y;
                    const localX = ((dx * Number(axisY.y)) - (dy * Number(axisY.x)))
                        / determinant;
                    const localY = ((dy * Number(axisX.x)) - (dx * Number(axisX.y)))
                        / determinant;
                    distance = Math.max(Math.abs(localX), Math.abs(localY)) * 2;
                    inside = Math.abs(localX) <= 0.5 && Math.abs(localY) <= 0.5;
                } else {
                    distance = Math.abs(px - point.x) / (Number(frame.tileWidth) * 0.5)
                        + Math.abs(py - point.y) / (Number(frame.tileHeight) * 0.5);
                    inside = distance <= 1;
                }
                if (inside) {
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

    /**
     * 실제 격자의 좌우 폭을 월드 뷰포트에 맞추고 카메라 초점을 적용합니다.
     * @param {string} floorId - 표시할 층 ID입니다.
     * @param {object|null} camera - 추적 중인 타일 좌표입니다.
     * @returns {object|null} 맵 이미지와 타일 축을 공유하는 투영값입니다.
     * @private
     */
    #createArtworkProjection(floorId, camera) {
        const profile = this.#config.mapArtwork?.[floorId];
        const sourceWidth = Number(profile?.sourceDimensions?.width);
        const sourceHeight = Number(profile?.sourceDimensions?.height);
        const quad = profile?.gridQuad;
        if (!(sourceWidth > 0) || !(sourceHeight > 0)
            || !quad?.top || !quad?.right || !quad?.bottom || !quad?.left) {
            return null;
        }
        const worldRect = this.#geometry.worldRect;
        const quadPoints = [quad.top, quad.right, quad.bottom, quad.left];
        const gridMinX = Math.min(...quadPoints.map((point) => Number(point.x)));
        const gridMaxX = Math.max(...quadPoints.map((point) => Number(point.x)));
        const sourceGridWidth = Math.max(1, gridMaxX - gridMinX);
        const viewportRatio = Math.max(
            0.01,
            Number(this.#config.camera?.GRID_WIDTH_VIEWPORT_RATIO) || 1
        );
        const scale = (worldRect.w * viewportRatio) / sourceGridWidth;
        const imageW = Math.max(1, Math.round(sourceWidth * scale));
        const imageH = Math.max(1, Math.round(sourceHeight * scale));
        const scaleX = imageW / sourceWidth;
        const scaleY = imageH / sourceHeight;
        const mapWidth = this.#geometry.mapWidth;
        const mapHeight = this.#geometry.mapHeight;
        const sourceAxisX = {
            x: (((quad.right.x - quad.top.x) + (quad.bottom.x - quad.left.x)) * 0.5)
                / mapWidth,
            y: (((quad.right.y - quad.top.y) + (quad.bottom.y - quad.left.y)) * 0.5)
                / mapWidth
        };
        const sourceAxisY = {
            x: (((quad.left.x - quad.top.x) + (quad.bottom.x - quad.right.x)) * 0.5)
                / mapHeight,
            y: (((quad.left.y - quad.top.y) + (quad.bottom.y - quad.right.y)) * 0.5)
                / mapHeight
        };
        const gridAxisX = Object.freeze({
            x: sourceAxisX.x * scaleX,
            y: sourceAxisX.y * scaleY
        });
        const gridAxisY = Object.freeze({
            x: sourceAxisY.x * scaleX,
            y: sourceAxisY.y * scaleY
        });
        const originSource = {
            x: quad.top.x + (sourceAxisX.x * 0.5) + (sourceAxisY.x * 0.5),
            y: quad.top.y + (sourceAxisX.y * 0.5) + (sourceAxisY.y * 0.5)
        };
        const hasCamera = camera?.initialized !== false
            && Number.isFinite(Number(camera?.x))
            && Number.isFinite(Number(camera?.y));
        const focusSource = hasCamera ? {
            x: originSource.x
                + (Number(camera.x) * sourceAxisX.x)
                + (Number(camera.y) * sourceAxisY.x),
            y: originSource.y
                + (Number(camera.x) * sourceAxisX.y)
                + (Number(camera.y) * sourceAxisY.y)
        } : {
            x: quadPoints.reduce((sum, point) => sum + Number(point.x), 0) / 4,
            y: quadPoints.reduce((sum, point) => sum + Number(point.y), 0) / 4
        };
        const focusXRatio = Number.isFinite(Number(this.#config.camera?.FOCUS_X_RATIO))
            ? Number(this.#config.camera.FOCUS_X_RATIO)
            : 0.5;
        const focusYRatio = Number.isFinite(Number(this.#config.camera?.FOCUS_Y_RATIO))
            ? Number(this.#config.camera.FOCUS_Y_RATIO)
            : 0.5;
        const desiredImageX = worldRect.x + (worldRect.w * focusXRatio)
            - (focusSource.x * scaleX);
        const desiredImageY = worldRect.y + (worldRect.h * focusYRatio)
            - (focusSource.y * scaleY);
        const mapImageRect = Object.freeze({
            x: Math.round(this.#constrainImageOffset(
                desiredImageX,
                imageW,
                worldRect.x,
                worldRect.w
            )),
            y: Math.round(this.#constrainImageOffset(
                desiredImageY,
                imageH,
                worldRect.y,
                worldRect.h
            )),
            w: imageW,
            h: imageH
        });
        const tileWidth = Math.max(2, Math.abs(gridAxisX.x - gridAxisY.x));
        const tileHeight = Math.max(2, Math.abs(gridAxisX.y + gridAxisY.y));
        const entityRatio = Number(this.#config.board.ENTITY_SCALE_RATIO) || 0.64;
        const gapRatio = Math.max(0, Number(this.#config.board.TILE_GAP_RATIO) || 0);
        return Object.freeze({
            mapImageRect,
            ambientFire: this.#createAmbientFireProjection(
                profile.ambientFire,
                mapImageRect,
                scaleX,
                scaleY
            ),
            gridAxisX,
            gridAxisY,
            tileWidth,
            tileHeight,
            tileElevation: tileHeight * 0.28,
            tileSide: tileWidth * entityRatio,
            tileGap: tileWidth * gapRatio,
            isoOriginX: mapImageRect.x + (originSource.x * scaleX),
            isoOriginY: mapImageRect.y + (originSource.y * scaleY)
        });
    }

    /**
     * 원본 맵에 실측한 촛불 심지 좌표를 현재 카메라가 적용된 화면 좌표로 변환합니다.
     * @param {object|null|undefined} config - 맵별 화염 설정입니다.
     * @param {{x:number,y:number,w:number,h:number}} mapImageRect - 화면의 맵 이미지 사각형입니다.
     * @param {number} scaleX - 원본 이미지 대비 화면 X 배율입니다.
     * @param {number} scaleY - 원본 이미지 대비 화면 Y 배율입니다.
     * @returns {Readonly<object>|null} 화면 좌표 화염 설정입니다.
     * @private
     */
    #createAmbientFireProjection(config, mapImageRect, scaleX, scaleY) {
        const sourceEmitters = Array.isArray(config?.emitters)
            ? config.emitters
            : [];
        const sourceSize = Number(config?.sourceSize);
        if (sourceEmitters.length === 0 || !(sourceSize > 0)) {
            return null;
        }
        const screenScale = (Math.abs(scaleX) + Math.abs(scaleY)) * 0.5;
        const emitters = sourceEmitters.map((emitter) => {
            const sourceX = Number(emitter?.x);
            const sourceY = Number(emitter?.y);
            if (!Number.isFinite(sourceX) || !Number.isFinite(sourceY)) {
                return null;
            }
            return Object.freeze({
                x: Math.round(mapImageRect.x + (sourceX * scaleX)),
                y: Math.round(mapImageRect.y + (sourceY * scaleY)),
                size: Math.max(1, sourceSize * screenScale),
                phase: Number.isFinite(Number(emitter?.phase))
                    ? Number(emitter.phase)
                    : 0
            });
        }).filter(Boolean);
        if (emitters.length === 0) {
            return null;
        }
        const configuredAlpha = Number(config?.alpha);
        return Object.freeze({
            alpha: Math.max(
                0,
                Math.min(1, Number.isFinite(configuredAlpha) ? configuredAlpha : 1)
            ),
            emitters: Object.freeze(emitters)
        });
    }

    /**
     * 확대된 맵이 뷰포트보다 크면 빈 배경이 드러나지 않는 범위로 이동을 제한합니다.
     * @param {number} desired - 카메라가 요청한 이미지 시작 좌표입니다.
     * @param {number} imageSize - 이미지 렌더 크기입니다.
     * @param {number} viewportStart - 월드 뷰포트 시작 좌표입니다.
     * @param {number} viewportSize - 월드 뷰포트 크기입니다.
     * @returns {number} 제한된 이미지 시작 좌표입니다.
     * @private
     */
    #constrainImageOffset(desired, imageSize, viewportStart, viewportSize) {
        if (imageSize <= viewportSize) {
            return viewportStart + ((viewportSize - imageSize) * 0.5);
        }
        const minimum = viewportStart + viewportSize - imageSize;
        return Math.min(viewportStart, Math.max(minimum, desired));
    }
}
