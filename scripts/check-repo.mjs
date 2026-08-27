import { existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TUTORIAL_GAME_DATA } from '../project/engine/script/data/game/tutorial_game_data.js';
import { TUTORIAL_ASSET_MANIFEST } from '../project/engine/script/data/game/tutorial_asset_manifest.js';
import { SOUND_CONSTANTS } from '../project/engine/script/data/sound/sound_constants.js';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const ENGINE_ROOT = resolve(REPOSITORY_ROOT, 'project', 'engine');
const STRICT_ASSETS = process.argv.includes('--strict-assets')
    || process.env.CIEN_STRICT_ASSETS === '1';

const failures = [];
const warnings = [];

/**
 * 검사 실패를 누적합니다.
 * @param {string} message - 사용자가 바로 원인을 찾을 수 있는 오류입니다.
 */
function fail(message) {
    failures.push(message);
}

/**
 * 중복 ID가 있는지 검사합니다.
 * @param {string} label - 검사 영역 이름입니다.
 * @param {Array<object>} entries - ID 속성을 가진 데이터 목록입니다.
 */
function checkUniqueIds(label, entries) {
    const seen = new Set();
    for (const entry of entries) {
        if (!entry || typeof entry.id !== 'string' || entry.id.length === 0) {
            fail(`${label}: 비어 있거나 문자열이 아닌 ID가 있습니다.`);
            continue;
        }
        if (seen.has(entry.id)) {
            fail(`${label}: 중복 ID '${entry.id}'`);
        }
        seen.add(entry.id);
    }
}

/**
 * 맵 내부의 정수 좌표인지 검사합니다.
 * @param {string} label - 좌표 출처입니다.
 * @param {{x:number,y:number}} point - 검사할 좌표입니다.
 */
function checkCoordinate(label, point) {
    const { WIDTH: width, HEIGHT: height } = TUTORIAL_GAME_DATA.MAP;
    if (!point || !Number.isInteger(point.x) || !Number.isInteger(point.y)) {
        fail(`${label}: 좌표는 정수 x/y여야 합니다.`);
        return;
    }
    if (point.x < 0 || point.x >= width || point.y < 0 || point.y >= height) {
        fail(`${label}: (${point.x}, ${point.y})는 ${width}×${height} 맵 범위를 벗어납니다.`);
    }
}

/**
 * 객체에서 PATH로 끝나는 선언을 재귀적으로 수집합니다.
 * @param {object} value - 탐색할 설정 객체입니다.
 * @param {string} prefix - 진단용 데이터 경로입니다.
 * @param {Array<{label:string,path:string}>} output - 수집 대상입니다.
 */
function collectDeclaredPaths(value, prefix, output) {
    for (const [key, child] of Object.entries(value ?? {})) {
        const label = prefix ? `${prefix}.${key}` : key;
        if (key === 'PATH') {
            output.push({ label, path: child });
        } else if (child && typeof child === 'object') {
            collectDeclaredPaths(child, label, output);
        }
    }
}

/**
 * 브라우저 진입점 기준 상대 에셋 경로를 검사합니다.
 * @param {string} label - 데이터 선언 경로입니다.
 * @param {unknown} assetPath - 런타임 상대 경로입니다.
 */
function checkAssetPath(label, assetPath) {
    if (typeof assetPath !== 'string' || assetPath.length === 0) {
        fail(`${label}: 에셋 경로가 비어 있거나 문자열이 아닙니다.`);
        return;
    }

    const absolutePath = resolve(ENGINE_ROOT, assetPath);
    const repositoryRelativePath = relative(REPOSITORY_ROOT, absolutePath);
    if (repositoryRelativePath.startsWith('..')) {
        fail(`${label}: 저장소 밖을 가리킵니다 (${assetPath}).`);
        return;
    }

    if (!existsSync(absolutePath)) {
        const message = `${label}: 파일 없음 (${repositoryRelativePath}).`;
        if (STRICT_ASSETS) {
            fail(message);
        } else {
            warnings.push(`${message} --strict-assets 사용 시 오류로 처리합니다.`);
        }
    }
}

/**
 * 튜토리얼 데이터의 ID와 맵 좌표 계약을 검사합니다.
 */
