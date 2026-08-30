import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import {
    clampBattleViewNumber,
    toBattleViewList
} from './_tutorial_battle_view_helpers.js';
import { drawBattleHpValue } from './_tutorial_battle_hp_value_view.js';
import {
    drawTutorialPixelAsset,
    fitTutorialAssetRect
} from './_tutorial_asset_view_helpers.js';
import { TutorialBattleCommandMenuView } from './_tutorial_battle_command_menu_view.js';
import { TutorialItemDescriptionView } from './_tutorial_item_description_view.js';
import { TutorialLoraStatusView } from './_tutorial_lora_status_view.js';

/**
 * @class TutorialBattleHudView
 * @description 전투 HUD 렌더와 동일 좌표의 직렬화 가능한 버튼 사양을 제공합니다.
 */
export class TutorialBattleHudView {
    #renderPort;
    #assetPort;
    #commandMenuView;
    #itemDescriptionView;
    #loraStatusView;
    #frame;

    /**
     * @param {{render:Function,measureText:Function,wrapText:Function}} renderPort - HUD 렌더 포트입니다.
     * @param {{getLoraPortrait?:Function,getUiAsset?:Function}} assetPort - 읽기 전용 에셋 포트입니다.
     */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
        this.#commandMenuView = new TutorialBattleCommandMenuView(
            renderPort,
            assetPort
        );
        this.#itemDescriptionView = new TutorialItemDescriptionView(
            renderPort,
            assetPort
        );
        this.#loraStatusView = new TutorialLoraStatusView(renderPort, assetPort);
        this.#frame = null;
    }

    /**
     * 인벤토리의 유효 페이지와 현재 항목을 순수 계산합니다.
     * @param {object[]} entries - 전체 인벤토리 항목입니다.
     * @param {number} requestedPage - 요청 페이지입니다.
     * @param {number} pageSize - 페이지당 항목 수입니다.
     * @returns {{entries:object[],page:number,pageCount:number}} 페이지 정보입니다.
     */
    getInventoryPaging(entries, requestedPage, pageSize) {
        const values = toBattleViewList(entries);
        const safePageSize = Math.max(1, Number(pageSize) || 1);
        const pageCount = Math.max(1, Math.ceil(values.length / safePageSize));
        const page = clampBattleViewNumber(
            Math.floor(Number(requestedPage) || 0),
            0,
            pageCount - 1
        );
        return {
            entries: values.slice(page * safePageSize, (page + 1) * safePageSize),
            page,
            pageCount
        };
    }

    /**
     * 전투 상태 카드와 인벤토리 헤더를 그립니다.
     * @param {object} viewModel - 장면이 조립한 읽기 전용 BattleViewModel입니다.
     */
    draw(viewModel) {
        if (!viewModel?.snapshot || !viewModel?.layout) {
            return;
        }
        this.#frame = viewModel;
        try {
            this.#loraStatusView.draw(viewModel);
            this.#drawPlayerStatus();
            this.#itemDescriptionView.draw(viewModel);
            this.#commandMenuView.draw(viewModel);
        } finally {
            this.#frame = null;
        }
    }

    /**
     * HUD와 동일한 레이아웃에서 전투 버튼 명령 사양을 만듭니다.
     * @param {object} viewModel - 장면이 조립한 읽기 전용 BattleViewModel입니다.
     * @returns {object[]} 직렬화 가능한 버튼 사양입니다.
     */
    getButtonSpecs(viewModel) {
        if (!viewModel?.snapshot || !viewModel?.layout) {
            return [];
        }
        this.#frame = viewModel;
        try {
            const specs = [];
            const { colors, hud, layout, snapshot } = viewModel;
            specs.push(...this.#commandMenuView.getButtonSpecs(viewModel));

            const inventoryRect = layout.hudRects.PLAYER_STATUS;
            const inventoryLayout = hud.config.inventory;
            const playerPanelRect = this.#resolvePlayerPanelRect(
                inventoryRect,
                inventoryLayout,
                this.#assetPort.getUiAsset?.('playerPanel')
            );
            const itemIconLayout = hud.config.itemIcon;
            hud.inventory.entries.forEach((entry, index) => {
                const slotRect = this.#getInventorySlotRect(
                    index,
                    playerPanelRect,
                    inventoryLayout
                );
                if (!slotRect) {
                    return;
                }
                const iconWidth = entry.known && entry.hasIcon
                    ? Math.min(slotRect.w, slotRect.h)
                        * itemIconLayout.BUTTON_ICON_SIZE_RATIO
                    : 0;
                specs.push({
                    key: 'item-' + entry.itemId,
                    ...slotRect,
                    label: '',
                    drawBackground: false,
                    iconId: iconWidth > 0 ? entry.itemId : null,
                    iconWidth,
                    iconVisualCenter: itemIconLayout.VISUAL_CENTERS?.[entry.itemId]
                        || null,
                    itemSpacing: 0,
                    enabled: entry.usable,
                    active: entry.movementConsumable && hud.cleanseSelected,
                    focused: hud.focusedControlKey === 'item-' + entry.itemId,
                    inspectable: true,
                    idleColor: colors.UI.CardHeader,
                    hoverColor: colors.UI.ButtonHover,
                    command: {
                        type: entry.movementConsumable ? TUTORIAL_COMMANDS.SELECT_CLEANSE
                            : TUTORIAL_COMMANDS.USE_ITEM,
                        payload: { itemId: entry.itemId }
                    },
                    disabledCommand: entry.blockedByMovementPhase ? { type: TUTORIAL_COMMANDS.USE_ITEM, payload: { itemId: entry.itemId } } : null
                });
            });

            if (hud.inventory.pageCount > 1) {
                const pageButtons = [
                    {
                        key: 'inventory-prev',
                        rect: this.#resolvePlayerPanelPart(
                            playerPanelRect,
                            inventoryLayout.PLAYER_PANEL?.PAGE_PREVIOUS,
                            inventoryLayout
                        ),
                        flipX: true,
                        delta: -1,
                        tooltip: '이전 아이템 페이지'
                    },
                    {
                        key: 'inventory-next',
                        rect: this.#resolvePlayerPanelPart(
                            playerPanelRect,
                            inventoryLayout.PLAYER_PANEL?.PAGE_NEXT,
                            inventoryLayout
                        ),
                        flipX: false,
                        delta: 1,
                        tooltip: '다음 아이템 페이지'
                    }
                ];
                pageButtons.forEach((button) => {
                    if (!button.rect) {
                        return;
                    }
                    specs.push({
                        key: button.key,
                        ...button.rect,
                        label: '',
                        tooltip: button.tooltip,
                        backgroundAssetKey: 'galleryTurnButton',
                        backgroundImageFlipX: button.flipX,
                        backgroundImageAlpha: 1,
                        drawSolidBackground: false,
                        fitHitToBackground: true,
                        command: {
                            type: TUTORIAL_COMMANDS.INVENTORY_PAGE_SHIFT,
                            payload: { delta: button.delta }
                        }
                    });
                });
            }
            return specs;
        } finally {
            this.#frame = null;
        }
    }

    /** 플레이어 슬롯과 HP 게이지를 패널 원본 좌표에 맞춰 그립니다. @private */
    #drawPlayerStatus() {
        const { colors, hud, layout, snapshot, world } = this.#frame;
        const rect = layout.hudRects.PLAYER_STATUS;
        const inventoryLayout = hud.config.inventory;
        const playerPanelImage = this.#assetPort.getUiAsset?.('playerPanel');
        const playerPanelRect = this.#resolvePlayerPanelRect(
            rect,
            inventoryLayout,
            playerPanelImage
        );
        const playerHp = Math.max(0, Number(world.presentation.playerHp) || 0);
        const playerMaxHp = Math.max(1, Number(snapshot.player?.maxHp) || 100);
        const preview = hud.readability?.playerPreview;
        const expectedPlayerHp = preview?.available
            ? Math.max(0, Number(preview.expected?.playerHp) || 0)
            : playerHp;
        drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: playerPanelImage,
            rect: playerPanelRect,
            mode: 'exact',
            alpha: 1
        });
        hud.inventory.entries.forEach((entry, index) => {
            const slotRect = this.#getInventorySlotRect(
                index,
                playerPanelRect,
                inventoryLayout
            );
            if (!slotRect) {
                return;
            }
            drawTutorialPixelAsset(this.#renderPort, {
                layer: 'ui',
                image: this.#assetPort.getUiAsset?.('playerItemSelected'),
                rect: slotRect,
                mode: 'exact',
                alpha: 1
            });
        });
        const hpBarRect = this.#resolvePlayerPanelPart(
            playerPanelRect,
            inventoryLayout.PLAYER_PANEL?.HP_BAR,
            inventoryLayout
        );
        if (!hpBarRect) {
            return;
        }
        this.#drawGauge(
            hpBarRect.x, hpBarRect.y, hpBarRect.w, hpBarRect.h,
            playerHp / playerMaxHp, colors.UI.GaugeHp,
            expectedPlayerHp / playerMaxHp, null, false
        );
        drawBattleHpValue(this.#renderPort, {
            rect: this.#resolvePlayerPanelPart(
                playerPanelRect,
                inventoryLayout.PLAYER_PANEL?.HP_VALUE,
                inventoryLayout
            ),
            value: playerHp,
            font: this.#frame.fonts.SMALL,
            fill: colors.UI.GaugeValue || colors.UI.Text
        });
    }

    /**
     * 플레이어 패널 원본 비율을 유지한 실제 렌더 사각형을 계산합니다.
     * @param {object} container - HUD가 예약한 플레이어 패널 영역입니다.
     * @param {object} inventoryLayout - 인벤토리와 패널 내부 좌표 데이터입니다.
     * @param {object|null} image - 로드된 플레이어 패널 이미지입니다.
     * @returns {{x:number,y:number,w:number,h:number}} 실제 패널 사각형입니다.
     * @private
     */
    #resolvePlayerPanelRect(container, inventoryLayout, image = null) {
        return this.#resolveSourcePanelRect(
            container,
            inventoryLayout?.PLAYER_PANEL?.SOURCE,
            image
        );
    }

    /**
     * 원본 크기가 있는 패널을 예약 영역 안에 비율 유지로 맞춥니다.
     * @param {object} container - HUD 예약 영역입니다.
     * @param {object} source - 패널 원본 크기입니다.
     * @param {object|null} image - 로드된 패널 이미지입니다.
     * @returns {{x:number,y:number,w:number,h:number}} 실제 패널 사각형입니다.
     * @private
     */
    #resolveSourcePanelRect(container, source, image = null) {
        const sourceWidth = Number(source?.WIDTH);
        const sourceHeight = Number(source?.HEIGHT);
        const dimensions = sourceWidth > 0 && sourceHeight > 0
            ? { width: sourceWidth, height: sourceHeight }
            : null;
        return fitTutorialAssetRect(image || dimensions, container) || {
            x: Math.round(container.x),
            y: Math.round(container.y),
            w: Math.max(1, Math.round(container.w)),
            h: Math.max(1, Math.round(container.h))
        };
    }

    /**
     * 패널 원본 픽셀 좌표를 현재 렌더 사각형으로 투영합니다.
     * @param {object} panelRect - 실제 플레이어 패널 사각형입니다.
     * @param {object} part - 원본 픽셀 기준 내부 사각형입니다.
     * @param {object} inventoryLayout - 인벤토리와 패널 내부 좌표 데이터입니다.
     * @returns {{x:number,y:number,w:number,h:number}|null} 투영된 내부 사각형입니다.
     * @private
     */
    #resolvePlayerPanelPart(panelRect, part, inventoryLayout) {
        return this.#resolveSourcePanelPart(
            panelRect,
            part,
            inventoryLayout?.PLAYER_PANEL?.SOURCE
        );
    }

    /**
     * 패널 원본 픽셀 좌표를 현재 렌더 사각형으로 투영합니다.
     * @param {object} panelRect - 실제 패널 사각형입니다.
     * @param {object} part - 원본 픽셀 기준 내부 사각형입니다.
     * @param {object} source - 패널 원본 크기입니다.
     * @returns {{x:number,y:number,w:number,h:number}|null} 투영된 내부 사각형입니다.
     * @private
     */
    #resolveSourcePanelPart(panelRect, part, source) {
        const sourceWidth = Number(source?.WIDTH);
        const sourceHeight = Number(source?.HEIGHT);
        const partWidth = Number(part?.WIDTH);
        const partHeight = Number(part?.HEIGHT);
        if (!(sourceWidth > 0) || !(sourceHeight > 0)
            || !(partWidth > 0) || !(partHeight > 0)) {
            return null;
        }
        const scaleX = panelRect.w / sourceWidth;
        const scaleY = panelRect.h / sourceHeight;
        return {
            x: Math.round(panelRect.x + (Number(part.X) * scaleX)),
            y: Math.round(panelRect.y + (Number(part.Y) * scaleY)),
            w: Math.max(1, Math.round(partWidth * scaleX)),
            h: Math.max(1, Math.round(partHeight * scaleY))
        };
    }

    /**
     * 인벤토리 항목 인덱스를 플레이어 패널의 슬롯 사각형으로 변환합니다.
     * @param {number} index - 현재 페이지 안의 항목 인덱스입니다.
     * @param {object} panelRect - 실제 플레이어 패널 사각형입니다.
     * @param {object} inventoryLayout - 인벤토리와 패널 내부 좌표 데이터입니다.
     * @returns {{x:number,y:number,w:number,h:number}|null} 항목 슬롯 사각형입니다.
     * @private
     */
    #getInventorySlotRect(index, panelRect, inventoryLayout) {
        const slot = inventoryLayout?.PLAYER_PANEL?.ITEM_SLOT;
        if (!slot) {
            return null;
        }
        const columns = Math.max(1, Number(inventoryLayout.COLUMNS) || 1);
        const column = index % columns;
        const row = Math.floor(index / columns);
        return this.#resolvePlayerPanelPart(panelRect, {
            X: Number(slot.X) + (column * (
                Number(slot.WIDTH) + (Number(slot.GAP_X) || 0)
            )),
            Y: Number(slot.Y) + (row * (
                Number(slot.HEIGHT) + (Number(slot.GAP_Y) || 0)
            )),
            WIDTH: slot.WIDTH,
            HEIGHT: slot.HEIGHT
        }, inventoryLayout);
    }

    /**
     * 현재값과 선택 행동의 예상 구간을 함께 그립니다.
     * @param {number} x - 게이지 왼쪽 좌표입니다.
     * @param {number} y - 게이지 위쪽 좌표입니다.
     * @param {number} w - 게이지 너비입니다.
     * @param {number} h - 게이지 높이입니다.
     * @param {number} ratio - 현재 게이지 비율입니다.
     * @param {string} fill - 현재 게이지 색입니다.
     * @param {number|null} pendingRatio - 선택 행동 후 예상 비율입니다.
     * @param {string|null} assetKey - 게이지 위에 얹을 에셋 키입니다.
     * @param {boolean} drawTrack - 빈 게이지 트랙을 별도로 그릴지 여부입니다.
     * @private
     */
    #drawGauge(
        x,
        y,
        w,
        h,
        ratio,
        fill,
        pendingRatio = null,
        assetKey = null,
        drawTrack = true
    ) {
        const colors = this.#frame.colors;
        const safeRatio = clampBattleViewNumber(ratio, 0, 1);
        const safePending = pendingRatio !== null
            && pendingRatio !== undefined
            && Number.isFinite(Number(pendingRatio))
            ? clampBattleViewNumber(pendingRatio, 0, 1)
            : safeRatio;
        if (drawTrack) {
            this.#renderPort.render('ui', {
                shape: 'roundRect', x, y, w, h,
                radius: h * 0.5, fill: colors.UI.GaugeTrack
            });
        }
        if (safeRatio > 0) {
            this.#renderPort.render('ui', {
                shape: 'roundRect', x, y, w: w * safeRatio, h,
                radius: h * 0.5, fill
            });
        }
        if (Math.abs(safePending - safeRatio) > 0.0001) {
            const startRatio = Math.min(safeRatio, safePending);
            const segmentRatio = Math.abs(safePending - safeRatio);
            this.#renderPort.render('ui', {
                shape: 'roundRect',
                x: x + (w * startRatio),
                y,
                w: w * segmentRatio,
                h,
                radius: Math.min(h * 0.5, w * segmentRatio * 0.5),
                fill: safePending > safeRatio ? colors.UI.Success : colors.UI.Danger
            });
        }
        if (assetKey) {
            drawTutorialPixelAsset(this.#renderPort, {
                layer: 'ui',
                image: this.#assetPort.getUiAsset?.(assetKey),
                rect: { x, y, w, h },
                alpha: 0.32
            });
        }
    }

}
