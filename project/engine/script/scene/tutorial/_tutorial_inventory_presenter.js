import { toList } from './_tutorial_value_utils.js';

const KNOWN_STARTER_IDS = new Set(['bow', 'mascot-costume']);

/**
 * 전투 인벤토리의 페이지 상태와 아이템 표시 정책을 소유합니다.
 */
export class TutorialInventoryPresenter {
    /**
     * @param {object} options - 데이터·에셋·HUD 페이지 계산 포트입니다.
     */
    constructor({ data, assetPort, hudView }) {
        this.data = data;
        this.assetPort = assetPort;
        this.hudView = hudView;
        this.page = 0;
    }

    /** 인벤토리 페이지를 첫 페이지로 초기화합니다. */
    reset() {
        this.page = 0;
    }

    /** @returns {number} 현재 페이지입니다. */
    getPage() {
        return this.page;
    }

    /**
     * 모델 인벤토리를 표시 가능한 ID·수량 배열로 변환합니다.
     * @param {object|null} model - 전투 모델입니다.
     * @param {object|null} [snapshot] - 선택적 모델 스냅샷입니다.
     * @returns {Array<{itemId:string,count:number}>}
     */
    getEntries(model, snapshot = null) {
        if (!model) {
            return [];
        }
        if (model.inventory instanceof Map) {
            return Array.from(model.inventory.entries())
                .filter(([, count]) => Number(count) > 0)
                .map(([itemId, count]) => ({ itemId, count: Number(count) }));
        }
        return toList(snapshot?.inventory ?? model.getSnapshot?.()?.inventory)
            .filter((entry) => Number(entry?.count) > 0)
            .map((entry) => ({
                itemId: entry.itemId,
                count: Number(entry.count)
            }));
    }

    /**
     * 현재 페이지의 원시 인벤토리 항목을 반환합니다.
     * @param {object|null} model - 전투 모델입니다.
     * @returns {{entries:Array<object>,page:number,pageCount:number}}
     */
    getPaging(model) {
        return this.hudView.getInventoryPaging(
            this.getEntries(model),
            this.page,
            this.data.LAYOUT.INVENTORY.PAGE_SIZE
        );
    }

    /**
     * 페이지 명령을 순환 적용합니다.
     * @param {object|null} model - 전투 모델입니다.
     * @param {number} delta - 페이지 이동 방향입니다.
     * @returns {boolean} 페이지가 바뀌었는지 여부입니다.
     */
    shiftPage(model, delta) {
        const paging = this.getPaging(model);
        const normalizedDelta = Math.sign(Number(delta) || 0);
        if (paging.pageCount <= 1 || normalizedDelta === 0) {
            return false;
        }
        this.page = (
            paging.page + normalizedDelta + paging.pageCount
        ) % paging.pageCount;
        return true;
    }

    /**
     * 한 프레임의 아이템 메타와 페이지 항목을 만듭니다.
     * @param {object} options - 모델 상태와 행동 가능 상태입니다.
     * @returns {{entries:Array<object>,itemMetadata:object,pagedInventory:object}}
     */
    createView({ model, snapshot, ready, actionReady, cleanseTargetCount }) {
        const entries = this.getEntries(model, snapshot);
        const paging = this.hudView.getInventoryPaging(
            entries,
            this.page,
            this.data.LAYOUT.INVENTORY.PAGE_SIZE
        );
        this.page = paging.page;
        const itemMetadata = Object.freeze(Object.fromEntries(
            Object.entries(this.data.ITEMS).map(([itemId, item]) => ([
                itemId,
                Object.freeze({
                    id: itemId,
                    label: item.label || itemId,
                    description: item.description || '효과 확인 중',
                    known: this.isItemKnown(itemId),
                    hasIcon: this.assetPort.hasItemIcon(itemId),
                    usable: this.isItemUsable(itemId),
                    movementConsumable: item.movementConsumable === true,
                    statusLabel: item.movementConsumable === true
                        ? '이동'
                        : item.passive === true && item.useOnce !== true
                            ? '자동'
                            : item.consumable === true || item.useOnce === true
                                ? '사용'
                                : '보유'
                })
            ]))
        ));
        const pagedInventory = Object.freeze({
            page: paging.page,
            pageCount: paging.pageCount,
            entries: Object.freeze(paging.entries.map((entry) => {
                const metadata = itemMetadata[entry.itemId] || {};
                const movementConsumable = metadata.movementConsumable === true;
                return Object.freeze({
                    itemId: entry.itemId,
                    count: Number(entry.count) || 0,
                    label: metadata.known ? metadata.label : '미확인',
                    description: metadata.known
                        ? metadata.description
                        : '선택해 효과를 확인하세요.',
                    statusLabel: metadata.statusLabel || '보유',
                    known: metadata.known === true,
                    hasIcon: metadata.hasIcon === true,
                    movementConsumable,
                    usable: movementConsumable
                        ? ready && snapshot.phase === 'move' && cleanseTargetCount > 0
                        : actionReady && metadata.usable === true
                });
            }))
        });
        return { entries, itemMetadata, pagedInventory };
    }

    /** @param {string} itemId @returns {boolean} 행동으로 사용할 수 있는 아이템인지 여부입니다. */
    isItemUsable(itemId) {
        const item = this.data.ITEMS[itemId];
        return Boolean(item && (item.consumable || item.useOnce));
    }

    /** @param {string} itemId @returns {boolean} 이름을 표시할 수 있는 아이템인지 여부입니다. */
    isItemKnown(itemId) {
        return KNOWN_STARTER_IDS.has(itemId)
            || Boolean(this.data.ITEMS[itemId]);
    }
}
