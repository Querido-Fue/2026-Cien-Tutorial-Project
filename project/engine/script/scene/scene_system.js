import { BaseScene } from './_base_scene.js';
import { clearSimulationCommands } from 'simulation/simulation_command_queue.js';

const SCENE_STATES = Object.freeze({
    EMPTY: 'empty',
    DIAGNOSTIC: 'diagnostic',
    ACTIVE: 'active'
});

/**
 * 기본 빈 씬을 생성합니다.
 * @param {SceneSystem} sceneSystem - 씬 시스템 인스턴스입니다.
 * @returns {BaseScene} 생성된 빈 씬입니다.
 */
function createDefaultScene(sceneSystem) {
    return new BaseScene(sceneSystem);
}

/**
 * 씬 factory 옵션을 정규화합니다.
 * @param {Function|undefined} factory - 외부에서 전달된 씬 factory입니다.
 * @param {Function|null} fallback - 기본 factory입니다.
 * @returns {Function} 사용할 씬 factory입니다.
 */
function normalizeSceneFactory(factory, fallback = null) {
    return typeof factory === 'function' ? factory : fallback;
}

/**
 * 씬에 지정한 메서드가 있으면 호출합니다.
 * @param {object|null|undefined} scene - 대상 씬 인스턴스입니다.
 * @param {string} methodName - 호출할 메서드 이름입니다.
 * @param {Array} [args=[]] - 메서드 인자 목록입니다.
 * @returns {*} 씬 메서드 반환값입니다.
 */
function callSceneMethod(scene, methodName, args = []) {
    if (scene && typeof scene[methodName] === 'function') {
        return scene[methodName](...args);
    }
    return undefined;
}

/**
 * @class SceneSystem
 * @description 현재 활성 씬을 보관하고 씬 전환을 관리합니다.
 */
export class SceneSystem {
    /**
     * @param {object} systemHandler - 상위 시스템 핸들러입니다.
     * @param {{initialSceneFactory?: Function, initialSceneState?: string, playSceneFactory?: Function, playMode?: string, benchmarkMode?: string}} [options={}] - 씬 생성 옵션입니다.
     */
    constructor(systemHandler, options = {}) {
        this.systemHandler = systemHandler;
        this.scene = null;
        this.initialSceneFactory = normalizeSceneFactory(options.initialSceneFactory, createDefaultScene);
        this.initialSceneState = typeof options.initialSceneState === 'string'
            ? options.initialSceneState
            : SCENE_STATES.EMPTY;
        this.playSceneFactory = normalizeSceneFactory(options.playSceneFactory);
        this.playMode = typeof options.playMode === 'string' ? options.playMode : 'play';
        this.benchmarkMode = typeof options.benchmarkMode === 'string' ? options.benchmarkMode : 'benchmark';
        this.sceneState = this.initialSceneState;
    }

    /**
     * 씬 시스템을 초기화합니다.
     * 초기 씬을 로드합니다.
     */
    async init() {
        this.#setScene(this.initialSceneFactory(this), this.initialSceneState);
    }

    /**
     * 현재 씬을 업데이트합니다.
     * @param {object} [options={}] - 현재 프레임의 실행 보조 옵션입니다.
     */
    update(options = {}) {
        this.#callActiveScene('update', [options]);
    }

    /**
     * 현재 씬의 고정 틱 업데이트를 호출합니다.
     */
    fixedUpdate() {
        this.#callActiveScene('fixedUpdate');
    }

    /**
     * 현재 씬을 그립니다.
     */
    draw() {
        this.#callActiveScene('draw');
    }

    /**
     * 창 크기 변경 이벤트를 현재 활성화된 씬에 전달합니다.
     */
    resize() {
        this.#callActiveScene('resize');
    }

    /**
     * 현재 활성 씬에 런타임 설정 변경을 전달합니다.
     * @param {object} [changedSettings={}] - 변경된 설정 키와 값입니다.
     */
    applyRuntimeSettings(changedSettings = {}) {
        this.#callActiveScene('applyRuntimeSettings', [changedSettings]);
    }

    /**
     * 현재 활성 씬에 시뮬레이션 명령 목록을 전달합니다.
     * @param {object[]} [commands=[]] - 전달할 시뮬레이션 명령 목록입니다.
     */
    applySimulationCommands(commands = []) {
        if (!Array.isArray(commands) || commands.length === 0) {
            return;
        }

        this.#callActiveScene('applySimulationCommands', [commands]);
    }

    /**
     * 플레이 씬을 시작합니다.
     */
    startPlayScene() {
        if (!this.playSceneFactory) {
            console.warn('SceneSystem: playSceneFactory가 등록되지 않아 startPlayScene을 무시합니다.');
            return;
        }

        clearSimulationCommands();
        this.#destroyActiveScene();
        this.#setScene(this.playSceneFactory(this, { mode: this.playMode }), SCENE_STATES.ACTIVE);
    }

    /**
     * 벤치마크 모드로 플레이 씬을 시작합니다.
     */
    startBenchmarkScene() {
        if (!this.playSceneFactory) {
            console.warn('SceneSystem: playSceneFactory가 등록되지 않아 startBenchmarkScene을 무시합니다.');
            return;
        }

        clearSimulationCommands();
        this.#destroyActiveScene();
        this.#setScene(this.playSceneFactory(this, { mode: this.benchmarkMode }), SCENE_STATES.ACTIVE);
    }

    /**
     * 현재 활성 씬의 메서드를 안전하게 호출합니다.
     * @param {string} methodName - 호출할 메서드 이름입니다.
     * @param {Array} [args=[]] - 메서드 인자 목록입니다.
     * @returns {*} 씬 메서드 반환값입니다.
     * @private
     */
    #callActiveScene(methodName, args = []) {
        return callSceneMethod(this.scene, methodName, args);
    }

    /**
     * 현재 활성 씬을 정리합니다.
     * @returns {void}
     * @private
     */
    #destroyActiveScene() {
        this.#callActiveScene('destroy');
    }

    /**
     * 활성 씬과 씬 상태 값을 갱신합니다.
     * @param {object} scene - 새 활성 씬입니다.
     * @param {string} sceneState - 새 씬 상태입니다.
     * @returns {void}
     * @private
     */
    #setScene(scene, sceneState) {
        this.scene = scene;
        this.sceneState = sceneState;
    }
}
