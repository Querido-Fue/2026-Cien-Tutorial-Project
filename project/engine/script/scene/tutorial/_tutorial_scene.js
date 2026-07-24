import { BaseScene } from 'scene/_base_scene.js';
import {
    getUIOffsetX,
    getUIWW,
    getWH,
    getWW,
    measureText,
    render,
    renderGL
} from 'display/display_system.js';
import { ColorSchemes } from 'display/_theme_handler.js';
import {
    consumeMouseState,
    getKeyboardCodeInput,
    getKeyboardSnapshot,
    getMouseFocus,
    getMouseInput
} from 'input/input_system.js';
import { getDelta } from 'engine/time_handler.js';
import { animate, remove } from 'animation/animation_system.js';
import { getData } from 'data/data_handler.js';
import { createFontString, wrapTextByCharacters } from 'util/font_util.js';
import { UIPool, releaseUIItem } from 'ui/_ui_pool.js';
import {
    clearSimulationCommands,
    enqueueSimulationCommand
} from 'simulation/simulation_command_queue.js';
import { TutorialBattleModel } from './_tutorial_battle_model.js';
import { TutorialCutsceneController } from './_tutorial_cutscene_controller.js';
import {
    createDefaultTutorialMeta,
    discoverTutorialTrap,
    identifyTutorialItem,
    loadTutorialMeta,
    markTutorialOpeningWatched,
    recordTutorialResult,
    saveTutorialMeta,
    unlockTutorialCutscene
} from './_tutorial_meta_progress.js';

const TUTORIAL_GAME_DATA = getData('TUTORIAL_GAME_DATA');

const MODES = Object.freeze({
    LOADING: 'loading',
    MENU: 'menu',
    STARTER: 'starter',
    BATTLE: 'battle',
    RESULT: 'result',
    GALLERY: 'gallery'
});

const COMMANDS = Object.freeze({
    META_READY: 'tutorial/meta-ready',
    START: 'tutorial/start',
    OPEN_GALLERY: 'tutorial/open-gallery',
    RETURN_MENU: 'tutorial/return-menu',
    STARTER_SHIFT: 'tutorial/starter-shift',
    CHOOSE_STARTER: 'tutorial/choose-starter',
    RESTART: 'tutorial/restart',
    UNDO: 'tutorial/undo',
    GALLERY_SHIFT: 'tutorial/gallery-shift',
    GALLERY_PLAY: 'tutorial/gallery-play',
    CUTSCENE_NEXT: 'tutorial/cutscene-next',
    CUTSCENE_CLOSE: 'tutorial/cutscene-close',
    PLAN_STEP: 'tutorial/plan-step',
    MOVE_TO: 'tutorial/move-to',
    COMMIT_PATH: 'tutorial/commit-path',
    SELECT_ATTACK: 'tutorial/select-attack',
    ATTACK: 'tutorial/attack',
    DEFEND: 'tutorial/defend',
    IDLE: 'tutorial/idle',
    USE_ITEM: 'tutorial/use-item',
    END_TURN: 'tutorial/end-turn',
    ESCAPE: 'tutorial/escape',
    PERFORM_LORA: 'tutorial/perform-lora',
    COMPLETE_LORA: 'tutorial/complete-lora'
});

const WATCHED_KEY_CODES = Object.freeze([
    'ArrowUp',
    'ArrowRight',
    'ArrowDown',
    'ArrowLeft',
    'KeyW',
    'KeyD',
    'KeyS',
    'KeyA',
    'Enter',
    'Space',
    'Digit1',
    'Digit2',
    'Digit3',
    'KeyE',
    'KeyG',
    'KeyR',
    'KeyZ',
    'ControlLeft',
    'ControlRight',
    'Tab',
    'Escape'
]);

const CONTROL_KEY_CODES = Object.freeze(['ControlLeft', 'ControlRight']);

const KEY_DIRECTIONS = Object.freeze([
    Object.freeze({ codes: Object.freeze(['ArrowUp', 'KeyW']), x: 0, y: -1 }),
    Object.freeze({ codes: Object.freeze(['ArrowRight', 'KeyD']), x: 1, y: 0 }),
    Object.freeze({ codes: Object.freeze(['ArrowDown', 'KeyS']), x: 0, y: 1 }),
    Object.freeze({ codes: Object.freeze(['ArrowLeft', 'KeyA']), x: -1, y: 0 })
]);

const PLAYER_ID = 'player';
const LORA_ID = 'lora';
const KNOWN_STARTER_IDS = new Set(['bow', 'bandage']);

/**
 * 숫자를 지정한 범위 안으로 제한합니다.
 * @param {*} value - 제한할 값입니다.
 * @param {number} min - 최솟값입니다.
 * @param {number} max - 최댓값입니다.
 * @returns {number} 제한된 숫자입니다.
 */
function clampNumber(value, min, max) {
    return Math.min(Math.max(Number(value) || 0, min), max);
}

/**
 * 타일 좌표를 조회 키로 변환합니다.
 * @param {number} x - 타일 X 좌표입니다.
 * @param {number} y - 타일 Y 좌표입니다.
 * @returns {string} 좌표 키입니다.
 */
function toTileKey(x, y) {
    return String(x) + ',' + String(y);
}

/**
 * 좌표처럼 보이는 값을 안전한 타일 좌표로 복제합니다.
 * @param {*} value - 원본 값입니다.
 * @returns {{x:number,y:number}|null} 좌표 복제본입니다.
 */
function cloneTile(value) {
    const x = Number(value?.x);
    const y = Number(value?.y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
        return null;
    }
    return { x, y };
}

/**
 * 반응형 폰트 문자열을 생성합니다.
 * @param {object} spec - 글꼴 규격입니다.
 * @param {number} uiWidth - UI 기준 너비입니다.
 * @returns {string} Canvas 글꼴 문자열입니다.
 */
function createResponsiveFont(spec, uiWidth) {
    return createFontString({
        sizePx: clampNumber(uiWidth * (spec.SIZE_UIWW / 100), spec.MIN, spec.MAX),
        family: spec.FAMILY,
        weight: spec.WEIGHT
    });
}

/**
 * 임의 값을 배열로 정규화합니다.
 * @param {*} value - 원본 값입니다.
 * @returns {Array} 배열입니다.
 */
function toList(value) {
    if (Array.isArray(value)) {
        return value;
    }
    if (value instanceof Map) {
        return Array.from(value.values());
    }
    return [];
}

/**
 * 체크포인트에 넣을 배열, Map, Set, 일반 객체를 참조 공유 없이 복제합니다.
 * @param {*} value - 복제할 값입니다.
 * @param {WeakMap<object, *>} [seen] - 순환 참조 방지 지도입니다.
 * @returns {*} 독립 복제본입니다.
 */
function cloneCheckpointValue(value, seen = new WeakMap()) {
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (seen.has(value)) {
        return seen.get(value);
    }
    if (Array.isArray(value)) {
        const copy = [];
        seen.set(value, copy);
        value.forEach((entry) => copy.push(cloneCheckpointValue(entry, seen)));
        return copy;
    }
    if (value instanceof Map) {
        const copy = new Map();
        seen.set(value, copy);
        for (const [key, entry] of value.entries()) {
            copy.set(
                cloneCheckpointValue(key, seen),
                cloneCheckpointValue(entry, seen)
            );
        }
        return copy;
    }
    if (value instanceof Set) {
        const copy = new Set();
        seen.set(value, copy);
        for (const entry of value.values()) {
            copy.add(cloneCheckpointValue(entry, seen));
        }
        return copy;
    }
    const copy = {};
    seen.set(value, copy);
    for (const [key, entry] of Object.entries(value)) {
        copy[key] = cloneCheckpointValue(entry, seen);
    }
    return copy;
}

/**
 * 튜토리얼 메타 두 값이 같은지 비교합니다.
 * @param {object} left - 왼쪽 값입니다.
 * @param {object} right - 오른쪽 값입니다.
 * @returns {boolean} 같으면 true입니다.
 */