function checkTutorialData() {
    const { WIDTH: width, HEIGHT: height } = TUTORIAL_GAME_DATA.MAP;
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
        fail(`MAP: WIDTH와 HEIGHT는 양의 정수여야 합니다. 현재 ${width}×${height}`);
        return;
    }

    checkUniqueIds('STARTER_CHOICES', TUTORIAL_GAME_DATA.STARTER_CHOICES);
    checkUniqueIds('FLOORS', TUTORIAL_GAME_DATA.FLOORS);

    const itemEntries = Object.entries(TUTORIAL_GAME_DATA.ITEMS);
    checkUniqueIds('ITEMS', itemEntries.map(([, item]) => item));
    for (const [key, item] of itemEntries) {
        if (item.id !== key) {
            fail(`ITEMS.${key}: 객체 키와 item.id '${item.id}'가 다릅니다.`);
        }
    }
    for (const starter of TUTORIAL_GAME_DATA.STARTER_CHOICES) {
        if (!TUTORIAL_GAME_DATA.ITEMS[starter.id]) {
            fail(`STARTER_CHOICES.${starter.id}: ITEMS에 대응 항목이 없습니다.`);
        }
    }

    for (const floor of TUTORIAL_GAME_DATA.FLOORS) {
        checkCoordinate(`FLOORS.${floor.id}.playerStart`, floor.playerStart);
        checkCoordinate(`FLOORS.${floor.id}.loraStart`, floor.loraStart);

        if (!Array.isArray(floor.heights) || floor.heights.length !== height) {
            fail(`FLOORS.${floor.id}.heights: 행 수가 MAP.HEIGHT(${height})와 다릅니다.`);
        } else {
            floor.heights.forEach((row, rowIndex) => {
                if (!Array.isArray(row) || row.length !== width) {
                    fail(`FLOORS.${floor.id}.heights[${rowIndex}]: 열 수가 MAP.WIDTH(${width})와 다릅니다.`);
                }
            });
        }

        const worldGroups = [
            ['walls', floor.walls],
            ['items', floor.items],
            ['eventTiles', floor.eventTiles],
            ['teleports', floor.teleports],
            ['mobs', floor.mobs]
        ];
        const worldEntries = worldGroups.flatMap(([, entries]) => entries ?? []);
        checkUniqueIds(`FLOORS.${floor.id}.world`, worldEntries);
        for (const [groupName, entries] of worldGroups) {
            for (const entry of entries ?? []) {
                checkCoordinate(`FLOORS.${floor.id}.${groupName}.${entry.id}`, entry);
            }
        }

        const teleportPairCounts = new Map();
        for (const teleport of floor.teleports ?? []) {
            teleportPairCounts.set(
                teleport.pairId,
                (teleportPairCounts.get(teleport.pairId) ?? 0) + 1
            );
        }
        for (const [pairId, count] of teleportPairCounts) {
            if (typeof pairId !== 'string' || pairId.length === 0 || count !== 2) {
                fail(`FLOORS.${floor.id}.teleports: pairId '${pairId}' 항목 수가 ${count}개입니다.`);
            }
        }
    }
}

/**
 * 현재 코드가 선언한 런타임 에셋 경로를 검사합니다.
 */
function checkDeclaredAssets() {
    for (const entry of TUTORIAL_ASSET_MANIFEST.ENTRIES) {
        if (entry.type === 'image/png') {
            checkAssetPath(`TUTORIAL_ASSET_MANIFEST.${entry.id}`, entry.runtimePath);
        }
    }

    const soundPaths = [];
    collectDeclaredPaths(SOUND_CONSTANTS, 'SOUND_CONSTANTS', soundPaths);
    for (const entry of soundPaths) {
        checkAssetPath(entry.label, entry.path);
    }
}

checkTutorialData();
checkDeclaredAssets();

for (const warning of warnings) {
    console.warn(`[check:repo] 경고: ${warning}`);
}

if (failures.length > 0) {
    for (const failure of failures) {
        console.error(`[check:repo] 오류: ${failure}`);
    }
    console.error(`[check:repo] 실패: 오류 ${failures.length}개, 경고 ${warnings.length}개`);
    process.exitCode = 1;
} else {
    console.log(`[check:repo] 성공: 오류 0개, 경고 ${warnings.length}개`);
}
