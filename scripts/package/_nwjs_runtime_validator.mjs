import { execFile } from 'node:child_process';
import { access, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { NWJS_PACKAGE_CONTRACT } from './_nwjs_package_contract.mjs';

const execFileAsync = promisify(execFile);

/** @param {string} executablePath @returns {Promise<string|null>} */
async function readWindowsProductVersion(executablePath) {
    if (process.platform !== 'win32') {
        return null;
    }
    const command = [
        '$item = Get-Item -LiteralPath $args[0];',
        '$item.VersionInfo.ProductVersion'
    ].join(' ');
    const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', command, executablePath],
        { windowsHide: true }
    );
    return stdout.trim() || null;
}

/**
 * @class NwjsRuntimeValidator
 * @description 패키징 입력이 고정한 NW.js Windows x64 배포본인지 검증합니다.
 */
export class NwjsRuntimeValidator {
    /** @param {{versionReader?:(path:string)=>Promise<string|null>}} [options] */
    constructor(options = {}) {
        this.versionReader = options.versionReader || readWindowsProductVersion;
    }

    /** @param {*} homeValue @returns {Promise<object>} 검증된 런타임 정보입니다. */
    async validate(homeValue) {
        if (typeof homeValue !== 'string' || homeValue.trim().length === 0) {
            throw new TypeError('NWJS_HOME 또는 --nwjs-home 경로가 필요합니다.');
        }
        const home = resolve(homeValue.trim());
        if (basename(home).toLowerCase()
            !== NWJS_PACKAGE_CONTRACT.runtimeDirectoryName.toLowerCase()) {
            throw new Error(
                `NW.js 폴더 이름은 ${NWJS_PACKAGE_CONTRACT.runtimeDirectoryName}이어야 합니다.`
            );
        }

        for (const name of NWJS_PACKAGE_CONTRACT.runtimeFiles) {
            await this.#assertEntry(join(home, name), 'file');
        }
        for (const name of NWJS_PACKAGE_CONTRACT.runtimeDirectories) {
            await this.#assertEntry(join(home, name), 'directory');
        }

        const productVersion = await this.versionReader(join(home, 'nw.exe'));
        if (productVersion !== null
            && productVersion !== NWJS_PACKAGE_CONTRACT.version) {
            throw new Error(
                `nw.exe 제품 버전 ${productVersion}은 고정 버전 `
                + `${NWJS_PACKAGE_CONTRACT.version}과 다릅니다.`
            );
        }
        return Object.freeze({ home, productVersion });
    }

    /** @param {string} targetPath @param {'file'|'directory'} type */
    async #assertEntry(targetPath, type) {
        try {
            await access(targetPath);
            const details = await stat(targetPath);
            const matches = type === 'file' ? details.isFile() : details.isDirectory();
            if (!matches) {
                throw new Error(`${type} 형식이 아닙니다.`);
            }
        } catch (error) {
            throw new Error(`NW.js ${type} 누락 또는 형식 오류: ${targetPath}`, {
                cause: error
            });
        }
    }
}
