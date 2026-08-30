import assert from 'node:assert/strict';
import test from 'node:test';

import { TutorialInventoryPresenter } from '../project/engine/script/scene/tutorial/_tutorial_inventory_presenter.js';
import { ITEM_DESCRIPTION_PANEL_LAYOUT } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_hud_layout.js';
import { TutorialItemDescriptionView } from '../project/engine/script/scene/tutorial/view/_tutorial_item_description_view.js';

test('패시브 아이템의 적용 방식은 자동 적용으로 표시된다', () => {
    const presenter = new TutorialInventoryPresenter({
        data: {
            ITEMS: {
                passive: {
                    label: '패시브 아이템',
                    description: '자동으로 적용됩니다.',
                    passive: true
                }
            },
            LAYOUT: { INVENTORY: { PAGE_SIZE: 5 } }
        },
        assetPort: { hasItemIcon: () => true },
        hudView: {
            getInventoryPaging(entries) {
                return { entries, page: 0, pageCount: 1 };
            }
        }
    });
    const result = presenter.createView({
        model: { inventory: new Map([['passive', 1]]) },
        snapshot: { phase: 'move' },
        ready: true,
        actionReady: true,
        cleanseTargetCount: 0
    });

    assert.equal(result.itemMetadata.passive.statusLabel, '자동 적용');
    assert.equal(result.pagedInventory.entries[0].statusLabel, '자동 적용');
});

test('아이템 설명은 제목·적용 방식을 가운데 두고 1.6·1.3배 줄간격을 지킨다', () => {
    const commands = [];
    const panelImage = { width: 86, height: 128 };
    const renderPort = {
        render(layer, command) {
            commands.push({ layer, ...command });
        },
        measureText(text) {
            return String(text).length * 8;
        },
        wrapText() {
            return ['첫째 줄', '둘째 줄', '셋째 줄'];
        }
    };
    const view = new TutorialItemDescriptionView(renderPort, {
        getUiAsset(key) {
            return key === 'itemPanel' ? panelImage : null;
        }
    });
    const panelRect = { x: 50, y: 20, w: 172, h: 256 };
    view.draw({
        layout: { hudRects: { INVENTORY_CARD: panelRect } },
        fonts: { SMALL: '500 20px sans-serif' },
        colors: { UI: { Text: '#fff', Accent: '#0ff', Muted: '#aaa' } },
        hud: {
            readability: {
                inspectedItem: {
                    label: '인형탈',
                    count: 1,
                    statusLabel: '자동 적용',
                    description: '테스트 설명'
                }
            },
            inventory: { page: 0, pageCount: 1 }
        }
    });

    const texts = commands.filter((command) => command.shape === 'text');
    const title = texts.find((command) => command.text === '인형탈 ×1');
    const status = texts.find((command) => command.text === '자동 적용');
    const body = ['첫째 줄', '둘째 줄', '셋째 줄'].map((text) => (
        texts.find((command) => command.text === text)
    ));
    const panelCenterX = panelRect.x + (panelRect.w * 0.5);
    const ornamentBottomY = panelRect.y + (
        panelRect.h
        * ITEM_DESCRIPTION_PANEL_LAYOUT.TOP_ORNAMENT_BOTTOM_Y
        / ITEM_DESCRIPTION_PANEL_LAYOUT.SOURCE.HEIGHT
    );

    assert.equal(title.align, 'center');
    assert.equal(title.x, panelCenterX);
    assert.equal(status.align, 'center');
    assert.equal(status.x, panelCenterX);
    assert.ok(status.y > ornamentBottomY);
    assert.equal(body.every((command) => command.align === 'left'), true);
    const statusGap = body[0].y - status.y;
    const bodyGap = body[1].y - body[0].y;
    assert.equal(
        statusGap,
        20 * ITEM_DESCRIPTION_PANEL_LAYOUT.STATUS_DESCRIPTION_GAP_MULTIPLIER
    );
    assert.equal(
        bodyGap,
        20 * ITEM_DESCRIPTION_PANEL_LAYOUT.DESCRIPTION_LINE_HEIGHT_MULTIPLIER
    );
    assert.ok(Math.abs((body[2].y - body[1].y) - bodyGap) < 0.0001);
});