function isSameMeta(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * @class TutorialScene
 * @description 두 층 전술전, 고정 카드 컷씬, 반복 플레이 메타를 조율합니다.
 */
export class TutorialScene extends BaseScene {
    /**
     * @param {object} sceneSystem - 현재 장면을 소유한 SceneSystem입니다.
     */
    constructor(sceneSystem) {
        super(sceneSystem);
        this.data = TUTORIAL_GAME_DATA;
        this.mode = MODES.LOADING;
        this.model = null;
        this.floorView = null;
        this.floorActorView = null;
        this.meta = createDefaultTutorialMeta();
        this.committedMeta = cloneCheckpointValue(this.meta);
        this.metaStaging = false;
        this.cutscenes = new TutorialCutsceneController(this.data.CUTSCENES);
        this.cutsceneReturnMode = MODES.MENU;
        this.pendingCutscenes = [];
        this.runCutsceneIds = new Set();
        this.galleryEntries = Object.values(this.data.CUTSCENES);
        this.galleryIndex = 0;
        this.starterIndex = Math.max(
            0,
            this.data.STARTER_CHOICES.findIndex((choice) => choice.id === 'bandage')
        );
        this.starterItemId = this.data.STARTER_CHOICES[this.starterIndex]?.id || 'bandage';
        this.resultData = null;
        this.resultRecorded = false;
        this.destroyed = false;
        this.saveSequence = Promise.resolve();
        this.undoHistory = [];
        this.timelineRevision = 0;
        this.ownedAnimationIds = new Set();
        this.animationSlots = new Map();
        this.presentationLocked = false;
        this.presentation = {
            floorIndex: 0,
            playerX: 0,
            playerY: 0,
            playerAlpha: 1,
            playerScale: 1,
            playerHp: 100,
            loraHp: 100,
            instability: 0,
            hoverProgress: 1,
            pathProgress: 1,
            attackProgress: 1,
            menuSelectionProgress: 1,
            actionPulse: 0
        };
        this.hoveredTileKey = '';

        this.elapsedSeconds = 0;
        this.hoveredTile = null;
        this.plannedPath = [];
        this.reachability = new Map();
        this.actionTargets = [];
        this.attackSelected = false;
        this.targetIndex = 0;
        this.inventoryPage = 0;
        this.loraTurnState = null;
        this.eventLog = [];
        this.floatingTexts = [];
        this.particles = [];
        this.screenShakeSeconds = 0;
        this.stabilizeSeconds = 0;
        this.flashSeconds = 0;
        this.loraPortrait = typeof Image === 'function' ? new Image() : null;
        if (this.loraPortrait) {
            this.loraPortrait.decoding = 'async';
            this.loraPortrait.src = this.data.ASSETS.LORA_PORTRAIT;
        }
        this.itemIconCanvases = new Map();
        this.itemAtlasImage = typeof Image === 'function' ? new Image() : null;
        if (this.itemAtlasImage) {
            this.itemAtlasImage.decoding = 'async';
            this.itemAtlasImage.onload = () => {
                if (!this.destroyed) {
                    this.#sliceItemAtlas();
                }
            };
            this.itemAtlasImage.onerror = () => {
                if (!this.destroyed) {
                    this.itemIconCanvases.clear();
                    this.buttonSignature = '';
                }
            };
            this.itemAtlasImage.src = this.data.ASSETS.ITEM_ICON_ATLAS;
        }
        this.loraSpriteReady = false;
        this.loraSprite = typeof Image === 'function' ? new Image() : null;
        if (this.loraSprite) {
            this.loraSprite.decoding = 'async';
            this.loraSprite.onload = () => {
                if (!this.destroyed && this.#isImageReady(this.loraSprite)) {
                    this.loraSpriteReady = true;
                }
            };
            this.loraSprite.onerror = () => {
                this.loraSpriteReady = false;
            };
            this.loraSprite.src = this.data.ASSETS.LORA_SPRITE;
        }

        this.buttons = {};
        this.buttonSignature = '';
        this.uiActionHandled = false;
        this.keyboardLatch = new Map();
        this.keyboardPressObserved = new Map();
        this.frameKeyEdges = new Set();
        this.pendingUndoShortcut = false;
        this.undoShortcutKeyDownHandler = (event) => {
            if (event?.code !== 'KeyZ'
                || event.ctrlKey !== true) {
                return;
            }
            event.preventDefault?.();
            if (event.repeat !== true) {
                this.pendingUndoShortcut = true;
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', this.undoShortcutKeyDownHandler, true);
        }
        const initialEventTime = Number(getKeyboardSnapshot()?.lastEvent?.timeStamp);
        this.lastKeyboardEventTimestamp = Number.isFinite(initialEventTime)
            ? initialEventTime
            : -1;
        for (const code of WATCHED_KEY_CODES) {
            const isDown = getKeyboardCodeInput(code) === true;
            this.keyboardLatch.set(code, isDown);
            this.keyboardPressObserved.set(code, isDown);
        }

        this.#syncViewport();
        loadTutorialMeta()
            .then((meta) => {
                if (!this.destroyed) {
                    enqueueSimulationCommand({
                        type: COMMANDS.META_READY,
                        payload: { meta }
                    });
                }
            })
            .catch((error) => {
                console.warn('튜토리얼 진행도 로드 오류:', error);
                if (!this.destroyed) {
                    enqueueSimulationCommand({
                        type: COMMANDS.META_READY,
                        payload: { meta: createDefaultTutorialMeta() }
                    });
                }
            });
    }

    /**
     * 입력과 표현 상태를 갱신하고 로라 턴 명령만 예약합니다.
     * @override
     */
    update() {
        const deltaSeconds = getDelta();
        this.elapsedSeconds += deltaSeconds;
        this.uiActionHandled = false;

        this.#ensureButtons();
        this.#updateButtons();
        this.#prepareKeyboardEdges();
        this.#handleKeyboardInput();
        this.#updatePointerState();
        this.#handlePointerInput();
        this.#updateLoraTurn(deltaSeconds);
        this.#updatePresentation(deltaSeconds);
        this.#captureKeyboardLatch();
    }

    /**
     * 현재 모드에 맞는 화면과 컷씬 카드를 그립니다.
     * @override
     */
    draw() {
        this.#ensureButtons();
        this.#drawBackdrop();

        if (this.mode === MODES.LOADING) {
            this.#drawLoading();
        } else if (this.mode === MODES.MENU) {
            this.#drawMenu();
        } else if (this.mode === MODES.STARTER) {
            this.#drawStarterSelect();
        } else if (this.mode === MODES.GALLERY) {
            this.#drawGallery();
        } else if (this.mode === MODES.BATTLE) {
            this.#drawBattle();
        } else if (this.mode === MODES.RESULT) {
            this.#drawResult();
        }

        if (this.cutscenes.isOpen()) {
            this.#drawCutscene();
        }
        this.#drawButtons();
    }

    /**
     * 프레임 경계에서 모든 상태 변경 명령을 적용합니다.
     * @param {object[]} commands - 검증할 명령 목록입니다.
     * @override
     */
    applySimulationCommands(commands = []) {
        for (const command of commands) {
            if (!command || typeof command.type !== 'string') {
                continue;
            }

            const revisionBeforeCommand = this.timelineRevision;

            switch (command.type) {
                case COMMANDS.META_READY:
                    this.#applyMetaReady(command.payload);
                    break;
                case COMMANDS.START:
                    this.#applyStart();
                    break;
                case COMMANDS.OPEN_GALLERY:
                    this.#applyOpenGallery();
                    break;
                case COMMANDS.RETURN_MENU:
                    this.#applyReturnMenu();
                    break;
                case COMMANDS.STARTER_SHIFT:
                    this.#applyStarterShift(command.payload);
                    break;
                case COMMANDS.CHOOSE_STARTER:
                    this.#applyChooseStarter(command.payload);
                    break;
                case COMMANDS.RESTART:
                    this.#applyRestart();
                    break;
                case COMMANDS.UNDO:
                    this.#applyUndo();
                    break;
                case COMMANDS.GALLERY_SHIFT:
                    this.#applyGalleryShift(command.payload);
                    break;
                case COMMANDS.GALLERY_PLAY:
                    this.#applyGalleryPlay();
                    break;
                case COMMANDS.CUTSCENE_NEXT:
                    this.#applyCutsceneNext();
                    break;
                case COMMANDS.CUTSCENE_CLOSE:
                    this.#applyCutsceneClose();
                    break;
                case COMMANDS.PLAN_STEP:
                    this.#applyPlanStep(command.payload);
                    break;
                case COMMANDS.MOVE_TO:
                    this.#applyMoveTo(command.payload);
                    break;
                case COMMANDS.COMMIT_PATH:
                    this.#applyCommitPath();
                    break;
                case COMMANDS.SELECT_ATTACK:
                    this.#applySelectAttack();
                    break;
                case COMMANDS.ATTACK:
                    this.#applyAttack(command.payload);
                    break;
                case COMMANDS.DEFEND:
                    this.#applyDefend();
                    break;
                case COMMANDS.IDLE:
                    this.#applyIdle();
                    break;
                case COMMANDS.USE_ITEM:
                    this.#applyUseItem(command.payload);
                    break;
                case COMMANDS.END_TURN:
                    this.#applyEndTurn();
                    break;
                case COMMANDS.ESCAPE:
                    this.#applyEscape();
                    break;
                case COMMANDS.PERFORM_LORA:
                    this.#applyLoraAction(command.payload);
                    break;
                case COMMANDS.COMPLETE_LORA:
                    this.#applyLoraCompletion(command.payload);
                    break;
                default:
                    break;
            }

            // Undo/재시작처럼 타임라인을 교체한 뒤에는 같은 drain의 명령이 모두 구식입니다.
            if (this.timelineRevision !== revisionBeforeCommand) {
                break;
            }
        }
        this.buttonSignature = '';
    }

    /**
     * 창 크기에 맞춰 투영 좌표와 UI를 다시 구성합니다.
     * @override
     */
    resize() {
        this.floatingTexts = [];
        this.particles = [];
        this.#syncViewport();
    }

    /**
     * 표시 설정 변경을 현재 레이아웃에 반영합니다.
     * @param {object} changedSettings - 변경된 런타임 설정입니다.
     * @override
     */
    applyRuntimeSettings(changedSettings = {}) {
        if (changedSettings.theme !== undefined
            || changedSettings.renderScale !== undefined
            || changedSettings.widescreenSupport !== undefined) {
            this.#syncViewport();
        }
    }

    /**
     * 장면이 소유한 풀 요소와 대기 명령을 정리합니다.
     * @override
     */
    destroy() {
        this.#commitStagedMeta();
        this.destroyed = true;
        this.timelineRevision += 1;
        this.#clearOwnedAnimations();
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', this.undoShortcutKeyDownHandler, true);
        }
        this.pendingUndoShortcut = false;
        if (this.itemAtlasImage) {
            this.itemAtlasImage.onload = null;
            this.itemAtlasImage.onerror = null;
        }
        if (this.loraSprite) {
            this.loraSprite.onload = null;
            this.loraSprite.onerror = null;
        }
        this.itemIconCanvases.clear();
        this.loraSpriteReady = false;
        clearSimulationCommands();
        this.#releaseButtons();
        this.cutscenes.close();
        this.pendingCutscenes = [];
        this.runCutsceneIds.clear();
        this.floatingTexts = [];
        this.particles = [];
        this.loraTurnState = null;
        this.floorView = null;
        this.floorActorView = null;
        this.undoHistory = [];
    }

    /**
     * 이미지가 실제 픽셀까지 로드됐는지 확인합니다.
     * @param {HTMLImageElement|null} image - 확인할 이미지입니다.
     * @returns {boolean} 렌더 가능한 이미지 여부입니다.
     * @private
     */
    #isImageReady(image) {
        return Boolean(image?.complete
            && Number(image.naturalWidth) > 0
            && Number(image.naturalHeight) > 0);
    }

    /**
     * 아이템 atlas의 fractional 셀을 정사각형 2D canvas 여덟 개로 분할합니다.
     * @private
     */
    #sliceItemAtlas() {
        this.itemIconCanvases.clear();
        if (!this.#isImageReady(this.itemAtlasImage)
            || typeof document === 'undefined') {
            this.buttonSignature = '';
            return;
        }
        const atlasData = this.data.SPRITES.ITEM_ATLAS;
        const columns = Math.max(1, Number(atlasData.COLUMNS) || 1);
        const rows = Math.max(1, Number(atlasData.ROWS) || 1);
        const sourceWidth = this.itemAtlasImage.naturalWidth / columns;
        const sourceHeight = this.itemAtlasImage.naturalHeight / rows;
        const canvasSize = Math.max(1, Math.ceil(Math.max(sourceWidth, sourceHeight)));

        for (const [itemId, cell] of Object.entries(atlasData.CELLS)) {
            const column = Number(cell.COLUMN);
            const row = Number(cell.ROW);
            if (!Number.isInteger(column)
                || !Number.isInteger(row)
                || column < 0
                || row < 0
                || column >= columns
                || row >= rows) {
                continue;
            }
            const canvas = document.createElement('canvas');
            canvas.width = canvasSize;
            canvas.height = canvasSize;
            const context = canvas.getContext('2d');
            if (!context) {
                continue;
            }
            context.clearRect(0, 0, canvasSize, canvasSize);
            context.imageSmoothingEnabled = true;
            context.drawImage(
                this.itemAtlasImage,
                column * sourceWidth,
                row * sourceHeight,
                sourceWidth,
                sourceHeight,
                (canvasSize - sourceWidth) * 0.5,
                (canvasSize - sourceHeight) * 0.5,
                sourceWidth,
                sourceHeight
            );
            this.itemIconCanvases.set(itemId, canvas);
        }
        this.buttonSignature = '';
    }

    /**
     * 메타 로드 완료를 메뉴 전환에 반영합니다.
     * @param {object} payload - 로드 결과입니다.
     * @private
     */
    #applyMetaReady(payload) {
        if (this.mode !== MODES.LOADING) {
            return;
        }
        this.meta = payload?.meta || createDefaultTutorialMeta();
        this.committedMeta = cloneCheckpointValue(this.meta);
        this.metaStaging = false;
        this.mode = MODES.MENU;
        this.#appendEvent('진행도를 불러왔습니다.');
    }

    /**
     * 메뉴에서 새 플레이 흐름을 시작합니다.
     * @private
     */
    #applyStart() {
        if (this.mode !== MODES.MENU) {
            return;
        }
        if (this.meta.openingWatched !== true) {
            this.#openCutscene('opening', MODES.STARTER, true);
            return;
        }
        this.mode = MODES.STARTER;
    }

    /**
     * 메뉴에서 컷씬 갤러리를 엽니다.
     * @private
     */
    #applyOpenGallery() {
        if (this.mode !== MODES.MENU) {
            return;
        }
        this.galleryIndex = clampNumber(this.galleryIndex, 0, this.galleryEntries.length - 1);
        this.mode = MODES.GALLERY;
    }

    /**
     * 현재 화면에서 메뉴로 돌아갑니다.
     * @private
     */
    #applyReturnMenu() {
        if (this.mode === MODES.LOADING) {
            return;
        }
        this.#commitStagedMeta();
        this.timelineRevision += 1;
        this.#clearOwnedAnimations();
        this.undoHistory = [];
        this.cutscenes.close();
        this.pendingCutscenes = [];
        this.cutsceneReturnMode = MODES.MENU;
        this.model = null;
        this.floorView = null;
        this.floorActorView = null;
        this.mode = MODES.MENU;
        this.resultData = null;
        this.loraTurnState = null;
        this.attackSelected = false;
        this.hoveredTile = null;
        this.reachability.clear();
        this.actionTargets = [];
        this.plannedPath = [];
    }

    /**
     * 스타터 선택 커서를 이동합니다.
     * @param {object} payload - 이동량입니다.
     * @private
     */
    #applyStarterShift(payload) {
        if (this.mode !== MODES.STARTER || this.cutscenes.isOpen()) {
            return;
        }
        const count = this.data.STARTER_CHOICES.length;
        if (count <= 0) {
            return;
        }
        const delta = Number(payload?.delta) || 0;
        this.starterIndex = (this.starterIndex + delta + count) % count;
        this.#startSelectionAnimation('menu-selection');
    }

    /**
     * 선택한 스타터로 새 전투를 시작합니다.
     * @param {object} payload - 선택 아이템 ID입니다.
     * @private
     */
    #applyChooseStarter(payload) {
        if (this.mode !== MODES.STARTER || this.cutscenes.isOpen()) {
            return;
        }
        const requestedId = payload?.itemId
            || this.data.STARTER_CHOICES[this.starterIndex]?.id;
        const choiceIndex = this.data.STARTER_CHOICES.findIndex(
            (choice) => choice.id === requestedId
        );
        if (choiceIndex < 0) {
            return;
        }
        this.starterIndex = choiceIndex;
        this.#beginRun(this.data.STARTER_CHOICES[choiceIndex].id);
    }

    /**
     * 같은 스타터로 현재 플레이를 초기화합니다.
     * @private
     */
    #applyRestart() {
        if (this.mode !== MODES.BATTLE && this.mode !== MODES.RESULT) {
            return;
        }
        this.#commitStagedMeta();
        this.cutscenes.close();
        this.pendingCutscenes = [];
        this.#beginRun(this.starterItemId);
    }

    /**
     * 새 모델과 뷰 상태로 전투를 시작합니다.
     * @param {string} starterItemId - 스타터 아이템 ID입니다.
     * @private
     */
    #beginRun(starterItemId) {
        this.timelineRevision += 1;
        this.#clearOwnedAnimations();
        this.undoHistory = [];
        this.metaStaging = true;
        this.starterItemId = starterItemId;
        const knowledge = {
            discoveredItemIds: [...this.meta.identifiedItemIds],
            identifiedItemIds: [...this.meta.identifiedItemIds],
            revealedTrapIds: [...this.meta.discoveredTrapIds],
            unlockedCutsceneIds: [...this.meta.unlockedCutsceneIds]
        };
        this.model = new TutorialBattleModel(this.data, { knowledge });
        this.model.reset({ starterItemId });
        this.mode = MODES.BATTLE;
        this.resultData = null;
        this.resultRecorded = false;
        this.pendingCutscenes = [];
        this.runCutsceneIds = new Set(this.#getSnapshot()?.unlockedCutscenes || []);
        this.attackSelected = false;
        this.targetIndex = 0;
        this.inventoryPage = 0;
        this.loraTurnState = null;
        this.eventLog = [];
        this.floatingTexts = [];
        this.particles = [];
        this.screenShakeSeconds = 0;
        this.stabilizeSeconds = 0;
        this.flashSeconds = 0;
        this.presentation = {
            ...this.presentation,
            floorIndex: Number(this.model.floorIndex) || 0,
            playerX: Number(this.model.player?.x) || 0,
            playerY: Number(this.model.player?.y) || 0,
            playerAlpha: 1,
            playerScale: 1,
            playerHp: Number(this.model.player?.hp) || 0,
            loraHp: Number(this.model.lora?.hp) || 0,
            instability: Number(this.model.lora?.instability) || 0,
            hoverProgress: 1,
            pathProgress: 1,
            attackProgress: 1,
            menuSelectionProgress: 1,
            actionPulse: 0
        };
        this.hoveredTileKey = '';
        this.#resetPlannedPath();
        this.#refreshBattleCache();
        this.#appendEvent('전투 시작 · 이동과 행동은 어느 쪽이든 먼저 할 수 있습니다.');
    }

    /**
     * 갤러리 선택 항목을 이동합니다.
     * @param {object} payload - 이동량입니다.
     * @private
     */
    #applyGalleryShift(payload) {
        if (this.mode !== MODES.GALLERY || this.cutscenes.isOpen()) {
            return;
        }
        const count = this.galleryEntries.length;
        if (count <= 0) {
            return;
        }
        const delta = Number(payload?.delta) || 0;
        this.galleryIndex = (this.galleryIndex + delta + count) % count;
        this.#startSelectionAnimation('menu-selection');
    }

    /**
     * 해금된 갤러리 컷씬을 재생합니다.
     * @private
     */
    #applyGalleryPlay() {
        if (this.mode !== MODES.GALLERY || this.cutscenes.isOpen()) {
            return;
        }
        const entry = this.galleryEntries[this.galleryIndex];
        if (!entry || !this.#isCutsceneUnlocked(entry.id)) {
            return;
        }
        this.#openCutscene(entry.id, MODES.GALLERY, true);
    }

    /**
     * 컷씬을 다음 카드로 진행하고 완료 시 메타를 갱신합니다.
     * @private
     */
    #applyCutsceneNext() {
        if (!this.cutscenes.isOpen()) {
            return;
        }
        const transition = this.cutscenes.next();
        if (!transition.ok || !transition.closed) {
            return;
        }
        const completedId = transition.completedCutsceneId;
        if (completedId) {
            let nextMeta = unlockTutorialCutscene(this.meta, completedId);
            if (completedId === 'opening') {
                nextMeta = markTutorialOpeningWatched(nextMeta);
            }
            this.#replaceMeta(nextMeta);
        }
        this.#resumeAfterCutscene();
    }

    /**
     * 현재 컷씬을 완료 처리 없이 닫습니다.
     * @private
     */
    #applyCutsceneClose() {
        if (!this.cutscenes.isOpen()) {
            return;
        }
        this.cutscenes.close();
        this.#resumeAfterCutscene();
    }

    /**
     * 대기 중인 컷씬을 열거나 원래 모드로 복귀합니다.
     * @private
     */
    #resumeAfterCutscene() {
        const next = this.pendingCutscenes.shift();
        if (next) {
            this.cutsceneReturnMode = next.returnMode;
            this.cutscenes.open(next.id);
            return;
        }
        this.mode = this.cutsceneReturnMode;
        this.cutsceneReturnMode = this.mode;
        if (this.mode === MODES.BATTLE) {
            this.#refreshBattleCache();
        }
    }

    /**
     * 방향 입력으로 이동 경로 또는 공격 대상을 선택합니다.
     * @param {object} payload - 방향 벡터입니다.
     * @private
     */
    #applyPlanStep(payload) {
        if (!this.#canAcceptBattleInput()) {
            return;
        }
        const dx = Number(payload?.x) || 0;
        const dy = Number(payload?.y) || 0;
        if (this.attackSelected) {
            this.#shiftAttackTarget(dx || dy);
            this.#startSelectionAnimation('attack');
            return;
        }
        if (this.model.movementUsed) {
            return;
        }
        const current = this.plannedPath[this.plannedPath.length - 1]
            || cloneTile(this.model.player);
        if (!current) {
            return;
        }
        const x = current.x + dx;
        const y = current.y + dy;
        const path = this.#normalizePath(this.model.getPathTo(x, y));
        if (path.length === 0) {
            return;
        }
        this.plannedPath = path;
        this.#startSelectionAnimation('path');
    }

    /**
     * 클릭한 도달 가능 타일까지 즉시 이동합니다.
     * @param {object} payload - 목적지 좌표입니다.
     * @private
     */
    #applyMoveTo(payload) {
        if (!this.#canAcceptBattleInput() || this.model.movementUsed) {
            return;
        }
        const tile = cloneTile(payload);
        if (!tile || !this.reachability.has(toTileKey(tile.x, tile.y))) {
            return;
        }
        const path = this.#normalizePath(this.model.getPathTo(tile.x, tile.y));
        this.#commitModelPath(path);
    }

    /**
     * 키보드로 계획한 경로를 확정합니다.
     * @private
     */
    #applyCommitPath() {
        if (!this.#canAcceptBattleInput() || this.model.movementUsed) {
            return;
        }
        this.#commitModelPath(this.plannedPath);
    }

    /**
     * 검증한 경로를 모델에 전달합니다.
     * @param {Array<{x:number,y:number}>} path - 이동 경로입니다.
     * @private
     */
    #commitModelPath(path) {
        const normalizedPath = this.#normalizePath(path);
        if (normalizedPath.length === 0) {
            return;
        }
        const { result, entry } = this.#performUndoableModelCommand(
            'move',
            () => this.model.commitPath(normalizedPath)
        );
        if (result?.ok) {
            entry.resultPath = this.#normalizePath(result.path);
            entry.teleportSegments = toList(result.events)
                .filter((event) => event?.type === 'teleported')
                .map((event) => ({
                    from: cloneTile(event.from),
                    to: cloneTile(event.to)
                }))
                .filter((segment) => segment.from && segment.to);
            this.#spawnPathParticles(entry.resultPath);
            this.#resetPlannedPath();
        }
        this.#afterModelChange(result);
        if (result?.ok) {
            this.#startPlayerPathPresentation(
                entry.resultPath,
                entry.teleportSegments
            );
        }
    }

    /**
     * 공격 선택 상태를 전환합니다.
     * @private
     */
    #applySelectAttack() {
        if (!this.#canAcceptBattleInput() || this.model.actionUsed) {
            return;
        }
        this.attackSelected = !this.attackSelected;
        this.targetIndex = 0;
        this.#refreshBattleCache();
        this.#startSelectionAnimation('attack');
    }

    /**
     * 선택 대상을 공격합니다.
     * @param {object} payload - 대상 ID입니다.
     * @private
     */
    #applyAttack(payload) {
        if (!this.#canAcceptBattleInput() || this.model.actionUsed) {
            return;
        }
        const targetId = payload?.targetId
            || this.actionTargets[this.targetIndex]?.id
            || LORA_ID;
        if (!this.actionTargets.some((target) => target.id === targetId)) {
            return;
        }
        const { result } = this.#performUndoableModelCommand(
            'attack',
            () => this.model.attack(targetId)
        );
        this.attackSelected = false;
        this.#afterModelChange(result);
        this.#startActionPresentation(result);
    }

    /**
     * 플레이어 방어 행동을 적용합니다.
     * @private
     */
    #applyDefend() {
        if (!this.#canAcceptBattleInput() || this.model.actionUsed) {
            return;
        }
        const { result } = this.#performUndoableModelCommand(
            'defend',
            () => this.model.defend()
        );
        this.attackSelected = false;
        this.#afterModelChange(result);
        this.#startActionPresentation(result);
    }

    /**
     * 플레이어가 행동을 아끼는 선택을 적용합니다.
     * @private
     */
    #applyIdle() {
        if (!this.#canAcceptBattleInput() || this.model.actionUsed) {
            return;
        }
        const { result } = this.#performUndoableModelCommand(
            'wait',
            () => this.model.wait()
        );
        this.attackSelected = false;
        this.#afterModelChange(result);
        this.#startActionPresentation(result);
    }

    /**
     * 인벤토리 아이템을 사용합니다.
     * @param {object} payload - 아이템 ID입니다.
     * @private
     */
    #applyUseItem(payload) {
        if (!this.#canAcceptBattleInput() || this.model.actionUsed) {
            return;
        }
        const itemId = payload?.itemId;
        if (typeof itemId !== 'string') {
            return;
        }
        const { result } = this.#performUndoableModelCommand(
            'use-item',
            () => this.model.useItem(itemId)
        );
        this.attackSelected = false;
        this.#afterModelChange(result);
        this.#startActionPresentation(result);
    }

    /**
     * 플레이어 턴을 끝내고 로라 행동 예약 상태로 전환합니다.
     * @private
     */
    #applyEndTurn() {
        if (!this.#canAcceptBattleInput()) {
            return;
        }
        const endMethod = typeof this.model.endPlayerTurn === 'function'
            ? this.model.endPlayerTurn
            : this.model.endTurn;
        if (typeof endMethod !== 'function') {
            return;
        }
        const { result } = this.#performUndoableModelCommand(
            'end-turn',
            () => endMethod.call(this.model)
        );
        this.attackSelected = false;
        this.#afterModelChange(result);
        this.#startActionPresentation(result, this.data.ANIMATION.TURN_GATE_SECONDS);
        if (this.mode === MODES.BATTLE && this.model?.turn === 'lora') {
            this.loraTurnState = {
                stage: 'before',
                seconds: 0,
                queued: false
            };
        }
    }

    /**
     * 열린 게이트에서 탈출을 시도합니다.
     * @private
     */
    #applyEscape() {
        if (!this.#canAcceptBattleInput() || !this.#canEscape()) {
            return;
        }
        const { result } = this.#performUndoableModelCommand(
            'escape',
            () => this.model.escape()
        );
        this.#afterModelChange(result);
        this.#startActionPresentation(result);
    }

    /**
     * 성공할 때만 남는 플레이어 모델 명령 체크포인트를 생성하고 실행합니다.
     * @param {string} action - 기록할 행동 ID입니다.
     * @param {Function} execute - 모델 명령 실행 함수입니다.
     * @returns {{result:object,entry:object|null}} 모델 결과와 기록 항목입니다.
     * @private
     */
    #performUndoableModelCommand(action, execute) {
        const entry = {
            action,
            checkpoint: this.#createSceneCheckpoint(),
            resultPath: [],
            teleportSegments: []
        };
        this.undoHistory.push(entry);
        let result;
        try {
            result = execute();
        } catch (error) {
            this.undoHistory.pop();
            throw error;
        }
        if (result?.ok !== true) {
            this.undoHistory.pop();
            this.buttonSignature = '';
            return { result, entry: null };
        }
        this.buttonSignature = '';
        return { result, entry };
    }

    /**
     * 모델과 씬 런 상태를 하나의 방어 복제 체크포인트로 묶습니다.
     * @returns {object} Undo용 체크포인트입니다.
     * @private
     */
    #createSceneCheckpoint() {
        if (!this.model || typeof this.model.createCheckpoint !== 'function') {
            throw new Error('TutorialScene: 모델 체크포인트 API를 사용할 수 없습니다.');
        }
        return {
            model: this.model.createCheckpoint(),
            mode: this.mode,
            resultData: cloneCheckpointValue(this.resultData),
            resultRecorded: this.resultRecorded,
            meta: cloneCheckpointValue(this.meta),
            metaStaging: this.metaStaging,
            cutscene: cloneCheckpointValue(this.cutscenes.getState()),
            cutsceneReturnMode: this.cutsceneReturnMode,
            pendingCutscenes: cloneCheckpointValue(this.pendingCutscenes),
            runCutsceneIds: [...this.runCutsceneIds],
            eventLog: [...this.eventLog],
            loraTurnState: cloneCheckpointValue(this.loraTurnState),
            attackSelected: this.attackSelected,
            targetIndex: this.targetIndex,
            inventoryPage: this.inventoryPage,
            hoveredTile: cloneTile(this.hoveredTile),
            hoveredTileKey: this.hoveredTileKey,
            plannedPath: cloneCheckpointValue(this.plannedPath),
            reachability: cloneCheckpointValue(this.reachability),
            actionTargets: cloneCheckpointValue(this.actionTargets),
            floatingTexts: cloneCheckpointValue(this.floatingTexts),
            particles: cloneCheckpointValue(this.particles),
            screenShakeSeconds: this.screenShakeSeconds,
            stabilizeSeconds: this.stabilizeSeconds,
            flashSeconds: this.flashSeconds,
            floorView: cloneCheckpointValue(this.floorView),
            floorActorView: cloneCheckpointValue(this.floorActorView),
            presentation: cloneCheckpointValue(this.presentation)
        };
    }

    /**
     * 가장 최근 플레이어 행동과 그 행동이 유발한 자동 진행을 함께 복원합니다.
     * @private
     */
    #applyUndo() {
        if (!this.#canUndo()) {
            return;
        }
        const entry = this.undoHistory.pop();
        const previousPresentation = cloneCheckpointValue(this.presentation);
        const rawPreviousFloorIndex = Number(previousPresentation?.floorIndex);
        const previousFloorIndex = Number.isFinite(rawPreviousFloorIndex)
            ? rawPreviousFloorIndex
            : (Number(this.model?.floorIndex) || 0);
        const previousFloorView = cloneCheckpointValue(this.floorView);
        const previousFloorActorView = cloneCheckpointValue(this.floorActorView);
        this.timelineRevision += 1;
        this.#clearOwnedAnimations();
        try {
            const targetPresentation = this.#restoreSceneCheckpoint(entry.checkpoint);
            const targetFloorIndex = Number(this.model?.floorIndex) || 0;
            const targetFloorView = cloneCheckpointValue(this.floorView);
            const targetFloorActorView = cloneCheckpointValue(this.floorActorView);
            if (previousFloorIndex !== targetFloorIndex) {
                this.floorView = previousFloorView;
                this.floorActorView = previousFloorActorView;
            }
            this.presentation = {
                ...targetPresentation,
                ...previousPresentation,
                floorIndex: previousFloorIndex
            };
            this.presentationLocked = false;
            this.#appendEvent(this.data.TEXT.ACTIONS.UNDO_EVENT);
            this.#startUndoPresentation(
                entry,
                targetPresentation,
                previousFloorIndex,
                targetFloorView,
                targetFloorActorView
            );
        } catch (error) {
            this.undoHistory.push(entry);
            console.warn('행동 되돌리기 오류:', error);
        }
        this.buttonSignature = '';
    }

    /**
     * 씬 체크포인트를 복원하고 애니메이션 목표 표현 상태를 반환합니다.
     * @param {object} checkpoint - 복원할 씬 체크포인트입니다.
     * @returns {object} 복원 목표 표현 상태입니다.
     * @private
     */
    #restoreSceneCheckpoint(checkpoint) {
        if (!checkpoint || typeof this.model?.restoreCheckpoint !== 'function') {
            throw new TypeError('TutorialScene: 복원할 체크포인트가 올바르지 않습니다.');
        }
        this.model.restoreCheckpoint(checkpoint.model);
        this.mode = checkpoint.mode;
        this.resultData = cloneCheckpointValue(checkpoint.resultData);
        this.resultRecorded = checkpoint.resultRecorded === true;
        this.meta = cloneCheckpointValue(checkpoint.meta);
        this.metaStaging = checkpoint.metaStaging === true;
        this.cutsceneReturnMode = checkpoint.cutsceneReturnMode;
        this.pendingCutscenes = cloneCheckpointValue(checkpoint.pendingCutscenes);
        this.runCutsceneIds = new Set(checkpoint.runCutsceneIds || []);
        this.eventLog = [...(checkpoint.eventLog || [])];
        this.loraTurnState = cloneCheckpointValue(checkpoint.loraTurnState);
        this.attackSelected = checkpoint.attackSelected === true;
        this.targetIndex = Number(checkpoint.targetIndex) || 0;
        this.inventoryPage = Number(checkpoint.inventoryPage) || 0;
        this.hoveredTile = cloneTile(checkpoint.hoveredTile);
        this.hoveredTileKey = String(checkpoint.hoveredTileKey || '');
        this.plannedPath = cloneCheckpointValue(checkpoint.plannedPath) || [];
        this.reachability = cloneCheckpointValue(checkpoint.reachability) || new Map();
        this.actionTargets = cloneCheckpointValue(checkpoint.actionTargets) || [];
        this.floatingTexts = cloneCheckpointValue(checkpoint.floatingTexts) || [];
        this.particles = cloneCheckpointValue(checkpoint.particles) || [];
        this.screenShakeSeconds = Number(checkpoint.screenShakeSeconds) || 0;
        this.stabilizeSeconds = Number(checkpoint.stabilizeSeconds) || 0;
        this.flashSeconds = Number(checkpoint.flashSeconds) || 0;
        this.#restoreCutsceneState(checkpoint.cutscene);
        this.floorView = cloneCheckpointValue(checkpoint.floorView)
            || this.model.getCurrentFloorState();
        this.floorActorView = cloneCheckpointValue(checkpoint.floorActorView)
            || this.#captureFloorActorView();
        return cloneCheckpointValue(checkpoint.presentation);
    }

    /**
     * 공개 컨트롤러 API만으로 컷씬 ID와 카드 위치를 복원합니다.
     * @param {object} state - 저장된 컷씬 상태입니다.
     * @private
     */
    #restoreCutsceneState(state) {
        this.cutscenes = new TutorialCutsceneController(this.data.CUTSCENES);
        if (!state?.open || typeof state.cutsceneId !== 'string') {
            return;
        }
        const opened = this.cutscenes.open(state.cutsceneId);
        if (!opened.ok) {
            return;
        }
        const targetIndex = Math.max(0, Number(state.cardIndex) || 0);
        for (let index = 0; index < targetIndex; index++) {
            const transition = this.cutscenes.next();
            if (!transition.ok || transition.closed) {
                break;
            }
        }
    }

    /**
     * 현재 모드나 표현 잠금과 무관하게 되돌릴 기록이 있는지 확인합니다.
     * @returns {boolean} Undo 가능 여부입니다.
     * @private
     */
    #canUndo() {
        return Boolean(this.model
            && this.undoHistory.length > 0
            && (this.mode === MODES.BATTLE
                || this.mode === MODES.RESULT
                || this.cutscenes.isOpen()));
    }

    /**
     * 예약된 로라 행동을 모델에 적용합니다.
     * @param {object} payload - 예약 당시 타임라인 버전입니다.
     * @private
     */
    #applyLoraAction(payload) {
        if (Number(payload?.timelineRevision) !== this.timelineRevision
            || this.mode !== MODES.BATTLE
            || this.cutscenes.isOpen()
            || this.model?.turn !== 'lora'
            || this.loraTurnState?.stage !== 'before') {
            return;
        }
        const result = this.model.performLoraTurn();
        this.loraTurnState = {
            stage: 'show',
            seconds: 0,
            queued: false
        };
        this.#afterModelChange(result);
    }

    /**
     * 로라 행동 연출 뒤 다음 플레이어 턴을 엽니다.
     * @param {object} payload - 예약 당시 타임라인 버전입니다.
     * @private
     */
    #applyLoraCompletion(payload) {
        if (Number(payload?.timelineRevision) !== this.timelineRevision
            || this.mode !== MODES.BATTLE
            || this.cutscenes.isOpen()
            || this.model?.turn !== 'lora'
            || this.loraTurnState?.stage !== 'show') {
            return;
        }
        const result = this.model.completeLoraTurn();
        this.loraTurnState = null;
        this.attackSelected = false;
        this.#resetPlannedPath();
        this.#afterModelChange(result);
    }

    /**
     * 모델 결과의 이벤트, 지식, 컷씬, 종료 상태를 동기화합니다.
     * @param {object} result - 모델 메서드 반환값입니다.
     * @private
     */
    #afterModelChange(result) {
        if (result?.ok === false) {
            this.#appendEvent(this.#formatReason(result.reason));
        }
        this.#consumeEvents(result?.events);
        this.#syncMetaFromModel();
        this.#refreshBattleCache();
        this.#enterResultIfNeeded();
        this.#collectRunCutscenes();
        this.#animateHudToModel();
        if (this.presentation.floorIndex !== (Number(this.model?.floorIndex) || 0)) {
            this.#startFloorTransitionPresentation();
        }
        if (this.mode === MODES.BATTLE
            && this.model?.turn === 'lora'
            && !this.loraTurnState) {
            this.loraTurnState = {
                stage: 'before',
                seconds: 0,
                queued: false
            };
        }
    }

    /**
     * 사용 아이템과 발동 함정을 반복 플레이 메타에 반영합니다.
     * @private
     */
    #syncMetaFromModel() {
        if (!this.model) {
            return;
        }
        let nextMeta = this.meta;
        const snapshot = this.#getSnapshot();
        for (const itemId of toList(snapshot?.usedItems)) {
            const normalizedId = typeof itemId === 'string' ? itemId : itemId?.itemId;
            if (normalizedId) {
                nextMeta = identifyTutorialItem(nextMeta, normalizedId);
            }
        }
        for (const itemId of toList(snapshot?.knowledge?.identifiedItemIds)) {
            if (typeof itemId === 'string') {
                nextMeta = identifyTutorialItem(nextMeta, itemId);
            }
        }
        for (const trapId of toList(snapshot?.knowledge?.revealedTrapIds)) {
            if (typeof trapId === 'string') {
                nextMeta = discoverTutorialTrap(nextMeta, trapId);
            }
        }
        for (const floor of toList(this.model.floorStates)) {
            for (const trap of toList(floor?.traps)) {
                if (trap?.triggered || trap?.revealed) {
                    nextMeta = discoverTutorialTrap(nextMeta, trap.id);
                }
            }
        }
        this.#replaceMeta(nextMeta);
    }

    /**
     * 모델이 공개한 컷씬을 런타임 표시 목록에 넣습니다.
     * @private
     */
    #collectRunCutscenes() {
        const snapshot = this.#getSnapshot();
        for (const rawId of toList(snapshot?.unlockedCutscenes)) {
            const id = typeof rawId === 'string' ? rawId : rawId?.id;
            if (id) {
                this.#openCutscene(id, this.mode, false);
            }
        }
    }

    /**
     * 모델 결과가 생기면 결과 모드와 메타 기록을 구성합니다.
     * @private
     */
    #enterResultIfNeeded() {
        if (!this.model || this.resultRecorded) {
            return;
        }
        const snapshot = this.#getSnapshot();
        const rawResult = this.model.result || snapshot?.result;
        if (!rawResult) {
            return;
        }
        const endingSource = rawResult.endingId
            || rawResult.ending?.id
            || rawResult.ending
            || rawResult.id;
        const endingId = typeof endingSource === 'string'
            ? endingSource
            : this.galleryEntries[this.galleryEntries.length - 1]?.id;
        const rawScore = Number(rawResult.score);
        const score = Math.max(
            0,
            Math.round(Number.isFinite(rawScore) ? rawScore : this.#calculateScore())
        );
        const entry = this.galleryEntries.find((candidate) => candidate.id === endingId);
        const instability = clampNumber(
            rawResult.instability ?? this.model.lora?.instability,
            0,
            100
        );
        this.resultData = {
            ...rawResult,
            endingId,
            score,
            instability,
            label: rawResult.label || entry?.title || '작전 종료'
        };
        this.mode = MODES.RESULT;
        this.resultRecorded = true;
        this.#replaceMeta(recordTutorialResult(this.meta, {
            score,
            endingId
        }));
        if (endingId) {
            this.#openCutscene(endingId, MODES.RESULT, true);
        }
    }

    /**
     * 현재 전투 상태로 안정적인 점수 기본값을 계산합니다.
     * @returns {number} 점수입니다.
     * @private
     */
    #calculateScore() {
        const hp = clampNumber(this.model?.player?.hp, 0, 100);
        const instability = clampNumber(this.model?.lora?.instability, 0, 100);
        const turnBonus = Math.max(
            0,
            (Number(this.model?.maxTurns) || this.data.RULES.MAX_TURNS)
                - (Number(this.model?.turnNumber) || 0)
        ) * 50;
        return Math.round((hp * 10) + ((100 - instability) * 12) + turnBonus);
    }

    /**
     * 새 메타가 달라졌을 때만 교체하고 저장합니다.
     * @param {object} nextMeta - 새 메타입니다.
     * @private
     */
    #replaceMeta(nextMeta) {
        if (!nextMeta || isSameMeta(this.meta, nextMeta)) {
            return;
        }
        this.meta = nextMeta;
        if (!this.metaStaging) {
            this.committedMeta = cloneCheckpointValue(this.meta);
            this.#saveMeta(this.committedMeta);
        }
    }

    /**
     * Undo 경계 안에서 쌓인 메타 변경을 확정 경계에서 한 번만 저장합니다.
     * @private
     */
    #commitStagedMeta() {
        if (!this.metaStaging) {
            return;
        }
        this.metaStaging = false;
        if (isSameMeta(this.committedMeta, this.meta)) {
            return;
        }
        this.committedMeta = cloneCheckpointValue(this.meta);
        this.#saveMeta(this.committedMeta);
    }

    /**
     * 최신 메타 복제본을 순서대로 비동기 저장합니다.
     * @param {object} [meta=this.meta] - 확정해 저장할 메타입니다.
     * @private
     */
    #saveMeta(meta = this.meta) {
        const snapshot = cloneCheckpointValue(meta);
        this.saveSequence = this.saveSequence
            .then(() => saveTutorialMeta(snapshot))
            .catch((error) => {
                console.warn('튜토리얼 진행도 저장 오류:', error);
            });
    }

    /**
     * 컷씬 ID를 검증해 즉시 열거나 대기열에 넣습니다.
     * @param {string} id - 컷씬 ID입니다.
     * @param {string} returnMode - 닫힌 뒤 복귀할 모드입니다.
     * @param {boolean} repeat - 같은 플레이 중 재생을 허용할지 여부입니다.
     * @private
     */
    #openCutscene(id, returnMode, repeat) {
        if (typeof id !== 'string') {
            return;
        }
        const exists = this.galleryEntries.some((entry) => entry.id === id);
        if (!exists || (!repeat && this.runCutsceneIds.has(id))) {
            return;
        }
        this.runCutsceneIds.add(id);
        if (this.cutscenes.isOpen()) {
            if (this.cutscenes.getState().cutsceneId === id) {
                return;
            }
            if (!this.pendingCutscenes.some((entry) => entry.id === id)) {
                this.pendingCutscenes.push({ id, returnMode });
            }
            return;
        }
        const transition = this.cutscenes.open(id);
        if (transition.ok) {
            this.cutsceneReturnMode = returnMode;
        }
    }

    /**
     * 컷씬 해금 여부를 확인합니다.
     * @param {string} id - 컷씬 ID입니다.
     * @returns {boolean} 해금 상태입니다.
     * @private
     */
    #isCutsceneUnlocked(id) {
        return this.meta.unlockedCutsceneIds.includes(id);
    }

    /**
     * 현재 모델 스냅샷을 안전하게 얻습니다.
     * @returns {object|null} 스냅샷입니다.
     * @private
     */
    #getSnapshot() {
        if (!this.model || typeof this.model.getSnapshot !== 'function') {
            return null;
        }
        return this.model.getSnapshot();
    }

    /**
     * 현재 논리 층의 인물과 게이트 상태를 표현용으로 방어 복제합니다.
     * @returns {object|null} 층 인물 표현 상태입니다.
     * @private
     */
    #captureFloorActorView() {
        if (!this.model) {
            return null;
        }
        return {
            floorIndex: Number(this.model.floorIndex) || 0,
            player: cloneCheckpointValue(this.model.player),
            lora: cloneCheckpointValue(this.model.lora),
            gateOpen: this.model.gateOpen === true
        };
    }

    /**
     * 전투 캐시를 모델의 현재 상태에 맞춥니다.
     * @private
     */
    #refreshBattleCache() {
        this.reachability = new Map();
        this.actionTargets = [];
        if (!this.model) {
            this.floorView = null;
            this.floorActorView = null;
            return;
        }
        if (this.mode !== MODES.BATTLE) {
            return;
        }
        const logicalFloorIndex = Number(this.model.floorIndex) || 0;
        const presentationFloorIndex = Number(this.presentation.floorIndex) || 0;
        if (!this.floorView || logicalFloorIndex === presentationFloorIndex) {
            this.floorView = this.model.getCurrentFloorState();
            this.floorActorView = this.#captureFloorActorView();
        }
        if (this.model.turn === 'player' && !this.model.movementUsed) {
            this.reachability = this.#normalizeReachability(this.model.getReachability());
        }
        if (this.model.turn === 'player' && !this.model.actionUsed && this.attackSelected) {
            this.actionTargets = toList(this.model.getValidTargets()).map((target) => ({
                ...target,
                x: Number(target.x),
                y: Number(target.y)
            }));
            this.targetIndex = clampNumber(
                this.targetIndex,
                0,
                Math.max(0, this.actionTargets.length - 1)
            );
        }
        const player = cloneTile(this.model.player);
        if (!player) {
            this.plannedPath = [];
            return;
        }
        if (this.plannedPath.length === 0
            || this.plannedPath[0].x !== player.x
            || this.plannedPath[0].y !== player.y) {
            this.plannedPath = [player];
        }
    }

    /**
     * 도달 가능 결과를 좌표 키 Map으로 정규화합니다.
     * @param {*} source - 모델 반환값입니다.
     * @returns {Map<string,object>} 정규화된 결과입니다.
     * @private
     */
    #normalizeReachability(source) {
        const normalized = new Map();
        if (source instanceof Map) {
            for (const [key, value] of source.entries()) {
                if (value && Number.isInteger(Number(value.x)) && Number.isInteger(Number(value.y))) {
                    normalized.set(toTileKey(Number(value.x), Number(value.y)), value);
                    continue;
                }
                const parts = String(key).split(',').map(Number);
                if (parts.length === 2 && parts.every(Number.isInteger)) {
                    normalized.set(toTileKey(parts[0], parts[1]), {
                        x: parts[0],
                        y: parts[1],
                        cost: Number(value) || 0
                    });
                }
            }
            return normalized;
        }
        for (const value of toList(source?.tiles || source)) {
            const tile = cloneTile(value);
            if (tile) {
                normalized.set(toTileKey(tile.x, tile.y), value);
            }
        }
        return normalized;
    }

    /**
     * 경로 반환값을 유효 좌표 배열로 정규화합니다.
     * @param {*} source - 모델 반환값입니다.
     * @returns {Array<{x:number,y:number}>} 좌표 배열입니다.
     * @private
     */
    #normalizePath(source) {
        const rawPath = Array.isArray(source) ? source : source?.path;
        if (!Array.isArray(rawPath)) {
            return [];
        }
        return rawPath.map(cloneTile).filter(Boolean);
    }

    /**
     * 현재 플레이어 위치를 경로 시작점으로 설정합니다.
     * @private
     */
    #resetPlannedPath() {
        const player = cloneTile(this.model?.player);
        this.plannedPath = player ? [player] : [];
    }

    /**
     * 공격 대상 선택 커서를 순환합니다.
     * @param {number} delta - 이동량입니다.
     * @private
     */
    #shiftAttackTarget(delta) {
        const count = this.actionTargets.length;
        if (count <= 0 || delta === 0) {
            return;
        }
        this.targetIndex = (this.targetIndex + Math.sign(delta) + count) % count;
    }

    /**
     * 플레이어 전투 입력을 받을 수 있는지 확인합니다.
     * @returns {boolean} 입력 가능 여부입니다.
     * @private
     */
    #canAcceptBattleInput() {
        return this.mode === MODES.BATTLE
            && !this.cutscenes.isOpen()
            && !this.presentationLocked
            && this.model?.turn === 'player'
            && !this.model?.result;
    }

    /**
     * 현재 위치에서 게이트 탈출이 가능한지 확인합니다.
     * @returns {boolean} 가능 여부입니다.
     * @private
     */
    #canEscape() {
        return Boolean(this.model
            && typeof this.model.canEscape === 'function'
            && this.model.canEscape());
    }

    /**
     * 로라 턴의 두 단계 명령을 시간에 맞춰 큐에 넣습니다.
     * @param {number} deltaSeconds - 경과 초입니다.
     * @private
     */
    #updateLoraTurn(deltaSeconds) {
        if (!this.loraTurnState
            || this.mode !== MODES.BATTLE
            || this.cutscenes.isOpen()
            || this.presentationLocked
            || this.loraTurnState.queued) {
            return;
        }
        this.loraTurnState.seconds += deltaSeconds;
        const beforeSeconds = Number(this.data.ANIMATION.TURN_GATE_SECONDS) || 0.22;
        const showSeconds = Number(this.data.ANIMATION.LORA_TURN_SECONDS) || 1.15;
        if (this.loraTurnState.stage === 'before'
            && this.loraTurnState.seconds >= beforeSeconds) {
            this.loraTurnState.queued = true;
            enqueueSimulationCommand({
                type: COMMANDS.PERFORM_LORA,
                payload: { timelineRevision: this.timelineRevision }
            });
        } else if (this.loraTurnState.stage === 'show'
            && this.loraTurnState.seconds >= showSeconds) {
            this.loraTurnState.queued = true;
            enqueueSimulationCommand({
                type: COMMANDS.COMPLETE_LORA,
                payload: { timelineRevision: this.timelineRevision }
            });
        }
    }

    /**
     * 키보드 상승 에지를 모드별 명령으로 변환합니다.
     * @private
     */
    #handleKeyboardInput() {
        const undoShortcutPressed = this.#consumeUndoShortcut();
        if (this.mode === MODES.LOADING) {
            return;
        }
        if (undoShortcutPressed && this.#canUndo()) {
            enqueueSimulationCommand({ type: COMMANDS.UNDO });
            return;
        }
        if (this.presentationLocked) {
            return;
        }
        if (this.cutscenes.isOpen()) {
            if (this.#wasKeyPressed('Enter') || this.#wasKeyPressed('Space')) {
                enqueueSimulationCommand({ type: COMMANDS.CUTSCENE_NEXT });
            } else if (this.#wasKeyPressed('Escape')) {
                enqueueSimulationCommand({ type: COMMANDS.CUTSCENE_CLOSE });
            }
            return;
        }

        if (this.mode === MODES.MENU) {
            if (this.#wasKeyPressed('Enter')) {
                enqueueSimulationCommand({ type: COMMANDS.START });
            } else if (this.#wasKeyPressed('KeyG')) {
                enqueueSimulationCommand({ type: COMMANDS.OPEN_GALLERY });
            }
            return;
        }

        if (this.mode === MODES.STARTER) {
            if (this.#wasAnyKeyPressed(['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW'])) {
                enqueueSimulationCommand({
                    type: COMMANDS.STARTER_SHIFT,
                    payload: { delta: -1 }
                });
            } else if (this.#wasAnyKeyPressed(['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS'])) {
                enqueueSimulationCommand({
                    type: COMMANDS.STARTER_SHIFT,
                    payload: { delta: 1 }
                });
            } else if (this.#wasKeyPressed('Enter')) {
                enqueueSimulationCommand({ type: COMMANDS.CHOOSE_STARTER });
            } else if (this.#wasKeyPressed('Escape')) {
                enqueueSimulationCommand({ type: COMMANDS.RETURN_MENU });
            }
            return;
        }

        if (this.mode === MODES.GALLERY) {
            if (this.#wasAnyKeyPressed(['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW'])) {
                enqueueSimulationCommand({
                    type: COMMANDS.GALLERY_SHIFT,
                    payload: { delta: -1 }
                });
            } else if (this.#wasAnyKeyPressed(['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS'])) {
                enqueueSimulationCommand({
                    type: COMMANDS.GALLERY_SHIFT,
                    payload: { delta: 1 }
                });
            } else if (this.#wasKeyPressed('Enter')) {
                enqueueSimulationCommand({ type: COMMANDS.GALLERY_PLAY });
            } else if (this.#wasKeyPressed('Escape')) {
                enqueueSimulationCommand({ type: COMMANDS.RETURN_MENU });
            }
            return;
        }

        if (this.mode === MODES.RESULT) {
            if (this.#wasKeyPressed('KeyR')) {
                enqueueSimulationCommand({ type: COMMANDS.RESTART });
            } else if (this.#wasKeyPressed('Escape')) {
                enqueueSimulationCommand({ type: COMMANDS.RETURN_MENU });
            }
            return;
        }

        if (this.mode !== MODES.BATTLE) {
            return;
        }
        if (this.#wasKeyPressed('KeyR')) {
            enqueueSimulationCommand({ type: COMMANDS.RESTART });
            return;
        }
        if (this.#wasKeyPressed('Escape')) {
            enqueueSimulationCommand({ type: COMMANDS.RETURN_MENU });
            return;
        }
        if (!this.#canAcceptBattleInput()) {
            return;
        }

        const direction = KEY_DIRECTIONS.find((entry) => this.#wasAnyKeyPressed(entry.codes));
        if (direction) {
            enqueueSimulationCommand({
                type: COMMANDS.PLAN_STEP,
                payload: { x: direction.x, y: direction.y }
            });
            return;
        }
        if (this.#wasKeyPressed('Tab') && this.attackSelected) {
            enqueueSimulationCommand({
                type: COMMANDS.PLAN_STEP,
                payload: { x: 1, y: 0 }
            });
        } else if (this.#wasKeyPressed('Enter')) {
            if (this.attackSelected) {
                enqueueSimulationCommand({
                    type: COMMANDS.ATTACK,
                    payload: { targetId: this.actionTargets[this.targetIndex]?.id }
                });
            } else {
                enqueueSimulationCommand({ type: COMMANDS.COMMIT_PATH });
            }
        } else if (this.#wasKeyPressed('Digit1')) {
            enqueueSimulationCommand({ type: COMMANDS.SELECT_ATTACK });
        } else if (this.#wasKeyPressed('Digit2')) {
            enqueueSimulationCommand({ type: COMMANDS.DEFEND });
        } else if (this.#wasKeyPressed('Digit3')) {
            enqueueSimulationCommand({ type: COMMANDS.IDLE });
        } else if (this.#wasKeyPressed('Space')) {
            enqueueSimulationCommand({ type: COMMANDS.END_TURN });
        } else if (this.#wasKeyPressed('KeyE')) {
            enqueueSimulationCommand({ type: COMMANDS.ESCAPE });
        }
    }

    /**
     * 포인터가 가리키는 전술 타일을 갱신합니다.
     * @private
     */
    #updatePointerState() {
        let nextTile = null;
        if (this.mode !== MODES.BATTLE || this.cutscenes.isOpen()) {
            this.hoveredTile = null;
            this.hoveredTileKey = '';
            return;
        }
        if (!getMouseFocus().includes('object')) {
            this.hoveredTile = null;
            this.hoveredTileKey = '';
            return;
        }
        const mouse = getMouseInput('pos') || {
            x: getMouseInput('x'),
            y: getMouseInput('y')
        };
        nextTile = this.#hitTestTile(mouse.x, mouse.y);
        const nextKey = nextTile ? toTileKey(nextTile.x, nextTile.y) : '';
        if (nextKey && nextKey !== this.hoveredTileKey) {
            this.#startSelectionAnimation('hover');
        }
        if (nextTile && this.attackSelected) {
            const hoveredTargetIndex = this.actionTargets.findIndex((target) => (
                target.x === nextTile.x && target.y === nextTile.y
            ));
            if (hoveredTargetIndex >= 0 && hoveredTargetIndex !== this.targetIndex) {
                this.targetIndex = hoveredTargetIndex;
                this.#startSelectionAnimation('attack');
            }
        }
        this.hoveredTile = nextTile;
        this.hoveredTileKey = nextKey;
    }

    /**
     * 보드 클릭을 이동 또는 공격 명령으로 변환합니다.
     * @private
     */
    #handlePointerInput() {
        if (this.uiActionHandled
            || this.mode !== MODES.BATTLE
            || this.cutscenes.isOpen()
            || !this.hoveredTile
            || !getMouseFocus().includes('object')) {
            return;
        }
        if (!consumeMouseState('left', 'clicked')) {
            return;
        }
        if (!this.#canAcceptBattleInput()) {
            return;
        }
        if (this.attackSelected) {
            const target = this.actionTargets.find((entry) => (
                entry.x === this.hoveredTile.x && entry.y === this.hoveredTile.y
            ));
            if (target) {
                enqueueSimulationCommand({
                    type: COMMANDS.ATTACK,
                    payload: { targetId: target.id }
                });
            }
            return;
        }
        if (!this.model.movementUsed
            && this.reachability.has(toTileKey(this.hoveredTile.x, this.hoveredTile.y))) {
            enqueueSimulationCommand({
                type: COMMANDS.MOVE_TO,
                payload: this.hoveredTile
            });
        }
    }

    /**
     * 명령 버튼 클릭을 큐에 넣고 보드 전파를 막습니다.
     * @param {string} type - 명령 타입입니다.
     * @param {object} [payload] - 명령 데이터입니다.
     * @private
     */
    #queueUiCommand(type, payload) {
        this.uiActionHandled = true;
        consumeMouseState('left', 'clicked');
        enqueueSimulationCommand({ type, payload });
    }

    /**
     * 키 하나가 이번 프레임에 눌렸는지 확인합니다.
     * @param {string} code - KeyboardEvent.code 값입니다.
     * @returns {boolean} 눌림 여부입니다.
     * @private
     */
    #wasKeyPressed(code) {
        return this.frameKeyEdges.has(code);
    }

    /**
     * 후보 키 중 하나가 이번 프레임에 눌렸는지 확인합니다.
     * @param {readonly string[]} codes - 키 후보입니다.
     * @returns {boolean} 눌림 여부입니다.
     * @private
     */
    #wasAnyKeyPressed(codes) {
        return codes.some((code) => this.#wasKeyPressed(code));
    }

    /**
     * DOM에서 포착한 Ctrl+Z를 우선 소비하고 프레임 에지와 현재 modifier로 보완합니다.
     * @returns {boolean} Undo 단축키 입력 여부입니다.
     * @private
     */
    #consumeUndoShortcut() {
        const capturedShortcut = this.pendingUndoShortcut;
        this.pendingUndoShortcut = false;
        if (capturedShortcut) {
            return true;
        }
        if (!this.#wasKeyPressed('KeyZ')) {
            return false;
        }
        const modifierDown = CONTROL_KEY_CODES.some(
            (code) => getKeyboardCodeInput(code) === true
        );
        if (!modifierDown) {
            return false;
        }
        const modifierEdge = this.#wasAnyKeyPressed(CONTROL_KEY_CODES);
        const modifierObserved = CONTROL_KEY_CODES.some((code) => (
            this.keyboardPressObserved.get(code) === true
                || this.keyboardLatch.get(code) === true
        ));
        return modifierEdge || modifierObserved;
    }

    /**
     * 현재 눌림과 빠른 탭을 상승 에지 집합으로 합칩니다.
     * @private
     */
    #prepareKeyboardEdges() {
        this.frameKeyEdges.clear();
        for (const code of WATCHED_KEY_CODES) {
            const isDown = getKeyboardCodeInput(code) === true;
            if (isDown && this.keyboardLatch.get(code) !== true) {
                this.frameKeyEdges.add(code);
                this.keyboardPressObserved.set(code, true);
            }
        }

        const lastEvent = getKeyboardSnapshot()?.lastEvent;
        const eventTimestamp = Number(lastEvent?.timeStamp);
        const code = lastEvent?.code;
        if (!Number.isFinite(eventTimestamp)
            || eventTimestamp === this.lastKeyboardEventTimestamp
            || !WATCHED_KEY_CODES.includes(code)) {
            return;
        }
        this.lastKeyboardEventTimestamp = eventTimestamp;
        if (lastEvent.pressed === true) {
            if (this.keyboardLatch.get(code) !== true
                && this.keyboardPressObserved.get(code) !== true) {
                this.frameKeyEdges.add(code);
            }
            this.keyboardPressObserved.set(code, true);
            return;
        }
        if (this.keyboardPressObserved.get(code) !== true) {
            this.frameKeyEdges.add(code);
        }
        this.keyboardPressObserved.set(code, false);
    }

    /**
     * 다음 프레임을 위해 현재 키 상태를 저장합니다.
     * @private
     */
    #captureKeyboardLatch() {
        for (const code of WATCHED_KEY_CODES) {
            this.keyboardLatch.set(code, getKeyboardCodeInput(code) === true);
        }
    }

    /**
     * 현재 모드와 전투 상태가 달라졌을 때 버튼을 다시 만듭니다.
     * @private
     */
    #ensureButtons() {
        const signature = this.#getButtonSignature();
        if (signature === this.buttonSignature) {
            return;
        }
        this.buttonSignature = signature;
        this.#buildButtons();
    }

    /**
     * 버튼 구성에 영향을 주는 상태를 문자열로 직렬화합니다.
     * @returns {string} 구성 서명입니다.
     * @private
     */
    #getButtonSignature() {
        const cutsceneState = this.cutscenes.getState();
        const inventory = this.#getInventoryEntries()
            .map((entry) => entry.itemId + ':' + String(entry.count))
            .join('|');
        return [
            this.mode,
            cutsceneState.open ? cutsceneState.cutsceneId : '-',
            String(cutsceneState.cardIndex),
            String(this.starterIndex),
            String(this.galleryIndex),
            String(this.model?.turn),
            String(this.model?.movementUsed),
            String(this.model?.actionUsed),
            String(this.attackSelected),
            String(this.inventoryPage),
            String(this.#canEscape()),
            String(this.#canUndo()),
            String(this.presentationLocked),
            inventory
        ].join('/');
    }

    /**
     * 현재 화면에 필요한 풀 기반 버튼을 구성합니다.
     * @private
     */
    #buildButtons() {
        this.#releaseButtons();
        if (this.mode === MODES.LOADING) {
            return;
        }
        if (this.cutscenes.isOpen()) {
            this.#buildCutsceneButtons();
            return;
        }
        if (this.mode === MODES.MENU) {
            this.#buildMenuButtons();
        } else if (this.mode === MODES.STARTER) {
            this.#buildStarterButtons();
        } else if (this.mode === MODES.GALLERY) {
            this.#buildGalleryButtons();
        } else if (this.mode === MODES.BATTLE) {
            this.#buildBattleButtons();
        } else if (this.mode === MODES.RESULT) {
            this.#buildResultButtons();
        }
    }

    /**
     * 메뉴 버튼을 구성합니다.
     * @private
     */
    #buildMenuButtons() {
        const w = this.#uww(24);
        const h = this.#uwh(6);
        const x = this.UIOffsetX + ((this.UIWW - w) * 0.5);
        this.#createButton('menu-start', {
            x,
            y: this.#uwh(58),
            w,
            h,
            label: '게임 시작  [Enter]',
            onClick: () => this.#queueUiCommand(COMMANDS.START)
        });
        this.#createButton('menu-gallery', {
            x,
            y: this.#uwh(66),
            w,
            h,
            label: '컷씬 갤러리  [G]',
            onClick: () => this.#queueUiCommand(COMMANDS.OPEN_GALLERY)
        });
    }

    /**
     * 스타터 선택 버튼을 구성합니다.
     * @private
     */
    #buildStarterButtons() {
        const w = this.#uww(27);
        const h = this.#uwh(11);
        const gap = this.#uww(3);
        const startX = this.UIOffsetX + ((this.UIWW - ((w * 2) + gap)) * 0.5);
        this.data.STARTER_CHOICES.forEach((choice, index) => {
            this.#createButton('starter-' + choice.id, {
                x: startX + (index * (w + gap)),
                y: this.#uwh(55),
                w,
                h,
                label: (index === this.starterIndex ? '◆ ' : '') + choice.label,
                active: index === this.starterIndex,
                onClick: () => this.#queueUiCommand(COMMANDS.CHOOSE_STARTER, {
                    itemId: choice.id
                })
            });
        });
        this.#createButton('starter-back', {
            x: this.UIOffsetX + this.#uww(4),
            y: this.#uwh(88),
            w: this.#uww(14),
            h: this.#uwh(5),
            label: '메뉴  [Esc]',
            onClick: () => this.#queueUiCommand(COMMANDS.RETURN_MENU)
        });
    }

    /**
     * 갤러리 조작 버튼을 구성합니다.
     * @private
     */
    #buildGalleryButtons() {
        const centerX = this.UIOffsetX + (this.UIWW * 0.5);
        const entry = this.galleryEntries[this.galleryIndex];
        const unlocked = entry && this.#isCutsceneUnlocked(entry.id);
        this.#createButton('gallery-prev', {
            x: centerX - this.#uww(31),
            y: this.#uwh(78),
            w: this.#uww(14),
            h: this.#uwh(5),
            label: '◀ 이전',
            onClick: () => this.#queueUiCommand(COMMANDS.GALLERY_SHIFT, { delta: -1 })
        });
        this.#createButton('gallery-play', {
            x: centerX - this.#uww(8),
            y: this.#uwh(78),
            w: this.#uww(16),
            h: this.#uwh(5),
            label: unlocked ? '재생  [Enter]' : '잠김',
            enabled: Boolean(unlocked),
            onClick: () => this.#queueUiCommand(COMMANDS.GALLERY_PLAY)
        });
        this.#createButton('gallery-next', {
            x: centerX + this.#uww(17),
            y: this.#uwh(78),
            w: this.#uww(14),
            h: this.#uwh(5),
            label: '다음 ▶',
            onClick: () => this.#queueUiCommand(COMMANDS.GALLERY_SHIFT, { delta: 1 })
        });
        this.#createButton('gallery-back', {
            x: this.UIOffsetX + this.#uww(4),
            y: this.#uwh(88),
            w: this.#uww(14),
            h: this.#uwh(5),
            label: '메뉴  [Esc]',
            onClick: () => this.#queueUiCommand(COMMANDS.RETURN_MENU)
        });
    }

    /**
     * 전투 행동과 인벤토리 버튼을 구성합니다.
     * @private
     */
    #buildBattleButtons() {
        if (!this.model) {
            return;
        }
        const colors = ColorSchemes.Tactics;
        const ready = this.#canAcceptBattleInput();
        const actionRect = this.hudRects.SECONDARY_ACTIONS;
        const actionLayout = this.data.LAYOUT.ACTIONS;
        const columns = Number(actionLayout.COLUMNS) || 4;
        const gapX = this.#uww(actionLayout.GAP_X_UIWW);
        const actionColumnW = (
            actionRect.w - (gapX * (columns - 1))
        ) / columns;
        const actionH = Math.min(actionRect.h, clampNumber(this.#uwh(7), 48, 64));
        const actionY = actionRect.y + ((actionRect.h - actionH) * 0.5);
        const hasAttackTarget = toList(this.model.getValidTargets()).length > 0;
        const actionSpecs = [
            {
                key: 'attack',
                label: this.attackSelected ? '1 공격 취소' : '1 공격',
                enabled: ready && !this.model.actionUsed && hasAttackTarget,
                active: this.attackSelected,
                type: COMMANDS.SELECT_ATTACK
            },
            {
                key: 'defend',
                label: '2 방어',
                enabled: ready && !this.model.actionUsed,
                type: COMMANDS.DEFEND
            },
            {
                key: 'idle',
                label: '3 대기',
                enabled: ready && !this.model.actionUsed,
                type: COMMANDS.IDLE
            },
            {
                key: 'escape',
                label: '게이트 탈출',
                enabled: ready && this.#canEscape(),
                active: this.#canEscape(),
                type: COMMANDS.ESCAPE
            }
        ];
        actionSpecs.forEach((spec, index) => {
            this.#createButton('battle-' + spec.key, {
                x: actionRect.x + (index * (actionColumnW + gapX)),
                y: actionY,
                w: actionColumnW,
                h: actionH,
                label: spec.label,
                enabled: spec.enabled,
                active: spec.active,
                onClick: () => this.#queueUiCommand(spec.type)
            });
        });
        const primaryRect = this.hudRects.PRIMARY_ACTION;
        const primaryH = Math.min(primaryRect.h, clampNumber(this.#uwh(7), 48, 72));
        this.#createButton('battle-end', {
            x: primaryRect.x,
            y: primaryRect.y + ((primaryRect.h - primaryH) * 0.5),
            w: primaryRect.w,
            h: primaryH,
            label: '턴 종료  [Space]',
            enabled: ready,
            idleColor: colors.UI.Primary,
            hoverColor: colors.UI.PrimaryHover,
            textColor: colors.UI.OnPrimary,
            radius: this.#uwh(1.35),
            shadow: { blur: 10, color: colors.UI.ButtonShadow },
            onClick: () => this.#queueUiCommand(COMMANDS.END_TURN)
        });
        const menuRect = this.hudRects.MENU;
        const menuH = Math.min(menuRect.h, clampNumber(this.#uwh(4.2), 32, 48));
        this.#createButton('battle-menu', {
            x: menuRect.x,
            y: menuRect.y + ((menuRect.h - menuH) * 0.5),
            w: menuRect.w,
            h: menuH,
            label: 'Esc  메뉴',
            enabled: !this.presentationLocked,
            idleColor: colors.UI.Card,
            hoverColor: colors.UI.ButtonHover,
            textColor: colors.UI.Text,
            radius: this.#uwh(1),
            shadow: { blur: 8, color: colors.UI.CardShadow },
            onClick: () => this.#queueUiCommand(COMMANDS.RETURN_MENU)
        });
        const undoRect = this.hudRects.UNDO;
        const undoH = Math.min(undoRect.h, clampNumber(this.#uwh(4.2), 32, 48));
        this.#createButton('battle-undo', {
            x: undoRect.x,
            y: undoRect.y + ((undoRect.h - undoH) * 0.5),
            w: undoRect.w,
            h: undoH,
            label: this.data.TEXT.ACTIONS.UNDO_SHORT,
            enabled: this.#canUndo(),
            idleColor: colors.UI.Undo,
            hoverColor: colors.UI.UndoHover,
            textColor: colors.UI.OnPrimary,
            radius: this.#uwh(1),
            shadow: { blur: 8, color: colors.UI.CardShadow },
            onClick: () => this.#queueUiCommand(COMMANDS.UNDO)
        });

        const paging = this.#getInventoryPaging();
        this.inventoryPage = paging.page;
        const inventoryRect = this.hudRects.INVENTORY_CARD;
        const inventoryLayout = this.data.LAYOUT.INVENTORY;
        const inventoryColumns = Number(inventoryLayout.COLUMNS) || 3;
        const inventoryRows = Number(inventoryLayout.ROWS) || 2;
        const inventoryPad = this.#uww(0.9);
        const inventoryGapX = this.#uww(0.45);
        const itemGapY = this.#uwh(0.6);
        const headerH = clampNumber(inventoryRect.h * 0.22, 30, 46);
        const inventoryY = inventoryRect.y
            + headerH
            + clampNumber(inventoryRect.h * 0.05, 6, 12);
        const inventoryColumnW = (
            inventoryRect.w
            - (inventoryPad * 2)
            - (inventoryGapX * (inventoryColumns - 1))
        ) / inventoryColumns;
        const availableItemH = (
            inventoryRect.y + inventoryRect.h - inventoryPad - inventoryY
            - (itemGapY * (inventoryRows - 1))
        ) / inventoryRows;
        const itemH = clampNumber(availableItemH, 30, 56);
        const itemAtlasLayout = this.data.SPRITES.ITEM_ATLAS;
        paging.entries.forEach((entry, index) => {
            const column = index % inventoryColumns;
            const row = Math.floor(index / inventoryColumns);
            const usable = ready && !this.model.actionUsed && this.#isItemUsable(entry.itemId);
            const known = this.#isItemKnown(entry.itemId);
            const item = this.data.ITEMS[entry.itemId];
            const itemIcon = known
                ? this.#createItemIconChild(
                    entry.itemId,
                    itemH * itemAtlasLayout.BUTTON_ICON_SIZE_RATIO
                )
                : null;
            const itemIconWidth = Number(itemIcon?.width) || 0;
            const itemIconGap = itemIcon
                ? this.#uww(itemAtlasLayout.BUTTON_ICON_GAP_UIWW)
                : 0;
            const countLabel = ' ×' + String(entry.count);
            const itemLabel = known ? item?.label || entry.itemId : '미확인';
            const label = this.#truncateText(
                itemLabel,
                this.fonts.BUTTON,
                inventoryColumnW
                    - this.#uww(1.2)
                    - itemIconWidth
                    - itemIconGap
                    - measureText(countLabel, this.fonts.BUTTON)
            ) + countLabel;
            this.#createButton('item-' + entry.itemId, {
                x: inventoryRect.x
                    + inventoryPad
                    + (column * (inventoryColumnW + inventoryGapX)),
                y: inventoryY + (row * (itemH + itemGapY)),
                w: inventoryColumnW,
                h: itemH,
                label,
                icon: itemIcon,
                itemSpacing: itemIconGap,
                enabled: usable,
                idleColor: colors.UI.CardHeader,
                hoverColor: colors.UI.ButtonHover,
                onClick: () => this.#queueUiCommand(COMMANDS.USE_ITEM, {
                    itemId: entry.itemId
                })
            });
        });

        if (paging.pageCount > 1) {
            const navH = clampNumber(headerH * 0.78, 26, 36);
            const navW = clampNumber(inventoryRect.w * 0.09, 28, 42);
            const navGap = this.#uww(0.35);
            const right = inventoryRect.x + inventoryRect.w - inventoryPad;
            this.#createButton('inventory-prev', {
                x: right - (navW * 2) - navGap,
                y: inventoryRect.y + ((headerH - navH) * 0.5),
                w: navW,
                h: navH,
                label: '◀',
                idleColor: colors.UI.CardHeader,
                hoverColor: colors.UI.ButtonHover,
                onClick: () => this.#changeInventoryPage(-1)
            });
            this.#createButton('inventory-next', {
                x: right - navW,
                y: inventoryRect.y + ((headerH - navH) * 0.5),
                w: navW,
                h: navH,
                label: '▶',
                idleColor: colors.UI.CardHeader,
                hoverColor: colors.UI.ButtonHover,
                onClick: () => this.#changeInventoryPage(1)
            });
        }
    }

    /**
     * 결과 화면 버튼을 구성합니다.
     * @private
     */
    #buildResultButtons() {
        const w = this.#uww(15);
        const h = this.#uwh(5.5);
        const centerX = this.UIOffsetX + (this.UIWW * 0.5);
        this.#createButton('result-undo', {
            x: centerX - (w * 1.5) - this.#uww(2),
            y: this.#uwh(72),
            w,
            h,
            label: this.data.TEXT.ACTIONS.UNDO + '  [Ctrl+Z]',
            enabled: this.#canUndo(),
            idleColor: ColorSchemes.Tactics.UI.Undo,
            hoverColor: ColorSchemes.Tactics.UI.UndoHover,
            textColor: ColorSchemes.Tactics.UI.OnPrimary,
            onClick: () => this.#queueUiCommand(COMMANDS.UNDO)
        });
        this.#createButton('result-retry', {
            x: centerX - (w * 0.5),
            y: this.#uwh(72),
            w,
            h,
            label: '다시 시작  [R]',
            enabled: !this.presentationLocked,
            onClick: () => this.#queueUiCommand(COMMANDS.RESTART)
        });
        this.#createButton('result-menu', {
            x: centerX + (w * 0.5) + this.#uww(2),
            y: this.#uwh(72),
            w,
            h,
            label: '메뉴  [Esc]',
            enabled: !this.presentationLocked,
            onClick: () => this.#queueUiCommand(COMMANDS.RETURN_MENU)
        });
    }

    /**
     * 컷씬 진행과 닫기 버튼을 구성합니다.
     * @private
     */
    #buildCutsceneButtons() {
        const state = this.cutscenes.getState();
        const modal = this.#getCutsceneRect();
        const h = this.#uwh(5);
        this.#createButton('cutscene-next', {
            x: modal.x + (modal.w * 0.61),
            y: modal.y + modal.h - h - this.#uwh(2.2),
            w: modal.w * 0.27,
            h,
            label: state.hasNextCard ? '다음  [Enter]' : '완료  [Enter]',
            enabled: !this.presentationLocked,
            onClick: () => this.#queueUiCommand(COMMANDS.CUTSCENE_NEXT)
        });
        this.#createButton('cutscene-close', {
            x: modal.x + (modal.w * 0.12),
            y: modal.y + modal.h - h - this.#uwh(2.2),
            w: modal.w * 0.2,
            h,
            label: '닫기  [Esc]',
            enabled: !this.presentationLocked,
            onClick: () => this.#queueUiCommand(COMMANDS.CUTSCENE_CLOSE)
        });
        if (this.#canUndo()) {
            this.#createButton('cutscene-undo', {
                x: modal.x + (modal.w * 0.36),
                y: modal.y + modal.h - h - this.#uwh(2.2),
                w: modal.w * 0.2,
                h,
                label: this.data.TEXT.ACTIONS.UNDO_SHORT,
                idleColor: ColorSchemes.Tactics.UI.Undo,
                hoverColor: ColorSchemes.Tactics.UI.UndoHover,
                textColor: ColorSchemes.Tactics.UI.OnPrimary,
                onClick: () => this.#queueUiCommand(COMMANDS.UNDO)
            });
        }
    }

    /**
     * 텍스트와 선택적 아이콘을 중앙 배치한 풀 기반 버튼을 만듭니다.
     * @param {string} key - 버튼 키입니다.
     * @param {object} options - 버튼 구성값입니다.
     * @private
     */
    #createButton(key, options) {
        const colors = ColorSchemes.Tactics;
        const enabled = options.enabled !== false;
        const textElement = UIPool.text_element.get();
        textElement.init({
            parent: this,
            layer: 'ui',
            text: options.label,
            font: this.data.TYPOGRAPHY.BUTTON.FAMILY,
            fontWeight: this.data.TYPOGRAPHY.BUTTON.WEIGHT,
            size: clampNumber(
                this.UIWW * (this.data.TYPOGRAPHY.BUTTON.SIZE_UIWW / 100),
                this.data.TYPOGRAPHY.BUTTON.MIN,
                this.data.TYPOGRAPHY.BUTTON.MAX
            ),
            color: enabled ? (options.textColor || colors.UI.Text) : colors.UI.Muted,
            align: 'center'
        });
        const button = UIPool.button.get();
        const centerItems = options.icon
            ? [options.icon, textElement]
            : [textElement];
        button.init({
            parent: this,
            layer: 'ui',
            x: options.x,
            y: options.y,
            width: options.w,
            height: options.h,
            center: centerItems,
            itemSpacing: options.itemSpacing,
            radius: options.radius ?? this.#uwh(
                this.data.LAYOUT.ACTIONS.BUTTON_RADIUS_WH
            ),
            shadow: options.shadow,
            idleColor: enabled
                ? (options.idleColor
                    || (options.active ? colors.UI.Accent : colors.UI.ButtonIdle))
                : colors.UI.ButtonDisabled,
            hoverColor: enabled
                ? (options.hoverColor || colors.UI.ButtonHover)
                : colors.UI.ButtonDisabled,
            color: colors.UI.Text,
            clickAble: enabled,
            onClick: options.onClick
        });
        button.clickAble = enabled;
        button.hoverScaleMultiplier = Number(
            this.data.ANIMATION.BUTTON_HOVER_SCALE
        ) || 1.035;
        button.pressScaleMultiplier = Number(
            this.data.ANIMATION.BUTTON_PRESS_SCALE
        ) || 0.965;
        this.buttons[key] = { item: button, text: textElement };
    }

    /**
     * 버튼 레이아웃이 그릴 수 있는 atlas 아이콘 자식을 생성합니다.
     * @param {string} itemId - 아이템 ID입니다.
     * @param {number} width - 버튼 안에서 차지할 아이콘 폭입니다.
     * @returns {object|null} 버튼용 아이콘 객체입니다.
     * @private
     */
    #createItemIconChild(itemId, width) {
        const image = this.itemIconCanvases.get(itemId);
        if (!image || !Number.isFinite(width) || width <= 0) {
            return null;
        }
        return {
            type: 'tutorial-item-atlas',
            width,
            draw: (layer, x, y, w, h, scale, alpha) => {
                render(layer, {
                    shape: 'image',
                    image,
                    x,
                    y,
                    w,
                    h,
                    alpha
                });
            }
        };
    }

    /**
     * 모든 풀 기반 버튼을 반납합니다.
     * @private
     */
    #releaseButtons() {
        for (const button of Object.values(this.buttons)) {
            releaseUIItem(button?.item);
        }
        this.buttons = {};
    }

    /**
     * 버튼 상호작용을 갱신합니다.
     * @private
     */
    #updateButtons() {
        for (const button of Object.values(this.buttons)) {
            button.item.update();
        }
    }

    /**
     * 버튼을 그립니다.
     * @private
     */
    #drawButtons() {
        for (const button of Object.values(this.buttons)) {
            button.item.draw();
        }
    }

    /**
     * 현재 인벤토리를 아이템 ID와 수량 배열로 반환합니다.
     * @returns {Array<{itemId:string,count:number}>} 인벤토리입니다.
     * @private
     */
    #getInventoryEntries() {
        if (!this.model) {
            return [];
        }
        if (this.model.inventory instanceof Map) {
            return Array.from(this.model.inventory.entries())
                .filter(([, count]) => Number(count) > 0)
                .map(([itemId, count]) => ({ itemId, count: Number(count) }));
        }
        return toList(this.#getSnapshot()?.inventory)
            .filter((entry) => Number(entry?.count) > 0)
            .map((entry) => ({
                itemId: entry.itemId,
                count: Number(entry.count)
            }));
    }

    /**
     * 현재 인벤토리 페이지와 표시 항목을 계산합니다.
     * @returns {{entries:Array<{itemId:string,count:number}>,page:number,pageCount:number}} 페이지 정보입니다.
     * @private
     */
    #getInventoryPaging() {
        const entries = this.#getInventoryEntries();
        const pageSize = Math.max(
            1,
            Number(this.data.LAYOUT.INVENTORY.PAGE_SIZE) || 6
        );
        const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
        const page = clampNumber(Math.floor(this.inventoryPage), 0, pageCount - 1);
        return {
            entries: entries.slice(page * pageSize, (page + 1) * pageSize),
            page,
            pageCount
        };
    }

    /**
     * 인벤토리 표시 페이지를 순환하고 클릭의 보드 전파를 막습니다.
     * @param {number} delta - 페이지 이동량입니다.
     * @private
     */
    #changeInventoryPage(delta) {
        const paging = this.#getInventoryPaging();
        if (paging.pageCount <= 1) {
            return;
        }
        this.uiActionHandled = true;
        consumeMouseState('left', 'clicked');
        this.inventoryPage = (
            paging.page + Math.sign(delta) + paging.pageCount
        ) % paging.pageCount;
        this.buttonSignature = '';
    }

    /**
     * 아이템을 현재 행동으로 사용할 수 있는지 확인합니다.
     * @param {string} itemId - 아이템 ID입니다.
     * @returns {boolean} 사용 가능 여부입니다.
     * @private
     */
    #isItemUsable(itemId) {
        const item = this.data.ITEMS[itemId];
        return Boolean(item && (item.consumable || item.useOnce));
    }

    /**
     * 아이템 이름이 반복 플레이에서 공개됐는지 확인합니다.
     * @param {string} itemId - 아이템 ID입니다.
     * @returns {boolean} 공개 여부입니다.
     * @private
     */
    #isItemKnown(itemId) {
        return KNOWN_STARTER_IDS.has(itemId)
            || this.meta.identifiedItemIds.includes(itemId);
    }

    /**
     * 화면, 보드 투영, HUD, 글꼴을 다시 계산합니다.
     * @private
     */
    #syncViewport() {
        this.WW = getWW();
        this.WH = getWH();
        this.UIWW = getUIWW();
        this.UIOffsetX = getUIOffsetX();
        this.fonts = Object.fromEntries(
            Object.entries(this.data.TYPOGRAPHY).map(([key, spec]) => (
                [key, createResponsiveFont(spec, this.UIWW)]
            ))
        );

        const boardLayout = this.data.LAYOUT.BOARD;
        const boardLeft = this.UIOffsetX + this.#uww(boardLayout.X_UIWW);
        const boardTop = this.#uwh(boardLayout.Y_WH);
        const boardW = this.#uww(boardLayout.MAX_WIDTH_UIWW);
        const boardH = this.#uwh(boardLayout.MAX_HEIGHT_WH);
        this.boardRect = {
            x: boardLeft,
            y: boardTop,
            w: boardW,
            h: boardH
        };
        const minBoardSide = Math.min(boardW, boardH);
        this.boardPadding = Math.min(
            Math.max(4, minBoardSide * boardLayout.FRAME_PADDING_RATIO),
            boardW * 0.08,
            boardH * 0.08
        );
        const gapRatio = Math.max(0, Number(boardLayout.TILE_GAP_RATIO) || 0);
        const mapWidth = this.data.MAP.WIDTH;
        const mapHeight = this.data.MAP.HEIGHT;
        const widthUnits = mapWidth + ((mapWidth - 1) * gapRatio);
        const heightUnits = mapHeight + ((mapHeight - 1) * gapRatio);
        this.tileSide = Math.max(1, Math.floor(Math.min(
            (boardW - (this.boardPadding * 2)) / widthUnits,
            (boardH - (this.boardPadding * 2)) / heightUnits
        )));
        this.tileGap = this.tileSide * gapRatio;
        this.tileStep = this.tileSide + this.tileGap;
        const gridW = (mapWidth * this.tileSide) + ((mapWidth - 1) * this.tileGap);
        const gridH = (mapHeight * this.tileSide) + ((mapHeight - 1) * this.tileGap);
        this.gridRect = {
            x: boardLeft + ((boardW - gridW) * 0.5),
            y: boardTop + ((boardH - gridH) * 0.5),
            w: gridW,
            h: gridH
        };

        this.hudRects = Object.fromEntries(
            Object.entries(this.data.LAYOUT.HUD).map(([key, layout]) => ([key, {
                x: this.UIOffsetX + this.#uww(layout.X_UIWW),
                y: this.#uwh(layout.Y_WH),
                w: this.#uww(layout.WIDTH_UIWW),
                h: this.#uwh(layout.HEIGHT_WH)
            }]))
        );
        this.buttonSignature = '';
        this.#ensureButtons();
    }

    /**
     * UI 기준 너비 백분율을 픽셀로 변환합니다.
     * @param {number} value - 백분율입니다.
     * @returns {number} 픽셀 값입니다.
     * @private
     */
    #uww(value) {
        return this.UIWW * (value / 100);
    }

    /**
     * 화면 높이 백분율을 픽셀로 변환합니다.
     * @param {number} value - 백분율입니다.
     * @returns {number} 픽셀 값입니다.
     * @private
     */
    #uwh(value) {
        return this.WH * (value / 100);
    }

    /**
     * 이름 있는 표현 속성 하나를 AnimationSystem 표준 애니메이션으로 갱신합니다.
     * @param {string} slot - 씬 내부 애니메이션 슬롯입니다.
     * @param {object} owner - 대상 객체입니다.
     * @param {string} variable - 대상 속성입니다.
     * @param {number} endValue - 목표 값입니다.
     * @param {number} duration - 지속 시간입니다.
     * @param {number|string} [startValue=current] - 시작 값입니다.
     * @returns {Promise<void>} 완료 Promise입니다.
     * @private
     */
    #animateSlot(slot, owner, variable, endValue, duration, startValue = 'current') {
        const previousId = this.animationSlots.get(slot);
        if (Number.isInteger(previousId) && previousId >= 0) {
            remove(previousId);
            this.ownedAnimationIds.delete(previousId);
        }
        const safeDuration = Math.max(0, Number(duration) || 0);
        if (safeDuration <= 0 || Number(owner?.[variable]) === Number(endValue)) {
            owner[variable] = endValue;
            this.animationSlots.delete(slot);
            return Promise.resolve();
        }
        const animation = animate(owner, {
            variable,
            startValue,
            endValue,
            duration: safeDuration,
            type: this.data.ANIMATION.EASING
        });
        this.animationSlots.set(slot, animation.id);
        this.ownedAnimationIds.add(animation.id);
        return animation.promise.then(() => {
            if (this.animationSlots.get(slot) === animation.id) {
                this.animationSlots.delete(slot);
            }
            this.ownedAnimationIds.delete(animation.id);
        });
    }

    /**
     * 씬이 생성한 모든 표준 애니메이션을 취소하고 표현 잠금을 풉니다.
     * @private
     */
    #clearOwnedAnimations() {
        for (const animationId of this.ownedAnimationIds) {
            remove(animationId);
        }
        this.ownedAnimationIds.clear();
        this.animationSlots.clear();
        this.presentationLocked = false;
    }

    /**
     * 호버, 경로, 공격 대상, 메뉴 선택의 진입 값을 easeOutExpo로 보간합니다.
     * @param {'hover'|'path'|'attack'|'menu-selection'} kind - 선택 연출 종류입니다.
     * @private
     */
    #startSelectionAnimation(kind) {
        const fields = {
            hover: 'hoverProgress',
            path: 'pathProgress',
            attack: 'attackProgress',
            'menu-selection': 'menuSelectionProgress'
        };
        const field = fields[kind];
        if (!field) {
            return;
        }
        this.presentation[field] = 0;
        void this.#animateSlot(
            'selection-' + kind,
            this.presentation,
            field,
            1,
            this.data.ANIMATION.SELECTION_SECONDS,
            0
        );
    }

    /**
     * 모델의 HP와 불안정도를 현재 표시값에서 부드럽게 보간합니다.
     * @returns {Promise<void>[]} 각 게이지 완료 Promise입니다.
     * @private
     */
    #animateHudToModel() {
        if (!this.model) {
            return [];
        }
        const duration = this.data.ANIMATION.GAUGE_SECONDS;
        return [
            this.#animateSlot(
                'hud-player-hp',
                this.presentation,
                'playerHp',
                Number(this.model.player?.hp) || 0,
                duration
            ),
            this.#animateSlot(
                'hud-lora-hp',
                this.presentation,
                'loraHp',
                Number(this.model.lora?.hp) || 0,
                duration
            ),
            this.#animateSlot(
                'hud-instability',
                this.presentation,
                'instability',
                Number(this.model.lora?.instability) || 0,
                duration
            )
        ];
    }

    /**
     * 이동 외 플레이어 행동 동안 짧은 충격 연출과 입력 잠금을 적용합니다.
     * @param {object} result - 모델 행동 결과입니다.
     * @param {number} [duration] - 재생 시간입니다.
     * @private
     */
    #startActionPresentation(result, duration = this.data.ANIMATION.ATTACK_SECONDS) {
        if (result?.ok !== true) {
            return;
        }
        const revision = this.timelineRevision;
        this.presentationLocked = true;
        this.presentation.actionPulse = 1;
        this.buttonSignature = '';
        void this.#animateSlot(
            'action-pulse',
            this.presentation,
            'actionPulse',
            0,
            duration,
            1
        ).then(() => {
            this.#finishPresentationLock(revision);
        });
    }

    /**
     * 모델이 반환한 실제 경로를 칸별로 재생하고 텔레포트 점프를 별도로 표현합니다.
     * @param {Array<{x:number,y:number}>} path - 실제 이동 경로입니다.
     * @param {Array<{from:object,to:object}>} [teleportSegments] - 텔레포트 구간입니다.
     * @private
     */
    #startPlayerPathPresentation(path, teleportSegments = []) {
        const route = this.#normalizePath(path);
        const revision = this.timelineRevision;
        this.presentationLocked = true;
        this.buttonSignature = '';
        if (route.length <= 1) {
            const stayScale = Number(this.data.ANIMATION.STAY_SCALE) || 0.86;
            this.presentation.playerScale = stayScale;
            void this.#animateSlot(
                'player-scale',
                this.presentation,
                'playerScale',
                1,
                this.data.ANIMATION.SELECTION_SECONDS,
                stayScale
            ).then(() => {
                this.#finishPresentationLock(revision);
            });
            return;
        }
        void this.#animatePlayerRoute(
            route,
            revision,
            this.data.ANIMATION.MOVE_SECONDS_PER_TILE,
            teleportSegments
        ).then(() => {
            if (revision === this.timelineRevision && this.model) {
                this.presentation.playerX = Number(this.model.player?.x) || 0;
                this.presentation.playerY = Number(this.model.player?.y) || 0;
                this.presentation.playerAlpha = 1;
                this.presentation.playerScale = 1;
                const logicalFloorIndex = Number(this.model.floorIndex) || 0;
                if (Number(this.floorView?.index) === logicalFloorIndex) {
                    this.presentation.floorIndex = logicalFloorIndex;
                }
            }
            this.#finishPresentationLock(revision);
        });
    }

    /**
     * 좌표 경로를 순차 보간하며 맨해튼 인접이 아닌 단계는 텔레포트로 처리합니다.
     * @param {Array<{x:number,y:number}>} route - 재생할 좌표 목록입니다.
     * @param {number} revision - 시작 시점 타임라인 버전입니다.
     * @param {number} secondsPerTile - 인접 타일당 시간입니다.
     * @param {Array<{from:object,to:object}>} [teleportSegments] - 강제 텔레포트 구간입니다.
     * @returns {Promise<void>} 재생 완료 Promise입니다.
     * @private
     */
    async #animatePlayerRoute(route, revision, secondsPerTile, teleportSegments = []) {
        for (const tile of route) {
            if (revision !== this.timelineRevision || !tile) {
                return;
            }
            const dx = Number(tile.x) - Number(this.presentation.playerX);
            const dy = Number(tile.y) - Number(this.presentation.playerY);
            if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
                continue;
            }
            const isAdjacent = Math.abs(dx) + Math.abs(dy) <= 1.001;
            const isTeleport = this.#isTeleportTransition(
                this.presentation,
                tile,
                teleportSegments
            );
            if (!isAdjacent || isTeleport) {
                await this.#animateTeleportTo(tile, revision);
                continue;
            }
            await Promise.all([
                this.#animateSlot(
                    'player-x',
                    this.presentation,
                    'playerX',
                    tile.x,
                    secondsPerTile
                ),
                this.#animateSlot(
                    'player-y',
                    this.presentation,
                    'playerY',
                    tile.y,
                    secondsPerTile
                )
            ]);
        }
    }

    /**
     * 플레이어를 축소·페이드한 뒤 새 타일로 옮기고 다시 나타냅니다.
     * @param {{x:number,y:number}} tile - 도착 타일입니다.
     * @param {number} revision - 시작 시점 타임라인 버전입니다.
     * @returns {Promise<void>} 완료 Promise입니다.
     * @private
     */
    async #animateTeleportTo(tile, revision) {
        if (!tile) {
            return;
        }
        await Promise.all([
            this.#animateSlot(
                'player-alpha',
                this.presentation,
                'playerAlpha',
                0,
                this.data.ANIMATION.TELEPORT_OUT_SECONDS
            ),
            this.#animateSlot(
                'player-scale',
                this.presentation,
                'playerScale',
                this.data.ANIMATION.TELEPORT_MIN_SCALE,
                this.data.ANIMATION.TELEPORT_OUT_SECONDS
            )
        ]);
        if (revision !== this.timelineRevision) {
            return;
        }
        this.presentation.playerX = tile.x;
        this.presentation.playerY = tile.y;
        await Promise.all([
            this.#animateSlot(
                'player-alpha',
                this.presentation,
                'playerAlpha',
                1,
                this.data.ANIMATION.TELEPORT_IN_SECONDS,
                0
            ),
            this.#animateSlot(
                'player-scale',
                this.presentation,
                'playerScale',
                1,
                this.data.ANIMATION.TELEPORT_IN_SECONDS,
                this.data.ANIMATION.TELEPORT_MIN_SCALE
            )
        ]);
    }

    /**
     * 현재 층을 유지한 채 플레이어를 숨기고, 완전히 사라진 뒤 목표 층 스냅샷으로 교체합니다.
     * @param {{x:number,y:number}} tile - 목표 층의 플레이어 타일입니다.
     * @param {number} floorIndex - 목표 층 인덱스입니다.
     * @param {object} floorView - 목표 층 표현 스냅샷입니다.
     * @param {object} floorActorView - 목표 층 인물 표현 스냅샷입니다.
     * @param {number} revision - 시작 시점 타임라인 버전입니다.
     * @returns {Promise<void>} 완료 Promise입니다.
     * @private
     */
    async #animateFloorSwapTo(tile, floorIndex, floorView, floorActorView, revision) {
        if (!tile) {
            return;
        }
        await Promise.all([
            this.#animateSlot(
                'player-alpha',
                this.presentation,
                'playerAlpha',
                0,
                this.data.ANIMATION.UNDO_FADE_SECONDS
            ),
            this.#animateSlot(
                'player-scale',
                this.presentation,
                'playerScale',
                this.data.ANIMATION.TELEPORT_MIN_SCALE,
                this.data.ANIMATION.UNDO_FADE_SECONDS
            )
        ]);
        if (revision !== this.timelineRevision) {
            return;
        }
        this.floorView = cloneCheckpointValue(floorView);
        this.floorActorView = cloneCheckpointValue(floorActorView);
        this.presentation.floorIndex = floorIndex;
        this.presentation.playerX = tile.x;
        this.presentation.playerY = tile.y;
        await Promise.all([
            this.#animateSlot(
                'player-alpha',
                this.presentation,
                'playerAlpha',
                1,
                this.data.ANIMATION.TELEPORT_IN_SECONDS,
                0
            ),
            this.#animateSlot(
                'player-scale',
                this.presentation,
                'playerScale',
                1,
                this.data.ANIMATION.TELEPORT_IN_SECONDS,
                this.data.ANIMATION.TELEPORT_MIN_SCALE
            )
        ]);
    }

    /**
     * 자동 층 전환 시 플레이어를 페이드한 뒤 새 층 시작 좌표에 배치합니다.
     * @private
     */
    #startFloorTransitionPresentation() {
        if (!this.model) {
            return;
        }
        const revision = this.timelineRevision;
        const target = cloneTile(this.model.player);
        const targetFloorIndex = Number(this.model.floorIndex) || 0;
        const targetFloorView = this.model.getCurrentFloorState();
        const targetFloorActorView = this.#captureFloorActorView();
        this.presentationLocked = true;
        this.buttonSignature = '';
        void this.#animateFloorSwapTo(
            target,
            targetFloorIndex,
            targetFloorView,
            targetFloorActorView,
            revision
        ).then(() => {
            this.#finishPresentationLock(revision);
        });
    }

    /**
     * Undo 대상 경로를 역재생하고 게이지를 복원값까지 보간합니다.
     * @param {object} entry - Undo 기록 항목입니다.
     * @param {object} targetPresentation - 체크포인트 표현 상태입니다.
     * @param {number} previousFloorIndex - Undo 직전 층입니다.
     * @param {object} targetFloorView - 복원할 층 표현 스냅샷입니다.
     * @param {object} targetFloorActorView - 복원할 인물 표현 스냅샷입니다.
     * @private
     */
    #startUndoPresentation(
        entry,
        targetPresentation,
        previousFloorIndex,
        targetFloorView,
        targetFloorActorView
    ) {
        const revision = this.timelineRevision;
        const targetFloorIndex = Number(this.model?.floorIndex) || 0;
        this.presentationLocked = true;
        this.buttonSignature = '';
        const gaugePromises = this.#animateHudToModel();
        let playerPromise;
        if (previousFloorIndex !== targetFloorIndex) {
            const playerTarget = cloneTile(this.model.player);
            playerPromise = this.#animateFloorSwapTo(
                playerTarget,
                targetFloorIndex,
                targetFloorView,
                targetFloorActorView,
                revision
            );
        } else {
            this.presentation.playerAlpha = 1;
            this.presentation.playerScale = 1;
            const reversePath = this.#buildUndoRoute(entry.resultPath);
            playerPromise = this.#animatePlayerRoute(
                reversePath,
                revision,
                this.data.ANIMATION.UNDO_SECONDS_PER_TILE,
                entry.teleportSegments
            );
        }
        void Promise.all([...gaugePromises, playerPromise]).then(() => {
            if (revision !== this.timelineRevision) {
                return;
            }
            this.floorView = cloneCheckpointValue(targetFloorView);
            this.floorActorView = cloneCheckpointValue(targetFloorActorView);
            this.presentation = {
                ...this.presentation,
                ...cloneCheckpointValue(targetPresentation),
                floorIndex: targetFloorIndex,
                playerX: Number(this.model.player?.x) || 0,
                playerY: Number(this.model.player?.y) || 0,
                playerAlpha: 1,
                playerScale: 1,
                playerHp: Number(this.model.player?.hp) || 0,
                loraHp: Number(this.model.lora?.hp) || 0,
                instability: Number(this.model.lora?.instability) || 0
            };
            this.#startSelectionAnimation(this.attackSelected ? 'attack' : 'path');
            this.#finishPresentationLock(revision);
        });
    }

    /**
     * 현재 표시 위치에서 가장 가까운 실제 이동 경로 지점부터 역방향 경로를 만듭니다.
     * @param {*} path - 성공 결과에 기록된 실제 경로입니다.
     * @returns {Array<{x:number,y:number}>} Undo 재생 경로입니다.
     * @private
     */
    #buildUndoRoute(path) {
        const reversePath = this.#normalizePath(path).reverse();
        const target = cloneTile(this.model?.player);
        if (reversePath.length === 0) {
            return target ? [target] : [];
        }
        let closestIndex = 0;
        let closestDistance = Number.POSITIVE_INFINITY;
        reversePath.forEach((tile, index) => {
            const dx = tile.x - Number(this.presentation.playerX);
            const dy = tile.y - Number(this.presentation.playerY);
            const distance = (dx * dx) + (dy * dy);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        });
        const route = reversePath.slice(closestIndex);
        if (target && !route.some((tile) => tile.x === target.x && tile.y === target.y)) {
            route.push(target);
        }
        return route;
    }

    /**
     * 현재 표시 좌표와 다음 타일이 기록된 텔레포트 구간인지 양방향으로 확인합니다.
     * @param {object} from - 현재 표시 좌표를 가진 객체입니다.
     * @param {{x:number,y:number}} to - 다음 타일입니다.
     * @param {Array<{from:object,to:object}>} segments - 텔레포트 구간입니다.
     * @returns {boolean} 텔레포트 전환 여부입니다.
     * @private
     */
    #isTeleportTransition(from, to, segments) {
        const fromX = Number(from?.playerX ?? from?.x);
        const fromY = Number(from?.playerY ?? from?.y);
        return toList(segments).some((segment) => {
            const forward = segment?.from?.x === fromX
                && segment?.from?.y === fromY
                && segment?.to?.x === to.x
                && segment?.to?.y === to.y;
            const backward = segment?.to?.x === fromX
                && segment?.to?.y === fromY
                && segment?.from?.x === to.x
                && segment?.from?.y === to.y;
            return forward || backward;
        });
    }

    /**
     * 시작 타임라인이 여전히 유효할 때만 표현 입력 잠금을 해제합니다.
     * @param {number} revision - 애니메이션 시작 타임라인 버전입니다.
     * @private
     */
    #finishPresentationLock(revision) {
        if (this.destroyed || revision !== this.timelineRevision) {
            return;
        }
        this.presentationLocked = false;
        this.buttonSignature = '';
    }

    /**
     * 현재 보드 화면 흔들림 오프셋을 반환합니다.
     * @returns {{x:number,y:number}} 흔들림 오프셋입니다.
     * @private
     */
    #getBoardShake() {
        if (this.screenShakeSeconds <= 0) {
            return { x: 0, y: 0 };
        }
        const ratio = Number(this.data.ANIMATION.SHAKE_TILE_RATIO) || 0.055;
        return {
            x: Math.sin(this.elapsedSeconds * 74) * this.tileSide * ratio,
            y: Math.cos(this.elapsedSeconds * 61) * this.tileSide * ratio
        };
    }

    /**
     * 타일 좌표를 축 정렬 정사각형 탑뷰 화면 좌표로 변환합니다.
     * @param {number} x - 타일 X입니다.
     * @param {number} y - 타일 Y입니다.
     * @returns {{x:number,y:number,height:number}} 화면 좌표입니다.
     * @private
     */
    #projectTile(x, y) {
        const height = Number(this.#getCurrentFloor()?.heights?.[y]?.[x])
            || 0;
        const shake = this.#getBoardShake();
        return {
            x: this.gridRect.x + (this.tileSide * 0.5) + (x * this.tileStep)
                + shake.x,
            y: this.gridRect.y + (this.tileSide * 0.5) + (y * this.tileStep)
                + shake.y,
            height
        };
    }

    /**
     * 포인터 좌표를 축 정렬 탑뷰 타일로 역변환합니다.
     * @param {number} px - 화면 X입니다.
     * @param {number} py - 화면 Y입니다.
     * @returns {{x:number,y:number}|null} 타일 좌표입니다.
     * @private
     */
    #hitTestTile(px, py) {
        if (!Number.isFinite(px) || !Number.isFinite(py)) {
            return null;
        }
        const shake = this.#getBoardShake();
        const localX = px - shake.x - this.gridRect.x;
        const localY = py - shake.y - this.gridRect.y;
        if (localX < 0 || localY < 0) {
            return null;
        }
        const x = Math.floor(localX / this.tileStep);
        const y = Math.floor(localY / this.tileStep);
        if (x < 0
            || y < 0
            || x >= this.data.MAP.WIDTH
            || y >= this.data.MAP.HEIGHT) {
            return null;
        }
        const cellX = localX - (x * this.tileStep);
        const cellY = localY - (y * this.tileStep);
        if (cellX > this.tileSide || cellY > this.tileSide) {
            return null;
        }
        return { x, y };
    }

    /**
     * 현재 층 상태를 얻습니다.
     * @returns {object|null} 층 상태입니다.
     * @private
     */
    #getCurrentFloor() {
        if (!this.model) {
            return null;
        }
        if (this.floorView) {
            return this.floorView;
        }
        const floorIndex = Number(this.presentation.floorIndex) || 0;
        return this.model.floorStates?.[floorIndex] || null;
    }

    /**
     * 공통 전체 화면 배경을 그립니다.
     * @private
     */
    #drawBackdrop() {
        renderGL('background', {
            shape: 'rect',
            x: this.WW * 0.5,
            y: this.WH * 0.5,
            w: this.WW,
            h: this.WH,
            fill: ColorSchemes.Tactics.Backdrop
        });
    }

    /**
     * 메타 로딩 화면을 그립니다.
     * @private
     */
    #drawLoading() {
        const colors = ColorSchemes.Tactics;
        const x = this.UIOffsetX + (this.UIWW * 0.5);
        this.#drawText('ui', '진행도 불러오는 중…', x, this.WH * 0.5, this.fonts.HEADING, colors.UI.Text, 'center');
    }

    /**
     * 메인 메뉴를 그립니다.
     * @private
     */
    #drawMenu() {
        const colors = ColorSchemes.Tactics;
        const centerX = this.UIOffsetX + (this.UIWW * 0.5);
        this.#drawText('ui', this.data.TEXT.TITLE, centerX, this.#uwh(24), this.fonts.TITLE, colors.UI.Text, 'center');
        this.#drawText('ui', this.data.TEXT.SUBTITLE, centerX, this.#uwh(31), this.fonts.SUBTITLE, colors.UI.Muted, 'center');
        renderGL('background', {
            shape: 'rect',
            x: centerX,
            y: this.#uwh(44),
            w: this.#uww(38),
            h: this.#uwh(12),
            fill: colors.UI.Panel,
            alpha: 0.9
        });
        this.#drawText(
            'ui',
            '플레이 ' + String(this.meta.playCount) + '회  ·  최고 점수 ' + String(this.meta.bestScore),
            centerX,
            this.#uwh(41.5),
            this.fonts.BODY,
            colors.UI.Text,
            'center'
        );
        this.#drawText(
            'ui',
            '해금 컷씬 ' + String(this.meta.unlockedCutsceneIds.length)
                + ' / ' + String(this.galleryEntries.length),
            centerX,
            this.#uwh(47),
            this.fonts.SMALL,
            colors.UI.Muted,
            'center'
        );
        this.#drawText('ui', 'Enter 시작 · G 갤러리', centerX, this.#uwh(82), this.fonts.SMALL, colors.UI.Muted, 'center');
    }

    /**
     * 스타터 선택 화면을 그립니다.
     * @private
     */
    #drawStarterSelect() {
        const colors = ColorSchemes.Tactics;
        const centerX = this.UIOffsetX + (this.UIWW * 0.5);
        this.#drawText('ui', '출발 장비 선택', centerX, this.#uwh(18), this.fonts.TITLE, colors.UI.Text, 'center');
        this.#drawText(
            'ui',
            '이동과 행동은 독립적입니다. 이번 플레이의 첫 선택을 고르세요.',
            centerX,
            this.#uwh(25),
            this.fonts.BODY,
            colors.UI.Muted,
            'center'
        );
        const w = this.#uww(27);
        const gap = this.#uww(3);
        const startX = this.UIOffsetX + ((this.UIWW - ((w * 2) + gap)) * 0.5);
        this.data.STARTER_CHOICES.forEach((choice, index) => {
            const x = startX + (index * (w + gap));
            const selected = index === this.starterIndex;
            const minScale = Number(this.data.ANIMATION.SELECTION_MIN_SCALE) || 0.72;
            const selectedScale = selected
                ? minScale + ((1 - minScale) * this.presentation.menuSelectionProgress)
                : 1;
            renderGL('background', {
                shape: 'rect',
                x: x + (w * 0.5),
                y: this.#uwh(42),
                w: w * selectedScale,
                h: this.#uwh(22) * selectedScale,
                fill: selected ? colors.UI.PanelStrong : colors.UI.Panel,
                alpha: 0.95
            });
            this.#drawText('ui', choice.label, x + (w * 0.5), this.#uwh(36), this.fonts.HEADING, colors.UI.Text, 'center');
            const lines = this.#wrapText(choice.description, this.fonts.SMALL, w * 0.8, 3);
            lines.forEach((line, lineIndex) => {
                this.#drawText(
                    'ui',
                    line,
                    x + (w * 0.5),
                    this.#uwh(42) + (lineIndex * this.#uwh(2.7)),
                    this.fonts.SMALL,
                    colors.UI.Muted,
                    'center'
                );
            });
        });
        this.#drawText('ui', '방향키/WASD 선택 · Enter 확정', centerX, this.#uwh(73), this.fonts.SMALL, colors.UI.Muted, 'center');
    }

    /**
     * 컷씬 갤러리를 잠금 상태와 함께 그립니다.
     * @private
     */
    #drawGallery() {
        const colors = ColorSchemes.Tactics;
        const centerX = this.UIOffsetX + (this.UIWW * 0.5);
        this.#drawText('ui', '컷씬 갤러리', centerX, this.#uwh(12), this.fonts.TITLE, colors.UI.Text, 'center');
        const listX = this.UIOffsetX + this.#uww(12);
        const listY = this.#uwh(23);
        const rowH = this.#uwh(5.7);
        this.galleryEntries.forEach((entry, index) => {
            const unlocked = this.#isCutsceneUnlocked(entry.id);
            const selected = index === this.galleryIndex;
            const minScale = Number(this.data.ANIMATION.SELECTION_MIN_SCALE) || 0.72;
            const selectedScale = selected
                ? minScale + ((1 - minScale) * this.presentation.menuSelectionProgress)
                : 1;
            renderGL('background', {
                shape: 'rect',
                x: listX + this.#uww(17),
                y: listY + (index * rowH),
                w: this.#uww(34) * selectedScale,
                h: rowH * 0.82 * selectedScale,
                fill: selected ? colors.UI.PanelStrong : colors.UI.Panel,
                alpha: selected ? 1 : 0.72
            });
            this.#drawText(
                'ui',
                (unlocked ? '◆ ' : '◇ ') + (unlocked ? entry.title : '잠긴 기록'),
                listX + this.#uww(1.2),
                listY + (index * rowH),
                this.fonts.BODY,
                unlocked ? colors.UI.Text : colors.UI.Muted
            );
        });
        const entry = this.galleryEntries[this.galleryIndex];
        const unlocked = entry && this.#isCutsceneUnlocked(entry.id);
        const cardX = this.UIOffsetX + this.#uww(55);
        renderGL('background', {
            shape: 'rect',
            x: cardX + this.#uww(16),
            y: this.#uwh(44),
            w: this.#uww(32),
            h: this.#uwh(38),
            fill: colors.UI.Panel,
            alpha: 0.96
        });
        this.#drawText(
            'ui',
            unlocked ? entry.title : '잠긴 컷씬',
            cardX + this.#uww(16),
            this.#uwh(34),
            this.fonts.HEADING,
            unlocked ? colors.UI.Text : colors.UI.Muted,
            'center'
        );
        this.#drawText(
            'ui',
            unlocked
                ? String(entry.cards.length) + '장 · Enter로 재생'
                : '플레이 중 조건을 달성하고 마지막 카드까지 확인하세요.',
            cardX + this.#uww(16),
            this.#uwh(46),
            this.fonts.BODY,
            colors.UI.Muted,
            'center'
        );
        this.#drawText(
            'ui',
            String(this.galleryIndex + 1) + ' / ' + String(this.galleryEntries.length),
            centerX,
            this.#uwh(70),
            this.fonts.MONO,
            colors.UI.Muted,
            'center'
        );
    }

    /**
     * 정사각형 탑뷰 보드와 전투 HUD를 그립니다.
     * @private
     */
    #drawBattle() {
        if (!this.model) {
            return;
        }
        const colors = ColorSchemes.Tactics;
        renderGL('background', {
            shape: 'rect',
            x: this.boardRect.x + (this.boardRect.w * 0.5),
            y: this.boardRect.y + (this.boardRect.h * 0.5),
            w: this.boardRect.w,
            h: this.boardRect.h,
            fill: colors.BoardFrame,
            alpha: 0.9
        });
        this.#drawTopDownBoard();
        this.#drawWorldObjects();
        this.#drawWorldEffects();
        this.#drawBattleHud();
    }

    /**
     * 층별 색, 이동 범위, 경로, 공격 표식을 그립니다.
     * @private
     */
    #drawTopDownBoard() {
        const colors = ColorSchemes.Tactics;
        const floorIndex = Number(this.presentation.floorIndex) || 0;
        const baseFill = floorIndex === 0 ? colors.Tile.Low : colors.Tile.High2;
        for (let y = 0; y < this.data.MAP.HEIGHT; y++) {
            for (let x = 0; x < this.data.MAP.WIDTH; x++) {
                const point = this.#projectTile(x, y);
                const alternate = (x + y) % 2 === 0;
                renderGL('background', {
                    shape: 'rect',
                    x: point.x,
                    y: point.y,
                    w: this.tileSide,
                    h: this.tileSide,
                    fill: floorIndex === 0
                        ? (alternate ? baseFill : colors.Tile.High1)
                        : (alternate ? baseFill : colors.Tile.Side2),
                    alpha: 0.96
                });
                renderGL('background', {
                    shape: 'rect',
                    x: point.x,
                    y: point.y,
                    w: this.tileSide * 0.92,
                    h: this.tileSide * 0.92,
                    fill: baseFill,
                    alpha: 0.9
                });
            }
        }

        if (floorIndex !== (Number(this.model.floorIndex) || 0)) {
            return;
        }

        if (this.model.turn === 'player' && !this.model.movementUsed) {
            for (const tile of this.reachability.values()) {
                const point = this.#projectTile(tile.x, tile.y);
                renderGL('background', {
                    shape: 'rect',
                    x: point.x,
                    y: point.y,
                    w: this.tileSide * 0.76,
                    h: this.tileSide * 0.76,
                    fill: colors.Tile.Reachable,
                    alpha: 0.52
                });
            }
        }
        if (this.attackSelected) {
            this.actionTargets.forEach((target, index) => {
                const point = this.#projectTile(target.x, target.y);
                const selected = index === this.targetIndex;
                const minScale = Number(this.data.ANIMATION.SELECTION_MIN_SCALE) || 0.72;
                const scale = selected
                    ? minScale + ((1 - minScale) * this.presentation.attackProgress)
                    : 0.82;
                renderGL('background', {
                    shape: 'rect',
                    x: point.x,
                    y: point.y,
                    w: this.tileSide * scale,
                    h: this.tileSide * scale,
                    fill: colors.Tile.Attack,
                    alpha: selected
                        ? 0.36 + (0.3 * this.presentation.attackProgress)
                        : 0.42
                });
            });
        }
        if (this.hoveredTile) {
            const point = this.#projectTile(this.hoveredTile.x, this.hoveredTile.y);
            const minScale = Number(this.data.ANIMATION.SELECTION_MIN_SCALE) || 0.72;
            const scale = minScale
                + ((0.88 - minScale) * this.presentation.hoverProgress);
            renderGL('background', {
                shape: 'rect',
                x: point.x,
                y: point.y,
                w: this.tileSide * scale,
                h: this.tileSide * scale,
                fill: colors.Tile.Hover,
                alpha: 0.24 + (0.34 * this.presentation.hoverProgress)
            });
        }
        this.plannedPath.slice(1).forEach((tile, index) => {
            const point = this.#projectTile(tile.x, tile.y);
            renderGL('object', {
                shape: 'circle',
                x: point.x,
                y: point.y,
                w: this.tileSide * this.data.LAYOUT.BOARD.PATH_MARKER_RATIO
                    * (0.72 + (0.28 * this.presentation.pathProgress)),
                h: this.tileSide * this.data.LAYOUT.BOARD.PATH_MARKER_RATIO
                    * (0.72 + (0.28 * this.presentation.pathProgress)),
                fill: colors.Tile.Path
            });
            this.#drawText(
                'texteffect',
                String(index + 1),
                point.x,
                point.y,
                this.fonts.SMALL,
                colors.UI.Text,
                'center'
            );
        });
    }

    /**
     * 층의 오브젝트와 두 인물을 깊이 순서로 그립니다.
     * @private
     */
    #drawWorldObjects() {
        const floor = this.#getCurrentFloor();
        if (!floor) {
            return;
        }
        const actorView = this.floorActorView;
        const presentationMatchesModel = Number(this.presentation.floorIndex) === (
            Number(this.model.floorIndex) || 0
        );
        const lora = actorView?.lora
            || (presentationMatchesModel ? this.model.lora : null);
        const player = actorView?.player
            || (presentationMatchesModel ? this.model.player : null);
        const entries = [];
        for (const wall of toList(floor.walls)) {
            if (!wall.destroyed) {
                entries.push({ type: 'wall', value: wall });
            }
        }
        for (const item of toList(floor.items)) {
            if (!item.collected
                && (!item.hidden || item.identified || item.nearbyHint)) {
                entries.push({ type: 'item', value: item });
            }
        }
        for (const trap of toList(floor.traps)) {
            if (trap.revealed
                || trap.triggered
                || this.meta.discoveredTrapIds.includes(trap.id)) {
                entries.push({ type: 'trap', value: trap });
            }
        }
        for (const teleport of toList(floor.teleports)) {
            if (!teleport.used) {
                entries.push({ type: 'teleport', value: teleport });
            }
        }
        for (const mob of toList(floor.mobs)) {
            if (mob.alive !== false && Number(mob.hp) > 0) {
                entries.push({ type: 'mob', value: mob });
            }
        }
        if (floor.gate) {
            entries.push({ type: 'gate', value: floor.gate });
        }
        if (lora) {
            entries.push({ type: 'lora', value: lora });
        }
        if (player) {
            entries.push({ type: 'player', value: player });
        }
        entries.sort((left, right) => (
            Number(left.value.y) - Number(right.value.y)
            || Number(left.value.x) - Number(right.value.x)
        ));
        for (const entry of entries) {
            if (entry.type === 'wall') this.#drawWall(entry.value);
            else if (entry.type === 'item') this.#drawWorldItem(entry.value);
            else if (entry.type === 'trap') this.#drawTrap(entry.value);
            else if (entry.type === 'teleport') this.#drawTeleport(entry.value);
            else if (entry.type === 'mob') this.#drawMob(entry.value);
            else if (entry.type === 'gate') this.#drawGate(entry.value);
            else if (entry.type === 'lora') this.#drawLora(entry.value);
            else this.#drawPlayer(entry.value);
        }
    }

    /**
     * 파괴 가능한 벽을 그립니다.
     * @param {object} wall - 벽 상태입니다.
     * @private
     */
    #drawWall(wall) {
        const colors = ColorSchemes.Tactics;
        const point = this.#projectTile(wall.x, wall.y);
        const size = this.tileSide * 0.58;
        renderGL('object', {
            shape: 'rect',
            x: point.x,
            y: point.y,
            w: size,
            h: size,
            fill: colors.Entity.Wall
        });
        renderGL('object', {
            shape: 'rect',
            x: point.x,
            y: point.y,
            w: size * 0.88,
            h: size * 0.14,
            fill: colors.Tile.Wall
        });
        this.#drawWorldGlyph('벽', point.x, point.y, colors.UI.Text);
    }

    /**
     * 월드 아이템과 공개 상태에 따른 글리프를 그립니다.
     * @param {object} entry - 아이템 배치 상태입니다.
     * @private
     */
    #drawWorldItem(entry) {
        const colors = ColorSchemes.Tactics;
        const point = this.#projectTile(entry.x, entry.y);
        const known = this.#isItemKnown(entry.itemId) || entry.identified === true;
        const glyph = known ? this.#getItemGlyph(entry.itemId) : '?';
        const itemAtlasLayout = this.data.SPRITES.ITEM_ATLAS;
        const icon = known ? this.itemIconCanvases.get(entry.itemId) : null;
        renderGL('object', {
            shape: 'circle',
            x: point.x,
            y: point.y,
            w: this.tileSide * itemAtlasLayout.WORLD_HALO_SIZE_TILE_RATIO,
            h: this.tileSide * itemAtlasLayout.WORLD_HALO_SIZE_TILE_RATIO,
            fill: colors.Entity.Item
        });
        if (icon) {
            const iconSize = this.tileSide * itemAtlasLayout.WORLD_ICON_SIZE_TILE_RATIO;
            render('texteffect', {
                shape: 'image',
                image: icon,
                x: point.x - (iconSize * 0.5),
                y: point.y - (iconSize * 0.5),
                w: iconSize,
                h: iconSize
            });
            return;
        }
        renderGL('object', {
            shape: 'rect',
            x: point.x,
            y: point.y,
            w: this.tileSide * 0.28,
            h: this.tileSide * 0.28,
            fill: colors.Tile.Item
        });
        this.#drawWorldGlyph(glyph, point.x, point.y, colors.UI.Text);
    }

    /**
     * 발견된 함정을 그립니다.
     * @param {object} trap - 함정 상태입니다.
     * @private
     */
    #drawTrap(trap) {
        const colors = ColorSchemes.Tactics;
        const point = this.#projectTile(trap.x, trap.y);
        renderGL('object', {
            shape: 'rect',
            x: point.x,
            y: point.y,
            w: this.tileSide * 0.52,
            h: this.tileSide * 0.52,
            fill: colors.Tile.Trap,
            alpha: trap.triggered ? 0.38 : 0.78
        });
        this.#drawWorldGlyph('!', point.x, point.y, colors.UI.Text);
    }

    /**
     * 층 이동 텔레포트를 그립니다.
     * @param {object} teleport - 텔레포트 상태입니다.
     * @private
     */
    #drawTeleport(teleport) {
        const colors = ColorSchemes.Tactics;
        const point = this.#projectTile(teleport.x, teleport.y);
        const pulse = 0.88 + (Math.sin(this.elapsedSeconds * 4) * 0.1);
        renderGL('object', {
            shape: 'circle',
            x: point.x,
            y: point.y,
            w: this.tileSide * 0.6 * pulse,
            h: this.tileSide * 0.6 * pulse,
            fill: colors.Entity.Teleport,
            alpha: teleport.used ? 0.32 : 0.68
        });
        renderGL('object', {
            shape: 'circle',
            x: point.x,
            y: point.y,
            w: this.tileSide * 0.34,
            h: this.tileSide * 0.34,
            fill: colors.Tile.Teleport
        });
        this.#drawWorldGlyph('전', point.x, point.y, colors.UI.Text);
    }

    /**
     * 일반 몹을 그립니다.
     * @param {object} mob - 몹 상태입니다.
     * @private
     */
    #drawMob(mob) {
        const colors = ColorSchemes.Tactics;
        const point = this.#projectTile(mob.x, mob.y);
        const size = this.tileSide * 0.5;
        this.#drawShadow(point.x, point.y, size);
        renderGL('object', {
            shape: 'circle',
            x: point.x,
            y: point.y,
            w: size,
            h: size,
            fill: colors.Entity.MobDark
        });
        renderGL('object', {
            shape: 'circle',
            x: point.x,
            y: point.y,
            w: size * 0.78,
            h: size * 0.78,
            fill: colors.Entity.Mob
        });
        this.#drawWorldGlyph('M', point.x, point.y, colors.UI.Text);
        this.#drawWorldHp(point.x, point.y - (size * 0.62), mob.hp, mob.maxHp || 50, size);
    }

    /**
     * 지하 게이트를 그립니다.
     * @param {object} gate - 게이트 좌표입니다.
     * @private
     */
    #drawGate(gate) {
        const colors = ColorSchemes.Tactics;
        const point = this.#projectTile(gate.x, gate.y);
        const presentationMatchesModel = Number(this.presentation.floorIndex) === (
            Number(this.model.floorIndex) || 0
        );
        const open = this.floorActorView
            ? this.floorActorView.gateOpen === true
            : (presentationMatchesModel && this.model.gateOpen === true);
        const size = this.tileSide * 0.72;
        renderGL('object', {
            shape: 'rect',
            x: point.x,
            y: point.y,
            w: size,
            h: size,
            fill: open ? colors.UI.Success : colors.Entity.Wall,
            alpha: open ? 0.58 : 1
        });
        renderGL('object', {
            shape: 'rect',
            x: point.x,
            y: point.y,
            w: size * 0.5,
            h: size * 0.8,
            fill: colors.Tile.Gate
        });
        this.#drawWorldGlyph(open ? '열' : '문', point.x, point.y, colors.UI.Text);
    }

    /**
     * 플레이어 말을 그립니다.
     * @param {object} player - 플레이어 상태입니다.
     * @private
     */
    #drawPlayer(player) {
        const colors = ColorSchemes.Tactics;
        const point = this.#projectTile(
            this.presentation.playerX,
            this.presentation.playerY
        );
        const alpha = clampNumber(this.presentation.playerAlpha, 0, 1);
        const size = this.tileSide * 0.56
            * this.presentation.playerScale
            * (1 + (this.presentation.actionPulse
                * this.data.ANIMATION.ACTION_PLAYER_SCALE));
        this.#drawShadow(point.x, point.y, size, alpha);
        renderGL('object', {
            shape: 'circle',
            x: point.x,
            y: point.y,
            w: size,
            h: size,
            fill: colors.Entity.PlayerDark,
            alpha
        });
        renderGL('object', {
            shape: 'circle',
            x: point.x,
            y: point.y,
            w: size * 0.78,
            h: size * 0.78,
            fill: colors.Entity.Player,
            alpha
        });
        this.#drawText(
            'texteffect',
            'P',
            point.x,
            point.y,
            this.fonts.HEADING,
            colors.Entity.PlayerAccent,
            'center',
            alpha
        );
        this.#drawWorldHp(
            point.x,
            point.y - (size * 0.62),
            this.presentation.playerHp,
            player.maxHp || 100,
            size,
            alpha
        );
    }

    /**
     * 고정 보스 로라를 그립니다.
     * @param {object} lora - 로라 상태입니다.
     * @private
     */
    #drawLora(lora) {
        const colors = ColorSchemes.Tactics;
        const point = this.#projectTile(lora.x, lora.y);
        const spriteLayout = this.data.SPRITES.LORA;
        const actionScale = 1 + (this.presentation.actionPulse
            * this.data.ANIMATION.ACTION_LORA_SCALE);
        const size = this.tileSide * spriteLayout.BASE_SIZE_TILE_RATIO * actionScale;
        const spriteSize = this.tileSide
            * spriteLayout.SPRITE_SIZE_TILE_RATIO
            * actionScale;
        const alive = lora.alive !== false && Number(lora.hp) > 0;
        const alpha = alive ? 1 : 0.56;
        const spriteReady = this.loraSpriteReady
            && this.#isImageReady(this.loraSprite);
        this.#drawShadow(point.x, point.y, size, alive ? 1 : 0.5);
        if (spriteReady) {
            if (this.flashSeconds > 0) {
                renderGL('object', {
                    shape: 'circle',
                    x: point.x,
                    y: point.y,
                    w: size * spriteLayout.FLASH_GLOW_SIZE_RATIO,
                    h: size * spriteLayout.FLASH_GLOW_SIZE_RATIO,
                    fill: colors.Entity.LoraAccent,
                    alpha: spriteLayout.FLASH_GLOW_ALPHA * alpha
                });
            }
            renderGL('object', {
                image: this.loraSprite,
                x: point.x - (spriteSize * 0.5),
                y: point.y - (spriteSize * 0.5)
                    + (this.tileSide * spriteLayout.OFFSET_Y_TILE_RATIO),
                w: spriteSize,
                h: spriteSize,
                alpha
            });
        } else {
            renderGL('object', {
                shape: 'circle',
                x: point.x,
                y: point.y,
                w: size,
                h: size,
                fill: colors.Entity.LoraDark,
                alpha
            });
            renderGL('object', {
                shape: 'circle',
                x: point.x,
                y: point.y,
                w: size * 0.8,
                h: size * 0.8,
                fill: this.flashSeconds > 0 ? colors.Entity.LoraAccent : colors.Entity.Lora,
                alpha
            });
            renderGL('object', {
                shape: 'rect',
                x: point.x,
                y: point.y - (size * 0.23),
                w: size * 0.56,
                h: size * 0.22,
                fill: colors.Entity.LoraHair
            });
        }
        if (this.stabilizeSeconds > 0) {
            renderGL('object', {
                shape: 'circle',
                x: point.x,
                y: point.y,
                w: size * (1.12 + (this.stabilizeSeconds * 0.2)),
                h: size * (1.12 + (this.stabilizeSeconds * 0.2)),
                fill: colors.Effects.Stabilize,
                alpha: clampNumber(this.stabilizeSeconds, 0, 1) * 0.38
            });
        }
        if (!spriteReady) {
            this.#drawWorldGlyph('L', point.x, point.y, colors.Entity.LoraAccent);
        }
        this.#drawWorldHp(
            point.x,
            point.y - (size * 0.68),
            this.presentation.loraHp,
            lora.maxHp || 100,
            size * 1.08
        );
    }

    /**
     * 전술 말의 그림자를 그립니다.
     * @param {number} x - 중심 X입니다.
     * @param {number} y - 중심 Y입니다.
     * @param {number} size - 기준 크기입니다.
     * @param {number} [alpha=1] - 투명도입니다.
     * @private
     */
    #drawShadow(x, y, size, alpha = 1) {
        const offset = Number(this.data.LAYOUT.BOARD.SHADOW_OFFSET_RATIO) || 0.08;
        renderGL('object', {
            shape: 'circle',
            x,
            y: y + (size * offset),
            w: size,
            h: size * 0.36,
            fill: ColorSchemes.Tactics.Entity.Shadow,
            alpha
        });
    }

    /**
     * 월드 HP 막대를 그립니다.
     * @param {number} x - 중심 X입니다.
     * @param {number} y - 중심 Y입니다.
     * @param {number} hp - 현재 HP입니다.
     * @param {number} maxHp - 최대 HP입니다.
     * @param {number} width - 막대 너비입니다.
     * @param {number} [alpha=1] - 막대 투명도입니다.
     * @private
     */
    #drawWorldHp(x, y, hp, maxHp, width, alpha = 1) {
        const colors = ColorSchemes.Tactics;
        const ratio = clampNumber(Number(hp) / Math.max(1, Number(maxHp)), 0, 1);
        renderGL('object', {
            shape: 'rect',
            x,
            y,
            w: width,
            h: Math.max(2, width * 0.09),
            fill: colors.UI.HpEmpty,
            alpha
        });
        if (ratio > 0) {
            renderGL('object', {
                shape: 'rect',
                x: x - (width * 0.5) + ((width * ratio) * 0.5),
                y,
                w: width * ratio,
                h: Math.max(2, width * 0.09),
                fill: colors.UI.HpFull,
                alpha
            });
        }
    }

    /**
     * 월드 오브젝트의 짧은 글리프를 그립니다.
     * @param {string} text - 글리프입니다.
     * @param {number} x - 중심 X입니다.
     * @param {number} y - 중심 Y입니다.
     * @param {string} fill - 색입니다.
     * @private
     */
    #drawWorldGlyph(text, x, y, fill) {
        this.#drawText('texteffect', text, x, y, this.fonts.HEADING, fill, 'center');
    }

    /**
     * 아이템 ID의 짧은 글리프를 반환합니다.
     * @param {string} itemId - 아이템 ID입니다.
     * @returns {string} 글리프입니다.
     * @private
     */
    #getItemGlyph(itemId) {
        const glyphs = {
            bow: '활',
            bandage: '+',
            'old-teddy': '곰',
            'music-box': '음',
            eyeliner: '선',
            'diamond-pickaxe': '곡',
            'glitch-item': 'G',
            mirror: '경',
            mushroom: '버',
            'speed-boots': '속',
            'shield-core': '실',
            'memory-photo': '사'
        };
        return glyphs[itemId] || 'I';
    }

    /**
     * 전투 프로젝트, 상태, 목표, 로그를 사이드바에 그립니다.
     * @private
     */
    #drawBattleHud() {
        this.#drawBattleStageHeader();
        this.#drawLoraStatusCard();
        this.#drawMissionCard();
        this.#drawPlayerStatus();
        this.#drawInventoryCard();
    }

    /**
     * Figma 기준의 스테이지 제목, 턴 주체, 층별 턴 핍을 그립니다.
     * @private
     */
    #drawBattleStageHeader() {
        const colors = ColorSchemes.Tactics;
        const rect = this.hudRects.STAGE_HEADER;
        const floor = this.#getCurrentFloor();
        const rawStageTitle = Number(this.presentation.floorIndex) === 0
            ? (floor?.label || '1층') + ' · 로라의 방'
            : (floor?.label || '지하층') + ' · 게이트 전실';
        const titleMaxWidth = rect.w * 0.58;
        const stageTitle = this.#truncateText(
            rawStageTitle,
            this.fonts.HEADING,
            titleMaxWidth
        );
        const titleY = rect.y + clampNumber(rect.h * 0.2, 18, 30);
        this.#drawText('ui', stageTitle, rect.x, titleY, this.fonts.HEADING, colors.UI.Text);
        const rawTurnLabel = (this.model.turn === 'player' ? '내 턴' : '로라의 턴')
            + '  ·  ' + String(this.model.turnNumber) + '/' + String(this.model.maxTurns);
        const turnLabel = this.#truncateText(
            rawTurnLabel,
            this.fonts.SMALL,
            rect.w - titleMaxWidth - this.#uww(0.8)
        );
        this.#drawText(
            'ui',
            turnLabel,
            rect.x + rect.w,
            titleY,
            this.fonts.SMALL,
            this.model.turn === 'player' ? colors.UI.Primary : colors.UI.Muted,
            'right'
        );

        const dotSize = clampNumber(this.#uwh(2.3), 16, 24);
        const dotGap = this.#uww(0.45);
        const dotY = rect.y + rect.h - (dotSize * 0.6);
        const floorTurn = ((Math.max(1, Number(this.model.turnNumber)) - 1) % 4) + 1;
        for (let index = 0; index < 4; index++) {
            const active = index < floorTurn;
            const dotX = rect.x + (dotSize * 0.5) + (index * (dotSize + dotGap));
            render('ui', {
                shape: 'circle',
                x: dotX,
                y: dotY,
                radius: dotSize * 0.5,
                fill: active ? colors.UI.Primary : colors.UI.CardHeader,
                stroke: colors.UI.Border,
                lineWidth: 1
            });
            this.#drawText(
                'ui',
                String(index + 1),
                dotX,
                dotY,
                this.fonts.SMALL,
                active ? colors.UI.OnPrimary : colors.UI.Muted,
                'center'
            );
        }
    }

    /**
     * 로라 초상, HP, 불안정도 게이지를 우상단 카드에 그립니다.
     * @private
     */
    #drawLoraStatusCard() {
        const colors = ColorSchemes.Tactics;
        const rect = this.hudRects.LORA_CARD;
        const pad = clampNumber(rect.w * 0.035, 10, 18);
        this.#drawHudCard(rect);
        const portraitH = rect.h - (pad * 2);
        const portraitW = portraitH * (200 / 240);
        const portraitX = rect.x + pad;
        const portraitY = rect.y + pad;
        if (this.loraPortrait?.complete && this.loraPortrait.naturalWidth > 0) {
            render('ui', {
                shape: 'image',
                image: this.loraPortrait,
                x: portraitX,
                y: portraitY,
                w: portraitW,
                h: portraitH
            });
        } else {
            render('ui', {
                shape: 'roundRect',
                x: portraitX,
                y: portraitY,
                w: portraitW,
                h: portraitH,
                radius: this.#uwh(1),
                fill: colors.UI.CardHeader,
                stroke: colors.UI.Border,
                lineWidth: 1
            });
            this.#drawText(
                'ui',
                'L',
                portraitX + (portraitW * 0.5),
                portraitY + (portraitH * 0.5),
                this.fonts.TITLE,
                colors.UI.Primary,
                'center'
            );
        }

        const contentX = portraitX + portraitW + pad;
        const contentRight = rect.x + rect.w - pad;
        const contentW = Math.max(1, contentRight - contentX);
        const headerH = rect.h * 0.28;
        render('ui', {
            shape: 'roundRect',
            x: contentX - (pad * 0.35),
            y: rect.y + pad,
            w: contentW + (pad * 0.35),
            h: headerH - pad,
            radius: this.#uwh(0.8),
            fill: colors.UI.CardHeader
        });
        const state = typeof this.model.getInstabilityState === 'function'
            ? this.model.getInstabilityState()
            : null;
        const stateLabel = state?.label || state?.id || '상태 확인 중';
        this.#drawText(
            'ui',
            'Rora',
            contentX,
            rect.y + (headerH * 0.52),
            this.fonts.HEADING,
            colors.UI.Text
        );
        this.#drawText(
            'ui',
            stateLabel,
            contentRight,
            rect.y + (headerH * 0.52),
            this.fonts.SMALL,
            Number(this.presentation.instability) <= 10
                ? colors.UI.Success
                : colors.UI.Warning,
            'right'
        );

        const loraHp = Math.max(0, Number(this.presentation.loraHp) || 0);
        const loraMaxHp = Math.max(1, Number(this.model.lora?.maxHp) || 100);
        const instability = clampNumber(this.presentation.instability, 0, 100);
        const gaugeH = clampNumber(rect.h * 0.055, 7, 12);
        const hpLabelY = rect.y + (rect.h * 0.48);
        this.#drawText(
            'ui',
            'HP  ' + String(Math.round(loraHp)) + '/' + String(loraMaxHp),
            contentX,
            hpLabelY,
            this.fonts.SMALL,
            colors.UI.Text
        );
        this.#drawGauge(
            contentX,
            rect.y + (rect.h * 0.57),
            contentW,
            gaugeH,
            loraHp / loraMaxHp,
            colors.UI.GaugeHp
        );
        const instabilityY = rect.y + (rect.h * 0.73);
        this.#drawText(
            'ui',
            '불안정도  ' + String(Math.round(instability)),
            contentX,
            instabilityY,
            this.fonts.SMALL,
            colors.UI.Text
        );
        this.#drawGauge(
            contentX,
            rect.y + (rect.h * 0.82),
            contentW,
            gaugeH,
            instability / 100,
            colors.UI.GaugeInstability
        );
    }

    /**
     * 목표와 최근 이벤트를 우측 플로팅 카드에 그립니다.
     * @private
     */
    #drawMissionCard() {
        const colors = ColorSchemes.Tactics;
        const rect = this.hudRects.MISSION_CARD;
        const pad = clampNumber(rect.w * 0.07, 14, 22);
        const lineH = clampNumber(this.#uwh(2.7), 18, 30);
        this.#drawHudCard(rect);
        let y = rect.y + pad;
        this.#drawText(
            'ui',
            'MISSION  ·  ' + this.data.TEXT.CORE_LOOP,
            rect.x + pad,
            y,
            this.fonts.BODY,
            colors.UI.Primary
        );
        y += lineH * 1.4;
        const objectiveLines = this.#wrapText(
            this.data.TEXT.OBJECTIVE,
            this.fonts.SMALL,
            rect.w - (pad * 2),
            3
        );
        objectiveLines.forEach((line) => {
            this.#drawText('ui', line, rect.x + pad, y, this.fonts.SMALL, colors.UI.Text);
            y += lineH;
        });

        y += lineH * 0.35;
        render('ui', {
            shape: 'rect',
            x: rect.x + pad,
            y,
            w: rect.w - (pad * 2),
            h: 1,
            fill: colors.UI.Border
        });
        y += lineH;
        this.#drawText('ui', '최근 이벤트', rect.x + pad, y, this.fonts.BODY, colors.UI.Text);
        y += lineH * 1.25;
        this.eventLog.slice(-3).forEach((entry) => {
            const line = this.#truncateText(
                '· ' + entry,
                this.fonts.SMALL,
                rect.w - (pad * 2)
            );
            this.#drawText('ui', line, rect.x + pad, y, this.fonts.SMALL, colors.UI.Muted);
            y += lineH;
        });

        const statusLine = this.data.TEXT.TURN_SUMMARY + '  ·  이동 '
            + (this.model.movementUsed ? '사용' : '가능')
            + '  ·  행동 ' + (this.model.actionUsed ? '사용' : '가능');
        this.#drawText(
            'ui',
            this.#truncateText(
                statusLine,
                this.fonts.SMALL,
                rect.w - (pad * 2)
            ),
            rect.x + rect.w - pad,
            rect.y + rect.h - pad,
            this.fonts.SMALL,
            colors.UI.Accent,
            'right'
        );
    }

    /**
     * 플레이어 HP 라벨과 게이지를 좌하단에 그립니다.
     * @private
     */
    #drawPlayerStatus() {
        const colors = ColorSchemes.Tactics;
        const rect = this.hudRects.PLAYER_STATUS;
        const playerHp = Math.max(0, Number(this.presentation.playerHp) || 0);
        const playerMaxHp = Math.max(1, Number(this.model.player?.maxHp) || 100);
        const gaugeH = clampNumber(rect.h * 0.24, 8, 12);
        this.#drawText(
            'ui',
            'HP',
            rect.x,
            rect.y + (rect.h * 0.28),
            this.fonts.BODY,
            colors.UI.Text
        );
        this.#drawText(
            'ui',
            String(Math.round(playerHp)) + '/' + String(playerMaxHp),
            rect.x + rect.w,
            rect.y + (rect.h * 0.28),
            this.fonts.MONO,
            colors.UI.Muted,
            'right'
        );
        this.#drawGauge(
            rect.x,
            rect.y + rect.h - gaugeH,
            rect.w,
            gaugeH,
            playerHp / playerMaxHp,
            colors.UI.GaugeHp
        );
    }

    /**
     * 인벤토리 슬롯의 공통 카드와 페이지 정보를 그립니다.
     * @private
     */
    #drawInventoryCard() {
        const colors = ColorSchemes.Tactics;
        const rect = this.hudRects.INVENTORY_CARD;
        const pad = this.#uww(0.9);
        const paging = this.#getInventoryPaging();
        const headerH = clampNumber(rect.h * 0.22, 30, 46);
        this.#drawHudCard(rect);
        this.#drawText(
            'ui',
            'ITEMS  ' + String(paging.page + 1) + '/' + String(paging.pageCount),
            rect.x + pad,
            rect.y + (headerH * 0.5),
            this.fonts.BODY,
            colors.UI.Text
        );
    }

    /**
     * 그림자와 테두리가 있는 Figma 스타일 플로팅 카드를 그립니다.
     * @param {{x:number,y:number,w:number,h:number}} rect - 카드 사각형입니다.
     * @private
     */
    #drawHudCard(rect) {
        const colors = ColorSchemes.Tactics;
        const radius = this.#uwh(1.1);
        render('ui', {
            shape: 'roundRect',
            x: rect.x + 2,
            y: rect.y + 3,
            w: rect.w,
            h: rect.h,
            radius,
            fill: colors.UI.CardShadow
        });
        render('ui', {
            shape: 'roundRect',
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: rect.h,
            radius,
            fill: colors.UI.Card,
            stroke: colors.UI.Border,
            lineWidth: 1
        });
    }

    /**
     * 지정 비율만큼 채운 둥근 게이지를 그립니다.
     * @param {number} x - 게이지 X입니다.
     * @param {number} y - 게이지 Y입니다.
     * @param {number} w - 게이지 너비입니다.
     * @param {number} h - 게이지 높이입니다.
     * @param {number} ratio - 0~1 채움 비율입니다.
     * @param {string} fill - 채움 색입니다.
     * @private
     */
    #drawGauge(x, y, w, h, ratio, fill) {
        const colors = ColorSchemes.Tactics;
        const safeRatio = clampNumber(ratio, 0, 1);
        render('ui', {
            shape: 'roundRect',
            x,
            y,
            w,
            h,
            radius: h * 0.5,
            fill: colors.UI.GaugeTrack
        });
        if (safeRatio <= 0) {
            return;
        }
        render('ui', {
            shape: 'roundRect',
            x,
            y,
            w: w * safeRatio,
            h,
            radius: h * 0.5,
            fill
        });
    }

    /**
     * 전투 중 떠오르는 글자와 입자를 그립니다.
     * @private
     */
    #drawWorldEffects() {
        if (Number(this.presentation.floorIndex) !== (Number(this.model?.floorIndex) || 0)) {
            return;
        }
        const colors = ColorSchemes.Tactics;
        for (const particle of this.particles) {
            const ratio = clampNumber(particle.seconds / particle.duration, 0, 1);
            renderGL('object', {
                shape: 'circle',
                x: particle.x + (particle.dx * ratio),
                y: particle.y + (particle.dy * ratio),
                w: particle.size * (1 - ratio),
                h: particle.size * (1 - ratio),
                fill: particle.fill || colors.Effects.Move,
                alpha: 1 - ratio
            });
        }
        for (const entry of this.floatingTexts) {
            const ratio = clampNumber(entry.seconds / entry.duration, 0, 1);
            this.#drawText(
                'texteffect',
                entry.text,
                entry.x,
                entry.y - (ratio * this.#uwh(3)),
                this.fonts.BODY,
                entry.fill,
                'center',
                1 - ratio
            );
        }
    }

    /**
     * 결과 화면을 엔딩, 점수, 불안정도와 함께 그립니다.
     * @private
     */
    #drawResult() {
        const colors = ColorSchemes.Tactics;
        const centerX = this.UIOffsetX + (this.UIWW * 0.5);
        const rect = {
            x: centerX - this.#uww(22),
            y: this.#uwh(20),
            w: this.#uww(44),
            h: this.#uwh(58)
        };
        renderGL('background', {
            shape: 'rect',
            x: rect.x + (rect.w * 0.5),
            y: rect.y + (rect.h * 0.5),
            w: rect.w,
            h: rect.h,
            fill: colors.UI.PanelStrong,
            alpha: 0.98
        });
        this.#drawText('ui', '작전 결과', centerX, rect.y + this.#uwh(8), this.fonts.TITLE, colors.UI.Text, 'center');
        this.#drawText(
            'ui',
            this.resultData?.label || '작전 종료',
            centerX,
            rect.y + this.#uwh(19),
            this.fonts.HEADING,
            colors.UI.Accent,
            'center'
        );
        this.#drawText(
            'ui',
            '점수  ' + String(this.resultData?.score || 0),
            centerX,
            rect.y + this.#uwh(29),
            this.fonts.TITLE,
            colors.UI.Text,
            'center'
        );
        this.#drawText(
            'ui',
            '최종 불안정도  ' + String(this.resultData?.instability || 0),
            centerX,
            rect.y + this.#uwh(37),
            this.fonts.BODY,
            colors.UI.Muted,
            'center'
        );
        this.#drawText(
            'ui',
            '최고 점수  ' + String(this.meta.bestScore),
            centerX,
            rect.y + this.#uwh(43),
            this.fonts.BODY,
            colors.UI.Muted,
            'center'
        );
    }

    /**
     * 현재 고정 카드 컷씬을 모달로 그립니다.
     * @private
     */
    #drawCutscene() {
        const colors = ColorSchemes.Tactics;
        const state = this.cutscenes.getState();
        const card = this.cutscenes.getCurrentCard();
        const modal = this.#getCutsceneRect();
        render('ui', {
            shape: 'rect',
            x: 0,
            y: 0,
            w: this.WW,
            h: this.WH,
            fill: colors.UI.OverlayDim,
            alpha: 0.78
        });
        render('ui', {
            shape: 'roundRect',
            x: modal.x,
            y: modal.y,
            w: modal.w,
            h: modal.h,
            radius: this.#uwh(1.5),
            fill: colors.UI.PanelStrong,
            alpha: 0.99
        });
        const centerX = modal.x + (modal.w * 0.5);
        this.#drawText('ui', state.title, centerX, modal.y + this.#uwh(5), this.fonts.HEADING, colors.UI.Text, 'center');
        this.#drawText(
            'ui',
            String(state.cardIndex + 1) + ' / ' + String(state.cardCount),
            modal.x + modal.w - this.#uww(2),
            modal.y + this.#uwh(5),
            this.fonts.MONO,
            colors.UI.Muted,
            'right'
        );
        this.#drawText(
            'ui',
            card?.speaker || '',
            modal.x + this.#uww(4),
            modal.y + this.#uwh(11),
            this.fonts.BODY,
            colors.UI.Accent
        );
        const lines = this.#wrapText(
            card?.text || '',
            this.fonts.BODY,
            modal.w - this.#uww(8),
            5
        );
        lines.forEach((line, index) => {
            this.#drawText(
                'ui',
                line,
                modal.x + this.#uww(4),
                modal.y + this.#uwh(17) + (index * this.#uwh(3.8)),
                this.fonts.BODY,
                colors.UI.Text
            );
        });
    }

    /**
     * 컷씬 모달 사각형을 반환합니다.
     * @returns {{x:number,y:number,w:number,h:number}} 모달 영역입니다.
     * @private
     */
    #getCutsceneRect() {
        const w = this.#uww(52);
        const h = this.#uwh(48);
        return {
            x: this.UIOffsetX + ((this.UIWW - w) * 0.5),
            y: (this.WH - h) * 0.5,
            w,
            h
        };
    }

    /**
     * 이벤트 목록을 로그와 간단한 전투 연출로 변환합니다.
     * @param {*} events - 모델 이벤트 목록입니다.
     * @private
     */
    #consumeEvents(events) {
        for (const event of toList(events)) {
            const message = this.#formatEvent(event);
            if (message) {
                this.#appendEvent(message);
            }
            if (event?.type === 'trap-triggered' && event.trapId) {
                this.#replaceMeta(discoverTutorialTrap(this.meta, event.trapId));
            }
            if (event?.type === 'item-used' && event.itemId) {
                this.#replaceMeta(identifyTutorialItem(this.meta, event.itemId));
            }
            this.#spawnEventEffect(event);
        }
    }

    /**
     * 모델 이벤트 하나를 한국어 로그로 변환합니다.
     * @param {object} event - 모델 이벤트입니다.
     * @returns {string} 로그 문자열입니다.
     * @private
     */
    #formatEvent(event) {
        if (!event || typeof event.type !== 'string') {
            return '';
        }
        const itemLabel = this.data.ITEMS[event.itemId]?.label || event.itemId || '아이템';
        const damage = Math.max(
            0,
            Math.round(Number(event.damage ?? event.amount) || 0)
        );
        const values = {
            'item-picked': itemLabel + ' 획득',
            'item-dropped': itemLabel + ' 드롭',
            'wall-destroyed': '벽 파괴',
            'trap-triggered': '함정 발동',
            'item-lost': itemLabel + ' 분실',
            teleported: '텔레포트 작동',
            'mob-damaged': '몹에게 ' + String(damage) + ' 피해',
            'mob-defeated': '몹 격파',
            'lora-damaged': '로라에게 ' + String(damage) + ' 피해',
            'instability-changed': '로라 불안정도 변화',
            'player-healed': '플레이어 HP 회복',
            'lora-healed': '로라 HP 회복',
            'player-damaged': '플레이어가 ' + String(damage) + ' 피해',
            'item-used': itemLabel + ' 사용',
            'player-defended': '플레이어 방어',
            'player-waited': '플레이어 대기',
            'lora-defended': '로라 방어',
            'lora-restrained': '로라 행동 봉쇄',
            peace: '로라가 공격하지 않았습니다.',
            'lora-attack': '로라 공격',
            'floor-transition': '지하층으로 이동',
            'gate-opened': '탈출 게이트 개방',
            'battle-finished': '작전 판정 완료'
        };
        return values[event.type] || '';
    }

    /**
     * 거절 사유를 짧은 안내로 변환합니다.
     * @param {*} reason - 모델 사유입니다.
     * @returns {string} 안내 문자열입니다.
     * @private
     */
    #formatReason(reason) {
        const values = {
            'movement-used': '이번 턴 이동을 이미 사용했습니다.',
            'action-used': '이번 턴 행동을 이미 사용했습니다.',
            'movement-unavailable': '이번 턴 이동을 사용할 수 없습니다.',
            'action-unavailable': '이번 턴 행동을 사용할 수 없습니다.',
            'unreachable-destination': '그 타일까지 도달할 수 없습니다.',
            'invalid-path': '그 경로로 이동할 수 없습니다.',
            'out-of-range': '대상이 범위 밖에 있습니다.',
            'invalid-target': '선택할 수 없는 대상입니다.',
            'item-missing': '해당 아이템이 없습니다.',
            'item-not-owned': '해당 아이템을 보유하지 않았습니다.',
            'passive-item': '자동 적용 아이템은 직접 사용할 수 없습니다.',
            'item-already-used': '이번 플레이에서 이미 사용한 아이템입니다.',
            'peace-active': '평화 효과 중에는 공격할 수 없습니다.',
            'gate-closed': '게이트가 아직 닫혀 있습니다.',
            'not-at-gate': '게이트 타일로 이동해야 합니다.',
            'escape-conditions-not-met': '로라를 무력화한 뒤 지하 게이트 위에서 탈출하세요.'
        };
        return values[reason] || '지금은 그 선택을 적용할 수 없습니다.';
    }

    /**
     * 이벤트에 맞는 떠오르는 글자와 화면 반응을 만듭니다.
     * @param {object} event - 모델 이벤트입니다.
     * @private
     */
    #spawnEventEffect(event) {
        if (!event || !this.model) {
            return;
        }
        if (event.type === 'lora-attack') {
            return;
        }
        const colors = ColorSchemes.Tactics;
        let tile = cloneTile(event);
        if (!tile && event.type?.startsWith('player-')) {
            tile = cloneTile(this.model.player);
        } else if (!tile && (event.type?.startsWith('lora-')
            || event.type === 'instability-changed')) {
            tile = cloneTile(this.model.lora);
        }
        if (!tile) {
            return;
        }
        const point = this.#projectTile(tile.x, tile.y);
        const damage = Math.max(
            0,
            Math.round(Number(event.damage ?? event.amount) || 0)
        );
        const heal = Math.max(0, Math.round(Number(event.amount || event.heal) || 0));
        if (damage > 0) {
            this.floatingTexts.push({
                text: '-' + String(damage),
                x: point.x,
                y: point.y - (this.tileSide * 0.42),
                fill: colors.UI.Danger,
                seconds: 0,
                duration: Number(this.data.ANIMATION.DAMAGE_TEXT_SECONDS)
            });
            this.screenShakeSeconds = Math.max(
                this.screenShakeSeconds,
                Number(this.data.ANIMATION.SHAKE_SECONDS) || 0.18
            );
            this.flashSeconds = Math.max(
                this.flashSeconds,
                Number(this.data.ANIMATION.HIT_FLASH_SECONDS)
            );
        } else if (heal > 0) {
            this.floatingTexts.push({
                text: '+' + String(heal),
                x: point.x,
                y: point.y - (this.tileSide * 0.42),
                fill: colors.UI.Success,
                seconds: 0,
                duration: Number(this.data.ANIMATION.HEAL_TEXT_SECONDS)
            });
        }
        if (event.type === 'instability-changed'
            && Number(event.change ?? event.delta ?? event.amount) < 0) {
            this.stabilizeSeconds = Math.max(
                this.stabilizeSeconds,
                Number(this.data.ANIMATION.STABILIZE_SECONDS)
            );
        }
    }

    /**
     * 이동 경로를 따라 짧은 입자를 생성합니다.
     * @param {Array<{x:number,y:number}>} path - 이동 경로입니다.
     * @private
     */
    #spawnPathParticles(path) {
        const fill = ColorSchemes.Tactics.Effects.Move;
        const steps = this.#normalizePath(path).slice(1);
        if (steps.length === 0) {
            return;
        }
        const count = Math.max(1, Number(this.data.ANIMATION.PARTICLE_COUNT) || 12);
        const duration = Math.max(
            0.01,
            Number(this.data.ANIMATION.PARTICLE_SECONDS) || 0.48
        );
        for (let index = 0; index < count; index++) {
            const tile = steps[index % steps.length];
            const point = this.#projectTile(tile.x, tile.y);
            this.particles.push({
                x: point.x,
                y: point.y,
                dx: (Math.random() - 0.5) * this.tileSide,
                dy: -this.tileSide * (0.2 + (Math.random() * 0.5)),
                size: this.tileSide * 0.12,
                fill,
                seconds: 0,
                duration
            });
        }
    }

    /**
     * 표현 전용 수명을 갱신합니다.
     * @param {number} deltaSeconds - 경과 초입니다.
     * @private
     */
    #updatePresentation(deltaSeconds) {
        this.screenShakeSeconds = Math.max(0, this.screenShakeSeconds - deltaSeconds);
        this.stabilizeSeconds = Math.max(0, this.stabilizeSeconds - deltaSeconds);
        this.flashSeconds = Math.max(0, this.flashSeconds - deltaSeconds);
        for (const entry of this.floatingTexts) {
            entry.seconds += deltaSeconds;
        }
        for (const particle of this.particles) {
            particle.seconds += deltaSeconds;
        }
        this.floatingTexts = this.floatingTexts.filter(
            (entry) => entry.seconds < entry.duration
        );
        this.particles = this.particles.filter(
            (entry) => entry.seconds < entry.duration
        );
    }

    /**
     * 이벤트 로그 끝에 중복을 줄여 새 메시지를 추가합니다.
     * @param {string} message - 로그 메시지입니다.
     * @private
     */
    #appendEvent(message) {
        if (!message || this.eventLog[this.eventLog.length - 1] === message) {
            return;
        }
        this.eventLog.push(message);
        const limit = Number(this.data.RULES.EVENT_LOG_LIMIT) || 80;
        if (this.eventLog.length > limit) {
            this.eventLog.splice(0, this.eventLog.length - limit);
        }
    }

    /**
     * 텍스트를 지정 폭과 줄 수에 맞춰 나눕니다.
     * @param {string} text - 원문입니다.
     * @param {string} font - Canvas 글꼴입니다.
     * @param {number} maxWidth - 최대 폭입니다.
     * @param {number} maxLines - 최대 줄 수입니다.
     * @returns {string[]} 줄 목록입니다.
     * @private
     */
    #wrapText(text, font, maxWidth, maxLines) {
        return wrapTextByCharacters(text, {
            maxWidth,
            maxLines,
            measureWidth: (value) => measureText(value, font)
        });
    }

    /**
     * 한 줄 텍스트를 지정 폭에 맞춰 말줄임합니다.
     * @param {string} text - 원문입니다.
     * @param {string} font - Canvas 글꼴입니다.
     * @param {number} maxWidth - 최대 폭입니다.
     * @returns {string} 말줄임된 텍스트입니다.
     * @private
     */
    #truncateText(text, font, maxWidth) {
        const value = String(text ?? '');
        if (maxWidth <= 0) {
            return '';
        }
        if (measureText(value, font) <= maxWidth) {
            return value;
        }
        const ellipsis = '…';
        let end = value.length;
        while (end > 0
            && measureText(value.slice(0, end) + ellipsis, font) > maxWidth) {
            end--;
        }
        return end > 0 ? value.slice(0, end) + ellipsis : ellipsis;
    }

    /**
     * 공통 텍스트 렌더 명령을 실행합니다.
     * @param {string} layer - 렌더 레이어입니다.
     * @param {string} text - 표시 문자열입니다.
     * @param {number} x - X 좌표입니다.
     * @param {number} y - Y 좌표입니다.
     * @param {string} font - Canvas 글꼴입니다.
     * @param {string} fill - 색입니다.
     * @param {string} [align=left] - 가로 정렬입니다.
     * @param {number} [alpha=1] - 투명도입니다.
     * @private
     */
    #drawText(layer, text, x, y, font, fill, align = 'left', alpha = 1) {
        render(layer, {
            shape: 'text',
            text: String(text ?? ''),
            x,
            y,
            font,
            fill,
            align,
            baseline: 'middle',
            alpha
        });
    }
}
