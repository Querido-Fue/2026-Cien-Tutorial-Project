import assert from 'node:assert/strict';
import test from 'node:test';

import {
    TutorialChangelogView
} from '../project/engine/script/scene/tutorial/view/_tutorial_changelog_view.js';

test('체인지로그 두 줄 본문은 축소 화면에서도 픽셀 글꼴 높이보다 넓게 배치된다', () => {
    const commands = [];
    const renderPort = {
        render(layer, command) {
            commands.push({ layer, ...command });
        },
        renderGL(layer, command) {
            commands.push({ layer, ...command });
        },
        wrapText(text) {
            return text === '변경 요약' ? ['첫 번째 줄', '두 번째 줄'] : [text];
        }
    };
    const view = new TutorialChangelogView(renderPort, {
        getUiAsset() {
            return null;
        }
    });

    view.draw({
        viewport: {
            WW: 1024,
            WH: 768,
            UIWW: 1024,
            UIOffsetX: 0
        },
        fonts: {
            HEADING: '700 24px sans-serif',
            BODY: '400 18px sans-serif',
            MONO: '400 14px monospace',
            SMALL: '400 18px sans-serif'
        },
        colors: {
            UI: {
                PanelStrong: '#111111',
                Muted: '#777777'
            }
        },
        version: '0830_1139',
        page: 0,
        entries: [{
            version: '0830_1139',
            commit: 'abcdef0',
            summary: '변경 요약'
        }]
    });

    const summaryLines = commands.filter(({ text }) => (
        text === '첫 번째 줄' || text === '두 번째 줄'
    ));
    assert.equal(summaryLines.length, 2);
    assert.ok(summaryLines[1].y - summaryLines[0].y >= (18 * 1.3) - 0.001);
});
