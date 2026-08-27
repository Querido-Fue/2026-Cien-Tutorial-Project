import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const SOURCE_URLS = Object.freeze({
    scene: new URL(
        '../project/engine/script/scene/tutorial/_tutorial_scene.js',
        import.meta.url
    ),
    gameData: new URL(
        '../project/engine/script/data/game/tutorial_game_data.js',
        import.meta.url
    ),
    lightTheme: new URL(
        '../project/engine/script/data/theme/light_theme.js',
        import.meta.url
    ),
    darkTheme: new URL(
        '../project/engine/script/data/theme/dark_theme.js',
        import.meta.url
    )
});

/**
 * 튜토리얼 장면과 데이터 계약 소스를 UTF-8 문자열로 읽습니다.
 * @returns {Promise<Record<string,string>>} 키별 소스 문자열입니다.
 */
async function readContractSources() {
    const entries = await Promise.all(Object.entries(SOURCE_URLS).map(
        async ([key, url]) => [key, await readFile(url, 'utf8')]
    ));
    return Object.fromEntries(entries);
}

test('플레이어 UNDO 명령·단축키·버튼·데이터 계약이 남아 있지 않다', async () => {
    const sources = await readContractSources();
    const combined = Object.values(sources).join('\n');
    const forbiddenPatterns = [
        /COMMANDS\.UNDO/,
        /tutorial\/undo/,
        /Ctrl\+Z/i,
        /KeyZ/,
        /UNDO_SHORT/,
        /pendingUndo/i,
        /undoHistory/i,
        /battle-undo/,
        /result-undo/,
        /cutscene-undo/,
        /UI\.Undo/,
        /\bUNDO\s*:/,
        /\bUNDO_/
    ];

    for (const pattern of forbiddenPatterns) {
        assert.equal(
            pattern.test(combined),
            false,
            `금지된 UNDO 계약이 남았습니다: ${pattern}`
        );
    }
});

test('전투와 결과 화면의 재시작은 같은 스타터를 재사용하지 않고 선택 화면으로 간다', async () => {
    const { scene } = await readContractSources();
    const restartMethod = scene.match(
        /#applyRestart\(\)\s*\{(?<body>[\s\S]*?)\n\s*\}\n\n\s*\/\*\*/
    );

    assert.ok(restartMethod?.groups?.body, '재시작 명령 메서드를 찾을 수 없습니다.');
    assert.match(restartMethod.groups.body, /this\.\#leaveRun\(MODES\.STARTER\)/);
    assert.doesNotMatch(restartMethod.groups.body, /#beginRun\(/);
});
