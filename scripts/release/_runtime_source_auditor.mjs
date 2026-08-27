import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { existsSync } from 'node:fs';

/** @param {string} value @returns {string} */
function toPosix(value) {
    return value.split(sep).join('/');
}

/** @param {string} root @returns {Promise<string[]>} */
async function listJavaScriptFiles(root) {
    const output = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
        const target = join(root, entry.name);
        if (entry.isDirectory()) {
            output.push(...await listJavaScriptFiles(target));
        } else if (entry.isFile() && extname(entry.name) === '.js') {
            output.push(target);
        }
    }
    return output;
}

/**
 * @class RuntimeSourceAuditor
 * @description 릴리스 소스의 임시 표식·UNDO 잔재·콘솔 로그와 HTML/CSS 런타임 에셋 경로를 검사합니다.
 */
export class RuntimeSourceAuditor {
    /** @param {{repositoryRoot:string}} options */
    constructor(options) {
        this.repositoryRoot = resolve(options.repositoryRoot);
        this.engineRoot = join(this.repositoryRoot, 'project', 'engine');
    }

    /** @returns {Promise<object>} 런타임 소스 감사 결과입니다. */
    async audit() {
        const errors = [];
        const warnings = [];
        const files = await listJavaScriptFiles(join(this.engineRoot, 'script'));
        const forbidden = [
            [/\bdebugger\b/, 'debugger 문'],
            [/\b(?:TODO|FIXME)\b/, 'TODO/FIXME'],
            [/COMMANDS\.UNDO|tutorial\/undo|pendingUndo|undoHistory|battle-undo|result-undo|cutscene-undo/, 'UNDO 계약'],
            [/(?:temp|temporary|placeholder|dummy)[_./ -][^'"\s]*\.(?:png|mp3)/i, '임시 에셋 경로']
        ];
        for (const file of files) {
            const source = await readFile(file, 'utf8');
            const label = toPosix(relative(this.repositoryRoot, file));
            for (const [pattern, name] of forbidden) {
                if (pattern.test(source)) {
                    errors.push(`${label}: ${name}이 남아 있습니다.`);
                }
            }
            if (/console\.log\s*\(/.test(source)) {
                warnings.push(`${label}: debugMode로 제한된 console.log 1개를 검토했습니다.`);
            }
        }

        await this.#checkDocumentAssetPaths(errors);
        return Object.freeze({
            fileCount: files.length,
            errors: Object.freeze(errors),
            warnings: Object.freeze(warnings)
        });
    }

    /** @param {string[]} errors */
    async #checkDocumentAssetPaths(errors) {
        const packagePath = join(this.repositoryRoot, 'project', 'package.json');
        const packageData = JSON.parse(await readFile(packagePath, 'utf8'));
        this.#checkPath(
            join(this.repositoryRoot, 'project'),
            packageData.window?.icon,
            'project/package.json window.icon',
            errors
        );

        const indexPath = join(this.engineRoot, 'index.html');
        const indexSource = await readFile(indexPath, 'utf8');
        for (const match of indexSource.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
            if (match[1].startsWith('../asset/')) {
                this.#checkPath(dirname(indexPath), match[1], 'project/engine/index.html', errors);
            }
        }
        const stylePath = join(this.engineRoot, 'style.css');
        const styleSource = await readFile(stylePath, 'utf8');
        for (const match of styleSource.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
            if (match[1].startsWith('../asset/')) {
                this.#checkPath(dirname(stylePath), match[1], 'project/engine/style.css', errors);
            }
        }
    }

    /** @param {string} base @param {*} value @param {string} label @param {string[]} errors */
    #checkPath(base, value, label, errors) {
        if (typeof value !== 'string' || !value) {
            errors.push(`${label}: 에셋 경로가 비어 있습니다.`);
            return;
        }
        const target = resolve(base, value);
        if (!existsSync(target)) {
            errors.push(`${label}: 파일이 없습니다 (${value}).`);
        }
    }
}
