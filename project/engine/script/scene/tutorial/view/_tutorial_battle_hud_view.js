import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import {
    clampBattleViewNumber,
    drawBattleViewText,
    toBattleViewList,
    truncateBattleViewText,
    wrapBattleViewText
} from './_tutorial_battle_view_helpers.js';

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
                    label: '3 회복 +20',
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
                    enabled: spec.enabled,
                    active: spec.active,
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
                label: 'Esc  메뉴',
                enabled: !hud.presentationLocked,
                idleColor: colors.UI.Card,
                hoverColor: colors.UI.ButtonHover,
                textColor: colors.UI.Text,
                radius: this.#uwh(1),
                shadow: { blur: 8, color: colors.UI.CardShadow },
                command: { type: TUTORIAL_COMMANDS.RETURN_MENU }
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
            const itemAtlas = hud.config.itemAtlas;
            hud.inventory.entries.forEach((entry, index) => {
                const column = index % inventoryColumns;
                const row = Math.floor(index / inventoryColumns);
                const iconWidth = entry.known && entry.hasIcon
                    ? itemH * itemAtlas.BUTTON_ICON_SIZE_RATIO
                    : 0;
                const iconGap = iconWidth > 0
                    ? this.#uww(itemAtlas.BUTTON_ICON_GAP_UIWW)
                    : 0;
                const countLabel = ' ×' + String(entry.count);
                const displayLabel = entry.movementConsumable
                    ? '[이동] ' + entry.label
                    : entry.label;
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
                    iconId: iconWidth > 0 ? entry.itemId : null,
                    iconWidth,
                    itemSpacing: iconGap,
                    enabled: entry.usable,
                    active: entry.movementConsumable && hud.cleanseSelected,
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
        this.#drawHudCard(rect);
        const portraitH = rect.h - (pad * 2);
        const portraitW = portraitH * (200 / 240);
        const portraitX = rect.x + pad;
        const portraitY = rect.y + pad;
        const portrait = this.#assetPort.getLoraPortrait?.() || null;
        if (portrait?.complete && portrait.naturalWidth > 0) {
            this.#renderPort.render('ui', {
                shape: 'image', image: portrait,
                x: portraitX, y: portraitY, w: portraitW, h: portraitH
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
        const gaugeH = clampBattleViewNumber(rect.h * 0.055, 7, 12);
        const hpLabelY = rect.y + (rect.h * 0.48);
        this.#drawText(
            'ui', 'HP  ' + String(Math.round(loraHp)) + '/' + String(loraMaxHp),
            contentX, hpLabelY, fonts.SMALL, colors.UI.Text
        );
        this.#drawGauge(
            contentX, rect.y + (rect.h * 0.57), contentW, gaugeH,
            loraHp / loraMaxHp, colors.UI.GaugeHp
        );
        this.#drawText(
            'ui', '불안정도  ' + String(Math.round(instability)),
            contentX, rect.y + (rect.h * 0.73), fonts.SMALL, colors.UI.Text
        );
        this.#drawGauge(
            contentX, rect.y + (rect.h * 0.82), contentW, gaugeH,
            instability / 100, colors.UI.GaugeInstability
        );
    }

    /** 목표와 최근 이벤트 카드를 그립니다. @private */
    #drawMissionCard() {
        const { colors, fonts, hud, layout, snapshot } = this.#frame;
        const rect = layout.hudRects.MISSION_CARD;
        const pad = clampBattleViewNumber(rect.w * 0.07, 14, 22);
        const lineH = clampBattleViewNumber(this.#uwh(2.7), 18, 30);
        this.#drawHudCard(rect);
        let y = rect.y + pad;
        this.#drawText(
            'ui', 'MISSION  ·  ' + hud.config.text.CORE_LOOP,
            rect.x + pad, y, fonts.SMALL, colors.UI.Primary
        );
        y += lineH * 1.4;
        const objectiveLines = wrapBattleViewText(
            this.#renderPort,
            hud.config.text.OBJECTIVE,
            fonts.SMALL,
            rect.w - (pad * 2),
            3
        );
        objectiveLines.forEach((line) => {
            this.#drawText('ui', line, rect.x + pad, y, fonts.SMALL, colors.UI.Text);
            y += lineH;
        });
        y += lineH * 0.35;
        this.#renderPort.render('ui', {
            shape: 'rect',
            x: rect.x + pad,
            y,
            w: rect.w - (pad * 2),
            h: 1,
            fill: colors.UI.Border
        });
        y += lineH;
        this.#drawText('ui', '최근 이벤트', rect.x + pad, y, fonts.BODY, colors.UI.Text);
        y += lineH * 1.25;
        hud.eventLog.slice(-3).forEach((entry) => {
            const line = truncateBattleViewText(
                this.#renderPort,
                '· ' + entry,
                fonts.SMALL,
                rect.w - (pad * 2)
            );
            this.#drawText('ui', line, rect.x + pad, y, fonts.SMALL, colors.UI.Muted);
            y += lineH;
        });
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
        const { colors, fonts, layout, snapshot, world } = this.#frame;
        const rect = layout.hudRects.PLAYER_STATUS;
        const playerHp = Math.max(0, Number(world.presentation.playerHp) || 0);
        const playerMaxHp = Math.max(1, Number(snapshot.player?.maxHp) || 100);
        const gaugeH = clampBattleViewNumber(rect.h * 0.24, 8, 12);
        this.#drawText('ui', 'HP', rect.x, rect.y + (rect.h * 0.28), fonts.BODY, colors.UI.Text);
        this.#drawText(
            'ui', String(Math.round(playerHp)) + '/' + String(playerMaxHp),
            rect.x + rect.w, rect.y + (rect.h * 0.28),
            fonts.MONO, colors.UI.Muted, 'right'
        );
        this.#drawGauge(
            rect.x, rect.y + rect.h - gaugeH, rect.w, gaugeH,
            playerHp / playerMaxHp, colors.UI.GaugeHp
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
    #drawHudCard(rect) {
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
    }

    /** 지정 비율만큼 채운 둥근 게이지를 그립니다. @private */
    #drawGauge(x, y, w, h, ratio, fill) {
        const colors = this.#frame.colors;
        const safeRatio = clampBattleViewNumber(ratio, 0, 1);
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
