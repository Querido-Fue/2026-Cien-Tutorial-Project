import { open } from 'node:fs/promises';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * PNG IHDR만 읽어 압축 해제 없이 실제 픽셀 크기를 확인합니다.
 * @param {string} filePath - 검사할 PNG 절대 경로입니다.
 * @returns {Promise<{width:number,height:number}>} IHDR 크기입니다.
 */
export async function readTutorialPngDimensions(filePath) {
    const handle = await open(filePath, 'r');
    try {
        const header = Buffer.alloc(24);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        if (bytesRead !== header.length
            || !header.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
            || header.toString('ascii', 12, 16) !== 'IHDR') {
            throw new Error('유효한 PNG IHDR이 아닙니다.');
        }
        return Object.freeze({
            width: header.readUInt32BE(16),
            height: header.readUInt32BE(20)
        });
    } finally {
        await handle.close();
    }
}
