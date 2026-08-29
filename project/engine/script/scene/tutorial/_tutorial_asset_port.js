/**
 * @class TutorialAssetPort
 * @description 장면과 뷰에 매니페스트의 논리 ID만 노출하고 로더 세부 구현을 감춥니다.
 */
export class TutorialAssetPort {
    #loader;
    #manifest;

    /** @param {object} loader - TutorialAssetLoader입니다. @param {object} manifest - 에셋 매니페스트입니다. */
    constructor(loader, manifest) {
        this.#loader = loader;
        this.#manifest = manifest;
    }

    /** @returns {readonly object[]} 전체 에셋 로드 시작 상태입니다. */
    loadAll() {
        return this.#loader.loadManifest(this.#manifest);
    }

    /** @param {string} assetId @returns {CanvasImageSource|null} 폴백 포함 이미지입니다. */
    getImage(assetId) {
        return this.#loader.getImage(assetId);
    }

    /** @param {keyof object|string} semanticKey @returns {CanvasImageSource|null} UI 이미지입니다. */
    getUiAsset(semanticKey) {
        const assetId = this.#manifest.UI?.[semanticKey];
        return assetId ? this.#loader.getImage(assetId) : null;
    }

    /** @param {string} itemId @returns {CanvasImageSource|null} 아이템 이미지 또는 null입니다. */
    getItemIcon(itemId) {
        const assetId = this.#manifest.ITEMS?.[itemId];
        return assetId ? this.#loader.getImage(assetId) : null;
    }

    /** @param {string} itemId @returns {boolean} 아이템 원본 이미지 준비 여부입니다. */
    hasItemIcon(itemId) {
        const assetId = this.#manifest.ITEMS?.[itemId];
        return Boolean(assetId && this.#loader.isOwnReady(assetId));
    }

    /** @returns {CanvasImageSource|null} 로라 초상화입니다. */
    getLoraPortrait() {
        return this.#loader.getImage(this.#manifest.LEGACY?.loraPortrait);
    }

    /** @returns {CanvasImageSource|null} 로라 정적 월드 이미지입니다. */
    getLoraSprite() {
        return this.#loader.getImage(this.#manifest.LEGACY?.loraStatic);
    }

    /**
     * 분리 배경+격자가 모두 준비됐을 때 우선하고 아니면 합성본 하나를 반환합니다.
     * @param {string} floorId - 층 ID입니다.
     * @returns {{mode:'separated'|'full',layers:readonly object[]}|null} 그릴 맵 레이어입니다.
     */
    getMapArtwork(floorId) {
        const profile = this.#manifest.MAPS?.[floorId];
        if (!profile) {
            return null;
        }
        const background = this.#loader.getOwnImage(profile.backgroundId);
        const grid = this.#loader.getOwnImage(profile.gridId);
        if (background && grid) {
            return Object.freeze({
                mode: 'separated',
                layers: Object.freeze([background, grid])
            });
        }
        const full = this.#loader.getOwnImage(profile.fullId);
        return full ? Object.freeze({
            mode: 'full',
            layers: Object.freeze([full])
        }) : null;
    }

    /** @returns {object} 진단용 로더 스냅샷입니다. */
    getSnapshot() {
        return this.#loader.getSnapshot();
    }

    /** @returns {{completed:number,total:number,pending:number,ratio:number,percent:number}} 에셋 로드 진행도입니다. */
    getLoadProgress() {
        return this.#loader.getProgress();
    }
}
