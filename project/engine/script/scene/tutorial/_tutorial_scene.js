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
import { TutorialAchievementEvaluator } from './_tutorial_achievement_evaluator.js';
import { TutorialBattleFocusController } from './_tutorial_battle_focus_controller.js';
import { TutorialBattleCamera } from './_tutorial_battle_camera.js';
import { TutorialCombatReadabilityPresenter } from './_tutorial_combat_readability_presenter.js';
import { TutorialCutsceneController } from './_tutorial_cutscene_controller.js';
import { TutorialCutsceneTriggerRouter } from './_tutorial_cutscene_trigger_router.js';
import { TutorialGalleryController } from './_tutorial_gallery_controller.js';
import { TutorialGuidanceController } from './_tutorial_guidance_controller.js';
import {
    createDefaultTutorialMeta,
    identifyTutorialItem,
    isTutorialMetaFutureVersionError,
    loadTutorialMeta,
    markTutorialCombatGuideSeen,
    markTutorialOpeningWatched,
    recordTutorialResult,
    saveTutorialMeta,
    unlockTutorialAchievement,
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
import { TutorialAnimationTimeline } from './_tutorial_animation_timeline.js';
import { TutorialAchievementBanner } from './_tutorial_achievement_banner.js';
import { TutorialAssetLoader } from './_tutorial_asset_loader.js';
import { TutorialAssetPort } from './_tutorial_asset_port.js';
import { TutorialAudioDirector } from './_tutorial_audio_director.js';
import { TutorialBattlePresenter } from './_tutorial_battle_presenter.js';
import { TutorialFeedbackQueue } from './_tutorial_feedback_queue.js';
import { TutorialSpriteAnimator } from './_tutorial_sprite_animator.js';
import { TutorialSpriteClipResolver } from './_tutorial_sprite_clip_resolver.js';
import { TutorialSpriteCueRouter } from './_tutorial_sprite_cue_router.js';
import { TutorialSpriteRoster } from './_tutorial_sprite_roster.js';
import { TutorialBattleFeedbackView } from './view/_tutorial_battle_feedback_view.js';
import { TutorialBattleHudView } from './view/_tutorial_battle_hud_view.js';
import { TutorialBattleLayout } from './view/_tutorial_battle_layout.js';
import { TutorialBattleTutorialView } from './view/_tutorial_battle_tutorial_view.js';
import { TutorialBattleWorldView } from './view/_tutorial_battle_world_view.js';
import { TutorialAchievementView } from './view/_tutorial_achievement_view.js';
import { TutorialButtonHost } from './view/_tutorial_button_host.js';
import { TutorialCutsceneView } from './view/_tutorial_cutscene_view.js';
import { TutorialGalleryView } from './view/_tutorial_gallery_view.js';
import { TutorialLoadingView } from './view/_tutorial_loading_view.js';
import { TutorialMenuView } from './view/_tutorial_menu_view.js';
import { TutorialPauseView } from './view/_tutorial_pause_view.js';
import { TutorialResultView } from './view/_tutorial_result_view.js';
import { TutorialStarterView } from './view/_tutorial_starter_view.js';

const TUTORIAL_GAME_DATA = getData('TUTORIAL_GAME_DATA');
const TUTORIAL_CONTENT_DATA = getData('TUTORIAL_CONTENT_DATA');
const TUTORIAL_ASSET_MANIFEST = getData('TUTORIAL_ASSET_MANIFEST');
const TUTORIAL_SPRITE_CLIPS = getData('TUTORIAL_SPRITE_CLIPS');

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
        this.content = TUTORIAL_CONTENT_DATA;
        this.mode = MODES.LOADING;
        this.model = null;
        this.floorView = null;
        this.floorActorView = null;
        this.meta = createDefaultTutorialMeta();
        this.committedMeta = cloneCheckpointValue(this.meta);
        this.metaStaging = false;
        this.metaWritesBlocked = false;
        this.cutscenes = new TutorialCutsceneController(this.data.CUTSCENES);
        const knownCutsceneIds = Object.values(this.data.CUTSCENES).map(
            (entry) => entry.id
        );
        this.cutsceneTriggers = new TutorialCutsceneTriggerRouter({
            triggerData: this.content.CUTSCENE_TRIGGERS,
            knownCutsceneIds
        });
        this.galleryController = new TutorialGalleryController({
            content: this.content,
            cutscenes: this.data.CUTSCENES
        });
        this.achievementEvaluator = new TutorialAchievementEvaluator(
            this.content.ACHIEVEMENTS
        );
        this.cutsceneReturnMode = MODES.MENU;
        this.pendingCutscenes = [];
        this.pendingEndingCutsceneId = null;
        this.runCutsceneIds = new Set();
        this.battleFocus = new TutorialBattleFocusController();
        this.guidance = new TutorialGuidanceController();
        this.starterIndex = Math.max(
            0,
            this.data.STARTER_CHOICES.findIndex((choice) => choice.id === 'mascot-costume')
        );
        this.starterItemId = this.data.STARTER_CHOICES[this.starterIndex]?.id || 'mascot-costume';
        this.resultData = null;
        this.resultRecorded = false;
        this.pauseIndex = 0;
        this.destroyed = false;
        this.saveSequence = Promise.resolve();
        this.timelineRevision = 0;
        this.lastPresentationSnapshot = null;
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
        this.assetLoader = new TutorialAssetLoader({
            onChange: () => this.buttonHost?.invalidate()
        });
        this.assetPort = new TutorialAssetPort(
            this.assetLoader,
            TUTORIAL_ASSET_MANIFEST
        );
        this.loadingView = new TutorialLoadingView(tutorialRenderPort);
        this.menuView = new TutorialMenuView(tutorialRenderPort, this.assetPort);
        this.starterView = new TutorialStarterView(tutorialRenderPort, this.assetPort);
        this.pauseView = new TutorialPauseView(tutorialRenderPort, this.assetPort);
        this.galleryView = new TutorialGalleryView(tutorialRenderPort, this.assetPort);
        this.resultView = new TutorialResultView(tutorialRenderPort, this.assetPort);
        this.cutsceneView = new TutorialCutsceneView(tutorialRenderPort);
        this.battleTutorialView = new TutorialBattleTutorialView(
            tutorialRenderPort,
            this.assetPort
        );
        this.battleLayout = new TutorialBattleLayout({
            map: this.data.MAP,
            floors: this.data.FLOORS,
            mapArtwork: TUTORIAL_ASSET_MANIFEST.MAPS,
            camera: this.data.LAYOUT.CAMERA,
            board: this.data.LAYOUT.BOARD,
            hud: this.data.LAYOUT.HUD,
            shakeTileRatio: this.data.ANIMATION.SHAKE_TILE_RATIO
        });
        this.battleCamera = new TutorialBattleCamera({
            durationSeconds: this.data.ANIMATION.CAMERA_FOLLOW_SECONDS
        });
        this.buttonHost = new TutorialButtonHost({
            parent: this,
            onCommand: (type, payload) => this.#queueUiCommand(type, payload),
            onFocus: (key) => this.#focusBattleControl(key),
            assetPort: this.assetPort,
            renderPort: tutorialRenderPort
        });
        this.battleWorldView = new TutorialBattleWorldView(
            tutorialRenderPort,
            this.assetPort
        );
        this.battleHudView = new TutorialBattleHudView(
            tutorialRenderPort,
            this.assetPort
        );
        this.battleFeedbackView = new TutorialBattleFeedbackView(tutorialRenderPort);
        this.battleAchievementView = new TutorialAchievementView(
            tutorialRenderPort,
            this.assetPort
        );
        this.battlePresenter = new TutorialBattlePresenter({
            items: this.data.ITEMS,
            animation: this.data.ANIMATION
        });
        this.combatReadability = new TutorialCombatReadabilityPresenter({
            items: this.data.ITEMS,
            reasonCopy: this.data.TEXT.COMBAT_REASONS
        });
        this.feedbackQueue = new TutorialFeedbackQueue({
            eventLogLimit: this.data.RULES.EVENT_LOG_LIMIT,
            particleCount: this.data.ANIMATION.PARTICLE_COUNT,
            particleSeconds: this.data.ANIMATION.PARTICLE_SECONDS
        });
        this.audioDirector = new TutorialAudioDirector({
            soundPort: this.sceneSystem?.systemHandler?.soundSystem,
            instabilityThreshold: this.data.ACTORS.LORA.INSTABILITY_STATES.find(
                (state) => state.id === 'unstable'
            )?.min ?? 61
        });
        const spriteClipResolver = new TutorialSpriteClipResolver(TUTORIAL_SPRITE_CLIPS);
        this.spriteAnimator = new TutorialSpriteAnimator({
            resolver: spriteClipResolver
        });
        this.spriteRoster = new TutorialSpriteRoster(this.spriteAnimator);
        this.spriteCueRouter = new TutorialSpriteCueRouter({
            animator: this.spriteAnimator,
            onCue: (cue) => this.feedbackQueue.enqueue([cue])
        });
        this.achievementBanner = new TutorialAchievementBanner({
            durationSeconds: 3
        });
        this.presentationTimeline = new TutorialAnimationTimeline({
            animationPort: Object.freeze({ animate, remove }),
            config: this.data.ANIMATION,
            onLockChange: () => this.buttonHost.invalidate()
        });
        this.assetPort.loadAll();

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
                this.metaWritesBlocked = isTutorialMetaFutureVersionError(error);
                if (this.metaWritesBlocked) {
                    console.warn('더 최신 버전의 진행도를 보호하기 위해 이번 실행의 메타 저장을 중지합니다.');
                }
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
        if (this.mode === MODES.PAUSE) {
            this.audioDirector.sync(this.#createAudioState());
            this.#captureKeyboardLatch();
            return;
        }
        this.#updateBattleCamera(deltaSeconds);
        this.#updatePointerState();
        this.#handlePointerInput();
        this.#updateLoraTurn(deltaSeconds);
        this.#syncSpriteRoster();
        this.spriteCueRouter.update(deltaSeconds);
        this.#enterResultIfNeeded();
        this.feedbackQueue.update(deltaSeconds);
        this.achievementBanner.update(deltaSeconds);
        this.audioDirector.consume(this.feedbackQueue.drainAudioCues());
        this.audioDirector.sync(this.#createAudioState());
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
        } else if (view === 'battle' || view === 'pause') {
            const battleViewModel = this.#createBattleViewModel();
            this.battleWorldView.draw(battleViewModel);
            this.battleFeedbackView.draw(battleViewModel);
            this.battleHudView.draw(battleViewModel);
            this.battleAchievementView.draw(battleViewModel);
            if (view === 'battle') {
                this.battleTutorialView.draw(
                    this.#createBattleTutorialViewModel(battleViewModel)
                );
            } else {
                this.pauseView.draw(this.#createPauseViewModel());
            }
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
                case COMMANDS.PAUSE:
                    this.#applyPause();
                    break;
                case COMMANDS.RESUME:
                    this.#applyResume();
                    break;
                case COMMANDS.PAUSE_SHIFT:
                    this.#applyPauseShift(command.payload);
                    break;
                case COMMANDS.RESTART:
                    this.#applyRestart();
                    break;
                case COMMANDS.GALLERY_SECTION_SHIFT:
                    this.#applyGallerySectionShift(command.payload);
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
                case COMMANDS.PLAN_RESET:
                    this.#applyPlanReset();
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
                case COMMANDS.FOCUS_SHIFT:
                    this.#applyFocusShift(command.payload);
                    break;
                case COMMANDS.SELECT_CLEANSE:
                    this.#applySelectCleanse();
                    break;
                case COMMANDS.CLEANSE_EVENT_TILE:
                    this.#applyCleanseEventTile(command.payload);
                    break;
                case COMMANDS.GUIDE_SHOW:
                    this.#applyGuideShow();
                    break;
                case COMMANDS.GUIDE_DISMISS:
                    this.#applyGuideDismiss();
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

            this.audioDirector.playCommand(command.type);

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
        this.feedbackQueue.clearTransient();
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
        this.presentationTimeline.destroy();
        this.battleCamera.destroy();
        this.spriteCueRouter.destroy();
        this.assetLoader.destroy();
        this.feedbackQueue.destroy();
        this.achievementBanner.destroy();
        this.audioDirector.destroy();
        clearSimulationCommands();
        this.buttonHost.destroy();
        this.cutscenes.close();
        this.cutsceneTriggers.reset();
        this.pendingCutscenes = [];
        this.pendingEndingCutsceneId = null;
        this.runCutsceneIds.clear();
        this.battleFocus.reset();
        this.guidance.reset();
        this.loraTurnState = null;
        this.floorView = null;
        this.floorActorView = null;
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
        this.presentationTimeline.startSelection('menu-selection');
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

    /** 안정된 전투 프레임을 파괴하지 않고 Pause 모드로 전환합니다. @private */
    #applyPause() {
        if (this.mode !== MODES.BATTLE
            || !this.model
            || this.cutscenes.isOpen()
            || this.guidance.isOpen()
            || this.presentationTimeline.isLocked()) {
            return;
        }
        this.pauseIndex = 0;
        this.hoveredTile = null;
        this.hoveredTileKey = '';
        this.mode = MODES.PAUSE;
        this.buttonHost.invalidate();
    }

    /** Pause 이전과 동일한 모델·표현 상태로 전투를 재개합니다. @private */
    #applyResume() {
        if (this.mode !== MODES.PAUSE || !this.model) {
            return;
        }
        this.mode = MODES.BATTLE;
        this.buttonHost.invalidate();
    }

    /** Pause 세로 메뉴의 키보드 선택을 순환합니다. @param {object} payload @private */
    #applyPauseShift(payload) {
        if (this.mode !== MODES.PAUSE) {
            return;
        }
        const delta = Math.sign(Number(payload?.delta) || 0);
        if (delta === 0) {
            return;
        }
        this.pauseIndex = (this.pauseIndex + delta + 3) % 3;
        this.presentationTimeline.startSelection('menu-selection');
        this.buttonHost.invalidate();
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
        this.presentationTimeline.cancel();
        this.battleCamera.clear();
        this.spriteCueRouter.reset();
        this.audioDirector.resetTransient();
        this.cutscenes.close();
        this.cutsceneTriggers.reset();
        this.pendingCutscenes = [];
        this.pendingEndingCutsceneId = null;
        this.runCutsceneIds.clear();
        this.cutsceneReturnMode = nextMode;
        this.model = null;
        this.floorView = null;
        this.floorActorView = null;
        this.mode = nextMode;
        this.resultData = null;
        this.resultRecorded = false;
        this.pauseIndex = 0;
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
        this.battleFocus.reset();
        this.guidance.reset();
        this.reachability.clear();
        this.actionTargets = [];
        this.plannedPath = [];
        this.lastPresentationSnapshot = null;
        this.feedbackQueue.clear();
        this.achievementBanner.clear();
        this.buttonHost.invalidate();
    }

    /**
     * 새 모델과 뷰 상태로 전투를 시작합니다.
     * @param {string} starterItemId - 스타터 아이템 ID입니다.
     * @private
     */
    #beginRun(starterItemId) {
        this.timelineRevision += 1;
        this.presentationTimeline.cancel();
        this.spriteCueRouter.reset();
        this.audioDirector.resetTransient();
        this.metaStaging = true;
        this.starterItemId = starterItemId;
        const knowledge = {
            discoveredItemIds: [...this.meta.identifiedItemIds],
            identifiedItemIds: [...this.meta.identifiedItemIds],
            revealedTrapIds: [...this.meta.revealedEventTileIds],
            unlockedCutsceneIds: [...this.meta.unlockedCutsceneIds]
        };
        this.model = new TutorialBattleModel(this.data, { knowledge });
        this.model.reset({ starterItemId });
        const initialSnapshot = this.#getSnapshot();
        this.mode = MODES.BATTLE;
        this.resultData = null;
        this.resultRecorded = false;
        this.pendingCutscenes = [];
        this.pendingEndingCutsceneId = null;
        this.runCutsceneIds = new Set();
        const openingCutsceneIds = this.cutsceneTriggers.beginRun(this.meta);
        this.attackSelected = false;
        this.attackWeapon = 'melee';
        this.targetIndex = 0;
        this.cleanseSelected = false;
        this.cleanseTargets = [];
        this.cleanseTargetIndex = 0;
        this.inventoryPage = 0;
        this.loraTurnState = null;
        this.battleFocus.reset();
        this.guidance.beginRun({ seen: this.meta.combatGuideSeen === true });
        this.feedbackQueue.clear();
        this.achievementBanner.clear();
        this.lastPresentationSnapshot = cloneCheckpointValue(initialSnapshot);
        this.presentationTimeline.reset({
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
        });
        this.battleCamera.reset({
            x: Number(this.model.player?.x) || 0,
            y: Number(this.model.player?.y) || 0,
            floorIndex: Number(this.model.floorIndex) || 0
        });
        this.hoveredTileKey = '';
        this.#resetPlannedPath();
        this.#refreshBattleCache();
        this.#syncSpriteRoster();
        this.#appendEvent('전투 시작 · 이동 경로를 지정하고 확정한 뒤 행동하세요.');
        for (const cutsceneId of openingCutsceneIds) {
            this.#openCutscene(cutsceneId, MODES.BATTLE, false);
        }
    }

    /** 갤러리 섹션을 키보드 또는 섹션 ID로 전환합니다. @param {object} payload @private */
    #applyGallerySectionShift(payload) {
        if (this.mode !== MODES.GALLERY || this.cutscenes.isOpen()) {
            return;
        }
        if (typeof payload?.sectionId === 'string') {
            this.galleryController.selectSection(payload.sectionId);
        } else {
            this.galleryController.shiftSection(Number(payload?.delta) || 0);
        }
        this.presentationTimeline.startSelection('menu-selection');
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
        const delta = Number(payload?.delta) || 0;
        this.galleryController.shiftEntry(delta, this.meta);
        this.presentationTimeline.startSelection('menu-selection');
    }

    /**
     * 해금된 갤러리 컷씬을 재생합니다.
     * @private
     */
    #applyGalleryPlay() {
        if (this.mode !== MODES.GALLERY || this.cutscenes.isOpen()) {
            return;
        }
        const entry = this.galleryController.getSelectedEntry(this.meta);
        if (!entry?.playable || typeof entry.replayCutsceneId !== 'string') {
            return;
        }
        this.#openCutscene(entry.replayCutsceneId, MODES.GALLERY, true);
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
        this.#recordCutsceneSeen(completedId);
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
        const skippedId = this.cutscenes.getState().cutsceneId;
        this.cutscenes.close();
        this.#recordCutsceneSeen(skippedId);
        this.#resumeAfterCutscene();
    }

    /** 완료 또는 스킵한 컷씬을 갤러리 해금과 오프닝 정책에 반영합니다. @param {string|null} id @private */
    #recordCutsceneSeen(id) {
        if (typeof id !== 'string' || !id) {
            return;
        }
        let nextMeta = unlockTutorialCutscene(this.meta, id);
        if (id === this.content.CUTSCENE_TRIGGERS.openingCutsceneId) {
            nextMeta = markTutorialOpeningWatched(nextMeta);
        }
        this.#replaceMeta(nextMeta);
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
            this.presentationTimeline.startSelection('attack');
            return;
        }
        if (this.attackSelected) {
            this.#shiftAttackTarget(dx || dy);
            this.presentationTimeline.startSelection('attack');
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
        this.presentationTimeline.startSelection('path');
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
        this.presentationTimeline.startSelection('path');
    }

    /** 선택한 이동 경로 전체를 현재 플레이어 위치로 초기화합니다. @private */
    #applyPlanReset() {
        if (!this.#canAcceptBattleInput()
            || this.model.movementUsed
            || this.model.phase !== 'move'
            || this.plannedPath.length <= 1) {
            return;
        }
        this.#resetPlannedPath();
        this.cleanseSelected = false;
        this.cleanseTargets = [];
        this.presentationTimeline.startSelection('path');
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
            this.cleanseSelected = false;
            this.cleanseTargets = [];
            this.#resetPlannedPath();
        }
        this.#afterModelChange(result);
        if (result?.ok) {
            this.presentationTimeline.startPlayerPath({
                path: resultPath,
                teleportSegments,
                finalPlayer: this.model.player,
                logicalFloorIndex: this.model.floorIndex,
                visibleFloorIndex: this.floorView?.index
            });
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
        this.battleFocus.focus(weapon === 'bow' ? 'battle-ranged' : 'battle-melee');
        this.cleanseSelected = false;
        this.cleanseTargets = [];
        this.targetIndex = 0;
        this.#refreshBattleCache();
        this.presentationTimeline.startSelection('attack');
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
        if (result?.ok === true) {
            this.presentationTimeline.startAction();
        }
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
        if (result?.ok === true) {
            this.presentationTimeline.startAction();
        }
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
        if (result?.ok === true) {
            this.presentationTimeline.startAction();
        }
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
        this.presentationTimeline.startSelection('attack');
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
        if (result?.ok === true) {
            this.presentationTimeline.startAction(this.data.ANIMATION.SELECTION_SECONDS);
        }
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
        if (result?.ok === true) {
            this.presentationTimeline.startAction();
        }
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
        const nextSnapshot = this.#getSnapshot();
        const cues = this.battlePresenter.createCues({
            events: result?.events,
            previousSnapshot: this.lastPresentationSnapshot || nextSnapshot,
            nextSnapshot,
            path: result?.ok === true ? result?.path : [],
            failureReason: result?.ok === false ? result.reason : ''
        });
        const layout = this.#createBattleLayoutFrame();
        const routedCues = this.spriteCueRouter.route(cues);
        const orderedCues = this.feedbackQueue.enqueue(routedCues, {
            actors: {
                player: nextSnapshot?.player,
                lora: nextSnapshot?.lora
            },
            projectTile: (tile) => TutorialBattleLayout.projectTile(
                layout,
                tile.x,
                tile.y
            ),
            tileSide: layout.tileSide,
            colors: {
                danger: ColorSchemes.Tactics.UI.Danger,
                success: ColorSchemes.Tactics.UI.Success,
                accent: ColorSchemes.Tactics.UI.Accent,
                move: ColorSchemes.Tactics.Effects.Move
            }
        });
        this.presentationTimeline.applyCues(orderedCues);
        const achievementResult = this.achievementEvaluator.evaluate(
            result?.events,
            this.meta.unlockedAchievementIds
        );
        let achievementMeta = this.meta;
        for (const achievementId of achievementResult.unlockedIds) {
            achievementMeta = unlockTutorialAchievement(achievementMeta, achievementId);
        }
        this.#replaceMeta(achievementMeta);
        const achievementCount = this.achievementBanner.enqueue(
            achievementResult.notifications
        );
        this.audioDirector.notifyAchievements(achievementCount);
        this.lastPresentationSnapshot = cloneCheckpointValue(nextSnapshot);
        this.#syncMetaFromModel();
        for (const cutsceneId of this.cutsceneTriggers.consume(result?.events)) {
            if (this.#isEndingCutsceneId(cutsceneId)) {
                this.pendingEndingCutsceneId = cutsceneId;
            } else {
                this.#openCutscene(cutsceneId, MODES.BATTLE, false);
            }
        }
        this.#refreshBattleCache();
        this.#enterResultIfNeeded();
        if (this.presentationTimeline.getState().floorIndex
            !== (Number(this.model?.floorIndex) || 0)) {
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
        if (this.cutscenes.isOpen()
            || this.pendingCutscenes.length > 0
            || this.spriteCueRouter.isBusy()) {
            return;
        }
        const endingSource = rawResult.endingId
            || rawResult.ending?.id
            || rawResult.ending
            || rawResult.id;
        const endingId = typeof endingSource === 'string'
            ? endingSource
            : 'failure';
        const ending = this.#getEndingDefinition(endingId);
        const instability = clampNumber(
            rawResult.instability ?? this.model.lora?.instability,
            0,
            100
        );
        this.resultData = {
            ...rawResult,
            endingId,
            instability,
            displayName: ending.displayName,
            label: rawResult.label || '작전 종료'
        };
        this.mode = MODES.RESULT;
        this.resultRecorded = true;
        this.#replaceMeta(recordTutorialResult(this.meta, { endingId }));
        const endingCutsceneId = this.pendingEndingCutsceneId;
        this.pendingEndingCutsceneId = null;
        if (endingCutsceneId === ending.cutsceneId) {
            this.#openCutscene(endingCutsceneId, MODES.RESULT, false);
        }
    }

    /** @param {string} endingId @returns {object} 표시명과 컷씬이 분리된 엔딩 정의입니다. @private */
    #getEndingDefinition(endingId) {
        return this.content.ENDINGS.find((ending) => ending.id === endingId)
            || this.content.ENDINGS.find((ending) => ending.id === 'failure')
            || {
                id: 'failure',
                displayName: 'happily ever after..?',
                cutsceneId: null
            };
    }

    /** @param {string} cutsceneId @returns {boolean} 엔딩 뒤 재생할 컷씬인지 여부입니다. @private */
    #isEndingCutsceneId(cutsceneId) {
        return this.content.ENDINGS.some(
            (ending) => ending.cutsceneId === cutsceneId
        );
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
        if (this.metaWritesBlocked) {
            return;
        }
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
        const exists = Object.values(this.data.CUTSCENES).some(
            (entry) => entry.id === id
        );
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

    /** @returns {Readonly<object>} 오디오 디렉터가 소비할 작은 장면 상태입니다. @private */
    #createAudioState() {
        const snapshot = this.#getSnapshot();
        return Object.freeze({
            mode: this.mode,
            cutsceneOpen: this.cutscenes.isOpen(),
            floorIndex: Number(snapshot?.floorIndex ?? this.model?.floorIndex) || 0,
            result: this.resultData ? Object.freeze({ ...this.resultData }) : null,
            lora: Object.freeze({
                hp: Number(snapshot?.lora?.hp ?? this.model?.lora?.hp) || 0,
                instability: Number(
                    snapshot?.lora?.instability ?? this.model?.lora?.instability
                ) || 0
            })
        });
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
        const presentationFloorIndex = Number(
            this.presentationTimeline.getState().floorIndex
        ) || 0;
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
            && !this.guidance.isOpen()
            && !this.presentationTimeline.isLocked()
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
            || this.presentationTimeline.isLocked()
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
        if (this.presentationTimeline.isLocked()) {
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
            if (this.#wasKeyPressed(KEY_CODES.GALLERY)) {
                enqueueSimulationCommand({ type: COMMANDS.OPEN_GALLERY });
            } else if (this.#wasKeyPressed(KEY_CODES.CONFIRM)) {
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

        if (this.mode === MODES.PAUSE) {
            if (this.#wasKeyPressed(KEY_CODES.CANCEL)) {
                enqueueSimulationCommand({ type: COMMANDS.RESUME });
            } else if (this.#wasKeyPressed(KEY_CODES.RESTART)) {
                enqueueSimulationCommand({ type: COMMANDS.RESTART });
            } else if (this.#wasAnyKeyPressed(SELECTION_KEY_CODES.PREVIOUS)) {
                enqueueSimulationCommand({
                    type: COMMANDS.PAUSE_SHIFT,
                    payload: { delta: -1 }
                });
            } else if (this.#wasAnyKeyPressed(SELECTION_KEY_CODES.NEXT)) {
                enqueueSimulationCommand({
                    type: COMMANDS.PAUSE_SHIFT,
                    payload: { delta: 1 }
                });
            } else if (this.#wasKeyPressed(KEY_CODES.CONFIRM)
                || this.#wasKeyPressed(KEY_CODES.ALTERNATE_CONFIRM)) {
                enqueueSimulationCommand({
                    type: [COMMANDS.RESUME, COMMANDS.RESTART, COMMANDS.RETURN_MENU][
                        this.pauseIndex
                    ]
                });
            }
            return;
        }

        if (this.mode === MODES.GALLERY) {
            const direction = KEY_DIRECTIONS.find(
                (entry) => this.#wasAnyKeyPressed(entry.codes)
            );
            if (direction?.y) {
                enqueueSimulationCommand({
                    type: COMMANDS.GALLERY_SECTION_SHIFT,
                    payload: { delta: direction.y }
                });
            } else if (direction?.x) {
                enqueueSimulationCommand({
                    type: COMMANDS.GALLERY_SHIFT,
                    payload: { delta: direction.x }
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
        if (this.guidance.isOpen()) {
            if (this.#wasKeyPressed(KEY_CODES.GUIDE)
                || this.#wasKeyPressed(KEY_CODES.CONFIRM)
                || this.#wasKeyPressed(KEY_CODES.CANCEL)) {
                enqueueSimulationCommand({ type: COMMANDS.GUIDE_DISMISS });
            }
            return;
        }
        if (this.#wasKeyPressed(KEY_CODES.GUIDE)) {
            enqueueSimulationCommand({ type: COMMANDS.GUIDE_SHOW });
            return;
        }
        if (this.#wasKeyPressed(KEY_CODES.RESTART)) {
            enqueueSimulationCommand({ type: COMMANDS.RESTART });
            return;
        }
        if (this.#wasKeyPressed(KEY_CODES.CANCEL)) {
            enqueueSimulationCommand({ type: COMMANDS.PAUSE });
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
        } else if (this.#wasKeyPressed(KEY_CODES.TARGET_NEXT)) {
            enqueueSimulationCommand({
                type: COMMANDS.FOCUS_SHIFT,
                payload: { delta: 1 }
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
            } else if (this.model.phase === 'action'
                && this.#queueFocusedBattleControl()) {
                return;
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
        if (this.mode !== MODES.BATTLE
            || this.cutscenes.isOpen()
            || this.guidance.isOpen()) {
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
            this.presentationTimeline.startSelection('hover');
        }
        if (nextTile && this.attackSelected) {
            const hoveredTargetIndex = this.actionTargets.findIndex((target) => (
                target.x === nextTile.x && target.y === nextTile.y
            ));
            if (hoveredTargetIndex >= 0 && hoveredTargetIndex !== this.targetIndex) {
                this.targetIndex = hoveredTargetIndex;
                this.presentationTimeline.startSelection('attack');
            }
        } else if (nextTile && this.cleanseSelected) {
            const hoveredTargetIndex = this.cleanseTargets.findIndex((target) => (
                target.x === nextTile.x && target.y === nextTile.y
            ));
            if (hoveredTargetIndex >= 0
                && hoveredTargetIndex !== this.cleanseTargetIndex) {
                this.cleanseTargetIndex = hoveredTargetIndex;
                this.presentationTimeline.startSelection('attack');
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
            canContinue: false
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
            selectionProgress: Number(
                this.presentationTimeline.getState().menuSelectionProgress
            ) || 0,
            selectionMinScale: Number(this.data.ANIMATION.SELECTION_MIN_SCALE) || 0.72
        });
    }

    /** @returns {object} Pause 오버레이 뷰 모델입니다. @private */
    #createPauseViewModel() {
        return Object.freeze({
            ...this.#createNonbattleViewFrame(),
            selectedIndex: this.pauseIndex
        });
    }

    /** @returns {object} 갤러리 뷰 모델입니다. @private */
    #createGalleryViewModel() {
        const gallery = this.galleryController.getSnapshot(this.meta);
        return Object.freeze({
            ...this.#createNonbattleViewFrame(),
            ...gallery,
            selectionProgress: Number(
                this.presentationTimeline.getState().menuSelectionProgress
            ) || 0,
            selectionMinScale: Number(this.data.ANIMATION.SELECTION_MIN_SCALE) || 0.72
        });
    }

    /** @returns {object} 결과 뷰 모델입니다. @private */
    #createResultViewModel() {
        return Object.freeze({
            ...this.#createNonbattleViewFrame(),
            result: Object.freeze({ ...(this.resultData || {}) }),
            presentationLocked: this.presentationTimeline.isLocked()
        });
    }

    /** @returns {object} 컷씬 카드 뷰 모델입니다. @private */
    #createCutsceneViewModel() {
        return Object.freeze({
            ...this.#createNonbattleViewFrame(),
            state: Object.freeze({ ...this.cutscenes.getState() }),
            card: Object.freeze({ ...(this.cutscenes.getCurrentCard() || {}) }),
            presentationLocked: this.presentationTimeline.isLocked()
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
            camera: this.battleCamera.getSnapshot(),
            elapsedSeconds: this.elapsedSeconds,
            screenShakeSeconds: this.feedbackQueue.getScreenShakeSeconds()
        });
    }

    /**
     * 현재 공격 선택 또는 공통 버튼 포커스를 모델 미리보기 호출로 변환합니다.
     * @param {string|null} focusedKey - 키보드·포인터 공통 포커스 키입니다.
     * @returns {{preview:object|null,label:string}} 모델 결과와 짧은 선택 이름입니다.
     * @private
     */
    #createPlayerActionPreviewSelection(focusedKey) {
        if (!this.model || this.model.phase !== 'action' || this.model.result) {
            return { preview: null, label: '이동 경로' };
        }
        if (this.attackSelected) {
            const target = this.actionTargets[this.targetIndex];
            return {
                preview: this.model.previewPlayerAction('attack', {
                    targetId: target?.id || LORA_ID,
                    weapon: this.attackWeapon
                }),
                label: this.attackWeapon === 'bow' ? '원거리 공격' : '근접 공격'
            };
        }
        if (focusedKey === 'battle-melee' || focusedKey === 'battle-ranged') {
            const weapon = focusedKey === 'battle-ranged' ? 'bow' : 'melee';
            const target = toList(this.model.getValidTargets({ weapon }))[0];
            return {
                preview: this.model.previewPlayerAction('attack', {
                    targetId: target?.id || LORA_ID,
                    weapon
                }),
                label: weapon === 'bow' ? '원거리 공격' : '근접 공격'
            };
        }
        if (focusedKey === 'battle-heal') {
            return {
                preview: this.model.previewPlayerAction('heal'),
                label: '회복'
            };
        }
        if (focusedKey === 'battle-idle') {
            return {
                preview: this.model.previewPlayerAction('wait'),
                label: '대기'
            };
        }
        if (focusedKey?.startsWith('item-')) {
            const itemId = focusedKey.slice('item-'.length);
            return {
                preview: this.model.previewPlayerAction('use-item', { itemId }),
                label: this.data.ITEMS[itemId]?.label || itemId
            };
        }
        return { preview: null, label: '행동을 선택하세요' };
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
        const presentation = Object.freeze(cloneCheckpointValue(
            this.presentationTimeline.getState()
        ));
        const feedback = this.feedbackQueue.getSnapshot();
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
                description: item.description || '효과 확인 중',
                known: this.#isItemKnown(itemId),
                hasIcon: this.assetPort.hasItemIcon(itemId),
                usable: this.#isItemUsable(itemId),
                movementConsumable: item.movementConsumable === true,
                statusLabel: item.movementConsumable === true
                    ? '이동'
                    : item.passive === true && item.useOnce !== true
                        ? '자동'
                        : item.consumable === true || item.useOnce === true
                            ? '사용'
                            : '보유'
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
                    description: metadata.known
                        ? metadata.description
                        : '선택해 효과를 확인하세요.',
                    statusLabel: metadata.statusLabel || '보유',
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
        const inventoryFocusKeys = pagedInventory.entries.map(
            (entry) => 'item-' + entry.itemId
        );
        const actionFocusKeys = [
            'battle-melee',
            'battle-ranged',
            'battle-heal',
            'battle-idle'
        ];
        this.battleFocus.setKeys(snapshot.phase === 'move'
            ? inventoryFocusKeys
            : [...actionFocusKeys, ...inventoryFocusKeys]);
        const focusedControlKey = this.battleFocus.getFocusedKey();
        const actionSelection = this.#createPlayerActionPreviewSelection(
            focusedControlKey
        );
        const inspectedItem = focusedControlKey?.startsWith('item-')
            ? pagedInventory.entries.find(
                (entry) => entry.itemId === focusedControlKey.slice('item-'.length)
            ) || null
            : null;
        const readability = this.combatReadability.create({
            snapshot,
            loraIntent: this.model.getLoraIntent({ allowForecast: true }),
            actionPreview: actionSelection.preview,
            selectionLabel: actionSelection.label,
            inspectedItem
        });
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
                spriteAnimations: this.spriteAnimator.getSnapshot(),
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
                readability,
                feedback: Object.freeze({
                    flashSeconds: feedback.flashSeconds,
                    stabilizeSeconds: feedback.stabilizeSeconds
                }),
                config: Object.freeze({
                    attackRange: this.data.ACTORS.PLAYER.ATTACK_RANGE,
                    pathMarkerRatio: this.data.LAYOUT.BOARD.PATH_MARKER_RATIO,
                    shadowOffsetRatio: this.data.LAYOUT.BOARD.SHADOW_OFFSET_RATIO,
                    selectionMinScale: this.data.ANIMATION.SELECTION_MIN_SCALE,
                    actionPlayerScale: this.data.ANIMATION.ACTION_PLAYER_SCALE,
                    actionLoraScale: this.data.ANIMATION.ACTION_LORA_SCALE,
                    itemIcon: this.data.SPRITES.ITEM,
                    loraSprite: this.data.SPRITES.LORA
                })
            }),
            hud: Object.freeze({
                presentationLocked: this.presentationTimeline.isLocked(),
                attackSelected: this.attackSelected,
                attackWeapon: this.attackWeapon,
                cleanseSelected: this.cleanseSelected,
                focusedControlKey,
                instabilityState: Object.freeze(cloneCheckpointValue(
                    this.model.getInstabilityState?.() || {}
                )),
                movePreview: movePreview ? Object.freeze(movePreview) : null,
                readability,
                eventLog: feedback.eventLog,
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
                    itemIcon: this.data.SPRITES.ITEM,
                    text: this.data.TEXT,
                    floorTransitionAfterTurn: this.data.RULES.FLOOR_TRANSITION_AFTER_TURN,
                    playerMoveRange: this.data.ACTORS.PLAYER.MOVE_RANGE,
                    healAmount: this.data.ACTORS.PLAYER.HEAL_AMOUNT
                })
            }),
            achievement: this.achievementBanner.getSnapshot(),
            feedback: Object.freeze({
                floatingTexts: feedback.floatingTexts,
                particles: feedback.particles
            })
        });
    }

    /**
     * 전투 안내 뷰가 필요한 레이아웃·문구·표시 상태만 조립합니다.
     * @param {object|null} battleViewModel - 같은 프레임의 전투 뷰 모델입니다.
     * @returns {object|null} 안내 오버레이 표시 모델입니다.
     * @private
     */
    #createBattleTutorialViewModel(battleViewModel) {
        if (!battleViewModel) {
            return null;
        }
        const copy = this.data.TEXT.TUTORIAL_GUIDE;
        return Object.freeze({
            open: this.guidance.isOpen(),
            viewport: battleViewModel.viewport,
            layout: battleViewModel.layout,
            fonts: battleViewModel.fonts,
            colors: battleViewModel.colors,
            modal: Object.freeze({ ...this.data.LAYOUT.MODAL }),
            copy: Object.freeze({
                title: copy.TITLE,
                sentences: Object.freeze([...copy.SENTENCES]),
                replay: copy.REPLAY
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
        const galleryState = this.galleryController.getSnapshot(this.meta);
        const inventory = this.#getInventoryEntries()
            .map((entry) => entry.itemId + ':' + String(entry.count))
            .join('|');
        return [
            this.mode,
            cutsceneState.open ? cutsceneState.cutsceneId : '-',
            String(cutsceneState.cardIndex),
            String(this.starterIndex),
            String(this.pauseIndex),
            galleryState.selectedSectionId,
            String(galleryState.selectedIndex),
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
            String(this.battleFocus.getFocusedKey()),
            String(this.guidance.isOpen()),
            String(this.presentationTimeline.isLocked()),
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
        if (buttonGroup === 'pause') {
            return this.pauseView.getButtonSpecs(this.#createPauseViewModel());
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
        const battleViewModel = this.#createBattleViewModel();
        const tutorialViewModel = this.#createBattleTutorialViewModel(battleViewModel);
        const specs = this.guidance.isOpen()
            ? this.battleTutorialView.getButtonSpecs(tutorialViewModel)
            : [
                ...this.battleHudView.getButtonSpecs(battleViewModel),
                ...this.battleTutorialView.getButtonSpecs(tutorialViewModel)
            ];
        return specs;
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
     * 키보드 조사 포커스를 현재 전투 버튼 목록에서 순환합니다.
     * @param {object} payload - 이동 방향입니다.
     * @private
     */
    #applyFocusShift(payload) {
        if (this.mode !== MODES.BATTLE || this.guidance.isOpen()) {
            return;
        }
        const before = this.battleFocus.getFocusedKey();
        const after = this.battleFocus.shift(Number(payload?.delta) || 1);
        if (after && after !== before) {
            this.presentationTimeline.startSelection('menu-selection');
            this.buttonHost.invalidate();
        }
    }

    /** 첫 플레이 또는 도움말 요청으로 전투 안내를 엽니다. @private */
    #applyGuideShow() {
        if (this.mode !== MODES.BATTLE || this.cutscenes.isOpen()) {
            return;
        }
        this.guidance.show();
        this.buttonHost.invalidate();
    }

    /** 전투 안내를 닫고 메타 진행도에 확인 여부를 기록합니다. @private */
    #applyGuideDismiss() {
        if (this.mode !== MODES.BATTLE || !this.guidance.dismiss()) {
            return;
        }
        this.#replaceMeta(markTutorialCombatGuideSeen(this.meta));
        this.buttonHost.invalidate();
    }

    /**
     * 포인터가 진입한 전투 버튼을 키보드와 같은 조사 포커스로 맞춥니다.
     * @param {string} key - 버튼 키입니다.
     * @private
     */
    #focusBattleControl(key) {
        if (this.mode === MODES.PAUSE && key?.startsWith('pause-')) {
            const index = ['pause-resume', 'pause-restart', 'pause-exit'].indexOf(key);
            if (index >= 0 && index !== this.pauseIndex) {
                this.pauseIndex = index;
                this.buttonHost.invalidate();
            }
            return;
        }
        if (this.mode === MODES.STARTER && key?.startsWith('starter-')) {
            const itemId = key.slice('starter-'.length);
            const index = this.data.STARTER_CHOICES.findIndex(
                (choice) => choice.id === itemId
            );
            if (index >= 0 && index !== this.starterIndex) {
                this.starterIndex = index;
                this.presentationTimeline.startSelection('menu-selection');
                this.buttonHost.invalidate();
            }
            return;
        }
        if (this.mode === MODES.BATTLE
            && !this.guidance.isOpen()
            && this.battleFocus.focus(key)) {
            this.buttonHost.invalidate();
        }
    }

    /**
     * 행동 단계에서 현재 키보드 포커스의 버튼 명령을 큐에 넣습니다.
     * @returns {boolean} 포커스가 전투 조사 항목이었는지 여부입니다.
     * @private
     */
    #queueFocusedBattleControl() {
        const key = this.battleFocus.getFocusedKey();
        if (!key) {
            return false;
        }
        if (key === 'battle-melee' || key === 'battle-ranged') {
            enqueueSimulationCommand({
                type: COMMANDS.SELECT_ATTACK,
                payload: { weapon: key === 'battle-ranged' ? 'bow' : 'melee' }
            });
            return true;
        }
        if (key === 'battle-heal') {
            enqueueSimulationCommand({ type: COMMANDS.HEAL });
            return true;
        }
        if (key === 'battle-idle') {
            enqueueSimulationCommand({ type: COMMANDS.IDLE });
            return true;
        }
        if (key.startsWith('item-')) {
            const itemId = key.slice('item-'.length);
            const item = this.data.ITEMS[itemId];
            if (item && item.movementConsumable !== true && this.#isItemUsable(itemId)) {
                enqueueSimulationCommand({
                    type: COMMANDS.USE_ITEM,
                    payload: { itemId }
                });
            }
            return true;
        }
        return false;
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
     * 자동 층 전환에 필요한 표시 스냅샷을 준비해 타임라인에 위임합니다.
     * @private
     */
    #startFloorTransitionPresentation() {
        if (!this.model) {
            return;
        }
        const target = cloneTile(this.model.player);
        const targetFloorIndex = Number(this.model.floorIndex) || 0;
        const targetFloorView = cloneCheckpointValue(this.model.getCurrentFloorState());
        const targetFloorActorView = cloneCheckpointValue(this.#captureFloorActorView());
        this.presentationTimeline.startFloorTransition({
            target,
            floorIndex: targetFloorIndex,
            onSwap: () => {
                this.floorView = cloneCheckpointValue(targetFloorView);
                this.floorActorView = cloneCheckpointValue(targetFloorActorView);
            }
        });
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
        const floorIndex = Number(
            this.presentationTimeline.getState().floorIndex
        ) || 0;
        return this.model.floorStates?.[floorIndex] || null;
    }

    /** 현재 표시 층 배우를 스프라이트 재생기 roster와 맞춥니다. @private */
    #syncSpriteRoster() {
        if (this.mode !== MODES.BATTLE || !this.model) {
            this.spriteAnimator.syncActors([]);
            return;
        }
        this.spriteRoster.sync({
            floor: this.#getCurrentFloor(),
            floorActors: this.floorActorView,
            snapshot: this.#getSnapshot(),
            presentation: this.presentationTimeline.getState()
        });
    }

    /**
     * 플레이어의 보간된 표시 좌표를 독립 카메라가 추적하도록 갱신합니다.
     * @param {number} deltaSeconds - 현재 가변 프레임 델타입니다.
     * @private
     */
    #updateBattleCamera(deltaSeconds) {
        if (this.mode !== MODES.BATTLE || !this.model) {
            return;
        }
        const presentation = this.presentationTimeline.getState();
        this.battleCamera.update({
            target: {
                x: presentation.playerX,
                y: presentation.playerY
            },
            floorIndex: presentation.floorIndex,
            deltaSeconds
        });
    }

    /**
     * 공통 전체 화면 배경을 그립니다.
     * @private
     */
    #drawBackdrop() {
        const view = getTutorialModePolicy(this.mode)?.view;
        const fill = view === 'battle' || view === 'pause'
            ? ColorSchemes.Tactics.WorldBackdrop
            : ColorSchemes.Tactics.Backdrop;
        renderGL('background', {
            shape: 'rect',
            x: this.WW * 0.5,
            y: this.WH * 0.5,
            w: this.WW,
            h: this.WH,
            fill
        });
    }

    /**
     * 이벤트 로그 끝에 중복을 줄여 새 메시지를 추가합니다.
     * @param {string} message - 로그 메시지입니다.
     * @private
     */
    #appendEvent(message) {
        this.feedbackQueue.appendLog(message);
    }

}
