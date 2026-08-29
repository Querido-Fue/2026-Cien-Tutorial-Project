import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import {
    clampBattleViewNumber,
    drawBattleViewText,
    toBattleViewList,
    truncateBattleViewText,
    wrapBattleViewText
} from './_tutorial_battle_view_helpers.js';
import {
    drawTutorialPixelAsset,
    fitTutorialAssetRect
} from './_tutorial_asset_view_helpers.js';

const LORA_STATUS_PANEL_LAYOUT = Object.freeze({
    SOURCE: Object.freeze({ WIDTH: 247, HEIGHT: 90 }),
    PORTRAIT_VIEWPORT: Object.freeze({ X: 0, Y: 0, WIDTH: 55, HEIGHT: 56 }),
    PORTRAIT_SCALE: 1.3,
    PORTRAIT_VISUAL_CENTER: Object.freeze({ X: 0.56, Y: 0.64 }),
    PORTRAIT_CLIP: Object.freeze([
        Object.freeze({ X: 25, Y: 0 }),
        Object.freeze({ X: 55, Y: 27 }),
        Object.freeze({ X: 25, Y: 56 }),
        Object.freeze({ X: 0, Y: 27 })
    ]),
    PORTRAIT_FRAME_CLIPS: Object.freeze([
        Object.freeze([
            Object.freeze({ X: 0, Y: 27 }),
            Object.freeze({ X: 25, Y: 0 }),
            Object.freeze({ X: 25, Y: 6 }),
            Object.freeze({ X: 6, Y: 27 })
        ]),
        Object.freeze([
            Object.freeze({ X: 25, Y: 0 }),
            Object.freeze({ X: 55, Y: 27 }),
            Object.freeze({ X: 49, Y: 27 }),
            Object.freeze({ X: 25, Y: 6 })
        ]),
        Object.freeze([
            Object.freeze({ X: 55, Y: 27 }),
            Object.freeze({ X: 25, Y: 56 }),
            Object.freeze({ X: 25, Y: 50 }),
            Object.freeze({ X: 49, Y: 27 })
        ]),
        Object.freeze([
            Object.freeze({ X: 25, Y: 56 }),
            Object.freeze({ X: 0, Y: 27 }),
            Object.freeze({ X: 6, Y: 27 }),
            Object.freeze({ X: 25, Y: 50 })
        ])
    ]),
    HP_BAR: Object.freeze({ X: 62, Y: 56, WIDTH: 149, HEIGHT: 4 }),
    INSTABILITY_BAR: Object.freeze({ X: 51, Y: 70, WIDTH: 149, HEIGHT: 4 })
});

const ITEM_DESCRIPTION_PANEL_LAYOUT = Object.freeze({
    SOURCE: Object.freeze({ WIDTH: 86, HEIGHT: 128 }),
    TITLE: Object.freeze({ X: 10, Y: 2, WIDTH: 66, HEIGHT: 10 }),
    STATUS: Object.freeze({ X: 10, Y: 16, WIDTH: 66, HEIGHT: 10 }),
    DESCRIPTION: Object.freeze({ X: 10, Y: 29, WIDTH: 66, HEIGHT: 64 }),
    PAGE: Object.freeze({ X: 22, Y: 94, WIDTH: 42, HEIGHT: 8 }),
    MAX_DESCRIPTION_LINES: 5,
    LINE_HEIGHT_WH: 2.1,
    MIN_LINE_HEIGHT_PX: 14,
    MAX_LINE_HEIGHT_PX: 17
});

/**
 * @class TutorialBattleHudView
 * @description 전투 HUD 렌더와 동일 좌표의 직렬화 가능한 버튼 사양을 제공합니다.
 */
export class TutorialBattleHudView {
    #renderPort;
    #assetPort;
    #frame;

