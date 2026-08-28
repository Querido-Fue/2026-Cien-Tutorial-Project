import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import {
    clampBattleViewNumber,
    drawBattleViewText,
    toBattleViewList,
    truncateBattleViewText,
    wrapBattleViewText
} from './_tutorial_battle_view_helpers.js';
import { drawTutorialPixelAsset } from './_tutorial_asset_view_helpers.js';

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
     * @param {{getLoraPortrait?:Function}} assetPort - 읽기 전용 초상화 포트입니다.
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
            this.#drawBattleStageHeader();
            this.#drawLoraStatusCard();
            this.#drawMissionCard();
            this.#drawPlayerStatus();
            this.#drawInventoryCard();
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
            const controls = hud.controls;
            const actionRect = layout.hudRects.SECONDARY_ACTIONS;
            const columns = Number(hud.config.actions.COLUMNS) || 4;
            const gapX = this.#uww(hud.config.actions.GAP_X_UIWW);
            const actionColumnW = (
                actionRect.w - (gapX * (columns - 1))
            ) / columns;
            const actionH = Math.min(
                actionRect.h,
                clampBattleViewNumber(this.#uwh(7), 48, 64)
            );
            const actionY = actionRect.y + ((actionRect.h - actionH) * 0.5);
            const actionSpecs = [
                {
                    key: 'melee',
                    label: hud.attackSelected && hud.attackWeapon === 'melee'
                        ? '1 근접 취소'
                        : '1 근접 공격',
                    enabled: controls.actionReady && controls.meleeTargetCount > 0,
                    active: hud.attackSelected && hud.attackWeapon === 'melee',
                    type: TUTORIAL_COMMANDS.SELECT_ATTACK,
                    payload: { weapon: 'melee' }
                },
                {
                    key: 'ranged',
                    label: hud.attackSelected && hud.attackWeapon === 'bow'
                        ? '2 원거리 취소'
                        : '2 원거리 공격',
                    enabled: controls.actionReady
                        && controls.hasBow
                        && controls.bowTargetCount > 0,
                    active: hud.attackSelected && hud.attackWeapon === 'bow',
                    type: TUTORIAL_COMMANDS.SELECT_ATTACK,
                    payload: { weapon: 'bow' }
                },
                {
                    key: 'heal',
                    label: '3 회복 +' + String(hud.config.healAmount),
                    enabled: controls.actionReady,
                    type: TUTORIAL_COMMANDS.HEAL
                },
                {
                    key: 'idle',
                    label: '4 대기',
                    enabled: controls.actionReady,
                    type: TUTORIAL_COMMANDS.IDLE
                }
            ];
            actionSpecs.forEach((spec, index) => {
                specs.push({
                    key: 'battle-' + spec.key,
                    x: actionRect.x + (index * (actionColumnW + gapX)),
                    y: actionY,
                    w: actionColumnW,
                    h: actionH,
                    label: spec.label,
                    backgroundAssetKey: spec.key === 'heal' || spec.key === 'idle'
                        ? 'waitHealButton'
                        : 'actionButton',
                    backgroundImageAlpha: 0.88,
                    enabled: spec.enabled,
                    active: spec.active,
                    focused: hud.focusedControlKey === 'battle-' + spec.key,
                    inspectable: true,
                    command: { type: spec.type, payload: spec.payload }
                });
            });

            const primaryRect = layout.hudRects.PRIMARY_ACTION;
            const primaryH = Math.min(
                primaryRect.h,
                clampBattleViewNumber(this.#uwh(7), 48, 72)
            );
            const primaryIsMove = snapshot.phase === 'move';
            const primaryEnabled = controls.ready && (primaryIsMove
                ? hud.movePreview?.ok === true
                : snapshot.phase === 'action' && !snapshot.actionUsed);
            const primaryLabel = primaryIsMove
                ? '이동 확정 '
                    + String(hud.movePreview?.stepsUsed || 0)
                    + '/'
                    + String(hud.movePreview?.moveRange || hud.config.playerMoveRange)
                    + ' · 남음 ' + String(hud.movePreview?.remainingMoves ?? 0)
                    + '  [Enter]'
                : snapshot.phase === 'action'
                    ? '대기 · 행동 '
                        + String((Number(snapshot.actionsUsed) || 0) + 1)
                        + '/'
                        + String(Number(snapshot.actionsPerTurn) || 1)
                        + '  [Space]'
                    : '로라와 몹 행동 중';
            specs.push({
                key: 'battle-end',
                x: primaryRect.x,
                y: primaryRect.y + ((primaryRect.h - primaryH) * 0.5),
                w: primaryRect.w,
                h: primaryH,
                label: primaryLabel,
                backgroundAssetKey: 'actionButton',
                backgroundImageAlpha: 0.82,
                enabled: primaryEnabled,
                idleColor: colors.UI.Primary,
                hoverColor: colors.UI.PrimaryHover,
                textColor: colors.UI.OnPrimary,
                radius: this.#uwh(1.35),
                shadow: { blur: 10, color: colors.UI.ButtonShadow },
                command: {
                    type: primaryIsMove
                        ? TUTORIAL_COMMANDS.COMMIT_PATH
                        : TUTORIAL_COMMANDS.IDLE
                }
            });

            const menuRect = layout.hudRects.MENU;
            const menuH = Math.min(
                menuRect.h,
                clampBattleViewNumber(this.#uwh(4.2), 32, 48)
            );
            specs.push({
                key: 'battle-menu',
                x: menuRect.x,
                y: menuRect.y + ((menuRect.h - menuH) * 0.5),
                w: menuRect.w,
                h: menuH,
                label: 'Esc  일시정지',
                backgroundAssetKey: 'mainButton',
                backgroundImageAlpha: 0.86,
                enabled: !hud.presentationLocked,
                idleColor: colors.UI.Card,
                hoverColor: colors.UI.ButtonHover,
                textColor: colors.UI.Text,
                radius: this.#uwh(1),
                shadow: { blur: 8, color: colors.UI.CardShadow },
                command: { type: TUTORIAL_COMMANDS.PAUSE }
            });

            const inventoryRect = layout.hudRects.INVENTORY_CARD;
            const inventoryLayout = hud.config.inventory;
            const inventoryColumns = Number(inventoryLayout.COLUMNS) || 3;
            const inventoryRows = Number(inventoryLayout.ROWS) || 2;
            const inventoryPad = this.#uww(0.9);
            const inventoryGapX = this.#uww(0.45);
            const itemGapY = this.#uwh(0.6);
            const headerH = clampBattleViewNumber(inventoryRect.h * 0.22, 30, 46);
            const inventoryY = inventoryRect.y
                + headerH
                + clampBattleViewNumber(inventoryRect.h * 0.05, 6, 12);
            const inventoryColumnW = (
                inventoryRect.w
                - (inventoryPad * 2)
                - (inventoryGapX * (inventoryColumns - 1))
            ) / inventoryColumns;
            const availableItemH = (
                inventoryRect.y + inventoryRect.h - inventoryPad - inventoryY
                - (itemGapY * (inventoryRows - 1))
            ) / inventoryRows;
            const itemH = clampBattleViewNumber(availableItemH, 22, 56);
            const itemIconLayout = hud.config.itemIcon;
            hud.inventory.entries.forEach((entry, index) => {
                const column = index % inventoryColumns;
                const row = Math.floor(index / inventoryColumns);
                const iconWidth = entry.known && entry.hasIcon
                    ? itemH * itemIconLayout.BUTTON_ICON_SIZE_RATIO
                    : 0;
                const iconGap = iconWidth > 0
                    ? this.#uww(itemIconLayout.BUTTON_ICON_GAP_UIWW)
                    : 0;
                const countLabel = ' ×' + String(entry.count);
                const displayLabel = '[' + entry.statusLabel + '] ' + entry.label;
                const label = truncateBattleViewText(
                    this.#renderPort,
                    displayLabel,
                    viewModel.fonts.BUTTON,
                    inventoryColumnW
                        - this.#uww(1.2)
                        - iconWidth
                        - iconGap
                        - this.#renderPort.measureText(countLabel, viewModel.fonts.BUTTON)
                ) + countLabel;
                specs.push({
                    key: 'item-' + entry.itemId,
                    x: inventoryRect.x
                        + inventoryPad
                        + (column * (inventoryColumnW + inventoryGapX)),
                    y: inventoryY + (row * (itemH + itemGapY)),
                    w: inventoryColumnW,
                    h: itemH,
                    label,
                    backgroundAssetKey: 'mainButton',
                    backgroundImageAlpha: 0.58,
                    iconId: iconWidth > 0 ? entry.itemId : null,
                    iconWidth,
                    itemSpacing: iconGap,
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
                const navH = clampBattleViewNumber(headerH * 0.78, 26, 36);
                const navW = clampBattleViewNumber(inventoryRect.w * 0.09, 28, 42);
                const navGap = this.#uww(0.35);
                const right = inventoryRect.x + inventoryRect.w - inventoryPad;
                specs.push({
                    key: 'inventory-prev',
                    x: right - (navW * 2) - navGap,
                    y: inventoryRect.y + ((headerH - navH) * 0.5),
                    w: navW,
                    h: navH,
                    label: '◀',
                    idleColor: colors.UI.CardHeader,
                    hoverColor: colors.UI.ButtonHover,
                    command: {
                        type: TUTORIAL_COMMANDS.INVENTORY_PAGE_SHIFT,
                        payload: { delta: -1 }
                    }
                });
                specs.push({
                    key: 'inventory-next',
                    x: right - navW,
                    y: inventoryRect.y + ((headerH - navH) * 0.5),
                    w: navW,
                    h: navH,
                    label: '▶',
                    idleColor: colors.UI.CardHeader,
                    hoverColor: colors.UI.ButtonHover,
                    command: {
                        type: TUTORIAL_COMMANDS.INVENTORY_PAGE_SHIFT,
                        payload: { delta: 1 }
                    }
                });
            }
            return specs;
        } finally {
            this.#frame = null;
        }
    }

    /** 스테이지 제목과 턴 진행 핍을 그립니다. @private */
    #drawBattleStageHeader() {
        const { colors, floor, fonts, hud, layout, snapshot, world } = this.#frame;
        const rect = layout.hudRects.STAGE_HEADER;
        drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: this.#assetPort.getUiAsset?.('turnFrame'),
            rect,
            alpha: 0.82
        });
        const rawStageTitle = Number(world.presentation.floorIndex) === 0
            ? (floor?.label || '1층') + ' · 로라의 방'
            : (floor?.label || '지하층') + ' · 붕괴 지대';
        const stageTitle = truncateBattleViewText(
            this.#renderPort,
            rawStageTitle,
            fonts.HEADING,
            rect.w
        );
        const titleY = rect.y + clampBattleViewNumber(rect.h * 0.2, 18, 30);
        this.#drawText('ui', stageTitle, rect.x, titleY, fonts.HEADING, colors.UI.Text);
        const actionsUsed = Number(snapshot.actionsUsed) || 0;
        const actionsPerTurn = Number(snapshot.actionsPerTurn) || 1;
        const phaseLabels = {
            move: '이동 계획',
            action: '행동 ' + String(Math.min(actionsUsed + 1, actionsPerTurn))
                + '/' + String(actionsPerTurn),
            lora: '로라 → 몹',
            result: '종료'
        };
        const completed = clampBattleViewNumber(
            Number(snapshot.loraActionsCompleted) || 0,
            0,
            Number(snapshot.maxTurns) || 12
        );
        const rawTurnLabel = '로라 행동 ' + String(completed)
            + '/' + String(snapshot.maxTurns)
            + '  ·  ' + (phaseLabels[snapshot.phase] || '진행 중');
        const turnLabel = truncateBattleViewText(
            this.#renderPort,
            rawTurnLabel,
            fonts.SMALL,
            rect.w
        );
        this.#drawText(
            'ui',
            turnLabel,
            rect.x,
            rect.y + (rect.h * 0.52),
            fonts.SMALL,
            snapshot.phase === 'move' || snapshot.phase === 'action'
                ? colors.UI.Primary
                : colors.UI.Muted
        );
        const maxTurns = Number(snapshot.maxTurns) || 12;
        const transitionAfter = Number(hud.config.floorTransitionAfterTurn) || 6;
        const dotGap = this.#uww(0.18);
        const dividerGap = this.#uww(0.75);
        const dotSize = clampBattleViewNumber(
            (rect.w - (dotGap * (maxTurns - 1)) - dividerGap) / maxTurns,
            10,
            18
        );
        const dotY = rect.y + rect.h - (dotSize * 0.6);
        let dotX = rect.x + (dotSize * 0.5);
        for (let index = 0; index < maxTurns; index++) {
            if (index === transitionAfter) {
                const dividerX = dotX - (dotGap * 0.5) + (dividerGap * 0.5);
                this.#renderPort.render('ui', {
                    shape: 'rect',
                    x: dividerX,
                    y: dotY - (dotSize * 0.7),
                    w: 1,
                    h: dotSize * 1.4,
                    fill: colors.UI.Border
                });
                dotX += dividerGap;
            }
            const done = index < completed;
            const upcoming = index === completed && snapshot.phase !== 'result';
            this.#renderPort.render('ui', {
                shape: 'circle',
                x: dotX,
                y: dotY,
                radius: dotSize * 0.5,
                fill: done ? colors.UI.Primary : colors.UI.CardHeader,
                stroke: upcoming ? colors.UI.Accent : colors.UI.Border,
                lineWidth: upcoming ? 2 : 1
            });
            this.#drawText(
                'ui', String(index + 1), dotX, dotY, fonts.SMALL,
                done ? colors.UI.OnPrimary : colors.UI.Muted, 'center'
            );
            dotX += dotSize + dotGap;
        }
    }

    /** 로라 초상과 게이지 카드를 그립니다. @private */
    #drawLoraStatusCard() {
        const { colors, fonts, hud, layout, snapshot, world } = this.#frame;
        const rect = layout.hudRects.LORA_CARD;
        const pad = clampBattleViewNumber(rect.w * 0.035, 10, 18);
        this.#drawHudCard(rect, 'loraPanel', 0.82);
        const portraitH = rect.h - (pad * 2);
        const portraitW = portraitH * (200 / 240);
        const portraitX = rect.x + pad;
        const portraitY = rect.y + pad;
        const portrait = this.#assetPort.getLoraPortrait?.() || null;
        if (portrait?.complete && portrait.naturalWidth > 0) {
            this.#renderPort.render('ui', {
                shape: 'image', image: portrait,
                x: Math.round(portraitX),
                y: Math.round(portraitY),
                w: Math.round(portraitW),
                h: Math.round(portraitH),
                smoothing: false
            });
        } else {
            this.#renderPort.render('ui', {
                shape: 'roundRect',
                x: portraitX, y: portraitY, w: portraitW, h: portraitH,
                radius: this.#uwh(1),
                fill: colors.UI.CardHeader,
                stroke: colors.UI.Border,
                lineWidth: 1
            });
            this.#drawText(
                'ui', 'L', portraitX + (portraitW * 0.5),
                portraitY + (portraitH * 0.5), fonts.TITLE,
                colors.UI.Primary, 'center'
            );
        }
        const contentX = portraitX + portraitW + pad;
        const contentRight = rect.x + rect.w - pad;
        const contentW = Math.max(1, contentRight - contentX);
        const headerH = rect.h * 0.28;
        this.#renderPort.render('ui', {
            shape: 'roundRect',
            x: contentX - (pad * 0.35),
            y: rect.y + pad,
            w: contentW + (pad * 0.35),
            h: headerH - pad,
            radius: this.#uwh(0.8),
            fill: colors.UI.CardHeader
        });
        const stateLabel = hud.instabilityState?.label
            || hud.instabilityState?.id
            || '상태 확인 중';
        this.#drawText(
            'ui', '로라', contentX, rect.y + (headerH * 0.52),
            fonts.HEADING, colors.UI.Text
        );
        this.#drawText(
            'ui', stateLabel, contentRight, rect.y + (headerH * 0.52),
            fonts.SMALL,
            Number(world.presentation.instability) <= 10
                ? colors.UI.Success
                : colors.UI.Warning,
            'right'
        );
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
        const gaugeH = clampBattleViewNumber(rect.h * 0.055, 7, 12);
        const hpLabelY = rect.y + (rect.h * 0.48);
        this.#drawText(
            'ui', 'HP  ' + this.#formatTransition(loraHp, expectedLoraHp)
                + '/' + String(loraMaxHp),
            contentX, hpLabelY, fonts.SMALL, colors.UI.Text
        );
        this.#drawGauge(
            contentX, rect.y + (rect.h * 0.57), contentW, gaugeH,
            loraHp / loraMaxHp, colors.UI.GaugeHp, expectedLoraHp / loraMaxHp
        );
        this.#drawText(
            'ui', '불안정도  ' + this.#formatTransition(instability, expectedInstability),
            contentX, rect.y + (rect.h * 0.73), fonts.SMALL, colors.UI.Text
        );
        this.#drawGauge(
            contentX, rect.y + (rect.h * 0.82), contentW, gaugeH,
            instability / 100, colors.UI.GaugeInstability, expectedInstability / 100
        );
    }

    /** 다음 로라 행동, 선택 행동 미리보기와 조사 아이템을 그립니다. @private */
    #drawMissionCard() {
        const { colors, fonts, hud, layout, snapshot } = this.#frame;
        const rect = layout.hudRects.MISSION_CARD;
        const pad = clampBattleViewNumber(rect.w * 0.07, 14, 22);
        const lineH = clampBattleViewNumber(this.#uwh(2.45), 17, 27);
        const maxW = rect.w - (pad * 2);
        const intent = hud.readability?.loraIntent || {};
        const preview = hud.readability?.playerPreview || {};
        const inspectedItem = hud.readability?.inspectedItem || null;
        this.#drawHudCard(rect, 'itemPanel', 0.58);
        let y = rect.y + pad;
        this.#drawText(
            'ui', 'NEXT LORA' + (intent.forecast ? ' · 현재 기준' : ''),
            rect.x + pad, y, fonts.SMALL, colors.UI.Primary
        );
        y += lineH * 1.25;
        this.#drawText(
            'ui',
            truncateBattleViewText(
                this.#renderPort,
                intent.actionLabel + ' · ' + intent.stateLabel,
                fonts.BODY,
                maxW
            ),
            rect.x + pad,
            y,
            fonts.BODY,
            colors.UI.Text
        );
        y += lineH;
        this.#drawText(
            'ui',
            '예상 피해 ' + String(Math.round(Number(intent.finalDamage) || 0))
                + ' · 범위 ' + String(intent.rangeLabel || '없음'),
            rect.x + pad,
            y,
            fonts.SMALL,
            Number(intent.finalDamage) > 0 ? colors.UI.Danger : colors.UI.Success
        );
        y += lineH;
        this.#drawText(
            'ui',
            truncateBattleViewText(
                this.#renderPort,
                String(intent.reasonLabel || ''),
                fonts.SMALL,
                maxW
            ),
            rect.x + pad,
            y,
            fonts.SMALL,
            colors.UI.Muted
        );
        y += lineH * 0.8;
        this.#renderPort.render('ui', {
            shape: 'rect',
            x: rect.x + pad,
            y,
            w: rect.w - (pad * 2),
            h: 1,
            fill: colors.UI.Border
        });
        y += lineH * 0.9;
        this.#drawText(
            'ui',
            'ACTION PREVIEW · ' + String(preview.title || '선택 없음'),
            rect.x + pad,
            y,
            fonts.SMALL,
            colors.UI.Primary
        );
        y += lineH;
        const hpLine = '로라 HP '
            + this.#formatTransition(preview.before?.loraHp, preview.expected?.loraHp)
            + ' · 내 HP '
            + this.#formatTransition(preview.before?.playerHp, preview.expected?.playerHp);
        this.#drawText(
            'ui',
            truncateBattleViewText(this.#renderPort, hpLine, fonts.SMALL, maxW),
            rect.x + pad,
            y,
            fonts.SMALL,
            colors.UI.Text
        );
        y += lineH;
        this.#drawText(
            'ui',
            '불안정 '
                + this.#formatTransition(
                    preview.before?.instability,
                    preview.expected?.instability
                ),
            rect.x + pad,
            y,
            fonts.SMALL,
            colors.UI.Text
        );
        y += lineH;
        const consumedLine = '소모 ' + String(preview.consumedItemLabel || '없음')
            + (Number(preview.consumedItemCount) > 0
                ? ' ×' + String(preview.consumedItemCount)
                : '')
            + ' · ' + String(preview.persistentLabel || '연속 공격 0회');
        this.#drawText(
            'ui',
            truncateBattleViewText(this.#renderPort, consumedLine, fonts.SMALL, maxW),
            rect.x + pad,
            y,
            fonts.SMALL,
            colors.UI.Muted
        );
        y += lineH;
        if (!inspectedItem) {
            this.#drawText(
                'ui',
                truncateBattleViewText(
                    this.#renderPort,
                    String(preview.reasonLabel || ''),
                    fonts.SMALL,
                    maxW
                ),
                rect.x + pad,
                y,
                fonts.SMALL,
                preview.ok === false && preview.available
                    ? colors.UI.Warning
                    : colors.UI.Muted
            );
        } else {
            const itemTitle = 'ITEM · ' + inspectedItem.label
                + ' ×' + String(inspectedItem.count)
                + ' [' + inspectedItem.statusLabel + ']';
            this.#drawText(
                'ui',
                truncateBattleViewText(this.#renderPort, itemTitle, fonts.SMALL, maxW),
                rect.x + pad,
                y,
                fonts.SMALL,
                colors.UI.Accent
            );
            y += lineH;
            wrapBattleViewText(
                this.#renderPort,
                inspectedItem.description,
                fonts.SMALL,
                maxW,
                2
            ).forEach((line) => {
                const detailBottom = rect.y + rect.h - pad - (lineH * 1.2);
                if (y < detailBottom) {
                    this.#drawText(
                        'ui', line, rect.x + pad, y, fonts.SMALL, colors.UI.Text
                    );
                    y += lineH;
                }
            });
        }
        const statusLine = snapshot.phase === 'move'
            ? '이동 ' + String(hud.movePreview?.stepsUsed || 0)
                + '/' + String(hud.movePreview?.moveRange || hud.config.playerMoveRange)
                + ' · 남음 ' + String(hud.movePreview?.remainingMoves ?? 0)
                + '  →  행동 0/' + String(snapshot.actionsPerTurn || 1)
            : snapshot.phase === 'action'
                ? '이동 완료  →  행동 ' + String(snapshot.actionsUsed || 0)
                    + '/' + String(snapshot.actionsPerTurn || 1)
                : snapshot.phase === 'lora'
                    ? '로라 행동  →  몹 행동'
                    : '작전 종료';
        this.#drawText(
            'ui',
            truncateBattleViewText(
                this.#renderPort,
                statusLine,
                fonts.SMALL,
                rect.w - (pad * 2)
            ),
            rect.x + rect.w - pad,
            rect.y + rect.h - pad,
            fonts.SMALL,
            colors.UI.Accent,
            'right'
        );
    }

    /** 플레이어 HP 라벨과 게이지를 그립니다. @private */
    #drawPlayerStatus() {
        const { colors, fonts, hud, layout, snapshot, world } = this.#frame;
        const rect = layout.hudRects.PLAYER_STATUS;
        const playerHp = Math.max(0, Number(world.presentation.playerHp) || 0);
        const playerMaxHp = Math.max(1, Number(snapshot.player?.maxHp) || 100);
        const preview = hud.readability?.playerPreview;
        const expectedPlayerHp = preview?.available
            ? Math.max(0, Number(preview.expected?.playerHp) || 0)
            : playerHp;
        const gaugeH = clampBattleViewNumber(rect.h * 0.24, 8, 12);
        drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: this.#assetPort.getUiAsset?.('playerPanel'),
            rect,
            alpha: 0.72
        });
        this.#drawText('ui', 'HP', rect.x, rect.y + (rect.h * 0.28), fonts.BODY, colors.UI.Text);
        this.#drawText(
            'ui', this.#formatTransition(playerHp, expectedPlayerHp)
                + '/' + String(playerMaxHp),
            rect.x + rect.w, rect.y + (rect.h * 0.28),
            fonts.MONO, colors.UI.Muted, 'right'
        );
        this.#drawGauge(
            rect.x, rect.y + rect.h - gaugeH, rect.w, gaugeH,
            playerHp / playerMaxHp, colors.UI.GaugeHp,
            expectedPlayerHp / playerMaxHp
        );
    }

    /** 인벤토리 공통 카드와 페이지 정보를 그립니다. @private */
    #drawInventoryCard() {
        const { colors, fonts, hud, layout } = this.#frame;
        const rect = layout.hudRects.INVENTORY_CARD;
        const pad = this.#uww(0.9);
        const headerH = clampBattleViewNumber(rect.h * 0.22, 30, 46);
        this.#drawHudCard(rect);
        this.#drawText(
            'ui',
            'ITEMS · 3×5  ' + String(hud.inventory.page + 1)
                + '/' + String(hud.inventory.pageCount),
            rect.x + pad,
            rect.y + (headerH * 0.5),
            fonts.BODY,
            colors.UI.Text
        );
    }

    /** 그림자와 테두리가 있는 HUD 카드를 그립니다. @private */
    #drawHudCard(rect, assetKey = null, assetAlpha = 1) {
        const colors = this.#frame.colors;
        const radius = this.#uwh(1.1);
        this.#renderPort.render('ui', {
            shape: 'roundRect',
            x: rect.x + 2, y: rect.y + 3, w: rect.w, h: rect.h,
            radius, fill: colors.UI.CardShadow
        });
        this.#renderPort.render('ui', {
            shape: 'roundRect',
            x: rect.x, y: rect.y, w: rect.w, h: rect.h,
            radius, fill: colors.UI.Card,
            stroke: colors.UI.Border, lineWidth: 1
        });
        if (assetKey) {
            drawTutorialPixelAsset(this.#renderPort, {
                layer: 'ui',
                image: this.#assetPort.getUiAsset?.(assetKey),
                rect,
                alpha: assetAlpha
            });
        }
    }

    /** 현재값과 선택 행동의 예상 구간을 함께 그립니다. @private */
    #drawGauge(x, y, w, h, ratio, fill, pendingRatio = null) {
        const colors = this.#frame.colors;
        const safeRatio = clampBattleViewNumber(ratio, 0, 1);
        const safePending = pendingRatio !== null
            && pendingRatio !== undefined
            && Number.isFinite(Number(pendingRatio))
            ? clampBattleViewNumber(pendingRatio, 0, 1)
            : safeRatio;
        this.#renderPort.render('ui', {
            shape: 'roundRect', x, y, w, h,
            radius: h * 0.5, fill: colors.UI.GaugeTrack
        });
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
    }

    /** @param {*} before @param {*} expected @returns {string} 현재→예상 표시입니다. @private */
    #formatTransition(before, expected) {
        const current = Math.round(Number(before) || 0);
        const next = Math.round(Number(expected) || 0);
        return current === next ? String(current) : String(current) + '→' + String(next);
    }

    /** UI 기준 너비 백분율을 픽셀로 변환합니다. @private */
    #uww(value) {
        return this.#frame.layout.viewport.UIWW * (Number(value) / 100);
    }

    /** 화면 높이 백분율을 픽셀로 변환합니다. @private */
    #uwh(value) {
        return this.#frame.layout.viewport.WH * (Number(value) / 100);
    }

    /** 공통 텍스트 렌더 명령을 실행합니다. @private */
    #drawText(layer, text, x, y, font, fill, align = 'left', alpha = 1) {
        drawBattleViewText(this.#renderPort, {
            layer, text, x, y, font, fill, align, alpha
        });
    }
}
