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
    getMouseInput,
    getPointerLockSnapshot,
    setPointerLockEnabled
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
import { TutorialBattleCameraController } from './_tutorial_battle_camera_controller.js';
import { TutorialCombatReadabilityPresenter } from './_tutorial_combat_readability_presenter.js';
import { TutorialCutsceneController } from './_tutorial_cutscene_controller.js';
import { TutorialCutsceneTriggerRouter } from './_tutorial_cutscene_trigger_router.js';
import { TutorialGalleryController } from './_tutorial_gallery_controller.js';
import { TutorialGuidanceController } from './_tutorial_guidance_controller.js';
import {
    createDefaultTutorialMeta,
    isTutorialMetaFutureVersionError,
    loadTutorialMeta
} from './_tutorial_meta_progress.js';
import {
    TUTORIAL_COMMANDS as COMMANDS,
    TUTORIAL_MODES as MODES
} from './_tutorial_scene_constants.js';
import {
    TUTORIAL_KEY_DIRECTIONS as KEY_DIRECTIONS,
    TUTORIAL_WATCHED_KEY_CODES as WATCHED_KEY_CODES
} from './_tutorial_input_bindings.js';
import {
    canRestartTutorialRun,
    canReturnToTutorialMenu,
    getTutorialModePolicy,
    isTutorialBattleMode
} from './_tutorial_mode_policy.js';
import {
    clampNumber,
    cloneTile,
    cloneValue as cloneCheckpointValue,
    toList
} from './_tutorial_value_utils.js';
import { TutorialKeyboardEdgeTracker } from './_tutorial_keyboard_edge_tracker.js';
import { TutorialKeyboardCommandMapper } from './_tutorial_keyboard_command_mapper.js';
import { TutorialMetaSession } from './_tutorial_meta_session.js';
import { TutorialNonbattleViewModelFactory } from './_tutorial_nonbattle_view_model_factory.js';
import { TutorialAnimationTimeline } from './_tutorial_animation_timeline.js';
import { TutorialAchievementBanner } from './_tutorial_achievement_banner.js';
import { TutorialAssetLoader } from './_tutorial_asset_loader.js';
import { TutorialAssetPort } from './_tutorial_asset_port.js';
import { TutorialAudioDirector } from './_tutorial_audio_director.js';
import { TutorialBattleCommandController } from './_tutorial_battle_command_controller.js';
import { TutorialBattleOutcomeCoordinator } from './_tutorial_battle_outcome_coordinator.js';
import { TutorialBattlePresenter } from './_tutorial_battle_presenter.js';
import { TutorialBattleSelectionController } from './_tutorial_battle_selection_controller.js';
import { TutorialBattleViewModelFactory } from './_tutorial_battle_view_model_factory.js';
import { TutorialFeedbackQueue } from './_tutorial_feedback_queue.js';
import { TutorialInventoryPresenter } from './_tutorial_inventory_presenter.js';
import { TutorialLoraTurnController } from './_tutorial_lora_turn_controller.js';
import { TutorialSpriteAnimator } from './_tutorial_sprite_animator.js';
import { TutorialSpriteClipResolver } from './_tutorial_sprite_clip_resolver.js';
import { TutorialSpriteCueRouter } from './_tutorial_sprite_cue_router.js';
import { TutorialSpriteRoster } from './_tutorial_sprite_roster.js';
import { TutorialRecordPopupQueue } from './_tutorial_record_popup_queue.js';
import { TutorialResultController } from './_tutorial_result_controller.js';
import { TutorialBattleFeedbackView } from './view/_tutorial_battle_feedback_view.js';
import { TutorialBattleHudView } from './view/_tutorial_battle_hud_view.js';
import { TutorialBattleLayout } from './view/_tutorial_battle_layout.js';
import { TutorialBattleTutorialView } from './view/_tutorial_battle_tutorial_view.js';
import { TutorialBattleWorldView } from './view/_tutorial_battle_world_view.js';
import { TutorialAchievementView } from './view/_tutorial_achievement_view.js';
import { TutorialButtonHost } from './view/_tutorial_button_host.js';
import { TutorialChangelogView } from './view/_tutorial_changelog_view.js';
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
     * @param {object} [options={}] - 웹 릴리스 표시 정보입니다.
     */
    constructor(sceneSystem, options = {}) {
        super(sceneSystem);
        this.data = TUTORIAL_GAME_DATA;
        this.content = TUTORIAL_CONTENT_DATA;
        this.mode = MODES.LOADING;
        this.model = null;
        this.floorView = null;
        this.floorActorView = null;
        this.metaSession = new TutorialMetaSession();
        this.results = new TutorialResultController({
            endings: this.content.ENDINGS,
            recordResult: (endingId) => this.metaSession.recordResult(endingId)
        });
        this.keyboardCommandMapper = new TutorialKeyboardCommandMapper();
        this.nonbattleViewModels = new TutorialNonbattleViewModelFactory(this.data);
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
        this.recordPopups = new TutorialRecordPopupQueue();
        this.achievementEvaluator = new TutorialAchievementEvaluator(
            this.content.ACHIEVEMENTS
        );
        this.cutsceneReturnMode = MODES.MENU;
        this.pendingCutscenes = [];
        this.runCutsceneIds = new Set();
        this.battleFocus = new TutorialBattleFocusController();
        this.battleSelection = new TutorialBattleSelectionController();
        this.guidance = new TutorialGuidanceController();
        this.starterIndex = Math.max(
            0,
            this.data.STARTER_CHOICES.findIndex((choice) => choice.id === 'mascot-costume')
        );
        this.starterItemId = this.data.STARTER_CHOICES[this.starterIndex]?.id || 'mascot-costume';
        this.pauseIndex = 0;
        this.destroyed = false;
        this.timelineRevision = 0;
        const releaseInfo = options.releaseInfo || {};
        this.releaseInfo = Object.freeze({
            id: String(releaseInfo.id || 'development'),
            version: String(releaseInfo.version || 'dev'),
            changelog: Object.freeze(toList(releaseInfo.changelog).map((entry) => (
                Object.freeze({
                    version: String(entry?.version || '기록'),
                    commit: String(entry?.commit || ''),
                    summary: String(entry?.summary || '')
                })
            )))
        });
        this.changelogPage = 0;

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
        this.changelogView = new TutorialChangelogView(
            tutorialRenderPort,
            this.assetPort
        );
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
            durationSeconds: this.data.ANIMATION.CAMERA_FOLLOW_SECONDS,
            zoomDurationSeconds: this.data.ANIMATION.CAMERA_ZOOM_SECONDS,
            defaultZoom: this.data.LAYOUT.CAMERA.DEFAULT_ZOOM
        });
        this.battleCameraController = new TutorialBattleCameraController({
            edgeMarginRatio: this.data.LAYOUT.CAMERA.EDGE_MARGIN_RATIO,
            edgeSpeedViewportRatioPerSecond:
                this.data.LAYOUT.CAMERA.EDGE_SPEED_VIEWPORT_RATIO_PER_SECOND,
            maxDeltaSeconds: this.data.LAYOUT.CAMERA.EDGE_MAX_DELTA_SECONDS,
            defaultZoom: this.data.LAYOUT.CAMERA.DEFAULT_ZOOM,
            maximumZoom: this.data.LAYOUT.CAMERA.MAX_ZOOM,
            wheelZoomRatio: this.data.LAYOUT.CAMERA.WHEEL_ZOOM_RATIO,
            maximumWheelDelta: this.data.LAYOUT.CAMERA.MAX_WHEEL_DELTA
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
        this.inventoryPresenter = new TutorialInventoryPresenter({
            data: this.data,
            assetPort: this.assetPort,
            hudView: this.battleHudView
        });
        this.battleViewModels = new TutorialBattleViewModelFactory({
            data: this.data,
            inventoryPresenter: this.inventoryPresenter,
            combatReadability: this.combatReadability,
            battleFocus: this.battleFocus
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
        this.battleOutcomes = new TutorialBattleOutcomeCoordinator({
            presenter: this.battlePresenter,
            spriteCueRouter: this.spriteCueRouter,
            feedbackQueue: this.feedbackQueue,
            presentationTimeline: this.presentationTimeline,
            achievementEvaluator: this.achievementEvaluator,
            metaSession: this.metaSession,
            achievementBanner: this.achievementBanner,
            audioDirector: this.audioDirector,
            recordPopups: this.recordPopups,
            cutsceneTriggers: this.cutsceneTriggers,
            results: this.results,
            projectTile: (layout, tile) => TutorialBattleLayout.projectTile(
                layout,
                tile.x,
                tile.y
            ),
            getFeedbackColors: () => ({
                danger: ColorSchemes.Tactics.UI.Danger,
                success: ColorSchemes.Tactics.UI.Success,
                accent: ColorSchemes.Tactics.UI.Accent,
                move: ColorSchemes.Tactics.Effects.Move
            })
        });
        this.battleCommands = new TutorialBattleCommandController({
            selection: this.battleSelection,
            focus: this.battleFocus,
            presentation: this.presentationTimeline,
            getModel: () => this.model,
            canAcceptInput: () => this.#canAcceptBattleInput(),
            onModelChange: (result) => this.#afterModelChange(result),
            getVisibleFloorIndex: () => this.floorView?.index,
            cleanseActionSeconds: this.data.ANIMATION.SELECTION_SECONDS
        });
        this.loraTurns = new TutorialLoraTurnController({
            getModel: () => this.model,
            getRevision: () => this.timelineRevision,
            canApply: () => this.mode === MODES.BATTLE && !this.cutscenes.isOpen(),
            canSchedule: () => this.mode === MODES.BATTLE
                && !this.cutscenes.isOpen()
                && !this.presentationTimeline.isLocked(),
            enqueueCommand: (command) => enqueueSimulationCommand(command),
            onModelChange: (result) => this.#afterModelChange(result),
            selection: this.battleSelection,
            beforeSeconds: this.data.ANIMATION.TURN_GATE_SECONDS,
            showSeconds: this.data.ANIMATION.LORA_TURN_SECONDS
        });
        this.assetPort.loadAll();

        this.elapsedSeconds = 0;
        this.uiActionHandled = false;
        this.keyboardEdges = new TutorialKeyboardEdgeTracker({
            watchedCodes: WATCHED_KEY_CODES,
            getCodeInput: getKeyboardCodeInput,
            getSnapshot: getKeyboardSnapshot
        });

        setPointerLockEnabled(true);
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
                const writesBlocked = isTutorialMetaFutureVersionError(error);
                this.metaSession.setWritesBlocked(writesBlocked);
                if (writesBlocked) {
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

    /** @returns {object} 현재 반복 플레이 진행도입니다. */
    get meta() {
        return this.metaSession.current;
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
        if (this.#openNextRecordPopup()) {
            this.#ensureButtons();
            this.audioDirector.sync(this.#createAudioState());
            this.keyboardEdges.capture();
            return;
        }
        this.keyboardEdges.prepare();
        this.#handleKeyboardInput();
        if (this.mode === MODES.PAUSE || this.mode === MODES.RECORD) {
            this.battleCameraController.primeWheelBaseline(
                getMouseInput('wheel')
            );
            this.audioDirector.sync(this.#createAudioState());
            this.keyboardEdges.capture();
            return;
        }
        this.#updateBattleCamera(deltaSeconds);
        this.#updatePointerState();
        this.#handlePointerInput();
        this.loraTurns.update(deltaSeconds);
        this.#syncSpriteRoster();
        this.spriteCueRouter.update(deltaSeconds);
        this.#enterResultIfNeeded();
        this.feedbackQueue.update(deltaSeconds);
        this.achievementBanner.update(deltaSeconds);
        this.audioDirector.consume(this.feedbackQueue.drainAudioCues());
        this.audioDirector.sync(this.#createAudioState());
        this.keyboardEdges.capture();
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
        } else if (view === 'changelog') {
            this.changelogView.draw(this.#createChangelogViewModel());
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
                case COMMANDS.OPEN_CHANGELOG:
                    this.#applyOpenChangelog();
                    break;
                case COMMANDS.CHANGELOG_SHIFT:
                    this.#applyChangelogShift(command.payload);
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
                case COMMANDS.CLOSE_RECORD:
                    this.#applyCloseRecord();
                    break;
                case COMMANDS.CUTSCENE_NEXT:
                    this.#applyCutsceneNext();
                    break;
                case COMMANDS.CUTSCENE_CLOSE:
                    this.#applyCutsceneClose();
                    break;
                case COMMANDS.PLAN_STEP:
                    this.battleCommands.applyPlanStep(command.payload);
                    break;
                case COMMANDS.PLAN_BACK:
                    this.battleCommands.applyPlanBack();
                    break;
                case COMMANDS.PLAN_RESET:
                    this.battleCommands.applyPlanReset();
                    break;
                case COMMANDS.COMMIT_PATH:
                    this.battleCommands.applyCommitPath();
                    break;
                case COMMANDS.SELECT_ATTACK:
                    this.battleCommands.applySelectAttack(command.payload);
                    break;
                case COMMANDS.ATTACK:
                    this.battleCommands.applyAttack(command.payload);
                    break;
                case COMMANDS.HEAL:
                    this.battleCommands.applyHeal();
                    break;
                case COMMANDS.IDLE:
                    this.battleCommands.applyIdle();
                    break;
                case COMMANDS.USE_ITEM:
                    this.battleCommands.applyUseItem(command.payload);
                    break;
                case COMMANDS.INVENTORY_PAGE_SHIFT:
                    this.#applyInventoryPageShift(command.payload);
                    break;
                case COMMANDS.FOCUS_SHIFT:
                    this.#applyFocusShift(command.payload);
                    break;
                case COMMANDS.SELECT_CLEANSE:
                    this.battleCommands.applySelectCleanse();
                    break;
                case COMMANDS.CLEANSE_EVENT_TILE:
                    this.battleCommands.applyCleanseEventTile(command.payload);
                    break;
                case COMMANDS.GUIDE_SHOW:
                    this.#applyGuideShow();
                    break;
                case COMMANDS.GUIDE_DISMISS:
                    this.#applyGuideDismiss();
                    break;
                case COMMANDS.PERFORM_LORA:
                    this.loraTurns.applyAction(command.payload);
                    break;
                case COMMANDS.COMPLETE_LORA:
                    this.loraTurns.applyCompletion(command.payload);
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
        this.metaSession.commitStaged();
        this.destroyed = true;
        this.timelineRevision += 1;
        this.presentationTimeline.destroy();
        this.battleCamera.destroy();
        this.battleCameraController.destroy();
        setPointerLockEnabled(false);
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
        this.results.reset();
        this.runCutsceneIds.clear();
        this.recordPopups.clear();
        this.battleFocus.reset();
        this.guidance.reset();
        this.loraTurns.reset();
        this.battleOutcomes.reset();
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
        this.metaSession.setLoaded(payload?.meta || createDefaultTutorialMeta());
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

    /** 타이틀 화면에서 현재 배포의 한글 변경 기록을 엽니다. @private */
    #applyOpenChangelog() {
        if (this.mode !== MODES.MENU) {
            return;
        }
        this.changelogPage = 0;
        this.mode = MODES.CHANGELOG;
    }

    /** @param {object} payload 체인지로그 페이지 이동량입니다. @private */
    #applyChangelogShift(payload) {
        if (this.mode !== MODES.CHANGELOG) {
            return;
        }
        const viewModel = this.#createChangelogViewModel();
        const pageCount = this.changelogView.getPageCount(viewModel);
        const delta = Math.sign(Number(payload?.delta) || 0);
        if (delta === 0 || pageCount <= 1) {
            return;
        }
        this.changelogPage = (
            this.changelogPage + delta + pageCount
        ) % pageCount;
        this.presentationTimeline.startSelection('menu-selection');
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
        this.battleSelection.clearHover();
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
        this.metaSession.commitStaged();
        this.timelineRevision += 1;
        this.presentationTimeline.cancel();
        this.battleCamera.clear();
        this.battleCameraController.clear();
        this.spriteCueRouter.reset();
        this.audioDirector.resetTransient();
        this.cutscenes.close();
        this.cutsceneTriggers.reset();
        this.pendingCutscenes = [];
        this.results.reset();
        this.runCutsceneIds.clear();
        this.recordPopups.clear();
        this.cutsceneReturnMode = nextMode;
        this.model = null;
        this.floorView = null;
        this.floorActorView = null;
        this.mode = nextMode;
        this.pauseIndex = 0;
        this.changelogPage = 0;
        this.loraTurns.reset();
        this.inventoryPresenter.reset();
        this.battleSelection.reset();
        this.battleFocus.reset();
        this.guidance.reset();
        this.battleOutcomes.reset();
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
        this.metaSession.beginStaging();
        this.starterItemId = starterItemId;
        const knowledge = {
            discoveredItemIds: [...this.meta.identifiedItemIds],
            identifiedItemIds: [...this.meta.identifiedItemIds],
            unlockedRecordIds: [...this.meta.unlockedRecordIds],
            revealedTrapIds: [...this.meta.revealedEventTileIds],
            unlockedCutsceneIds: [...this.meta.unlockedCutsceneIds]
        };
        this.model = new TutorialBattleModel(this.data, { knowledge });
        this.model.reset({ starterItemId });
        const initialSnapshot = this.#getSnapshot();
        this.mode = MODES.BATTLE;
        this.pendingCutscenes = [];
        this.results.reset();
        this.runCutsceneIds = new Set();
        this.recordPopups.clear();
        const openingCutsceneIds = this.cutsceneTriggers.beginRun(this.meta);
        this.battleSelection.reset(this.model);
        this.inventoryPresenter.reset();
        this.loraTurns.reset();
        this.battleFocus.reset();
        this.guidance.beginRun({ seen: this.meta.combatGuideSeen === true });
        this.feedbackQueue.clear();
        this.achievementBanner.clear();
        this.battleOutcomes.reset(initialSnapshot);
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
            floorIndex: Number(this.model.floorIndex) || 0,
            zoom: this.data.LAYOUT.CAMERA.DEFAULT_ZOOM
        });
        this.battleCameraController.reset({
            x: Number(this.model.player?.x) || 0,
            y: Number(this.model.player?.y) || 0,
            floorIndex: Number(this.model.floorIndex) || 0
        });
        this.#refreshBattleCache();
        this.#syncSpriteRoster();
        this.#appendEvent('전투 시작 · 이동 경로를 지정하고 확정한 뒤 행동하세요.');
        for (const cutsceneId of openingCutsceneIds) {
            this.#openCutscene(cutsceneId, MODES.BATTLE, false);
        }
    }

    /** 갤러리 섹션을 키보드 또는 섹션 ID로 전환합니다. @param {object} payload @private */
    #applyGallerySectionShift(payload) {
        if (!this.#isGalleryMode() || this.cutscenes.isOpen()) {
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
        if (!this.#isGalleryMode() || this.cutscenes.isOpen()) {
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
        if (!this.#isGalleryMode() || this.cutscenes.isOpen()) {
            return;
        }
        const entry = this.galleryController.getSelectedEntry(this.meta);
        if (!entry?.playable || typeof entry.replayCutsceneId !== 'string') {
            return;
        }
        this.#openCutscene(entry.replayCutsceneId, this.mode, true);
    }

    /** 현재 화면이 메뉴 갤러리 또는 전투 중 수집물 팝업인지 확인합니다. @private */
    #isGalleryMode() {
        return this.mode === MODES.GALLERY || this.mode === MODES.RECORD;
    }

    /** 현재 기록 팝업을 닫고 다음 기록 또는 중단된 전투로 복귀합니다. @private */
    #applyCloseRecord() {
        if (this.mode !== MODES.RECORD || this.cutscenes.isOpen()) {
            return;
        }
        this.recordPopups.closeActive();
        this.mode = MODES.BATTLE;
        this.#refreshBattleCache();
        if (this.#openNextRecordPopup()) {
            return;
        }
        this.#enterResultIfNeeded();
    }

    /**
     * 전투가 다른 오버레이로 점유되지 않았을 때 다음 기록을 갤러리 책으로 엽니다.
     * @returns {boolean} 기록 팝업을 열었는지 여부입니다.
     * @private
     */
    #openNextRecordPopup() {
        if (this.mode !== MODES.BATTLE
            || this.cutscenes.isOpen()
            || this.presentationTimeline.isLocked()
            || !this.model) {
            return false;
        }
        let recordId = this.recordPopups.openNext();
        while (recordId) {
            if (this.galleryController.selectEntry(recordId, this.meta)) {
                this.mode = MODES.RECORD;
                this.battleSelection.clearHover();
                this.buttonHost.invalidate();
                return true;
            }
            this.recordPopups.closeActive();
            recordId = this.recordPopups.openNext();
        }
        return false;
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
        this.metaSession.recordCutsceneSeen(
            id,
            this.content.CUTSCENE_TRIGGERS.openingCutsceneId
        );
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
            this.#openNextRecordPopup();
        }
    }

    /**
     * 모델 결과의 이벤트, 지식, 컷씬, 종료 상태를 동기화합니다.
     * @param {object} result - 모델 메서드 반환값입니다.
     * @private
     */
    #afterModelChange(result) {
        const nextSnapshot = this.#getSnapshot();
        const layout = this.#createBattleLayoutFrame();
        const outcome = this.battleOutcomes.process({
            result,
            nextSnapshot,
            layout,
            unlockedAchievementIds: this.meta.unlockedAchievementIds
        });
        for (const cutsceneId of outcome.cutsceneIds) {
            this.#openCutscene(cutsceneId, MODES.BATTLE, false);
        }
        this.#refreshBattleCache();
        this.#enterResultIfNeeded();
        if (this.presentationTimeline.getState().floorIndex
            !== (Number(this.model?.floorIndex) || 0)) {
            this.#startFloorTransitionPresentation();
        }
        this.loraTurns.armIfNeeded();
    }

    /**
     * 모델 결과가 생기면 결과 모드와 메타 기록을 구성합니다.
     * @private
     */
    #enterResultIfNeeded() {
        const snapshot = this.#getSnapshot();
        const transition = this.results.tryEnter({
            model: this.model,
            snapshot,
            hasRecordWork: this.recordPopups.hasWork(),
            blocked: this.cutscenes.isOpen()
            || this.pendingCutscenes.length > 0
            || this.spriteCueRouter.isBusy()
        });
        if (!transition.entered) {
            return;
        }
        this.mode = MODES.RESULT;
        if (transition.endingCutsceneId) {
            this.#openCutscene(
                transition.endingCutsceneId,
                MODES.RESULT,
                false
            );
        }
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
        const resultData = this.results.getData();
        return Object.freeze({
            mode: this.mode,
            cutsceneOpen: this.cutscenes.isOpen(),
            floorIndex: Number(snapshot?.floorIndex ?? this.model?.floorIndex) || 0,
            result: resultData ? Object.freeze(resultData) : null,
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
        if (!this.model) {
            this.floorView = null;
            this.floorActorView = null;
            this.battleSelection.refresh(null);
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
        this.battleSelection.refresh(this.model);
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
     * 키보드 상승 에지를 모드별 명령으로 변환합니다.
     * @private
     */
    #handleKeyboardInput() {
        const command = this.keyboardCommandMapper.map({
            mode: this.mode,
            presentationLocked: this.presentationTimeline.isLocked(),
            cutsceneOpen: this.cutscenes.isOpen(),
            guidanceOpen: this.guidance.isOpen(),
            pauseIndex: this.pauseIndex,
            canAcceptBattleInput: this.#canAcceptBattleInput(),
            ...this.battleSelection.createKeyboardState(),
            modelPhase: this.model?.phase,
            focusedBattleCommand: this.#createFocusedBattleCommand()
        }, this.keyboardEdges.getPressedCodes());
        if (command?.type) {
            enqueueSimulationCommand(command);
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
            this.battleSelection.clearHover();
            return;
        }
        if (!getMouseFocus().includes('object')) {
            this.battleSelection.clearHover();
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
        const hoverResult = this.battleSelection.setHoveredTile(nextTile);
        if (hoverResult.hoverChanged) {
            this.presentationTimeline.startSelection('hover');
        }
        if (hoverResult.targetChanged) {
            this.presentationTimeline.startSelection('attack');
        }
    }

    /**
     * 보드 클릭을 이동 또는 공격 명령으로 변환합니다.
     * @private
     */
    #handlePointerInput() {
        if (this.uiActionHandled
            || this.mode !== MODES.BATTLE
            || this.cutscenes.isOpen()
            || !this.battleSelection.hasHoveredTile()
            || !getMouseFocus().includes('object')) {
            return;
        }
        if (!consumeMouseState('left', 'clicked')) {
            return;
        }
        if (!this.#canAcceptBattleInput()) {
            return;
        }
        const command = this.battleSelection.createPointerCommand(this.model);
        if (command) {
            enqueueSimulationCommand(command);
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
        return this.nonbattleViewModels.createLoading(
            this.#createNonbattleViewFrame()
        );
    }

    /** @returns {object} 메인 메뉴 뷰 모델입니다. @private */
    #createMenuViewModel() {
        return this.nonbattleViewModels.createMenu(
            this.#createNonbattleViewFrame(),
            {
                meta: this.meta,
                releaseVersion: this.releaseInfo.version
            }
        );
    }

    /** @returns {object} 현재 배포와 Git 변경 기록 뷰 모델입니다. @private */
    #createChangelogViewModel() {
        return this.nonbattleViewModels.createChangelog(
            this.#createNonbattleViewFrame(),
            { releaseInfo: this.releaseInfo, page: this.changelogPage }
        );
    }

    /** @returns {object} 스타터 선택 뷰 모델입니다. @private */
    #createStarterViewModel() {
        return this.nonbattleViewModels.createStarter(
            this.#createNonbattleViewFrame(),
            {
                selectedIndex: this.starterIndex,
                selectionProgress:
                    this.presentationTimeline.getState().menuSelectionProgress
            }
        );
    }

    /** @returns {object} Pause 오버레이 뷰 모델입니다. @private */
    #createPauseViewModel() {
        return this.nonbattleViewModels.createPause(
            this.#createNonbattleViewFrame(),
            this.pauseIndex
        );
    }

    /** @returns {object} 갤러리 뷰 모델입니다. @private */
    #createGalleryViewModel() {
        return this.nonbattleViewModels.createGallery(
            this.#createNonbattleViewFrame(),
            {
                gallery: this.galleryController.getSnapshot(this.meta),
                mode: this.mode,
                selectionProgress:
                    this.presentationTimeline.getState().menuSelectionProgress
            }
        );
    }

    /** @returns {object} 결과 뷰 모델입니다. @private */
    #createResultViewModel() {
        return this.nonbattleViewModels.createResult(
            this.#createNonbattleViewFrame(),
            {
                result: this.results.getData(),
                presentationLocked: this.presentationTimeline.isLocked()
            }
        );
    }

    /** @returns {object} 컷씬 카드 뷰 모델입니다. @private */
    #createCutsceneViewModel() {
        return this.nonbattleViewModels.createCutscene(
            this.#createNonbattleViewFrame(),
            {
                state: this.cutscenes.getState(),
                card: this.cutscenes.getCurrentCard(),
                presentationLocked: this.presentationTimeline.isLocked()
            }
        );
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
     * 한 프레임의 모델·선택·표현 상태를 전용 팩토리에 전달합니다.
     * @returns {object|null} 전투 뷰들이 공유할 읽기 전용 모델입니다.
     * @private
     */
    #createBattleViewModel() {
        if (!this.model) {
            return null;
        }
        const floor = this.#getCurrentFloor();
        return this.battleViewModels.create({
            model: this.model,
            floor,
            layout: this.#createBattleLayoutFrame(floor),
            fonts: this.fonts,
            colors: ColorSchemes.Tactics,
            elapsedSeconds: this.elapsedSeconds,
            presentation: this.presentationTimeline.getState(),
            presentationLocked: this.presentationTimeline.isLocked(),
            feedback: this.feedbackQueue.getSnapshot(),
            spriteAnimations: this.spriteAnimator.getSnapshot(),
            floorActors: this.floorActorView,
            ready: this.#canAcceptBattleInput(),
            achievement: this.achievementBanner.getSnapshot(),
            selection: this.battleSelection.getSnapshot()
        });
    }

    /**
     * 전투 안내 뷰가 필요한 레이아웃·문구·표시 상태만 조립합니다.
     * @param {object|null} battleViewModel - 같은 프레임의 전투 뷰 모델입니다.
     * @returns {object|null} 안내 오버레이 표시 모델입니다.
     * @private
     */
    #createBattleTutorialViewModel(battleViewModel) {
        return this.nonbattleViewModels.createBattleTutorial(
            battleViewModel,
            this.guidance.isOpen()
        );
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
        const pointerLock = getPointerLockSnapshot();
        const inventory = this.inventoryPresenter.getEntries(this.model)
            .map((entry) => entry.itemId + ':' + String(entry.count))
            .join('|');
        return [
            this.mode,
            cutsceneState.open ? cutsceneState.cutsceneId : '-',
            String(cutsceneState.cardIndex),
            String(this.starterIndex),
            String(this.pauseIndex),
            String(this.changelogPage),
            this.releaseInfo.id,
            galleryState.selectedSectionId,
            String(galleryState.selectedIndex),
            String(this.model?.turn),
            String(this.model?.phase),
            String(this.model?.movementUsed),
            String(this.model?.actionUsed),
            String(this.model?.actionsUsed),
            String(this.model?.actionsPerTurn),
            String(this.model?.loraActionsCompleted),
            ...this.battleSelection.getSignatureParts(),
            String(this.inventoryPresenter.getPage()),
            String(this.battleFocus.getFocusedKey()),
            String(this.guidance.isOpen()),
            String(this.presentationTimeline.isLocked()),
            String(pointerLock.initialActivationPending),
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
        if (buttonGroup === 'menu'
            && getPointerLockSnapshot().initialActivationPending === true) {
            return [];
        }
        if (this.cutscenes.isOpen()) {
            return this.cutsceneView.getButtonSpecs(this.#createCutsceneViewModel());
        }
        if (buttonGroup === 'menu') {
            return this.menuView.getButtonSpecs(this.#createMenuViewModel());
        }
        if (buttonGroup === 'changelog') {
            return this.changelogView.getButtonSpecs(
                this.#createChangelogViewModel()
            );
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
     * 명령 경계에서 인벤토리 표시 페이지를 순환합니다.
     * @param {object} payload - 페이지 이동량입니다.
     * @private
     */
    #applyInventoryPageShift(payload) {
        if (this.mode !== MODES.BATTLE || !this.model) {
            return;
        }
        if (this.inventoryPresenter.shiftPage(this.model, payload?.delta)) {
            this.buttonHost.invalidate();
        }
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
        this.metaSession.markCombatGuideSeen();
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
     * 현재 전투 조사 포커스를 부작용 없는 명령 사양으로 변환합니다.
     * @returns {object|null} 실행할 명령 또는 null입니다.
     * @private
     */
    #createFocusedBattleCommand() {
        const key = this.battleFocus.getFocusedKey();
        if (!key) {
            return null;
        }
        if (key === 'battle-melee' || key === 'battle-ranged') {
            return {
                type: COMMANDS.SELECT_ATTACK,
                payload: { weapon: key === 'battle-ranged' ? 'bow' : 'melee' }
            };
        }
        if (key === 'battle-heal') {
            return { type: COMMANDS.HEAL };
        }
        if (key === 'battle-idle') {
            return { type: COMMANDS.IDLE };
        }
        if (key.startsWith('item-')) {
            const itemId = key.slice('item-'.length);
            const item = this.data.ITEMS[itemId];
            if (item
                && item.movementConsumable !== true
                && this.inventoryPresenter.isItemUsable(itemId)) {
                return {
                    type: COMMANDS.USE_ITEM,
                    payload: { itemId }
                };
            }
            return null;
        }
        return null;
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
     * 플레이어 추적점에 가장자리 이동·휠 줌·휠 클릭 중앙 복귀를 결합합니다.
     * @param {number} deltaSeconds - 현재 가변 프레임 델타입니다.
     * @private
     */
    #updateBattleCamera(deltaSeconds) {
        if (this.mode !== MODES.BATTLE || !this.model) {
            return;
        }
        const presentation = this.presentationTimeline.getState();
        const pointerLock = getPointerLockSnapshot();
        const cameraInputEnabled = pointerLock.locked === true
            && !this.cutscenes.isOpen()
            && !this.guidance.isOpen()
            && !this.presentationTimeline.isLocked();
        const layout = this.#createBattleLayoutFrame();
        const target = this.battleCameraController.update({
            player: {
                x: presentation.playerX,
                y: presentation.playerY
            },
            floorIndex: presentation.floorIndex,
            layout,
            pointer: getMouseInput('pos'),
            wheel: getMouseInput('wheel'),
            deltaSeconds,
            edgePanEnabled: cameraInputEnabled,
            zoomEnabled: cameraInputEnabled,
            recenter: cameraInputEnabled
                && consumeMouseState('middle', 'clicked')
        });
        this.battleCamera.update({
            target,
            floorIndex: presentation.floorIndex,
            deltaSeconds,
            zoomTarget: this.battleCameraController.getTargetZoom()
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