    /**
     * @param {{render:Function,measureText:Function,wrapText:Function}} renderPort - HUD 렌더 포트입니다.
     * @param {{getLoraPortrait?:Function,getUiAsset?:Function}} assetPort - 읽기 전용 에셋 포트입니다.
     */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
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
            this.#drawLoraStatusCard();
            this.#drawPlayerStatus();
            this.#drawInventoryCard();
            this.#drawActionCluster();
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
            const actionGeometry = this.#resolveActionClusterGeometry();
            const actionSpecs = this.#resolveActionClusterActions();
            for (const spec of actionSpecs) {
                specs.push({
                    key: spec.key,
                    ...actionGeometry[spec.slot],
                    label: '',
                    tooltip: spec.label,
                    drawBackground: false,
                    drawSolidBackground: false,
                    enabled: spec.enabled,
                    active: spec.active,
                    focused: spec.focused,
                    inspectable: true,
                    command: { type: spec.type, payload: spec.payload }
                });
            }

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
                    tooltip: '[' + entry.statusLabel + '] ' + entry.label
                        + ' ×' + String(entry.count) + ': ' + entry.description,
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
                        type: entry.movementConsumable
                            ? TUTORIAL_COMMANDS.SELECT_CLEANSE
                            : TUTORIAL_COMMANDS.USE_ITEM,
                        payload: { itemId: entry.itemId }
                    }
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

    /** 로라 원본 패널의 메달 슬롯과 두 게이지 트랙에 상태를 그립니다. @private */
    #drawLoraStatusCard() {
        const { colors, hud, layout, snapshot, world } = this.#frame;
        const rect = layout.hudRects.LORA_CARD;
        const panelImage = this.#assetPort.getUiAsset?.('loraPanelFull');
        const panelRect = this.#resolveSourcePanelRect(
            rect,
            LORA_STATUS_PANEL_LAYOUT.SOURCE,
            panelImage
        );
        drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: panelImage,
            rect: panelRect,
            mode: 'exact',
            alpha: 1
        });

        const portraitViewport = this.#resolveSourcePanelPart(
            panelRect,
            LORA_STATUS_PANEL_LAYOUT.PORTRAIT_VIEWPORT,
            LORA_STATUS_PANEL_LAYOUT.SOURCE
        );
        const portrait = this.#assetPort.getUiAsset?.('loraPortraitIcon')
            || this.#assetPort.getLoraPortrait?.()
            || null;
        if (portrait && portraitViewport) {
            const portraitWidth = Math.max(1, Math.round(
                portraitViewport.w * LORA_STATUS_PANEL_LAYOUT.PORTRAIT_SCALE
            ));
            const portraitHeight = Math.max(1, Math.round(
                portraitViewport.h * LORA_STATUS_PANEL_LAYOUT.PORTRAIT_SCALE
            ));
            const visualCenter = LORA_STATUS_PANEL_LAYOUT.PORTRAIT_VISUAL_CENTER;
            this.#renderPort.render('ui', {
                shape: 'image', image: portrait,
                x: Math.round(
                    portraitViewport.x + (portraitViewport.w * 0.5)
                    - (portraitWidth * visualCenter.X)
                ),
                y: Math.round(
                    portraitViewport.y + (portraitViewport.h * 0.5)
                    - (portraitHeight * visualCenter.Y)
                ),
                w: portraitWidth,
                h: portraitHeight,
                clipVertices: this.#resolveSourcePanelVertices(
                    panelRect,
                    LORA_STATUS_PANEL_LAYOUT.PORTRAIT_CLIP,
                    LORA_STATUS_PANEL_LAYOUT.SOURCE
                ),
                smoothing: true
            });
        } else if (portraitViewport) {
            this.#renderPort.render('ui', {
                shape: 'rect',
                ...portraitViewport,
                fill: colors.UI.CardHeader,
                stroke: colors.UI.Border,
                lineWidth: 1
            });
        }
        this.#drawLoraPortraitFrame(panelImage, panelRect);

        const loraHp = Math.max(0, Number(world.presentation.loraHp) || 0);
        const loraMaxHp = Math.max(1, Number(snapshot.lora?.maxHp) || 100);
        const instability = clampBattleViewNumber(world.presentation.instability, 0, 100);
        const preview = hud.readability?.playerPreview;
        const expectedLoraHp = preview?.available
            ? Math.max(0, Number(preview.expected?.loraHp) || 0)
            : loraHp;
        const expectedInstability = preview?.available
            ? clampBattleViewNumber(preview.expected?.instability, 0, 100)
            : instability;
        const hpBarRect = this.#resolveSourcePanelPart(
            panelRect,
            LORA_STATUS_PANEL_LAYOUT.HP_BAR,
            LORA_STATUS_PANEL_LAYOUT.SOURCE
        );
        const instabilityBarRect = this.#resolveSourcePanelPart(
            panelRect,
            LORA_STATUS_PANEL_LAYOUT.INSTABILITY_BAR,
            LORA_STATUS_PANEL_LAYOUT.SOURCE
        );
        this.#drawEmbeddedGauge(
            hpBarRect,
            loraHp / loraMaxHp, colors.UI.GaugeHp,
            expectedLoraHp / loraMaxHp, 'loraHpBar'
        );
        this.#drawEmbeddedGauge(
            instabilityBarRect,
            instability / 100, colors.UI.GaugeInstability,
            expectedInstability / 100, 'loraGaugeBar'
        );
    }

    /** 확대 초상 위에 원본 마름모 장식만 다시 덮어 자연스러운 프레임 마스킹을 만듭니다. @private */
    #drawLoraPortraitFrame(panelImage, panelRect) {
        if (!panelImage || !panelRect) {
            return;
        }
        for (const frameClip of LORA_STATUS_PANEL_LAYOUT.PORTRAIT_FRAME_CLIPS) {
            this.#renderPort.render('ui', {
                shape: 'image',
                image: panelImage,
                ...panelRect,
                clipVertices: this.#resolveSourcePanelVertices(
                    panelRect,
                    frameClip,
                    LORA_STATUS_PANEL_LAYOUT.SOURCE
                ),
                smoothing: false
            });
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
    }

    /** 픽셀 설명 패널의 실제 내부 안전 영역에 아이템 정보를 그립니다. @private */
    #drawInventoryCard() {
        const { colors, fonts, hud, layout } = this.#frame;
        const rect = layout.hudRects.INVENTORY_CARD;
        const inspectedItem = hud.readability?.inspectedItem || null;
        if (!inspectedItem) {
            return;
        }
        const panelImage = this.#assetPort.getUiAsset?.('itemPanel');
        const panelRect = this.#resolveSourcePanelRect(
            rect,
            ITEM_DESCRIPTION_PANEL_LAYOUT.SOURCE,
            panelImage
        );
        drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: panelImage,
            rect: panelRect,
            mode: 'exact',
            alpha: 1
        });
        const titleRect = this.#resolveSourcePanelPart(
            panelRect,
            ITEM_DESCRIPTION_PANEL_LAYOUT.TITLE,
            ITEM_DESCRIPTION_PANEL_LAYOUT.SOURCE
        );
        const statusRect = this.#resolveSourcePanelPart(
            panelRect,
            ITEM_DESCRIPTION_PANEL_LAYOUT.STATUS,
            ITEM_DESCRIPTION_PANEL_LAYOUT.SOURCE
        );
        const descriptionRect = this.#resolveSourcePanelPart(
            panelRect,
            ITEM_DESCRIPTION_PANEL_LAYOUT.DESCRIPTION,
            ITEM_DESCRIPTION_PANEL_LAYOUT.SOURCE
        );
        const pageRect = this.#resolveSourcePanelPart(
            panelRect,
            ITEM_DESCRIPTION_PANEL_LAYOUT.PAGE,
            ITEM_DESCRIPTION_PANEL_LAYOUT.SOURCE
        );
        if (!titleRect || !statusRect || !descriptionRect || !pageRect) {
            return;
        }
        this.#drawText(
            'ui',
            truncateBattleViewText(
                this.#renderPort,
                String(inspectedItem.label || 'ITEM') + ' ×'
                    + String(inspectedItem.count || 0),
                fonts.SMALL,
                titleRect.w
            ),
            titleRect.x,
            titleRect.y + (titleRect.h * 0.5),
            fonts.SMALL,
            colors.UI.Text
        );
        this.#drawText(
            'ui',
            truncateBattleViewText(
                this.#renderPort,
                String(inspectedItem.statusLabel || ''),
                fonts.SMALL,
                statusRect.w
            ),
            statusRect.x,
            statusRect.y + (statusRect.h * 0.5),
            fonts.SMALL,
            colors.UI.Accent
        );
        const lines = wrapBattleViewText(
            this.#renderPort,
            String(inspectedItem.description || ''),
            fonts.SMALL,
            descriptionRect.w,
            ITEM_DESCRIPTION_PANEL_LAYOUT.MAX_DESCRIPTION_LINES
        );
        const lineHeight = Math.min(
            clampBattleViewNumber(
                this.#uwh(ITEM_DESCRIPTION_PANEL_LAYOUT.LINE_HEIGHT_WH),
                ITEM_DESCRIPTION_PANEL_LAYOUT.MIN_LINE_HEIGHT_PX,
                ITEM_DESCRIPTION_PANEL_LAYOUT.MAX_LINE_HEIGHT_PX
            ),
            descriptionRect.h / ITEM_DESCRIPTION_PANEL_LAYOUT.MAX_DESCRIPTION_LINES
        );
        lines.forEach((line, index) => {
            this.#drawText(
                'ui', line, descriptionRect.x,
                descriptionRect.y + (lineHeight * (index + 0.5)),
                fonts.SMALL, colors.UI.Text
            );
        });
        this.#drawText(
            'ui', String(hud.inventory.page + 1) + '/'
                + String(hud.inventory.pageCount),
            pageRect.x + (pageRect.w * 0.5),
            pageRect.y + (pageRect.h * 0.5),
            fonts.SMALL, colors.UI.Muted, 'center'
        );
    }

    /** 원본 픽셀 에셋을 참고 이미지의 다이아 행동 클러스터로 조립합니다. @private */
    #drawActionCluster() {
        const { colors, fonts } = this.#frame;
        const geometry = this.#resolveActionClusterGeometry();
        const actionSpecs = this.#resolveActionClusterActions();
        const actionBySlot = Object.fromEntries(
            actionSpecs.map((spec) => [spec.slot, spec])
        );
        const primaryGroup = ['left', 'right', 'center']
            .map((slot) => actionBySlot[slot]);
        const primaryGroupEnabled = primaryGroup.some((spec) => spec?.enabled);
        const primaryGroupHighlighted = primaryGroup.some(
            (spec) => spec?.focused || spec?.active
        );
        drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: this.#assetPort.getUiAsset?.('actionButton'),
            rect: geometry.frame,
            mode: 'exact',
            alpha: primaryGroupHighlighted ? 1 : primaryGroupEnabled ? 0.92 : 0.38
        });

        const primary = actionBySlot.center;
        this.#drawText(
            'ui',
            primary.label,
            geometry.center.x + (geometry.center.w * 0.5),
            geometry.frame.y + (
                geometry.frame.h * geometry.config.PRIMARY_LABEL_Y_RATIO
            ),
            fonts.BUTTON || fonts.SMALL,
            colors.UI.OnPrimary || colors.UI.Text,
            'center',
            primary.enabled ? (primary.focused ? 1 : 0.94) : 0.46
        );

        for (const slot of ['heal', 'idle']) {
            const action = actionBySlot[slot];
            const rect = geometry[slot];
            const alpha = action.enabled
                ? (action.focused || action.active ? 1 : 0.9)
                : 0.38;
            drawTutorialPixelAsset(this.#renderPort, {
                layer: 'ui',
                image: this.#assetPort.getUiAsset?.('waitHealButton'),
                rect,
                mode: 'exact',
                alpha
            });
            const iconSize = Math.max(
                1,
                Math.round(rect.w * geometry.config.TOP_ICON_SIZE_RATIO)
            );
            drawTutorialPixelAsset(this.#renderPort, {
                layer: 'ui',
                image: this.#assetPort.getUiAsset?.(
                    slot === 'heal' ? 'healIcon' : 'waitIcon'
                ),
                rect: {
                    x: Math.round(rect.x + ((rect.w - iconSize) * 0.5)),
                    y: Math.round(rect.y + ((rect.h - iconSize) * 0.5)),
                    w: iconSize,
                    h: iconSize
                },
                alpha
            });
        }
        this.#drawActionSpark(geometry.spark, colors.UI.OnPrimary || colors.UI.Text);
    }

    /**
     * 현재 전투 상태를 액션 클러스터의 다섯 상호작용으로 변환합니다.
     * @returns {object[]} 슬롯·명령·활성 상태를 가진 행동 목록입니다.
     * @private
     */
    #resolveActionClusterActions() {
        const { hud, snapshot } = this.#frame;
        const controls = hud.controls;
        const primaryIsMove = snapshot.phase === 'move';
        const hasPlannedMovement = Number(hud.movePreview?.stepsUsed) > 0;
        const primaryEnabled = controls.ready && (primaryIsMove
            ? hud.movePreview?.ok === true
            : snapshot.phase === 'action' && !snapshot.actionUsed);
        const values = [
            primaryIsMove
                ? {
                    key: 'battle-reset-path',
                    slot: 'left',
                    label: '초기화',
                    enabled: controls.ready && hasPlannedMovement,
                    type: TUTORIAL_COMMANDS.PLAN_RESET
                }
                : {
                    key: 'battle-melee',
                    slot: 'left',
                    label: hud.attackSelected && hud.attackWeapon === 'melee'
                        ? '근접 취소'
                        : '근접',
                    enabled: controls.actionReady && controls.meleeTargetCount > 0,
                    active: hud.attackSelected && hud.attackWeapon === 'melee',
                    type: TUTORIAL_COMMANDS.SELECT_ATTACK,
                    payload: { weapon: 'melee' }
                },
            {
                key: 'battle-ranged',
                slot: 'right',
                label: hud.attackSelected && hud.attackWeapon === 'bow'
                    ? '원거리 취소'
                    : '원거리',
                enabled: controls.actionReady
                    && controls.hasBow
                    && controls.bowTargetCount > 0,
                active: hud.attackSelected && hud.attackWeapon === 'bow',
                type: TUTORIAL_COMMANDS.SELECT_ATTACK,
                payload: { weapon: 'bow' }
            },
            {
                key: 'battle-heal',
                slot: 'heal',
                label: '회복',
                enabled: controls.actionReady,
                type: TUTORIAL_COMMANDS.HEAL
            },
            {
                key: 'battle-idle',
                slot: 'idle',
                label: '대기',
                enabled: controls.actionReady,
                type: TUTORIAL_COMMANDS.IDLE
            },
            {
                key: 'battle-end',
                slot: 'center',
                label: '액션',
                enabled: primaryEnabled,
                type: primaryIsMove
                    ? TUTORIAL_COMMANDS.COMMIT_PATH
                    : TUTORIAL_COMMANDS.IDLE
            }
        ];
        return values.map((value) => ({
            ...value,
            focused: hud.focusedControlKey === value.key
        }));
    }

    /**
     * 액션 프레임의 원본 비율에서 중앙·화살·상단 다이아의 렌더 및 히트 영역을 계산합니다.
     * @returns {object} 액션 클러스터 기하입니다.
     * @private
     */
    #resolveActionClusterGeometry() {
        const { hud, layout } = this.#frame;
        const config = hud.config.actions.CLUSTER;
        const primaryRect = layout.hudRects.PRIMARY_ACTION;
        const primaryHeight = Math.min(
            primaryRect.h,
            clampBattleViewNumber(
                this.#uwh(config.PRIMARY_HEIGHT_WH),
                config.PRIMARY_MIN_HEIGHT_PX,
                config.PRIMARY_MAX_HEIGHT_PX
            )
        );
        const primaryContainer = {
            x: primaryRect.x,
            y: primaryRect.y + ((primaryRect.h - primaryHeight) * 0.5),
            w: primaryRect.w,
            h: primaryHeight
        };
        const frame = fitTutorialAssetRect(
            this.#assetPort.getUiAsset?.('actionButton'),
            primaryContainer
        ) || {
            x: Math.round(primaryContainer.x),
            y: Math.round(primaryContainer.y),
            w: Math.max(1, Math.round(primaryContainer.w)),
            h: Math.max(1, Math.round(primaryContainer.h))
        };
        const sideWidth = Math.max(
            1,
            Math.round(frame.w * config.SIDE_HIT_WIDTH_RATIO)
        );
        const sideHeight = Math.max(
            1,
            Math.round(frame.h * config.SIDE_HIT_HEIGHT_RATIO)
        );
        const hitGap = Math.max(0, Math.round(config.HIT_GAP_PX));
        const sideY = Math.round(frame.y + ((frame.h - sideHeight) * 0.5));
        const topSize = Math.max(
            1,
            Math.round(
                frame.w * config.TOP_BUTTON_SIZE_TO_PRIMARY_WIDTH_RATIO
            )
        );
        const topGap = Math.max(
            0,
            Math.round(topSize * config.TOP_BUTTON_GAP_TO_PRIMARY_RATIO)
        );
        const topY = Math.round(frame.y - topSize - topGap);
        const topCenters = config.TOP_BUTTON_CENTER_X_RATIOS;
        const createTopRect = (ratio) => ({
            x: Math.round(frame.x + (frame.w * ratio) - (topSize * 0.5)),
            y: topY,
            w: topSize,
            h: topSize
        });
        const sparkSize = Math.max(
            3,
            Math.round(topSize * config.SPARK_SIZE_TO_TOP_BUTTON_RATIO)
        );
        return {
            config,
            frame,
            left: {
                x: frame.x,
                y: sideY,
                w: Math.max(1, sideWidth - hitGap),
                h: sideHeight
            },
            right: {
                x: frame.x + frame.w - sideWidth + hitGap,
                y: sideY,
                w: Math.max(1, sideWidth - hitGap),
                h: sideHeight
            },
            center: {
                x: frame.x + sideWidth + hitGap,
                y: frame.y,
                w: Math.max(1, frame.w - (sideWidth * 2) - (hitGap * 2)),
                h: frame.h
            },
            heal: createTopRect(topCenters[0]),
            idle: createTopRect(topCenters[1]),
            spark: {
                x: Math.round(frame.x + (
                    frame.w * config.SPARK_CENTER_X_RATIO
                )),
                y: Math.round(topY - (
                    topSize * config.SPARK_GAP_TO_TOP_BUTTON_RATIO
                )),
                size: sparkSize
            }
        };
    }

    /** 작은 십자 픽셀 반짝임을 액션 클러스터 위에 그립니다. @private */
    #drawActionSpark(spark, fill) {
        const thickness = Math.max(1, Math.round(spark.size * 0.24));
        this.#renderPort.render('ui', {
            shape: 'rect',
            x: Math.round(spark.x - (thickness * 0.5)),
            y: Math.round(spark.y - (spark.size * 0.5)),
            w: thickness,
            h: spark.size,
            fill,
            alpha: 0.86
        });
        this.#renderPort.render('ui', {
            shape: 'rect',
            x: Math.round(spark.x - (spark.size * 0.5)),
            y: Math.round(spark.y - (thickness * 0.5)),
            w: spark.size,
            h: thickness,
            fill,
            alpha: 0.86
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
     * 패널 원본 픽셀 꼭짓점을 현재 렌더 좌표의 평면 배열로 투영합니다.
     * @param {object} panelRect - 실제 패널 사각형입니다.
     * @param {{X:number,Y:number}[]} points - 원본 픽셀 기준 꼭짓점입니다.
     * @param {object} source - 패널 원본 크기입니다.
     * @returns {number[]|null} 렌더 명령용 평면 꼭짓점 배열입니다.
     * @private
     */
    #resolveSourcePanelVertices(panelRect, points, source) {
        const sourceWidth = Number(source?.WIDTH);
        const sourceHeight = Number(source?.HEIGHT);
        if (!(sourceWidth > 0) || !(sourceHeight > 0)
            || !Array.isArray(points) || points.length < 3) {
            return null;
        }
        const scaleX = panelRect.w / sourceWidth;
        const scaleY = panelRect.h / sourceHeight;
        return points.flatMap((point) => [
            Math.round(panelRect.x + (Number(point.X) * scaleX)),
            Math.round(panelRect.y + (Number(point.Y) * scaleY))
        ]);
    }

    /**
     * 원본 패널 내부 트랙에 픽셀 게이지와 선택 행동 예상 구간을 그립니다.
     * @param {object|null} rect - 패널 원본에서 투영한 게이지 사각형입니다.
     * @param {number} ratio - 현재 게이지 비율입니다.
     * @param {string} fill - 에셋이 없을 때 사용할 색입니다.
     * @param {number|null} pendingRatio - 선택 행동 후 예상 비율입니다.
     * @param {string} assetKey - 픽셀 게이지 에셋 키입니다.
     * @private
     */
    #drawEmbeddedGauge(rect, ratio, fill, pendingRatio, assetKey) {
        if (!rect) {
            return;
        }
        const colors = this.#frame.colors;
        const safeRatio = clampBattleViewNumber(ratio, 0, 1);
        const safePending = pendingRatio !== null
            && pendingRatio !== undefined
            && Number.isFinite(Number(pendingRatio))
            ? clampBattleViewNumber(pendingRatio, 0, 1)
            : safeRatio;
        if (safeRatio > 0) {
            const fillRect = {
                x: rect.x,
                y: rect.y,
                w: Math.max(1, rect.w * safeRatio),
                h: rect.h
            };
            const drewAsset = drawTutorialPixelAsset(this.#renderPort, {
                layer: 'ui',
                image: this.#assetPort.getUiAsset?.(assetKey),
                rect: fillRect,
                mode: 'exact',
                alpha: 1
            });
            if (!drewAsset) {
                this.#renderPort.render('ui', {
                    shape: 'rect',
                    ...fillRect,
                    fill
                });
            }
        }
        if (Math.abs(safePending - safeRatio) <= 0.0001) {
            return;
        }
        const startRatio = Math.min(safeRatio, safePending);
        const segmentRatio = Math.abs(safePending - safeRatio);
        this.#renderPort.render('ui', {
            shape: 'rect',
            x: rect.x + (rect.w * startRatio),
            y: rect.y,
            w: rect.w * segmentRatio,
            h: rect.h,
            fill: safePending > safeRatio ? colors.UI.Success : colors.UI.Danger
        });
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

    /** UI 기준 너비 백분율을 픽셀로 변환합니다. @private */
    #uww(value) {
        return this.#frame.layout.designSpace.w * (Number(value) / 100);
    }

    /** 화면 높이 백분율을 픽셀로 변환합니다. @private */
    #uwh(value) {
        return this.#frame.layout.designSpace.h * (Number(value) / 100);
    }

    /** 공통 텍스트 렌더 명령을 실행합니다. @private */
    #drawText(layer, text, x, y, font, fill, align = 'left', alpha = 1) {
        drawBattleViewText(this.#renderPort, {
            layer, text, x, y, font, fill, align, alpha
        });
    }
}
