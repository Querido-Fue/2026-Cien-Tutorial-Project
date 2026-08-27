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
import {
    clearSimulationCommands,
    enqueueSimulationCommand
} from 'simulation/simulation_command_queue.js';
import { TutorialBattleModel } from './_tutorial_battle_model.js';
import { TutorialCutsceneController } from './_tutorial_cutscene_controller.js';
import {
    createDefaultTutorialMeta,
    identifyTutorialItem,
    loadTutorialMeta,
    markTutorialOpeningWatched,
    recordTutorialResult,
    saveTutorialMeta,
    unlockTutorialCutscene
} from './_tutorial_meta_progress.js';
import {
    TUTORIAL_COMMANDS as COMMANDS,
    TUTORIAL_MODES as MODES
} from './_tutorial_scene_constants.js';
import {
    TUTORIAL_KEY_CODES as KEY_CODES,
    TUTORIAL_KEY_DIRECTIONS as KEY_DIRECTIONS,
    TUTORIAL_SELECTION_KEY_CODES as SELECTION_KEY_CODES,
    TUTORIAL_WATCHED_KEY_CODES as WATCHED_KEY_CODES
} from './_tutorial_input_bindings.js';
import {
    canRestartTutorialRun,
    canReturnToTutorialMenu,
    getTutorialModePolicy,
    isTutorialBattleMode
} from './_tutorial_mode_policy.js';
import {
    areSerializableValuesEqual as isSameMeta,
    clampNumber,
    cloneTile,
    cloneValue as cloneCheckpointValue,
    toList,
    toTileKey
} from './_tutorial_value_utils.js';
import { TutorialBattleFeedbackView } from './view/_tutorial_battle_feedback_view.js';
import { TutorialBattleHudView } from './view/_tutorial_battle_hud_view.js';
import { TutorialBattleLayout } from './view/_tutorial_battle_layout.js';
import { TutorialBattleWorldView } from './view/_tutorial_battle_world_view.js';
import { TutorialButtonHost } from './view/_tutorial_button_host.js';
import { TutorialCutsceneView } from './view/_tutorial_cutscene_view.js';
import { TutorialGalleryView } from './view/_tutorial_gallery_view.js';
import { TutorialLoadingView } from './view/_tutorial_loading_view.js';
import { TutorialMenuView } from './view/_tutorial_menu_view.js';
import { TutorialResultView } from './view/_tutorial_result_view.js';
import { TutorialStarterView } from './view/_tutorial_starter_view.js';

const TUTORIAL_GAME_DATA = getData('TUTORIAL_GAME_DATA');

