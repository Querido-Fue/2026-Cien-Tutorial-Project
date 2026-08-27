import {
    access,
    cp,
    mkdir,
    readFile,
    rename,
    rm,
    stat,
    writeFile
} from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

import { NWJS_PACKAGE_CONTRACT } from './_nwjs_package_contract.mjs';
import { NwjsRuntimeValidator } from './_nwjs_runtime_validator.mjs';

/** @param {string} targetPath @returns {Promise<boolean>} */
async function pathExists(targetPath) {
    try {
        await access(targetPath);
        return true;
    } catch {
        return false;
    }
}

/**
 * @class NwjsPackager
 * @description 검증된 NW.js 런타임과 배포에 필요한 앱 파일만 새 출력 폴더에 조립합니다.
 */
export class NwjsPackager {
    /** @param {{validator?:NwjsRuntimeValidator}} [options] */
    constructor(options = {}) {
        this.validator = options.validator || new NwjsRuntimeValidator();
    }

    /**
     * @param {{repositoryRoot:string,nwjsHome:string,outputDirectory?:string}} options
     * @returns {Promise<object>} 패키징 결과입니다.
     */
    async package(options) {
        const repositoryRoot = resolve(options.repositoryRoot);
        const runtime = await this.validator.validate(options.nwjsHome);
        const outputDirectory = resolve(
            options.outputDirectory
                || join(repositoryRoot, 'dist', NWJS_PACKAGE_CONTRACT.outputDirectoryName)
        );
        if (await pathExists(outputDirectory)) {
            throw new Error(`출력 폴더가 이미 있습니다. 기존 파일을 지우지 않습니다: ${outputDirectory}`);
        }
        await this.#validateApplicationEntries(repositoryRoot);

        const outputParent = dirname(outputDirectory);
        await mkdir(outputParent, { recursive: true });
        const staging = join(
            outputParent,
            `.${NWJS_PACKAGE_CONTRACT.outputDirectoryName}.staging-${process.pid}`
        );
        if (await pathExists(staging)) {
            throw new Error(`임시 패키징 폴더가 이미 있습니다: ${staging}`);
        }
        await mkdir(staging);

        try {
            await this.#copyRuntime(runtime.home, staging);
            await this.#copyApplication(repositoryRoot, staging);
            await this.#writeBuildInfo(repositoryRoot, staging);
            await rename(staging, outputDirectory);
        } catch (error) {
            await this.#removeOwnedStaging(staging, outputParent);
            throw error;
        }

        return Object.freeze({
            outputDirectory,
            nwjsVersion: NWJS_PACKAGE_CONTRACT.version,
            executableName: NWJS_PACKAGE_CONTRACT.executableName
        });
    }

    /** @param {string} repositoryRoot */
    async #validateApplicationEntries(repositoryRoot) {
        for (const entry of NWJS_PACKAGE_CONTRACT.applicationEntries) {
            const source = join(repositoryRoot, entry.source);
            if (!await pathExists(source)) {
                throw new Error(`배포 입력 파일이 없습니다: ${source}`);
            }
        }
    }

    /** @param {string} runtimeHome @param {string} staging */
    async #copyRuntime(runtimeHome, staging) {
        for (const name of NWJS_PACKAGE_CONTRACT.runtimeFiles) {
            const targetName = name === 'nw.exe'
                ? NWJS_PACKAGE_CONTRACT.executableName
                : name;
            await cp(join(runtimeHome, name), join(staging, targetName));
        }
        for (const name of NWJS_PACKAGE_CONTRACT.runtimeDirectories) {
            await cp(join(runtimeHome, name), join(staging, name), { recursive: true });
        }
    }

    /** @param {string} repositoryRoot @param {string} staging */
    async #copyApplication(repositoryRoot, staging) {
        for (const entry of NWJS_PACKAGE_CONTRACT.applicationEntries) {
            const source = join(repositoryRoot, entry.source);
            const target = join(staging, entry.target);
            const details = await stat(source);
            await mkdir(dirname(target), { recursive: true });
            await cp(source, target, { recursive: details.isDirectory() });
        }
    }

    /** @param {string} repositoryRoot @param {string} staging */
    async #writeBuildInfo(repositoryRoot, staging) {
        const appPackage = JSON.parse(await readFile(
            join(repositoryRoot, 'project', 'package.json'),
            'utf8'
        ));
        const buildInfo = {
            schemaVersion: NWJS_PACKAGE_CONTRACT.schemaVersion,
            appName: appPackage.name,
            appVersion: appPackage.version,
            nwjsVersion: NWJS_PACKAGE_CONTRACT.version,
            platform: NWJS_PACKAGE_CONTRACT.platform,
            architecture: NWJS_PACKAGE_CONTRACT.architecture,
            executable: NWJS_PACKAGE_CONTRACT.executableName
        };
        await writeFile(
            join(staging, 'BUILD_INFO.json'),
            JSON.stringify(buildInfo, null, 2) + '\n',
            'utf8'
        );
    }

    /** @param {string} staging @param {string} outputParent */
    async #removeOwnedStaging(staging, outputParent) {
        if (dirname(staging) !== outputParent
            || !basename(staging).startsWith('.nth-player-nwjs-')) {
            throw new Error(`임시 폴더 안전 검증에 실패했습니다: ${staging}`);
        }
        await rm(staging, { recursive: true, force: true });
    }
}
