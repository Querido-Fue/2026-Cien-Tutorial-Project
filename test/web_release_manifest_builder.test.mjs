import assert from 'node:assert/strict';
import test from 'node:test';

import {
    formatKstReleaseVersion,
    WebReleaseManifestBuilder
} from '../scripts/web/_web_release_manifest_builder.mjs';

test('웹 표시 버전은 실행 환경과 무관하게 KST MMDD_HHmm 형식을 사용한다', () => {
    assert.equal(
        formatKstReleaseVersion(new Date('2026-08-29T17:26:30.000Z')),
        '0830_0226'
    );
});

test('웹 릴리스 매니페스트는 실제 Git 기록에 있는 한글 항목만 최신순으로 만든다', async () => {
    const headCommit = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const manifest = await new WebReleaseManifestBuilder({
        repositoryRoot: 'unused',
        now: () => new Date('2026-08-29T17:26:30.000Z'),
        gitLogReader: async () => [
            {
                commit: headCommit,
                authoredAt: '2026-08-29T17:25:00.000Z',
                subject: 'feat: add automatic web release updates and changelog'
            },
            {
                commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                authoredAt: '2026-08-29T16:00:00.000Z',
                subject: 'unmapped temporary commit'
            },
            {
                commit: '2b73ac51e251ecc49e71136994bc967815d4f893',
                authoredAt: '2026-08-29T20:00:16.000Z',
                subject: 'feat: add smooth wheel camera zoom'
            }
        ]
    }).create();

    assert.equal(manifest.version, '0830_0226');
    assert.equal(manifest.id, '0830_0226-aaaaaaaaaaaa');
    assert.equal(manifest.commit, headCommit);
    assert.equal(manifest.builtAtKst, '2026-08-30T02:26:30+09:00');
    assert.equal(manifest.changelog.length, 2);
    assert.match(manifest.changelog[0].summary, /최신 배포 자동 확인/);
    assert.equal(manifest.changelog[1].version, '0830_0500');
    assert.match(manifest.changelog[1].summary, /마우스 휠 카메라/);
});
