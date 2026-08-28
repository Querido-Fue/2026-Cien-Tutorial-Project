const STORAGE_NAMESPACE = 'jukchang.nthplayer.fs.v1';
const DIRECTORY_KIND = 'directory';
const TEXT_KIND = 'text';
const BINARY_KIND = 'binary';

const createFileSystemError = (code, targetPath) => {
    const error = new Error(`${code}: ${targetPath}`);
    error.code = code;
    return error;
};

const normalizePath = (targetPath) => {
    const value = String(targetPath ?? '').replaceAll('\\', '/').trim();
    const segments = value.split('/').filter((segment) => segment && segment !== '.');

    if (segments.some((segment) => segment === '..')) {
        throw createFileSystemError('EINVAL', value);
    }

    return `/${segments.join('/')}`;
};

const encodeBinary = (value) => {
    if (value instanceof Uint8Array) {
        return Array.from(value);
    }

    if (value instanceof ArrayBuffer) {
        return Array.from(new Uint8Array(value));
    }

    if (ArrayBuffer.isView(value)) {
        return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    }

    return Array.from(new TextEncoder().encode(String(value ?? '')));
};

class MemoryStorage {
    constructor() {
        this.entries = new Map();
    }

    getItem(key) {
        return this.entries.has(key) ? this.entries.get(key) : null;
    }

    setItem(key, value) {
        this.entries.set(key, String(value));
    }
}

const resolveStorage = () => {
    try {
        if (typeof globalThis.localStorage !== 'undefined') {
            const probeKey = `${STORAGE_NAMESPACE}:probe`;
            globalThis.localStorage.setItem(probeKey, '1');
            globalThis.localStorage.removeItem(probeKey);
            return globalThis.localStorage;
        }
    } catch {
        // Private browsing or restrictive embedding may make localStorage unavailable.
    }

    return new MemoryStorage();
};

/**
 * 브라우저의 동일 출처 저장소를 fs/promises의 최소 표면처럼 제공합니다.
 */
export class BrowserFileSystem {
    constructor(storage = resolveStorage()) {
        this.storage = storage;
    }

    #storageKey(targetPath) {
        return `${STORAGE_NAMESPACE}:${normalizePath(targetPath)}`;
    }

    #readEntry(targetPath) {
        const rawEntry = this.storage.getItem(this.#storageKey(targetPath));
        if (rawEntry === null) {
            return null;
        }

        try {
            return JSON.parse(rawEntry);
        } catch {
            throw createFileSystemError('EIO', targetPath);
        }
    }

    async access(targetPath) {
        if (this.#readEntry(targetPath) === null) {
            throw createFileSystemError('ENOENT', targetPath);
        }
    }

    async mkdir(targetPath, options = {}) {
        const normalizedPath = normalizePath(targetPath);
        const segments = normalizedPath.split('/').filter(Boolean);

        if (!options.recursive && segments.length > 1) {
            const parentPath = `/${segments.slice(0, -1).join('/')}`;
            if (this.#readEntry(parentPath) === null) {
                throw createFileSystemError('ENOENT', parentPath);
            }
        }

        const paths = options.recursive
            ? segments.map((_, index) => `/${segments.slice(0, index + 1).join('/')}`)
            : [normalizedPath];

        for (const directoryPath of paths) {
            this.storage.setItem(this.#storageKey(directoryPath), JSON.stringify({ kind: DIRECTORY_KIND }));
        }
    }

    async readFile(targetPath, encoding) {
        const entry = this.#readEntry(targetPath);
        if (!entry || entry.kind === DIRECTORY_KIND) {
            throw createFileSystemError(entry ? 'EISDIR' : 'ENOENT', targetPath);
        }

        const bytes = entry.kind === TEXT_KIND
            ? new TextEncoder().encode(entry.value)
            : Uint8Array.from(entry.value);

        if (typeof encoding === 'string') {
            return new TextDecoder(encoding).decode(bytes);
        }

        return bytes;
    }

    async writeFile(targetPath, value) {
        const normalizedPath = normalizePath(targetPath);
        const parentPath = normalizedPath.slice(0, normalizedPath.lastIndexOf('/')) || '/';
        if (parentPath !== '/' && this.#readEntry(parentPath) === null) {
            throw createFileSystemError('ENOENT', parentPath);
        }

        const entry = typeof value === 'string'
            ? { kind: TEXT_KIND, value }
            : { kind: BINARY_KIND, value: encodeBinary(value) };
        this.storage.setItem(this.#storageKey(normalizedPath), JSON.stringify(entry));
    }
}

/**
 * 브라우저 저장 경로를 POSIX 형태로 결합합니다.
 */
export const browserPath = Object.freeze({
    join(...parts) {
        return normalizePath(parts.filter((part) => part !== undefined && part !== null).join('/'));
    },
});
