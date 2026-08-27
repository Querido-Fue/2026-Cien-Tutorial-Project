import assert from 'node:assert/strict';
import {
    access,
    mkdir,
    mkdtemp,
    readFile,
    rm,
    writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { TUTORIAL_META_VERSION } from '../project/engine/script/scene/tutorial/_tutorial_meta_progress.js';
import { NWJS_PACKAGE_CONTRACT } from '../scripts/package/_nwjs_package_contract.mjs';
import { NwjsPackager } from '../scripts/package/_nwjs_packager.mjs';
import { NwjsRuntimeValidator } from '../scripts/package/_nwjs_runtime_validator.mjs';
import { ProvenanceAuditor } from '../scripts/release/_provenance_auditor.mjs';
import { RuntimeSourceAuditor } from '../scripts/release/_runtime_source_auditor.mjs';
import { SourceGraphAuditor } from '../scripts/release/_source_graph_auditor.mjs';

const TEST_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(TEST_DIRECTORY, '..');

/** @param {string} path @param {string} [contents='fixture'] */
async function createFile(path, contents = 'fixture') {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, 'utf8');
}

/** @param {string} root */
async function createFakeRuntime(root) {
    for (const name of NWJS_PACKAGE_CONTRACT.runtimeFiles) {
        await createFile(join(root, name));
    }
    for (const name of NWJS_PACKAGE_CONTRACT.runtimeDirectories) {
        await createFile(join(root, name, 'fixture.dat'));
    }
}

/** @param {string} root */
async function createFakeRepository(root) {
    await createFile(join(root, 'project', 'package.json'), JSON.stringify({
        name: 'fixture-app',
        version: '1.0.0'
    }));
    await createFile(join(root, 'project', 'engine', 'index.html'));
    await createFile(join(root, 'project', 'license', 'pretendard.txt'));
    await createFile(join(root, 'project', 'asset', 'tutorial', 'runtime.png'));
    await createFile(join(
        root,
        'project',
        'asset',
        'old',
        'font',
        'PretendardVariable.woff2'
    ));
    await createFile(join(root, 'project', 'asset', 'old', 'icon', 'logo.ico'));
    await createFile(join(root, 'project', 'asset', 'old', 'icon', 'logo.png'));
    await createFile(join(root, 'project', 'asset', 'img', 'source-only.png'));
    await createFile(join(root, 'project', 'save', 'runtime_state.dat'));
    await createFile(join(root, 'THIRD_PARTY_NOTICES.md'));
}

test('릴리스 정적 감사는 순환·누락·임시 계약 없이 모든 에셋 출처를 분류한다', async () => {
    const [graph, provenance, source] = await Promise.all([
        new SourceGraphAuditor({ repositoryRoot: REPOSITORY_ROOT }).audit(),
        new ProvenanceAuditor({ repositoryRoot: REPOSITORY_ROOT }).audit(),
        new RuntimeSourceAuditor({ repositoryRoot: REPOSITORY_ROOT }).audit()
    ]);
    assert.deepEqual(graph.unresolved, []);
    assert.deepEqual(graph.cycles, []);
    assert.deepEqual(provenance.errors, []);
    assert.ok(provenance.assetFileCount > 0);
    assert.deepEqual(source.errors, []);
    assert.ok(provenance.blockers.some(({ id }) => id === 'provided-art-sources'));
    assert.ok(provenance.blockers.some(({ id }) => id === 'provided-audio-sources'));
    assert.ok(provenance.blockers.some(
        ({ id }) => id === 'external-reference-item-icons'
    ));
});

test('저장·패키징 릴리스 계약은 버전과 파일당 한 클래스 경계를 고정한다', async () => {
    assert.equal(TUTORIAL_META_VERSION, 4);
    assert.equal(NWJS_PACKAGE_CONTRACT.version, '0.108.0');
    assert.equal(NWJS_PACKAGE_CONTRACT.platform, 'win');
    assert.equal(NWJS_PACKAGE_CONTRACT.architecture, 'x64');

    for (const name of [
        '_tutorial_meta_migrator.js',
        '_tutorial_meta_version_error.js'
    ]) {
        const source = await readFile(new URL(
            `../project/engine/script/scene/tutorial/${name}`,
            import.meta.url
        ), 'utf8');
        assert.equal((source.match(/export class /g) || []).length, 1, name);
        assert.equal(source.includes('_tutorial_scene.js'), false, name);
    }
    for (const name of [
        '_nwjs_runtime_validator.mjs',
        '_nwjs_packager.mjs'
    ]) {
        const source = await readFile(new URL(
            `../scripts/package/${name}`,
            import.meta.url
        ), 'utf8');
        assert.equal((source.match(/export class /g) || []).length, 1, name);
    }
});

test('패키징은 고정 NW.js 입력과 런타임 에셋만 새 폴더에 조립한다', async (context) => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'cien-release-test-'));
    context.after(() => rm(temporaryRoot, { recursive: true, force: true }));
    const repositoryRoot = join(temporaryRoot, 'repository');
    const runtimeHome = join(
        temporaryRoot,
        NWJS_PACKAGE_CONTRACT.runtimeDirectoryName
    );
    await createFakeRuntime(runtimeHome);
    await createFakeRepository(repositoryRoot);

    const validator = new NwjsRuntimeValidator({
        versionReader: async () => NWJS_PACKAGE_CONTRACT.version
    });
    const packager = new NwjsPackager({ validator });
    const outputDirectory = join(temporaryRoot, 'nth-player-nwjs-fixture');
    const result = await packager.package({
        repositoryRoot,
        nwjsHome: runtimeHome,
        outputDirectory
    });
    assert.equal(result.outputDirectory, outputDirectory);
    await access(join(outputDirectory, NWJS_PACKAGE_CONTRACT.executableName));
    await access(join(outputDirectory, 'asset', 'tutorial', 'runtime.png'));
    await access(join(outputDirectory, 'asset', 'old', 'icon', 'logo.png'));
    await access(join(outputDirectory, 'THIRD_PARTY_NOTICES.md'));
    await assert.rejects(() => access(join(outputDirectory, 'nw.exe')));
    await assert.rejects(() => access(join(outputDirectory, 'asset', 'img')));
    await assert.rejects(() => access(join(outputDirectory, 'save')));

    const buildInfo = JSON.parse(await readFile(
        join(outputDirectory, 'BUILD_INFO.json'),
        'utf8'
    ));
    assert.equal(buildInfo.nwjsVersion, NWJS_PACKAGE_CONTRACT.version);
    assert.equal(buildInfo.executable, NWJS_PACKAGE_CONTRACT.executableName);
    await assert.rejects(
        () => packager.package({
            repositoryRoot,
            nwjsHome: runtimeHome,
            outputDirectory
        }),
        /이미 있습니다/
    );
});

test('NW.js 검증기는 잘못된 폴더명과 제품 버전을 명시적으로 거부한다', async (context) => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'cien-nwjs-test-'));
    context.after(() => rm(temporaryRoot, { recursive: true, force: true }));
    const wrongName = join(temporaryRoot, 'nwjs-latest');
    await mkdir(wrongName);
    const validator = new NwjsRuntimeValidator({ versionReader: async () => '0.999.0' });
    await assert.rejects(() => validator.validate(wrongName), /폴더 이름/);

    const runtimeHome = join(temporaryRoot, NWJS_PACKAGE_CONTRACT.runtimeDirectoryName);
    await createFakeRuntime(runtimeHome);
    await assert.rejects(() => validator.validate(runtimeHome), /제품 버전/);
});
