export const NWJS_PACKAGE_CONTRACT = Object.freeze({
    schemaVersion: 1,
    version: '0.108.0',
    platform: 'win',
    architecture: 'x64',
    runtimeDirectoryName: 'nwjs-v0.108.0-win-x64',
    archiveName: 'nwjs-v0.108.0-win-x64.zip',
    executableName: 'nth-player.exe',
    outputDirectoryName: 'nth-player-nwjs-v0.108.0-win-x64',
    runtimeFiles: Object.freeze([
        'credits.html',
        'd3dcompiler_47.dll',
        'dxcompiler.dll',
        'dxil.dll',
        'ffmpeg.dll',
        'icudtl.dat',
        'libEGL.dll',
        'libGLESv2.dll',
        'node.dll',
        'notification_helper.exe',
        'nw.exe',
        'nw_100_percent.pak',
        'nw_200_percent.pak',
        'nw_elf.dll',
        'nw.dll',
        'resources.pak',
        'v8_context_snapshot.bin',
        'vk_swiftshader_icd.json',
        'vk_swiftshader.dll',
        'vulkan-1.dll'
    ]),
    runtimeDirectories: Object.freeze([
        'Dictionaries',
        'locales',
        'swiftshader'
    ]),
    applicationEntries: Object.freeze([
        Object.freeze({ source: 'project/package.json', target: 'package.json' }),
        Object.freeze({ source: 'project/engine', target: 'engine' }),
        Object.freeze({ source: 'project/license', target: 'license' }),
        Object.freeze({ source: 'project/asset/tutorial', target: 'asset/tutorial' }),
        Object.freeze({
            source: 'project/asset/old/font/PretendardVariable.woff2',
            target: 'asset/old/font/PretendardVariable.woff2'
        }),
        Object.freeze({
            source: 'project/asset/old/icon/logo.ico',
            target: 'asset/old/icon/logo.ico'
        }),
        Object.freeze({
            source: 'project/asset/old/icon/logo.png',
            target: 'asset/old/icon/logo.png'
        }),
        Object.freeze({ source: 'THIRD_PARTY_NOTICES.md', target: 'THIRD_PARTY_NOTICES.md' })
    ])
});
