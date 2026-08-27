import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NWJS_PACKAGE_CONTRACT } from './package/_nwjs_package_contract.mjs';
import { NwjsPackager } from './package/_nwjs_packager.mjs';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..');

/** @param {string} name @returns {string|null} */
function readArgument(name) {
    const exactIndex = process.argv.indexOf(name);
    if (exactIndex >= 0) {
        return process.argv[exactIndex + 1] || null;
    }
    const prefix = name + '=';
    return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

const nwjsHome = readArgument('--nwjs-home') || process.env.NWJS_HOME;
const outputDirectory = readArgument('--output') || undefined;

try {
    const result = await new NwjsPackager().package({
        repositoryRoot: REPOSITORY_ROOT,
        nwjsHome,
        outputDirectory
    });
    console.log(
        `[package:nwjs] 성공: NW.js ${result.nwjsVersion}, `
        + `${result.executableName}, ${result.outputDirectory}`
    );
} catch (error) {
    console.error(`[package:nwjs] 실패: ${error.message}`);
    console.error(
        `[package:nwjs] ${NWJS_PACKAGE_CONTRACT.archiveName}을 새 폴더에 풀고 `
        + 'NWJS_HOME 또는 --nwjs-home으로 지정하세요.'
    );
    process.exitCode = 1;
}
