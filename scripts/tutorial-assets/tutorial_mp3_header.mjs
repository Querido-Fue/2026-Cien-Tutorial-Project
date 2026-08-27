import { open, stat } from 'node:fs/promises';

/**
 * MP3의 최소 헤더와 파일 크기를 읽어 잘못 복사된 파일을 조기에 거부합니다.
 * @param {string} filePath - 검사할 MP3입니다.
 * @returns {Promise<Readonly<object>>} 헤더 종류와 바이트 크기입니다.
 */
export async function readTutorialMp3Header(filePath) {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile() || fileStat.size < 4) {
        throw new Error('MP3 파일이 비어 있거나 너무 짧습니다.');
    }
    const handle = await open(filePath, 'r');
    try {
        const buffer = Buffer.alloc(10);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        const hasId3 = bytesRead >= 3
            && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33;
        const hasFrameSync = bytesRead >= 2
            && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
        if (!hasId3 && !hasFrameSync) {
            throw new Error('ID3 또는 MPEG frame sync 헤더가 없습니다.');
        }
        return Object.freeze({
            kind: hasId3 ? 'id3' : 'mpeg-frame',
            byteLength: fileStat.size
        });
    } finally {
        await handle.close();
    }
}
