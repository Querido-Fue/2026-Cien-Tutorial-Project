import { BrowserFileSystem, browserPath } from './_browser_file_system.js';

/**
 * NW.js/브라우저 런타임 차이를 파일 시스템과 창 API 경계에서 흡수합니다.
 */

const hasWindow = typeof window !== 'undefined';
const hasNw = hasWindow && typeof window.nw !== 'undefined';
const hasRequire = hasWindow && typeof window.require === 'function';
const hasNodeRuntime = hasNw && hasRequire;

/**
 * 현재 런타임이 NW.js인지 여부를 반환합니다.
 * @returns {boolean}
 */
export const isNwRuntime = () => hasNodeRuntime;

/**
 * nw 전역 객체
 * @type {typeof nw}
 */
export const nw = hasNodeRuntime ? window.nw : null;

/**
 * fs/promises 모듈
 * @type {typeof import('fs/promises')}
 */
export const fsPromises = hasNodeRuntime
    ? window.require('fs').promises
    : new BrowserFileSystem();

/**
 * path 모듈
 * @type {typeof import('path')}
 */
export const path = hasNodeRuntime
    ? window.require('path')
    : browserPath;

/**
 * 저장 데이터 기준 경로입니다. 브라우저에서는 localStorage 네임스페이스 내부의 가상 경로입니다.
 * @type {string}
 */
export const runtimeRoot = hasNodeRuntime
    ? window.require('process').cwd()
    : '/nthplayer';