const PLAYER_ID = 'player';
const LORA_ID = 'lora';
const KNOWN_STARTER_IDS = new Set(['bow', 'mascot-costume']);

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
            this.data.STARTER_CHOICES.findIndex((choice) => choice.id === 'mascot-costume')
        );
        this.starterItemId = this.data.STARTER_CHOICES[this.starterIndex]?.id || 'mascot-costume';
        this.resultData = null;
        this.resultRecorded = false;
        this.destroyed = false;
        this.saveSequence = Promise.resolve();
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

        const tutorialRenderPort = Object.freeze({
            render,
            renderGL,
            measureText,
            wrapText: (text, font, maxWidth, maxLines) => wrapTextByCharacters(text, {
                maxWidth,
                maxLines,
                measureWidth: (value) => measureText(value, font)
            })
        });
        this.loadingView = new TutorialLoadingView(tutorialRenderPort);
        this.menuView = new TutorialMenuView(tutorialRenderPort);
        this.starterView = new TutorialStarterView(tutorialRenderPort);
        this.galleryView = new TutorialGalleryView(tutorialRenderPort);
        this.resultView = new TutorialResultView(tutorialRenderPort);
        this.cutsceneView = new TutorialCutsceneView(tutorialRenderPort);
        this.battleLayout = new TutorialBattleLayout({
            map: this.data.MAP,
            floors: this.data.FLOORS,
            board: this.data.LAYOUT.BOARD,
            hud: this.data.LAYOUT.HUD,
            shakeTileRatio: this.data.ANIMATION.SHAKE_TILE_RATIO
        });
        const battleAssetPort = Object.freeze({
            getItemIcon: (itemId) => this.itemIconCanvases?.get(itemId) || null,
            getLoraPortrait: () => this.loraPortrait,
            getLoraSprite: () => (
                this.loraSpriteReady && this.#isImageReady(this.loraSprite)
                    ? this.loraSprite
                    : null
            )
        });
        this.battleWorldView = new TutorialBattleWorldView(
            tutorialRenderPort,
            battleAssetPort
        );
        this.battleHudView = new TutorialBattleHudView(
            tutorialRenderPort,
            battleAssetPort
        );
        this.battleFeedbackView = new TutorialBattleFeedbackView(tutorialRenderPort);
        this.buttonHost = new TutorialButtonHost({
            parent: this,
            onCommand: (type, payload) => this.#queueUiCommand(type, payload)
        });

        this.elapsedSeconds = 0;
        this.hoveredTile = null;
        this.plannedPath = [];
        this.reachability = new Map();
        this.actionTargets = [];
        this.attackSelected = false;
        this.attackWeapon = 'melee';
        this.targetIndex = 0;
        this.cleanseSelected = false;
        this.cleanseTargets = [];
        this.cleanseTargetIndex = 0;
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
                    this.buttonHost.invalidate();
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

        this.uiActionHandled = false;
        this.keyboardLatch = new Map();
        this.keyboardPressObserved = new Map();
        this.frameKeyEdges = new Set();
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
        this.buttonHost.update();
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
        const view = getTutorialModePolicy(this.mode)?.view;

        if (view === 'loading') {
            this.loadingView.draw(this.#createLoadingViewModel());
        } else if (view === 'menu') {
            this.menuView.draw(this.#createMenuViewModel());
        } else if (view === 'starter') {
            this.starterView.draw(this.#createStarterViewModel());
        } else if (view === 'gallery') {
            this.galleryView.draw(this.#createGalleryViewModel());
        } else if (view === 'battle') {
            const battleViewModel = this.#createBattleViewModel();
            this.battleWorldView.draw(battleViewModel);
            this.battleFeedbackView.draw(battleViewModel);
            this.battleHudView.draw(battleViewModel);
        } else if (view === 'result') {
            this.resultView.draw(this.#createResultViewModel());
        }

        if (this.cutscenes.isOpen()) {
            this.cutsceneView.draw(this.#createCutsceneViewModel());
        }
        this.buttonHost.draw();
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
                case COMMANDS.PLAN_BACK:
                    this.#applyPlanBack();
                    break;
                case COMMANDS.COMMIT_PATH:
                    this.#applyCommitPath();
                    break;
                case COMMANDS.SELECT_ATTACK:
                    this.#applySelectAttack(command.payload);
                    break;
                case COMMANDS.ATTACK:
                    this.#applyAttack(command.payload);
                    break;
                case COMMANDS.HEAL:
                    this.#applyHeal();
                    break;
                case COMMANDS.IDLE:
                    this.#applyIdle();
                    break;
                case COMMANDS.USE_ITEM:
                    this.#applyUseItem(command.payload);
                    break;
                case COMMANDS.INVENTORY_PAGE_SHIFT:
                    this.#applyInventoryPageShift(command.payload);
                    break;
                case COMMANDS.SELECT_CLEANSE:
                    this.#applySelectCleanse();
                    break;
                case COMMANDS.CLEANSE_EVENT_TILE:
                    this.#applyCleanseEventTile(command.payload);
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

            // 재시작이나 화면 전환으로 타임라인이 바뀌면 같은 drain의 남은 명령은 구식입니다.
            if (this.timelineRevision !== revisionBeforeCommand) {
                break;
            }
        }
        this.buttonHost.invalidate();
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
        this.buttonHost.destroy();
        this.cutscenes.close();
        this.pendingCutscenes = [];
        this.runCutsceneIds.clear();
        this.floatingTexts = [];
        this.particles = [];
        this.loraTurnState = null;
        this.floorView = null;
        this.floorActorView = null;
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
            this.buttonHost.invalidate();
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
        this.buttonHost.invalidate();
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
        this.mode = MODES.STARTER;
    }

    /**
     * 메뉴에서 컷씬 갤러리를 엽니다.
     * @private
     */
    #applyOpenGallery() {
        if (this.mode !== MODES.MENU || this.data.FEATURES?.CUTSCENES !== true) {
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
        if (!canReturnToTutorialMenu(this.mode)) {
            return;
        }
        this.#leaveRun(MODES.MENU);
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

    /** 전투를 중단하거나 결과를 닫고 스타터 선택으로 돌아갑니다. @private */
    #applyRestart() {
        if (!canRestartTutorialRun(this.mode)) {
            return;
        }
        this.#leaveRun(MODES.STARTER);
    }

    /**
     * 현재 런을 정리하고 지정한 비전투 화면으로 전환합니다.
     * @param {'menu'|'starter'} nextMode - 정리 후 표시할 모드입니다.
     * @private
     */
    #leaveRun(nextMode) {
        this.#commitStagedMeta();
        this.timelineRevision += 1;
        this.#clearOwnedAnimations();
        this.cutscenes.close();
        this.pendingCutscenes = [];
        this.runCutsceneIds.clear();
        this.cutsceneReturnMode = nextMode;
        this.model = null;
        this.floorView = null;
        this.floorActorView = null;
        this.mode = nextMode;
        this.resultData = null;
        this.resultRecorded = false;
        this.loraTurnState = null;
        this.attackSelected = false;
        this.attackWeapon = 'melee';
        this.targetIndex = 0;
        this.cleanseSelected = false;
        this.cleanseTargets = [];
        this.cleanseTargetIndex = 0;
        this.inventoryPage = 0;
        this.hoveredTile = null;
        this.hoveredTileKey = '';
        this.reachability.clear();
        this.actionTargets = [];
        this.plannedPath = [];
        this.eventLog = [];
        this.floatingTexts = [];
        this.particles = [];
        this.screenShakeSeconds = 0;
        this.stabilizeSeconds = 0;
        this.flashSeconds = 0;
        this.buttonHost.invalidate();
    }

    /**
     * 새 모델과 뷰 상태로 전투를 시작합니다.
     * @param {string} starterItemId - 스타터 아이템 ID입니다.
     * @private
     */
    #beginRun(starterItemId) {
        this.timelineRevision += 1;
        this.#clearOwnedAnimations();
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
        this.attackWeapon = 'melee';
        this.targetIndex = 0;
        this.cleanseSelected = false;
        this.cleanseTargets = [];
        this.cleanseTargetIndex = 0;
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
        this.#appendEvent('전투 시작 · 이동 경로를 지정하고 확정한 뒤 행동하세요.');
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
        if (this.cleanseSelected) {
            this.#shiftCleanseTarget(dx || dy);
            this.#startSelectionAnimation('attack');
            return;
        }
        if (this.attackSelected) {
            this.#shiftAttackTarget(dx || dy);
            this.#startSelectionAnimation('attack');
            return;
        }
        if (this.model.movementUsed || this.model.phase !== 'move') {
            return;
        }
        const path = this.#normalizePath(this.model.extendPath(this.plannedPath, dx, dy));
        if (path.length === 0) {
            return;
        }
        this.plannedPath = path;
        this.#startSelectionAnimation('path');
    }

    /**
     * 직접 지정 경로의 마지막 이동 스텝을 취소합니다. 포탈 이동은 입구와 출구를 함께 제거합니다.
     * @private
     */
    #applyPlanBack() {
        if (!this.#canAcceptBattleInput()
            || this.model.movementUsed
            || this.model.phase !== 'move'
            || this.plannedPath.length <= 1) {
            return;
        }
        const last = this.plannedPath[this.plannedPath.length - 1];
        const previous = this.plannedPath[this.plannedPath.length - 2];
        this.plannedPath.pop();
        if (previous
            && Math.abs(last.x - previous.x) + Math.abs(last.y - previous.y) > 1
            && this.plannedPath.length > 1) {
            this.plannedPath.pop();
        }
        this.cleanseSelected = false;
        this.#startSelectionAnimation('path');
    }

    /**
     * 키보드로 계획한 경로를 확정합니다.
     * @private
     */
    #applyCommitPath() {
        if (!this.#canAcceptBattleInput()
            || this.model.movementUsed
            || this.model.phase !== 'move') {
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
        const result = this.model.commitPath(normalizedPath);
        const resultPath = this.#normalizePath(result?.path);
        const teleportSegments = toList(result?.events)
            .filter((event) => event?.type === 'teleported')
            .map((event) => ({
                from: cloneTile(event.from),
                to: cloneTile(event.to)
            }))
            .filter((segment) => segment.from && segment.to);
        if (result?.ok) {
            this.#spawnPathParticles(resultPath);
            this.cleanseSelected = false;
            this.cleanseTargets = [];
            this.#resetPlannedPath();
        }
        this.#afterModelChange(result);
        if (result?.ok) {
            this.#startPlayerPathPresentation(
                resultPath,
                teleportSegments
            );
        }
    }

    /**
     * 공격 선택 상태를 전환합니다.
     * @private
     */
    #applySelectAttack(payload = {}) {
        if (!this.#canAcceptBattleInput()
            || this.model.phase !== 'action'
            || this.model.actionUsed) {
            return;
        }
        const weapon = payload?.weapon === 'bow' ? 'bow' : 'melee';
        const selectingSameWeapon = this.attackSelected && this.attackWeapon === weapon;
        if (!selectingSameWeapon
            && toList(this.model.getValidTargets({ weapon })).length === 0) {
            return;
        }
        this.attackSelected = !selectingSameWeapon;
        this.attackWeapon = weapon;
        this.cleanseSelected = false;
        this.cleanseTargets = [];
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
        if (!this.#canAcceptBattleInput()
            || this.model.phase !== 'action'
            || this.model.actionUsed) {
            return;
        }
        const targetId = payload?.targetId
            || this.actionTargets[this.targetIndex]?.id
            || LORA_ID;
        if (!this.actionTargets.some((target) => target.id === targetId)) {
            return;
        }
        const result = this.model.attack(targetId, { weapon: this.attackWeapon });
        this.attackSelected = false;
        this.#afterModelChange(result);
        this.#startActionPresentation(result);
    }

    /**
     * 플레이어 회복 행동을 적용합니다.
     * @private
     */
    #applyHeal() {
        if (!this.#canAcceptBattleInput()
            || this.model.phase !== 'action'
            || this.model.actionUsed) {
            return;
        }
        const result = this.model.heal();
        this.attackSelected = false;
        this.#afterModelChange(result);
        this.#startActionPresentation(result);
    }

    /**
     * 플레이어가 행동을 아끼는 선택을 적용합니다.
     * @private
     */
    #applyIdle() {
        if (!this.#canAcceptBattleInput()
            || this.model.phase !== 'action'
            || this.model.actionUsed) {
            return;
        }
        const result = this.model.wait();
        this.attackSelected = false;
        this.cleanseSelected = false;
        this.#afterModelChange(result);
        this.#startActionPresentation(result);
    }

    /**
     * 이동 단계의 타일 정화 대상 선택을 전환합니다.
     * @private
     */
    #applySelectCleanse() {
        if (!this.#canAcceptBattleInput()
            || this.model.phase !== 'move'
            || this.model.movementUsed) {
            return;
        }
        const targets = toList(this.model.getCleanseTargets?.());
        if (targets.length === 0) {
            this.cleanseSelected = false;
            this.cleanseTargets = [];
            return;
        }
        this.cleanseSelected = !this.cleanseSelected;
        this.attackSelected = false;
        this.cleanseTargetIndex = 0;
        this.#refreshBattleCache();
        this.#startSelectionAnimation('attack');
    }

    /**
     * 선택한 negative 이벤트 타일에 정화제를 사용합니다.
     * @param {object} payload - 이벤트 타일 ID 또는 좌표입니다.
     * @private
     */
    #applyCleanseEventTile(payload) {
        if (!this.#canAcceptBattleInput() || !this.cleanseSelected) {
            return;
        }
        const target = payload?.id
            ? payload
            : this.cleanseTargets[this.cleanseTargetIndex];
        if (!target) {
            return;
        }
        const result = this.model.cleanseEventTile(target);
        this.cleanseSelected = false;
        this.cleanseTargets = [];
        this.#afterModelChange(result);
        this.#startActionPresentation(result, this.data.ANIMATION.SELECTION_SECONDS);
    }

    /**
     * 인벤토리 아이템을 사용합니다.
     * @param {object} payload - 아이템 ID입니다.
     * @private
     */
    #applyUseItem(payload) {
        if (!this.#canAcceptBattleInput()
            || this.model.phase !== 'action'
            || this.model.actionUsed) {
            return;
        }
        const itemId = payload?.itemId;
        if (typeof itemId !== 'string') {
            return;
        }
        const result = this.model.useItem(itemId);
        this.attackSelected = false;
        this.#afterModelChange(result);
        this.#startActionPresentation(result);
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
        this.cleanseSelected = false;
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
                - (Number(this.model?.loraActionsCompleted) || 0)
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

    /** 현재 런에서 쌓인 메타 변경을 이탈 경계에서 한 번만 저장합니다. @private */
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
        if (typeof id !== 'string' || this.data.FEATURES?.CUTSCENES !== true) {
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
     * 현재 논리 층의 인물 상태를 표현용으로 방어 복제합니다.
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
            lora: cloneCheckpointValue(this.model.lora)
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
        if (this.model.phase === 'move') {
            this.reachability = this.#normalizeReachability(this.model.getReachability());
        }
        if (this.model.phase === 'action' && !this.model.actionUsed && this.attackSelected) {
            this.actionTargets = toList(this.model.getValidTargets({
                weapon: this.attackWeapon
            })).map((target) => ({
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
        if (this.model.phase === 'move' && this.cleanseSelected) {
            this.cleanseTargets = toList(this.model.getCleanseTargets()).map((target) => ({
                ...target,
                x: Number(target.x),
                y: Number(target.y)
            }));
            this.cleanseTargetIndex = clampNumber(
                this.cleanseTargetIndex,
                0,
                Math.max(0, this.cleanseTargets.length - 1)
            );
            if (this.cleanseTargets.length === 0) {
                this.cleanseSelected = false;
            }
        } else if (!this.cleanseSelected) {
            this.cleanseTargets = [];
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
     * 정화 대상 선택 커서를 순환합니다.
     * @param {number} delta - 이동량입니다.
     * @private
     */
    #shiftCleanseTarget(delta) {
        const count = this.cleanseTargets.length;
        if (count <= 0 || delta === 0) {
            return;
        }
        this.cleanseTargetIndex = (
            this.cleanseTargetIndex + Math.sign(delta) + count
        ) % count;
    }

    /**
     * 플레이어 전투 입력을 받을 수 있는지 확인합니다.
     * @returns {boolean} 입력 가능 여부입니다.
     * @private
     */
    #canAcceptBattleInput() {
        return isTutorialBattleMode(this.mode)
            && !this.cutscenes.isOpen()
            && !this.presentationLocked
            && this.model?.turn === 'player'
            && !this.model?.result;
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
        if (this.mode === MODES.LOADING) {
            return;
        }
        if (this.presentationLocked) {
            return;
        }
        if (this.cutscenes.isOpen()) {
            if (this.#wasKeyPressed(KEY_CODES.CONFIRM)
                || this.#wasKeyPressed(KEY_CODES.ALTERNATE_CONFIRM)) {
                enqueueSimulationCommand({ type: COMMANDS.CUTSCENE_NEXT });
            } else if (this.#wasKeyPressed(KEY_CODES.CANCEL)) {
                enqueueSimulationCommand({ type: COMMANDS.CUTSCENE_CLOSE });
            }
            return;
        }

        if (this.mode === MODES.MENU) {
            if (this.#wasKeyPressed(KEY_CODES.CONFIRM)) {
                enqueueSimulationCommand({ type: COMMANDS.START });
            }
            return;
        }

        if (this.mode === MODES.STARTER) {
            if (this.#wasAnyKeyPressed(SELECTION_KEY_CODES.PREVIOUS)) {
                enqueueSimulationCommand({
                    type: COMMANDS.STARTER_SHIFT,
                    payload: { delta: -1 }
                });
            } else if (this.#wasAnyKeyPressed(SELECTION_KEY_CODES.NEXT)) {
                enqueueSimulationCommand({
                    type: COMMANDS.STARTER_SHIFT,
                    payload: { delta: 1 }
                });
            } else if (this.#wasKeyPressed(KEY_CODES.CONFIRM)) {
                enqueueSimulationCommand({ type: COMMANDS.CHOOSE_STARTER });
            } else if (this.#wasKeyPressed(KEY_CODES.CANCEL)) {
                enqueueSimulationCommand({ type: COMMANDS.RETURN_MENU });
            }
            return;
        }

        if (this.mode === MODES.GALLERY) {
            if (this.#wasAnyKeyPressed(SELECTION_KEY_CODES.PREVIOUS)) {
                enqueueSimulationCommand({
                    type: COMMANDS.GALLERY_SHIFT,
                    payload: { delta: -1 }
                });
            } else if (this.#wasAnyKeyPressed(SELECTION_KEY_CODES.NEXT)) {
                enqueueSimulationCommand({
                    type: COMMANDS.GALLERY_SHIFT,
                    payload: { delta: 1 }
                });
            } else if (this.#wasKeyPressed(KEY_CODES.CONFIRM)) {
                enqueueSimulationCommand({ type: COMMANDS.GALLERY_PLAY });
            } else if (this.#wasKeyPressed(KEY_CODES.CANCEL)) {
                enqueueSimulationCommand({ type: COMMANDS.RETURN_MENU });
            }
            return;
        }

        if (this.mode === MODES.RESULT) {
            if (this.#wasKeyPressed(KEY_CODES.RESTART)) {
                enqueueSimulationCommand({ type: COMMANDS.RESTART });
            } else if (this.#wasKeyPressed(KEY_CODES.CANCEL)) {
                enqueueSimulationCommand({ type: COMMANDS.RETURN_MENU });
            }
            return;
        }

        if (this.mode !== MODES.BATTLE) {
            return;
        }
        if (this.#wasKeyPressed(KEY_CODES.RESTART)) {
            enqueueSimulationCommand({ type: COMMANDS.RESTART });
            return;
        }
        if (this.#wasKeyPressed(KEY_CODES.CANCEL)) {
            enqueueSimulationCommand({ type: COMMANDS.RETURN_MENU });
            return;
        }
        if (!this.#canAcceptBattleInput()) {
            return;
        }

        if (this.#wasKeyPressed(KEY_CODES.PATH_BACK)) {
            enqueueSimulationCommand({ type: COMMANDS.PLAN_BACK });
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
        if (this.#wasKeyPressed(KEY_CODES.TARGET_NEXT)
            && (this.attackSelected || this.cleanseSelected)) {
            enqueueSimulationCommand({
                type: COMMANDS.PLAN_STEP,
                payload: { x: 1, y: 0 }
            });
        } else if (this.#wasKeyPressed(KEY_CODES.CONFIRM)) {
            if (this.cleanseSelected) {
                const target = this.cleanseTargets[this.cleanseTargetIndex];
                enqueueSimulationCommand({
                    type: COMMANDS.CLEANSE_EVENT_TILE,
                    payload: target
                });
            } else if (this.attackSelected) {
                enqueueSimulationCommand({
                    type: COMMANDS.ATTACK,
                    payload: { targetId: this.actionTargets[this.targetIndex]?.id }
                });
            } else if (this.model.phase === 'move') {
                enqueueSimulationCommand({ type: COMMANDS.COMMIT_PATH });
            }
        } else if (this.#wasKeyPressed(KEY_CODES.ACTION_MELEE)) {
            enqueueSimulationCommand({
                type: COMMANDS.SELECT_ATTACK,
                payload: { weapon: 'melee' }
            });
        } else if (this.#wasKeyPressed(KEY_CODES.ACTION_RANGED)) {
            enqueueSimulationCommand({
                type: COMMANDS.SELECT_ATTACK,
                payload: { weapon: 'bow' }
            });
        } else if (this.#wasKeyPressed(KEY_CODES.ACTION_HEAL)) {
            enqueueSimulationCommand({ type: COMMANDS.HEAL });
        } else if (this.#wasKeyPressed(KEY_CODES.ACTION_IDLE)) {
            enqueueSimulationCommand({ type: COMMANDS.IDLE });
        } else if (this.#wasKeyPressed(KEY_CODES.ALTERNATE_CONFIRM)) {
            enqueueSimulationCommand({ type: COMMANDS.IDLE });
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
        nextTile = TutorialBattleLayout.hitTestTile(
            this.#createBattleLayoutFrame(),
            mouse.x,
            mouse.y
        );
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
        } else if (nextTile && this.cleanseSelected) {
            const hoveredTargetIndex = this.cleanseTargets.findIndex((target) => (
                target.x === nextTile.x && target.y === nextTile.y
            ));
            if (hoveredTargetIndex >= 0
                && hoveredTargetIndex !== this.cleanseTargetIndex) {
                this.cleanseTargetIndex = hoveredTargetIndex;
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
        if (this.cleanseSelected) {
            const target = this.cleanseTargets.find((entry) => (
                entry.x === this.hoveredTile.x && entry.y === this.hoveredTile.y
            ));
            if (target) {
                enqueueSimulationCommand({
                    type: COMMANDS.CLEANSE_EVENT_TILE,
                    payload: target
                });
            }
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
        const endpoint = this.plannedPath[this.plannedPath.length - 1];
        const dx = this.hoveredTile.x - (endpoint?.x ?? this.model.player.x);
        const dy = this.hoveredTile.y - (endpoint?.y ?? this.model.player.y);
        if (this.model.phase === 'move' && Math.abs(dx) + Math.abs(dy) === 1) {
            enqueueSimulationCommand({
                type: COMMANDS.PLAN_STEP,
                payload: { x: dx, y: dy }
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
     * 비전투 뷰가 공유하는 직렬화 가능 표시 프레임을 만듭니다.
     * @returns {object} 뷰포트·글꼴·색상 스냅샷입니다.
     * @private
     */
    #createNonbattleViewFrame() {
        return Object.freeze({
            viewport: Object.freeze({
                WW: this.WW,
                WH: this.WH,
                UIWW: this.UIWW,
                UIOffsetX: this.UIOffsetX
            }),
            fonts: Object.freeze({ ...this.fonts }),
            colors: Object.freeze({
                UI: Object.freeze({ ...ColorSchemes.Tactics.UI })
            })
        });
    }

    /** @returns {object} 로딩 뷰 모델입니다. @private */
    #createLoadingViewModel() {
        return Object.freeze({
            ...this.#createNonbattleViewFrame(),
            message: '진행도 불러오는 중…'
        });
    }

    /** @returns {object} 메인 메뉴 뷰 모델입니다. @private */
    #createMenuViewModel() {
        return Object.freeze({
            ...this.#createNonbattleViewFrame(),
            title: this.data.TEXT.TITLE,
            subtitle: this.data.TEXT.SUBTITLE,
            playCount: Number(this.meta?.playCount) || 0,
            bestScore: Number(this.meta?.bestScore) || 0
        });
    }

    /** @returns {object} 스타터 선택 뷰 모델입니다. @private */
    #createStarterViewModel() {
        return Object.freeze({
            ...this.#createNonbattleViewFrame(),
            choices: Object.freeze(this.data.STARTER_CHOICES.map((choice) => Object.freeze({
                id: choice.id,
                label: choice.label,
                description: choice.description
            }))),
            selectedIndex: this.starterIndex,
            selectionProgress: Number(this.presentation.menuSelectionProgress) || 0,
            selectionMinScale: Number(this.data.ANIMATION.SELECTION_MIN_SCALE) || 0.72
        });
    }

    /** @returns {object} 갤러리 뷰 모델입니다. @private */
    #createGalleryViewModel() {
        return Object.freeze({
            ...this.#createNonbattleViewFrame(),
            entries: Object.freeze(this.galleryEntries.map((entry) => Object.freeze({
                id: entry.id,
                title: entry.title,
                cardCount: Array.isArray(entry.cards) ? entry.cards.length : 0,
                unlocked: this.#isCutsceneUnlocked(entry.id)
            }))),
            selectedIndex: this.galleryIndex,
            selectionProgress: Number(this.presentation.menuSelectionProgress) || 0,
            selectionMinScale: Number(this.data.ANIMATION.SELECTION_MIN_SCALE) || 0.72
        });
    }

    /** @returns {object} 결과 뷰 모델입니다. @private */
    #createResultViewModel() {
        return Object.freeze({
            ...this.#createNonbattleViewFrame(),
            result: Object.freeze({ ...(this.resultData || {}) }),
            bestScore: Number(this.meta?.bestScore) || 0,
            presentationLocked: this.presentationLocked
        });
    }

    /** @returns {object} 컷씬 카드 뷰 모델입니다. @private */
    #createCutsceneViewModel() {
        return Object.freeze({
            ...this.#createNonbattleViewFrame(),
            state: Object.freeze({ ...this.cutscenes.getState() }),
            card: Object.freeze({ ...(this.cutscenes.getCurrentCard() || {}) }),
            presentationLocked: this.presentationLocked
        });
    }

    /**
     * 렌더와 히트테스트가 공유할 현재 전투 투영 프레임을 만듭니다.
     * @param {object|null} [floor=this.#getCurrentFloor()] - 표시 중인 층입니다.
     * @returns {object} 직렬화 가능한 전투 레이아웃입니다.
     * @private
     */
    #createBattleLayoutFrame(floor = this.#getCurrentFloor()) {
        return this.battleLayout.createFrame({
            floor,
            elapsedSeconds: this.elapsedSeconds,
            screenShakeSeconds: this.screenShakeSeconds
        });
    }

    /**
     * 한 프레임의 모델·선택·표현·HUD 상태를 읽기 전용 BattleViewModel로 조립합니다.
     * @returns {object|null} 세 전투 뷰가 함께 소비할 프레임입니다.
     * @private
     */
    #createBattleViewModel() {
        if (!this.model) {
            return null;
        }
        const snapshot = this.#getSnapshot();
        if (!snapshot) {
            return null;
        }
        const floor = cloneCheckpointValue(this.#getCurrentFloor() || snapshot.floor);
        const presentation = Object.freeze(cloneCheckpointValue(this.presentation));
        const layout = this.#createBattleLayoutFrame(floor);
        const inventoryEntries = this.#getInventoryEntries();
        const inventory = this.battleHudView.getInventoryPaging(
            inventoryEntries,
            this.inventoryPage,
            this.data.LAYOUT.INVENTORY.PAGE_SIZE
        );
        this.inventoryPage = inventory.page;
        const ready = this.#canAcceptBattleInput();
        const actionReady = ready
            && snapshot.phase === 'action'
            && !snapshot.actionUsed;
        const meleeTargets = toList(this.model.getValidTargets({ weapon: 'melee' }));
        const bowTargets = toList(this.model.getValidTargets({ weapon: 'bow' }));
        const cleanseTargets = toList(this.model.getCleanseTargets?.());
        const itemMetadata = Object.freeze(Object.fromEntries(
            Object.entries(this.data.ITEMS).map(([itemId, item]) => ([itemId, Object.freeze({
                id: itemId,
                label: item.label || itemId,
                known: this.#isItemKnown(itemId),
                hasIcon: this.itemIconCanvases.has(itemId),
                usable: this.#isItemUsable(itemId),
                movementConsumable: itemId === 'tile-cleanser'
            })]))
        ));
        const pagedInventory = Object.freeze({
            page: inventory.page,
            pageCount: inventory.pageCount,
            entries: Object.freeze(inventory.entries.map((entry) => {
                const metadata = itemMetadata[entry.itemId] || {};
                const movementConsumable = metadata.movementConsumable === true;
                return Object.freeze({
                    itemId: entry.itemId,
                    count: Number(entry.count) || 0,
                    label: metadata.known ? metadata.label : '미확인',
                    known: metadata.known === true,
                    hasIcon: metadata.hasIcon === true,
                    movementConsumable,
                    usable: movementConsumable
                        ? ready && snapshot.phase === 'move' && cleanseTargets.length > 0
                        : actionReady && metadata.usable === true
                });
            }))
        });
        const pathExtensions = [];
        if (Number(presentation.floorIndex) === (Number(snapshot.floorIndex) || 0)
            && snapshot.phase === 'move') {
            for (const direction of KEY_DIRECTIONS) {
                const extension = this.#normalizePath(this.model.extendPath(
                    this.plannedPath,
                    direction.x,
                    direction.y
                ));
                pathExtensions.push(Object.freeze(
                    extension.slice(this.plannedPath.length)
                        .map((tile) => Object.freeze({ ...tile }))
                ));
            }
        }
        const movePreview = snapshot.phase === 'move'
            ? cloneCheckpointValue(this.model.previewPath(this.plannedPath))
            : null;
        return Object.freeze({
            viewport: layout.viewport,
            layout,
            fonts: Object.freeze({ ...this.fonts }),
            colors: ColorSchemes.Tactics,
            snapshot: Object.freeze(snapshot),
            floor: Object.freeze(floor || {}),
            world: Object.freeze({
                elapsedSeconds: this.elapsedSeconds,
                presentation,
                floorActors: this.floorActorView
                    ? Object.freeze(cloneCheckpointValue(this.floorActorView))
                    : null,
                plannedPath: Object.freeze(this.plannedPath.map((tile) => Object.freeze({ ...tile }))),
                reachability: Object.freeze(Array.from(this.reachability.values()).map(
                    (entry) => Object.freeze(cloneCheckpointValue(entry))
                )),
                pathExtensions: Object.freeze(pathExtensions),
                hoveredTile: this.hoveredTile
                    ? Object.freeze({ ...this.hoveredTile })
                    : null,
                attackSelected: this.attackSelected,
                attackWeapon: this.attackWeapon,
                actionTargets: Object.freeze(this.actionTargets.map(
                    (target) => Object.freeze(cloneCheckpointValue(target))
                )),
                targetIndex: this.targetIndex,
                cleanseSelected: this.cleanseSelected,
                cleanseTargets: Object.freeze(this.cleanseTargets.map(
                    (target) => Object.freeze(cloneCheckpointValue(target))
                )),
                cleanseTargetIndex: this.cleanseTargetIndex,
                itemMetadata,
                feedback: Object.freeze({
                    flashSeconds: this.flashSeconds,
                    stabilizeSeconds: this.stabilizeSeconds
                }),
                config: Object.freeze({
                    attackRange: this.data.ACTORS.PLAYER.ATTACK_RANGE,
                    pathMarkerRatio: this.data.LAYOUT.BOARD.PATH_MARKER_RATIO,
                    shadowOffsetRatio: this.data.LAYOUT.BOARD.SHADOW_OFFSET_RATIO,
                    selectionMinScale: this.data.ANIMATION.SELECTION_MIN_SCALE,
                    actionPlayerScale: this.data.ANIMATION.ACTION_PLAYER_SCALE,
                    actionLoraScale: this.data.ANIMATION.ACTION_LORA_SCALE,
                    itemAtlas: this.data.SPRITES.ITEM_ATLAS,
                    loraSprite: this.data.SPRITES.LORA
                })
            }),
            hud: Object.freeze({
                presentationLocked: this.presentationLocked,
                attackSelected: this.attackSelected,
                attackWeapon: this.attackWeapon,
                cleanseSelected: this.cleanseSelected,
                instabilityState: Object.freeze(cloneCheckpointValue(
                    this.model.getInstabilityState?.() || {}
                )),
                movePreview: movePreview ? Object.freeze(movePreview) : null,
                eventLog: Object.freeze([...this.eventLog]),
                inventory: pagedInventory,
                controls: Object.freeze({
                    ready,
                    actionReady,
                    meleeTargetCount: meleeTargets.length,
                    bowTargetCount: bowTargets.length,
                    hasBow: inventoryEntries.some((entry) => entry.itemId === 'bow'),
                    cleanseTargetCount: cleanseTargets.length
                }),
                config: Object.freeze({
                    actions: this.data.LAYOUT.ACTIONS,
                    inventory: this.data.LAYOUT.INVENTORY,
                    itemAtlas: this.data.SPRITES.ITEM_ATLAS,
                    text: this.data.TEXT,
                    floorTransitionAfterTurn: this.data.RULES.FLOOR_TRANSITION_AFTER_TURN,
                    playerMoveRange: this.data.ACTORS.PLAYER.MOVE_RANGE
                })
            }),
            feedback: Object.freeze({
                floatingTexts: Object.freeze(this.floatingTexts.map(
                    (entry) => Object.freeze({ ...entry })
                )),
                particles: Object.freeze(this.particles.map(
                    (entry) => Object.freeze({ ...entry })
                ))
            })
        });
    }

    /**
     * 현재 모드와 전투 상태가 달라졌을 때 버튼을 다시 만듭니다.
     * @private
     */
    #ensureButtons() {
        const signature = this.#getButtonSignature();
        if (this.buttonHost.isCurrent(signature)) {
            return;
        }
        this.buttonHost.setButtons(
            signature,
            this.#getButtonSpecs(),
            this.#createButtonHostStyle()
        );
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
            String(this.model?.phase),
            String(this.model?.movementUsed),
            String(this.model?.actionUsed),
            String(this.model?.actionsUsed),
            String(this.model?.actionsPerTurn),
            String(this.model?.loraActionsCompleted),
            String(this.attackSelected),
            String(this.attackWeapon),
            String(this.cleanseSelected),
            String(this.cleanseTargetIndex),
            this.plannedPath.map((point) => toTileKey(point.x, point.y)).join('>'),
            String(this.inventoryPage),
            String(this.presentationLocked),
            inventory
        ].join('/');
    }

    /**
     * 현재 화면에 필요한 풀 기반 버튼을 구성합니다.
     * @private
     */
    #getButtonSpecs() {
        const buttonGroup = getTutorialModePolicy(this.mode)?.buttons;
        if (!buttonGroup) {
            return [];
        }
        if (this.cutscenes.isOpen()) {
            return this.cutsceneView.getButtonSpecs(this.#createCutsceneViewModel());
        }
        if (buttonGroup === 'menu') {
            return this.menuView.getButtonSpecs(this.#createMenuViewModel());
        }
        if (buttonGroup === 'starter') {
            return this.starterView.getButtonSpecs(this.#createStarterViewModel());
        }
        if (buttonGroup === 'gallery') {
            return this.galleryView.getButtonSpecs(this.#createGalleryViewModel());
        }
        if (buttonGroup === 'battle') {
            return this.#getBattleButtonSpecs();
        }
        if (buttonGroup === 'result') {
            return this.resultView.getButtonSpecs(this.#createResultViewModel());
        }
        return [];
    }

    /**
     * 버튼 호스트가 현재 테마와 해상도로 사용할 스타일을 만듭니다.
     * @returns {object} 버튼 공통 스타일입니다.
     * @private
     */
    #createButtonHostStyle() {
        const colors = ColorSchemes.Tactics;
        return {
            font: {
                family: this.data.TYPOGRAPHY.BUTTON.FAMILY,
                weight: this.data.TYPOGRAPHY.BUTTON.WEIGHT,
                size: clampNumber(
                    this.UIWW * (this.data.TYPOGRAPHY.BUTTON.SIZE_UIWW / 100),
                    this.data.TYPOGRAPHY.BUTTON.MIN,
                    this.data.TYPOGRAPHY.BUTTON.MAX
                )
            },
            defaultRadius: this.#uwh(this.data.LAYOUT.ACTIONS.BUTTON_RADIUS_WH),
            hoverScale: Number(this.data.ANIMATION.BUTTON_HOVER_SCALE) || 1.035,
            pressScale: Number(this.data.ANIMATION.BUTTON_PRESS_SCALE) || 0.965,
            colors: {
                text: colors.UI.Text,
                muted: colors.UI.Muted,
                accent: colors.UI.Accent,
                idle: colors.UI.ButtonIdle,
                hover: colors.UI.ButtonHover,
                disabled: colors.UI.ButtonDisabled
            }
        };
    }

    /**
     * 전투 행동과 인벤토리 버튼을 구성합니다.
     * @private
     */
    #getBattleButtonSpecs() {
        if (!this.model) {
            return [];
        }
        return this.battleHudView
            .getButtonSpecs(this.#createBattleViewModel())
            .map((spec) => {
                const { iconId, iconWidth, ...resolved } = spec;
                if (!iconId || !(Number(iconWidth) > 0)) {
                    return resolved;
                }
                return {
                    ...resolved,
                    icon: this.#createItemIconChild(iconId, iconWidth)
                };
            });
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
        return this.battleHudView.getInventoryPaging(
            entries,
            this.inventoryPage,
            this.data.LAYOUT.INVENTORY.PAGE_SIZE
        );
    }

    /**
     * 명령 경계에서 인벤토리 표시 페이지를 순환합니다.
     * @param {object} payload - 페이지 이동량입니다.
     * @private
     */
    #applyInventoryPageShift(payload) {
        if (this.mode !== MODES.BATTLE || !this.model) {
            return;
        }
        const paging = this.#getInventoryPaging();
        if (paging.pageCount <= 1) {
            return;
        }
        const delta = Number(payload?.delta) || 0;
        if (delta === 0) {
            return;
        }
        this.inventoryPage = (
            paging.page + Math.sign(delta) + paging.pageCount
        ) % paging.pageCount;
        this.buttonHost.invalidate();
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
            || Boolean(this.data.ITEMS[itemId]);
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

        this.battleLayout.resize({
            WW: this.WW,
            WH: this.WH,
            UIWW: this.UIWW,
            UIOffsetX: this.UIOffsetX
        });
        this.buttonHost.invalidate();
        this.#ensureButtons();
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
        this.buttonHost.invalidate();
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
        this.buttonHost.invalidate();
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
                this.data.ANIMATION.FLOOR_FADE_SECONDS
            ),
            this.#animateSlot(
                'player-scale',
                this.presentation,
                'playerScale',
                this.data.ANIMATION.TELEPORT_MIN_SCALE,
                this.data.ANIMATION.FLOOR_FADE_SECONDS
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
        this.buttonHost.invalidate();
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
        this.buttonHost.invalidate();
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
        if (event.type === 'event-tile-triggered') {
            const labels = {
                damage: '피해 -20 이벤트 타일 발동',
                'move-penalty': '이동력 -2 이벤트 타일 발동',
                'instability-up': '불안정도 +10 이벤트 타일 발동',
                'instability-down': '불안정도 -10 이벤트 타일 발동'
            };
            return labels[event.eventType] || '이벤트 타일 발동';
        }
        if (event.type === 'instability-changed') {
            const change = Math.round(Number(event.change) || 0);
            return '로라 불안정도 ' + (change >= 0 ? '+' : '') + String(change);
        }
        const values = {
            'item-picked': itemLabel + ' 획득',
            'item-dropped': itemLabel + ' 드롭',
            'wall-destroyed': '벽 파괴',
            teleported: '텔레포트 작동',
            'mob-damaged': '몹에게 ' + String(damage) + ' 피해',
            'mob-defeated': '몹 격파',
            'lora-damaged': '로라에게 ' + String(damage) + ' 피해',
            'player-healed': '플레이어 HP 회복',
            'player-damaged': '플레이어가 ' + String(damage) + ' 피해',
            'item-used': itemLabel + ' 사용',
            'player-waited': '플레이어 대기',
            'event-tile-cleansed': '이벤트 타일을 positive로 정화',
            'extra-player-turn': '거울 효과 · 플레이어 추가 턴 예약',
            'mob-attack': '몹 공격 ' + String(damage) + ' 피해',
            'mob-waited': '몹 대기',
            'mushroom-activated': '버섯 효과 · 이동과 공격 2배',
            'mushroom-ended': '피해를 받아 버섯 효과 종료',
            peace: '로라가 공격하지 않았습니다.',
            'lora-attack': '로라 공격',
            'floor-transition': '6번째 로라 행동 종료 · 지하층 붕괴',
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
            'path-cost-exceeded': '남은 이동력이 부족합니다.',
            'blocked-by-wall': '벽이 경로를 막고 있습니다.',
            'blocked-by-lora': '로라가 그 타일을 점유하고 있습니다.',
            'blocked-by-mob': '몹이 그 타일을 점유하고 있습니다.',
            'out-of-range': '대상이 범위 밖에 있습니다.',
            'invalid-target': '선택할 수 없는 대상입니다.',
            'item-missing': '해당 아이템이 없습니다.',
            'item-not-owned': '해당 아이템을 보유하지 않았습니다.',
            'passive-item': '자동 적용 아이템은 직접 사용할 수 없습니다.',
            'item-already-used': '이번 플레이에서 이미 사용한 아이템입니다.',
            'peace-active': '평화 효과 중에는 공격할 수 없습니다.',
            'invalid-event-tile': '정화 가능한 negative 이벤트 타일을 선택하세요.'
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
        if (event.type === 'lora-attack' || event.type === 'mob-attack') {
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
        const layout = this.#createBattleLayoutFrame();
        const point = TutorialBattleLayout.projectTile(layout, tile.x, tile.y);
        const damage = Math.max(
            0,
            Math.round(Number(event.damage ?? event.amount) || 0)
        );
        const heal = Math.max(0, Math.round(Number(event.amount || event.heal) || 0));
        if (damage > 0) {
            this.floatingTexts.push({
                text: '-' + String(damage),
                x: point.x,
                y: point.y - (layout.tileSide * 0.42),
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
                y: point.y - (layout.tileSide * 0.42),
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
        const layout = this.#createBattleLayoutFrame();
        for (let index = 0; index < count; index++) {
            const tile = steps[index % steps.length];
            const point = TutorialBattleLayout.projectTile(layout, tile.x, tile.y);
            this.particles.push({
                x: point.x,
                y: point.y,
                dx: (Math.random() - 0.5) * layout.tileSide,
                dy: -layout.tileSide * (0.2 + (Math.random() * 0.5)),
                size: layout.tileSide * 0.12,
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

}
