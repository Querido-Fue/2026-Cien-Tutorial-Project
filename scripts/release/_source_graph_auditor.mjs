import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

const IMPORT_PATTERNS = Object.freeze([
    /\b(?:import|export)\s+(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
]);
const SCRIPT_ALIASES = new Set([
    'animation',
    'core',
    'data',
    'debug',
    'display',
    'input',
    'object',
    'overlay',
    'save',
    'scene',
    'simulation',
    'sound',
    'ui',
    'util'
]);

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
    return output.sort();
}

/**
 * @class SourceGraphAuditor
 * @description 엔진 정적 import 그래프를 구성하고 저장소 내부의 순환·누락 참조를 찾습니다.
 */
export class SourceGraphAuditor {
    /** @param {{repositoryRoot:string}} options */
    constructor(options) {
        this.repositoryRoot = resolve(options.repositoryRoot);
        this.scriptRoot = join(this.repositoryRoot, 'project', 'engine', 'script');
    }

    /** @returns {Promise<object>} 그래프 감사 결과입니다. */
    async audit() {
        const files = await listJavaScriptFiles(this.scriptRoot);
        const graph = new Map(files.map((file) => [file, []]));
        const unresolved = [];
        for (const file of files) {
            const source = await readFile(file, 'utf8');
            for (const specifier of this.#extractSpecifiers(source)) {
                const target = this.#resolveSpecifier(file, specifier);
                if (target === null) {
                    continue;
                }
                if (!existsSync(target)) {
                    unresolved.push({
                        from: this.#relative(file),
                        specifier
                    });
                    continue;
                }
                if (graph.has(target)) {
                    graph.get(file).push(target);
                }
            }
        }
        const cycles = this.#findCycles(graph).map(
            (cycle) => cycle.map((file) => this.#relative(file))
        );
        return Object.freeze({
            fileCount: files.length,
            edgeCount: Array.from(graph.values()).reduce(
                (total, edges) => total + edges.length,
                0
            ),
            unresolved: Object.freeze(unresolved),
            cycles: Object.freeze(cycles)
        });
    }

    /** @param {string} source @returns {string[]} */
    #extractSpecifiers(source) {
        const values = [];
        for (const pattern of IMPORT_PATTERNS) {
            pattern.lastIndex = 0;
            for (const match of source.matchAll(pattern)) {
                values.push(match[1]);
            }
        }
        return [...new Set(values)];
    }

    /** @param {string} file @param {string} specifier @returns {string|null} */
    #resolveSpecifier(file, specifier) {
        if (specifier.startsWith('.')) {
            return resolve(dirname(file), specifier);
        }
        if (specifier.startsWith('node:') || !specifier.includes('/')) {
            return null;
        }
        const [alias, ...parts] = specifier.split('/');
        if (alias === 'engine') {
            return resolve(this.scriptRoot, ...parts);
        }
        if (!SCRIPT_ALIASES.has(alias)) {
            return null;
        }
        return resolve(this.scriptRoot, specifier);
    }

    /** @param {Map<string,string[]>} graph @returns {string[][]} */
    #findCycles(graph) {
        const state = new Map();
        const stack = [];
        const cyclesByKey = new Map();
        const visit = (file) => {
            state.set(file, 1);
            stack.push(file);
            for (const target of graph.get(file) || []) {
                if (state.get(target) === 1) {
                    const cycle = stack.slice(stack.indexOf(target));
                    const rotations = cycle.map((_, index) => [
                        ...cycle.slice(index),
                        ...cycle.slice(0, index)
                    ]);
                    rotations.sort((left, right) => left.join('|').localeCompare(right.join('|')));
                    cyclesByKey.set(rotations[0].join('|'), [...rotations[0], rotations[0][0]]);
                } else if (!state.has(target)) {
                    visit(target);
                }
            }
            stack.pop();
            state.set(file, 2);
        };
        for (const file of graph.keys()) {
            if (!state.has(file)) {
                visit(file);
            }
        }
        return [...cyclesByKey.values()];
    }

    /** @param {string} file @returns {string} */
    #relative(file) {
        return toPosix(relative(this.repositoryRoot, file));
    }
}
