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
import { getData } from 'data/data_handler.js';
import { createFontString, wrapTextByCharacters } from 'util/font_util.js';
import { UIPool, releaseUIItem } from 'ui/_ui_pool.js';
import {
    clearSimulationCommands,
    enqueueSimulationCommand
} from 'simulation/simulation_command_queue.js';
import { TutorialBattleModel } from './_tutorial_battle_model.js';

const TUTORIAL_GAME_DATA = getData('TUTORIAL_GAME_DATA');

const TUTORIAL_COMMANDS = Object.freeze({
    MOVE: 'tutorial/move',
    SELECT_ACTION: 'tutorial/select-action',
    INTERACT: 'tutorial/interact',
    END_TURN: 'tutorial/end-turn',
    DEFEND: 'tutorial/defend',
    ESCAPE: 'tutorial/escape',
    DIALOGUE: 'tutorial/dialogue',
    UNDO: 'tutorial/undo',
    COMPLETE_LORA_TURN: 'tutorial/complete-lora-turn',
    RESTART: 'tutorial/restart'
});

const ACTION_ATTACK = 'attack';
const PLAYER_ID = 'player';
const LORA_ID = 'lora';
const DIALOGUE_CHOICES = TUTORIAL_GAME_DATA.DIALOGUE.CHOICES;
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
    'Digit4',
    'KeyE',
    'KeyZ',
    'Escape',
    'KeyR'
]);
const KEY_DIRECTIONS = Object.freeze([
    Object.freeze({ codes: Object.freeze(['ArrowUp', 'KeyW']), x: 0, y: -1, facing: 0 }),
    Object.freeze({ codes: Object.freeze(['ArrowRight', 'KeyD']), x: 1, y: 0, facing: 90 }),
    Object.freeze({ codes: Object.freeze(['ArrowDown', 'KeyS']), x: 0, y: 1, facing: 180 }),
    Object.freeze({ codes: Object.freeze(['ArrowLeft', 'KeyA']), x: -1, y: 0, facing: 270 })
]);

/**
 * 숫자를 지정한 범위 안으로 제한합니다.
 * @param {number} value - 제한할 값입니다.
 * @param {number} min - 최솟값입니다.
 * @param {number} max - 최댓값입니다.
 * @returns {number} 제한된 값입니다.
 */
function clampNumber(value, min, max) {
    return Math.min(Math.max(Number(value) || 0, min), max);
}

/**
 * 두 숫자 사이를 선형 보간합니다.
 * @param {number} start - 시작 값입니다.
 * @param {number} end - 끝 값입니다.
 * @param {number} amount - 0~1 보간 계수입니다.
 * @returns {number} 보간된 값입니다.
 */
function lerpNumber(start, end, amount) {
    return start + ((end - start) * amount);
}

/**
 * 이동 연출에 사용할 부드러운 감속 곡선을 계산합니다.
 * @param {number} value - 0~1 진행률입니다.
 * @returns {number} 완화된 진행률입니다.
 */
function easeOutCubic(value) {
    const t = clampNumber(value, 0, 1);
    return 1 - Math.pow(1 - t, 3);
}

/**
 * 타일 좌표를 Map 조회 키로 변환합니다.
 * @param {number} x - 타일 X 좌표입니다.
 * @param {number} y - 타일 Y 좌표입니다.
 * @returns {string} `x,y` 키입니다.
 */
function toTileKey(x, y) {
    return `${x},${y}`;
}

/**
 * UI 기준 폭에 맞춰 반응형 Canvas 폰트 문자열을 생성합니다.
 * @param {object} spec - `TUTORIAL_GAME_DATA.TYPOGRAPHY`의 폰트 규격입니다.
 * @param {number} uiWidth - 현재 UI 기준 너비입니다.
 * @returns {string} Canvas font 문자열입니다.
 */
function createResponsiveFont(spec, uiWidth) {
    return createFontString({
        sizePx: clampNumber(uiWidth * (spec.SIZE_UIWW / 100), spec.MIN, spec.MAX),
        family: spec.FAMILY,
        weight: spec.WEIGHT
    });
}

/**
 * 목록에서 직전 값과 가급적 겹치지 않는 임의 항목을 선택합니다.
 * @param {readonly string[]} values - 선택 후보입니다.
 * @param {string} previous - 직전 선택값입니다.
 * @returns {string} 선택된 문자열입니다.
 */
function pickDifferentLine(values, previous = '') {
    if (!Array.isArray(values) || values.length === 0) {
        return '';
    }
    if (values.length === 1) {
        return values[0];
    }

    const candidates = values.filter((value) => value !== previous);
    return candidates[Math.floor(Math.random() * candidates.length)] || values[0];
}

/**
 * @class TutorialScene
 * @description 이동과 상호작용을 한 턴으로 묶는 2D 탑뷰 전술 튜토리얼 씬입니다.
 */
export class TutorialScene extends BaseScene {
    /**
     * @param {object} sceneSystem - 현재 씬을 소유한 SceneSystem입니다.
     */
    constructor(sceneSystem) {
        super(sceneSystem);
        this.data = TUTORIAL_GAME_DATA;
        this.model = new TutorialBattleModel(this.data);
        this.elapsedSeconds = 0;
        this.facing = 0;
        this.cursorTile = { ...this.model.player };
        this.plannedPath = [{ ...this.model.player }];
        this.plannedPathCost = 0;
        this.plannedDestinationSelected = false;
        this.hoveredTile = null;
        this.reachability = new Map();
        this.actionTargets = [];
        this.buttons = {};
        this.keyboardLatch = new Map();
        this.keyboardPressObserved = new Map();
        this.frameKeyEdges = new Set();
        const initialKeyboardEventTimestamp = Number(getKeyboardSnapshot()?.lastEvent?.timeStamp);
        this.lastKeyboardEventTimestamp = Number.isFinite(initialKeyboardEventTimestamp)
            ? initialKeyboardEventTimestamp
            : -1;
        for (const code of WATCHED_KEY_CODES) {
            const isDown = getKeyboardCodeInput(code) === true;
            this.keyboardLatch.set(code, isDown);
            this.keyboardPressObserved.set(code, isDown);
        }
        this.eventLog = [];
        this.movementAnimation = null;
        this.loraMovementAnimation = null;
        this.actionAnimation = null;
        this.particles = [];
        this.floatingTexts = [];
        this.speechBubble = null;
        this.loraTurnState = null;
        this.turnGateSeconds = 0;
        this.screenShakeSeconds = 0;
        this.shakeX = 0;
        this.shakeY = 0;
        this.lastLoraLine = '';
        this.lastPlayerLine = '';
        this.lastMoveCost = 0;
        this.uiActionHandled = false;
        this.#syncViewport();
        this.#refreshTacticalCache();
        this.#appendEvent('임무 시작 · 이동할 타일을 선택하세요.');
    }

    /**
     * 입력, 전술 상태 명령, 턴 연출을 가변 프레임에서 갱신합니다.
     * @override
     */
    update() {
        const deltaSeconds = getDelta();
        this.elapsedSeconds += deltaSeconds;
        this.uiActionHandled = false;

        this.#updatePresentation(deltaSeconds);
        this.#syncButtonStates();
        this.#updateButtons();
        this.#prepareKeyboardEdges();
        this.#handleKeyboardInput();
        this.#updatePointerState();
        this.#handlePointerInput();
        this.#updateLoraTurn(deltaSeconds);
        this.#captureKeyboardLatch();
    }

    /**
     * 맵, 전술 오브젝트, 경로, HUD와 결과 화면을 레이어 순서에 맞춰 그립니다.
     * @override
     */
    draw() {
        this.#drawBackdrop();
        this.#drawBoard();
        this.#drawDoor();
        this.#drawEntities();
        this.#drawPathPreview();
        this.#drawWorldEffects();
        this.#drawHud();
        this.#drawSpeechBubble();
        this.#drawDialogueOverlay();
        this.#drawResultOverlay();
    }

    /**
     * 프레임 경계에서 전달된 검증 대상 명령을 전투 모델에 적용합니다.
     * @param {object[]} commands - 시뮬레이션 명령 목록입니다.
     * @override
     */
    applySimulationCommands(commands = []) {
        for (const command of commands) {
            if (!command || typeof command.type !== 'string') {
                continue;
            }

            if (command.type === TUTORIAL_COMMANDS.RESTART) {
                clearSimulationCommands();
                this.sceneSystem.startPlayScene();
                return;
            }

            switch (command.type) {
                case TUTORIAL_COMMANDS.MOVE:
                    this.#applyMoveCommand(command.payload);
                    break;
                case TUTORIAL_COMMANDS.SELECT_ACTION:
                    this.#applyActionSelectionCommand(command.payload);
                    break;
                case TUTORIAL_COMMANDS.INTERACT:
                    this.#applyInteractionCommand(command.payload);
                    break;
                case TUTORIAL_COMMANDS.END_TURN:
                    this.#applyEndTurnCommand();
                    break;
                case TUTORIAL_COMMANDS.DEFEND:
                    this.#applyDefendCommand();
                    break;
                case TUTORIAL_COMMANDS.ESCAPE:
                    this.#applyEscapeCommand();
                    break;
                case TUTORIAL_COMMANDS.DIALOGUE:
                    this.#applyDialogueCommand(command.payload);
                    break;
                case TUTORIAL_COMMANDS.UNDO:
                    this.#applyUndoCommand();
                    break;
                case TUTORIAL_COMMANDS.COMPLETE_LORA_TURN:
                    this.#applyLoraTurnCompletion();
                    break;
                default:
                    break;
            }
        }
    }

    /**
     * 창 크기에 맞춰 보드와 HUD 배치를 다시 계산합니다.
     * @override
     */
    resize() {
        this.particles = [];
        this.floatingTexts = [];
        this.#syncViewport();
    }

    /**
     * 테마나 표시 설정 변경 후 현재 반응형 레이아웃을 다시 구성합니다.
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
     * 씬이 소유한 UI 풀 요소와 대기 명령을 정리합니다.
     * @override
     */
    destroy() {
        clearSimulationCommands();
        this.#releaseButtons();
        this.particles = [];
        this.floatingTexts = [];
    }

    /**
     * 현재 표시 영역에서 보드, 사이드바, 폰트와 버튼 배치를 계산합니다.
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
        const maxBoardWidth = this.#uww(boardLayout.MAX_WIDTH_UIWW);
        const maxBoardHeight = this.#uwh(boardLayout.MAX_HEIGHT_WH);
        this.tileSize = Math.max(1, Math.min(
            maxBoardWidth / this.data.MAP.WIDTH,
            maxBoardHeight / this.data.MAP.HEIGHT
        ));
        this.boardWidth = this.tileSize * this.data.MAP.WIDTH;
        this.boardHeight = this.tileSize * this.data.MAP.HEIGHT;
        this.boardX = this.UIOffsetX + this.#uww(boardLayout.X_UIWW);
        this.boardY = this.#uwh(boardLayout.Y_WH);
        this.tileGap = this.tileSize * boardLayout.TILE_GAP_RATIO;
        this.elevationLift = this.tileSize * boardLayout.ELEVATION_LIFT_RATIO;
        this.maxTerrainHeight = Math.max(...this.data.MAP.HEIGHTS.flat());
        const framePadding = this.tileSize * boardLayout.FRAME_PADDING_RATIO;
        this.boardFrame = {
            x: this.boardX - framePadding,
            y: this.boardY - (this.maxTerrainHeight * this.elevationLift) - framePadding,
            w: this.boardWidth + (framePadding * 2),
            h: this.boardHeight + (this.maxTerrainHeight * this.elevationLift) + (framePadding * 2)
        };

        const sidebarLayout = this.data.LAYOUT.SIDEBAR;
        this.sidebar = {
            x: this.UIOffsetX + this.#uww(sidebarLayout.X_UIWW),
            y: this.#uwh(sidebarLayout.Y_WH),
            w: this.#uww(sidebarLayout.WIDTH_UIWW),
            h: this.#uwh(sidebarLayout.HEIGHT_WH),
            padding: this.#uww(sidebarLayout.PADDING_UIWW),
            radius: this.#uwh(sidebarLayout.RADIUS_WH)
        };
        this.#buildButtons();
    }

    /**
     * UI 기준 너비 백분율을 현재 픽셀 값으로 변환합니다.
     * @param {number} value - UIWW 백분율입니다.
     * @returns {number} 변환된 픽셀 값입니다.
     * @private
     */
    #uww(value) {
        return this.UIWW * (value / 100);
    }

    /**
     * 화면 높이 백분율을 현재 픽셀 값으로 변환합니다.
     * @param {number} value - WH 백분율입니다.
     * @returns {number} 변환된 픽셀 값입니다.
     * @private
     */
    #uwh(value) {
        return this.WH * (value / 100);
    }

    /**
     * HUD 행동 버튼, 대화 선택지와 결과 재시작 버튼을 UI 풀에서 구성합니다.
     * @private
     */
    #buildButtons() {
        this.#releaseButtons();
        const actions = this.data.LAYOUT.ACTIONS;
        const buttonHeight = Math.min(this.#uwh(actions.BUTTON_HEIGHT_WH), this.#uwh(4.1));
        const buttonGap = Math.min(this.#uwh(actions.GAP_WH), this.#uwh(0.55));
        const buttonX = this.sidebar.x + this.sidebar.padding;
        const buttonWidth = this.sidebar.w - (this.sidebar.padding * 2);
        const firstButtonY = this.#uwh(actions.TOP_WH);
        const buttonDefinitions = [
            ['attack', this.data.TEXT.ACTIONS.ATTACK, () => this.#queueActionSelection(ACTION_ATTACK)],
            ['defend', '방어', () => this.#queueUiCommand(TUTORIAL_COMMANDS.DEFEND)],
            ['endTurn', '턴 종료', () => this.#queueEndTurnOrMove()],
            ['undo', '이동 취소', () => this.#queueUiCommand(TUTORIAL_COMMANDS.UNDO)],
            ['escape', '게이트 탈출', () => this.#queueUiCommand(TUTORIAL_COMMANDS.ESCAPE)]
        ];

        buttonDefinitions.forEach(([key, label, onClick], index) => {
            this.buttons[key] = this.#createButton({
                x: buttonX,
                y: firstButtonY + ((buttonHeight + buttonGap) * index),
                w: buttonWidth,
                h: buttonHeight,
                label,
                onClick
            });
        });

        const modal = this.data.LAYOUT.MODAL;
        const modalW = this.#uww(modal.WIDTH_UIWW);
        const modalH = this.#uwh(modal.HEIGHT_WH);
        const modalX = this.UIOffsetX + ((this.UIWW - modalW) * 0.5);
        const modalY = (this.WH - modalH) * 0.5;
        this.buttons.resultRestart = this.#createButton({
            x: modalX + (modalW * 0.25),
            y: modalY + (modalH * 0.72),
            w: modalW * 0.5,
            h: buttonHeight,
            label: `${this.data.TEXT.ACTIONS.RESTART}  [R]`,
            onClick: () => this.#queueUiCommand(TUTORIAL_COMMANDS.RESTART)
        });

        const dialogueW = Math.max(modalW, this.#uww(42));
        const dialogueH = Math.max(modalH, this.#uwh(48));
        const dialogueX = this.UIOffsetX + ((this.UIWW - dialogueW) * 0.5);
        const dialogueY = (this.WH - dialogueH) * 0.5;
        const choiceHeight = this.#uwh(5);
        DIALOGUE_CHOICES.forEach((choice, index) => {
            this.buttons[`dialogue-${choice.id}`] = this.#createButton({
                x: dialogueX + (dialogueW * 0.12),
                y: dialogueY + (dialogueH * 0.39) + (index * this.#uwh(6.2)),
                w: dialogueW * 0.76,
                h: choiceHeight,
                label: `${index + 1}. ${choice.label}`,
                onClick: () => this.#queueUiCommand(TUTORIAL_COMMANDS.DIALOGUE, {
                    choice: choice.id
                })
            });
        });
    }

    /**
     * 텍스트 하나를 중앙에 배치한 풀 기반 버튼을 생성합니다.
     * @param {{x:number,y:number,w:number,h:number,label:string,onClick:Function}} options - 버튼 구성값입니다.
     * @returns {{item:object,text:object}} 생성된 버튼 묶음입니다.
     * @private
     */
    #createButton(options) {
        const colors = ColorSchemes.Tactics;
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
            color: colors.UI.Text,
            align: 'center'
        });

        const button = UIPool.button.get();
        button.init({
            parent: this,
            layer: 'ui',
            x: options.x,
            y: options.y,
            width: options.w,
            height: options.h,
            center: [textElement],
            radius: this.#uwh(this.data.LAYOUT.ACTIONS.BUTTON_RADIUS_WH),
            idleColor: colors.UI.ButtonIdle,
            hoverColor: colors.UI.ButtonHover,
            color: colors.UI.Text,
            onClick: options.onClick
        });
        return { item: button, text: textElement };
    }

    /**
     * 씬이 보유한 모든 버튼과 자식 텍스트를 UI 풀에 반납합니다.
     * @private
     */
    #releaseButtons() {
        for (const button of Object.values(this.buttons)) {
            releaseUIItem(button?.item);
        }
        this.buttons = {};
    }

    /**
     * 현재 전투 단계에 맞춰 버튼 표시, 라벨, 활성 상태와 색을 갱신합니다.
     * @private
     */
    #syncButtonStates() {
        if (!this.buttons.attack) {
            return;
        }

        const colors = ColorSchemes.Tactics;
        const isResult = this.#isResultPhase();
        const isDialogue = this.#isDialoguePhase();
        const isPlayerPhase = this.model.turn === 'player';
        const locked = this.#isPresentationLocked();
        const isMovePhase = isPlayerPhase && this.model.phase === 'move';
        const isActionPhase = isPlayerPhase && this.model.phase === 'action';
        const attackTargets = isActionPhase ? this.model.getValidTargets(ACTION_ATTACK) : [];

        this.buttons.endTurn.text.text = isMovePhase && this.plannedDestinationSelected
            ? '이동 확정  [Enter]'
            : '턴 종료  [Space]';
        this.buttons.attack.text.text = `${this.data.TEXT.ACTIONS.ATTACK}  [1]`;
        this.buttons.defend.text.text = '방어  [2]';
        this.buttons.undo.text.text = '이동 취소  [Z]';
        this.buttons.escape.text.text = '게이트 탈출  [E]';

        this.#configureButton(this.buttons.attack, {
            visible: !isResult && !isDialogue,
            enabled: isPlayerPhase
                && !locked
                && ((isMovePhase && !this.plannedDestinationSelected)
                    || (isActionPhase && attackTargets.length > 0)),
            active: isActionPhase && this.model.selectedAction === ACTION_ATTACK
        });
        this.#configureButton(this.buttons.defend, {
            visible: !isResult && !isDialogue,
            enabled: ((isMovePhase && !this.plannedDestinationSelected) || isActionPhase) && !locked,
            active: this.model.player?.defending === true
        });
        this.#configureButton(this.buttons.endTurn, {
            visible: !isResult && !isDialogue,
            enabled: isPlayerPhase && !locked,
            active: false
        });
        this.#configureButton(this.buttons.undo, {
            visible: !isResult && !isDialogue,
            enabled: isPlayerPhase
                && !locked
                && (isActionPhase || (isMovePhase && this.plannedDestinationSelected)),
            active: false
        });
        this.#configureButton(this.buttons.escape, {
            visible: !isResult && !isDialogue && this.model.gateOpen === true,
            enabled: isPlayerPhase && this.#canEscape() && !locked,
            active: this.#canEscape()
        });
        this.#configureButton(this.buttons.resultRestart, {
            visible: isResult,
            enabled: isResult,
            active: true
        });
        for (const choice of DIALOGUE_CHOICES) {
            this.#configureButton(this.buttons[`dialogue-${choice.id}`], {
                visible: isDialogue,
                enabled: isDialogue && !locked,
                active: false
            });
        }

        for (const button of Object.values(this.buttons)) {
            button.text.color = button.item.clickAble
                ? colors.UI.Text
                : colors.UI.Muted;
        }
    }

    /**
     * 버튼 한 개의 상호작용 가능 여부와 강조 색을 적용합니다.
     * @param {{item:object,text:object}} button - 갱신할 버튼입니다.
     * @param {{visible:boolean,enabled:boolean,active:boolean}} state - 표시 상태입니다.
     * @private
     */
    #configureButton(button, state) {
        if (!button) {
            return;
        }
        const colors = ColorSchemes.Tactics;
        button.item.visible = state.visible;
        button.item.clickAble = state.enabled;
        button.item.idleColor = state.enabled
            ? (state.active ? colors.UI.Accent : colors.UI.ButtonIdle)
            : colors.UI.ButtonDisabled;
        button.item.hoverColor = state.enabled
            ? colors.UI.ButtonHover
            : colors.UI.ButtonDisabled;
    }

    /**
     * 현재 표시 중인 UI 버튼들의 상호작용 애니메이션과 클릭을 갱신합니다.
     * @private
     */
    #updateButtons() {
        for (const button of Object.values(this.buttons)) {
            button.item.update();
        }
    }

    /**
     * HUD 클릭에서 발생한 명령을 큐에 넣고 같은 클릭의 보드 전파를 차단합니다.
     * @param {string} type - 명령 타입입니다.
     * @param {object} [payload] - 검증할 명령 데이터입니다.
     * @private
     */
    #queueUiCommand(type, payload) {
        this.uiActionHandled = true;
        consumeMouseState('left', 'clicked');
        enqueueSimulationCommand({ type, payload });
    }

    /**
     * 공격 선택 명령을 큐에 넣습니다.
     * @param {'attack'} action - 선택할 행동입니다.
     * @private
     */
    #queueActionSelection(action) {
        this.#queueUiCommand(TUTORIAL_COMMANDS.SELECT_ACTION, { action });
    }

    /**
     * 선택된 이동 경로를 확정하거나 현재 플레이어 턴을 종료합니다.
     * @private
     */
    #queueEndTurnOrMove() {
        if (this.model.turn !== 'player') {
            return;
        }
        if (this.model.phase === 'move' && this.plannedDestinationSelected) {
            this.#queueUiCommand(TUTORIAL_COMMANDS.MOVE, {
                x: this.plannedPath[this.plannedPath.length - 1].x,
                y: this.plannedPath[this.plannedPath.length - 1].y,
                path: this.plannedPath.map((point) => ({ ...point }))
            });
            return;
        }
        if (this.model.phase === 'move' || this.model.phase === 'action') {
            this.#queueUiCommand(TUTORIAL_COMMANDS.END_TURN);
        }
    }

    /**
     * 키보드 단발 입력을 전술 커서와 행동 명령으로 변환합니다.
     * @private
     */
    #handleKeyboardInput() {
        if (this.sceneSystem.systemHandler.overlayManager?.hasAnyOverlay?.()) {
            return;
        }
        if (this.#isKeyPressed('KeyR')) {
            enqueueSimulationCommand({ type: TUTORIAL_COMMANDS.RESTART });
            return;
        }
        if (this.#isResultPhase() || this.#isPresentationLocked()) {
            return;
        }

        if (this.#isDialoguePhase()) {
            const choiceIndex = ['Digit1', 'Digit2', 'Digit3', 'Digit4']
                .findIndex((code) => this.#isKeyPressed(code));
            if (choiceIndex >= 0) {
                enqueueSimulationCommand({
                    type: TUTORIAL_COMMANDS.DIALOGUE,
                    payload: { choice: DIALOGUE_CHOICES[choiceIndex].id }
                });
            }
            return;
        }

        const direction = KEY_DIRECTIONS.find((candidate) => (
            candidate.codes.some((code) => this.#isKeyPressed(code))
        ));
        if (direction && this.model.turn === 'player') {
            if (this.model.phase === 'move') {
                this.#extendPlannedPath(direction);
            } else {
                const nextX = this.cursorTile.x + direction.x;
                const nextY = this.cursorTile.y + direction.y;
                if (this.model.isInside(nextX, nextY)) {
                    this.cursorTile = { x: nextX, y: nextY };
                    this.facing = direction.facing;
                }
            }
        }

        if (this.model.turn !== 'player') {
            return;
        }
        if (this.model.phase === 'move') {
            if (this.#isKeyPressed('KeyZ') || this.#isKeyPressed('Escape')) {
                this.#removePlannedPathStep();
            } else if (this.#isKeyPressed('Enter') && this.plannedDestinationSelected) {
                enqueueSimulationCommand({
                    type: TUTORIAL_COMMANDS.MOVE,
                    payload: {
                        x: this.plannedPath[this.plannedPath.length - 1].x,
                        y: this.plannedPath[this.plannedPath.length - 1].y,
                        path: this.plannedPath.map((point) => ({ ...point }))
                    }
                });
            } else if (this.#isKeyPressed('Space')) {
                enqueueSimulationCommand({ type: TUTORIAL_COMMANDS.END_TURN });
            } else if (this.#isKeyPressed('KeyE') && this.#canEscape()) {
                enqueueSimulationCommand({ type: TUTORIAL_COMMANDS.ESCAPE });
            } else if (this.#isKeyPressed('Digit1') && !this.plannedDestinationSelected) {
                enqueueSimulationCommand({
                    type: TUTORIAL_COMMANDS.SELECT_ACTION,
                    payload: { action: ACTION_ATTACK }
                });
            } else if (this.#isKeyPressed('Digit2') && !this.plannedDestinationSelected) {
                enqueueSimulationCommand({ type: TUTORIAL_COMMANDS.DEFEND });
            }
            return;
        }

        if (this.model.phase !== 'action') {
            return;
        }
        if (this.#isKeyPressed('Digit1')) {
            enqueueSimulationCommand({
                type: TUTORIAL_COMMANDS.SELECT_ACTION,
                payload: { action: ACTION_ATTACK }
            });
        } else if (this.#isKeyPressed('Digit2')) {
            enqueueSimulationCommand({ type: TUTORIAL_COMMANDS.DEFEND });
        } else if (this.#isKeyPressed('Digit3') || this.#isKeyPressed('Space')) {
            enqueueSimulationCommand({ type: TUTORIAL_COMMANDS.END_TURN });
        } else if (this.#isKeyPressed('KeyE') && this.#canEscape()) {
            enqueueSimulationCommand({ type: TUTORIAL_COMMANDS.ESCAPE });
        } else if (this.#isKeyPressed('KeyZ') || this.#isKeyPressed('Escape')) {
            enqueueSimulationCommand({ type: TUTORIAL_COMMANDS.UNDO });
        } else if (this.#isKeyPressed('Enter')) {
            const target = this.actionTargets.find((candidate) => (
                candidate.x === this.cursorTile.x && candidate.y === this.cursorTile.y
            ));
            if (target) {
                enqueueSimulationCommand({
                    type: TUTORIAL_COMMANDS.INTERACT,
                    payload: { targetId: target.id }
                });
            }
        }
    }

    /**
     * 지정한 키가 이번 프레임에 새로 눌렸는지 확인합니다.
     * @param {string} code - KeyboardEvent.code 값입니다.
     * @returns {boolean} 상승 에지 입력이면 true입니다.
     * @private
     */
    #isKeyPressed(code) {
        return this.frameKeyEdges.has(code);
    }

    /**
     * 현재 눌림 상승 에지와 프레임 사이에 끝난 빠른 탭 이벤트를 하나의 키 집합으로 합칩니다.
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
     * 다음 프레임의 상승 에지 판정을 위해 현재 키 상태를 저장합니다.
     * @private
     */
    #captureKeyboardLatch() {
        for (const code of WATCHED_KEY_CODES) {
            this.keyboardLatch.set(code, getKeyboardCodeInput(code) === true);
        }
    }

    /**
     * 방향키 한 번을 실제 이동 경로 한 칸으로 추가합니다.
     * 점유, 누적 이동력과 같은 턴 내 타일 재방문 금지를 즉시 검증합니다.
     * @param {{x:number,y:number,facing:number}} direction - 추가할 방향입니다.
     * @private
     */
    #extendPlannedPath(direction) {
        const previous = this.plannedPath[this.plannedPath.length - 1];
        const next = {
            x: previous.x + direction.x,
            y: previous.y + direction.y
        };
        if (!this.model.isInside(next.x, next.y)) {
            return;
        }

        const occupant = this.model.getOccupantAt(next.x, next.y);
        if (occupant && occupant.type !== 'player' && occupant.type !== 'door') {
            return;
        }
        if (this.plannedPath.some((point) => point.x === next.x && point.y === next.y)) {
            return;
        }

        const stepCost = 1;
        if (this.plannedPathCost + stepCost > this.data.MAP.MOVE_RANGE) {
            return;
        }
        this.plannedPath.push(next);
        this.plannedPathCost += stepCost;
        this.plannedDestinationSelected = true;
        this.cursorTile = { ...next };
        this.facing = direction.facing;
    }

    /**
     * 키보드로 계획한 마지막 이동 한 칸을 취소합니다.
     * @private
     */
    #removePlannedPathStep() {
        if (this.plannedPath.length <= 1) {
            this.plannedDestinationSelected = false;
            return;
        }
        this.plannedPath.pop();
        const current = this.plannedPath[this.plannedPath.length - 1];
        this.plannedPathCost = Math.max(0, this.plannedPathCost - 1);
        this.plannedDestinationSelected = this.plannedPath.length > 1;
        this.cursorTile = { ...current };
    }

    /**
     * 선택 중인 이동 경로를 현재 플레이어 위치로 초기화합니다.
     * @private
     */
    #clearPlannedPath() {
        this.cursorTile = { x: this.model.player.x, y: this.model.player.y };
        this.plannedPath = [{ ...this.cursorTile }];
        this.plannedPathCost = 0;
        this.plannedDestinationSelected = false;
    }

    /**
     * 자동 경로가 인접 좌표로 이어지고 같은 타일을 두 번 방문하지 않는지 확인합니다.
     * @param {Array<{x:number,y:number}>} path - 모델이 제안한 경로입니다.
     * @returns {Array<{x:number,y:number}>|null} 표시 가능한 복제 경로입니다.
     * @private
     */
    #normalizePreviewPath(path) {
        if (!Array.isArray(path) || path.length === 0) {
            return null;
        }
        const normalized = [];
        const visited = new Set();
        for (let index = 0; index < path.length; index++) {
            const point = path[index];
            if (!point || !this.model.isInside(point.x, point.y)) {
                return null;
            }
            const key = toTileKey(point.x, point.y);
            if (visited.has(key)) {
                return null;
            }
            if (index > 0) {
                const previous = normalized[index - 1];
                if (Math.abs(previous.x - point.x) + Math.abs(previous.y - point.y) !== 1) {
                    return null;
                }
            }
            visited.add(key);
            normalized.push({ x: point.x, y: point.y });
        }
        return normalized;
    }

    /**
     * 보드 포커스와 현재 마우스 좌표로 호버 타일을 갱신합니다.
     * @private
     */
    #updatePointerState() {
        if (!getMouseFocus().includes('object')) {
            this.hoveredTile = null;
            return;
        }

        const mouse = getMouseInput('pos') || { x: 0, y: 0 };
        this.hoveredTile = this.#getTileAtPoint(mouse.x, mouse.y);
    }

    /**
     * 소비되지 않은 마우스 클릭을 이동 또는 상호작용 의도로 변환합니다.
     * @private
     */
    #handlePointerInput() {
        if (this.uiActionHandled
            || this.#isResultPhase()
            || this.#isDialoguePhase()
            || this.#isPresentationLocked()) {
            return;
        }
        if (!getMouseFocus().includes('object')) {
            return;
        }

        if (consumeMouseState('right', 'clicked')) {
            if (this.model.turn === 'player') {
                if (this.model.phase === 'action') {
                    enqueueSimulationCommand({ type: TUTORIAL_COMMANDS.UNDO });
                } else if (this.model.phase === 'move') {
                    this.#clearPlannedPath();
                }
            }
            return;
        }
        if (!consumeMouseState('left', 'clicked') || !this.hoveredTile) {
            return;
        }
        if (this.model.turn !== 'player') {
            return;
        }

        if (this.model.phase === 'move') {
            const key = toTileKey(this.hoveredTile.x, this.hoveredTile.y);
            const reachable = this.reachability.get(key);
            if (reachable) {
                const destination = this.plannedPath[this.plannedPath.length - 1];
                if (this.plannedDestinationSelected
                    && destination.x === this.hoveredTile.x
                    && destination.y === this.hoveredTile.y) {
                    enqueueSimulationCommand({
                        type: TUTORIAL_COMMANDS.MOVE,
                        payload: {
                            x: destination.x,
                            y: destination.y,
                            path: this.plannedPath.map((point) => ({ ...point }))
                        }
                    });
                    return;
                }

                const path = this.#normalizePreviewPath(reachable.path);
                if (!path) {
                    return;
                }
                this.plannedPath = path;
                this.plannedPathCost = path.length - 1;
                this.plannedDestinationSelected = true;
                this.cursorTile = { ...this.hoveredTile };
                this.#syncFacingFromPath(path);
                this.#appendEvent('이동 경로 선택 · 같은 타일을 다시 누르면 확정됩니다.');
            }
            return;
        }

        if (this.model.phase === 'action') {
            const target = this.actionTargets.find((candidate) => (
                candidate.x === this.hoveredTile.x && candidate.y === this.hoveredTile.y
            ));
            if (target) {
                enqueueSimulationCommand({
                    type: TUTORIAL_COMMANDS.INTERACT,
                    payload: { targetId: target.id }
                });
            }
        }
    }

    /**
     * 화면 좌표가 포함된 가장 앞쪽 타일을 반환합니다.
     * @param {number} pointX - 화면 X 좌표입니다.
     * @param {number} pointY - 화면 Y 좌표입니다.
     * @returns {{x:number,y:number}|null} 호버 타일입니다.
     * @private
     */
    #getTileAtPoint(pointX, pointY) {
        for (let y = this.data.MAP.HEIGHT - 1; y >= 0; y--) {
            for (let x = this.data.MAP.WIDTH - 1; x >= 0; x--) {
                const tile = this.#getTileVisual(x, y, false);
                if (pointX >= tile.left
                    && pointX <= tile.left + this.tileSize
                    && pointY >= tile.top
                    && pointY <= tile.top + this.tileSize) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    /**
     * 이동 명령의 좌표를 검증해 모델에 적용하고 경로 연출을 시작합니다.
     * @param {object} payload - 목적지 좌표입니다.
     * @private
     */
    #applyMoveCommand(payload) {
        const x = Number(payload?.x);
        const y = Number(payload?.y);
        if (!Number.isInteger(x) || !Number.isInteger(y) || this.#isPresentationLocked()) {
            return;
        }

        const result = Array.isArray(payload?.path)
            ? this.model.commitPath(payload.path)
            : this.model.commitMove(x, y);
        if (!result.ok) {
            return;
        }

        const destination = result.path[result.path.length - 1];
        this.lastMoveCost = result.cost;
        this.cursorTile = { ...destination };
        this.plannedPath = [{ ...destination }];
        this.plannedPathCost = 0;
        this.plannedDestinationSelected = false;
        this.#syncFacingFromPath(result.path);
        if (result.path.length > 1) {
            this.movementAnimation = {
                path: result.path.map((point) => ({ ...point })),
                elapsed: 0,
                duration: (result.path.length - 1) * this.data.ANIMATION.MOVE_SECONDS_PER_TILE
            };
        }
        this.#appendEvent(`이동 확정 · 이동력 ${result.cost}/${this.data.MAP.MOVE_RANGE}`);
        this.#refreshTacticalCache();
    }

    /**
     * 선택된 경로의 마지막 방향을 플레이어 표시 방향으로 반영합니다.
     * @param {Array<{x:number,y:number}>} path - 이동 경로입니다.
     * @private
     */
    #syncFacingFromPath(path) {
        if (!Array.isArray(path) || path.length < 2) {
            return;
        }
        const previous = path[path.length - 2];
        const current = path[path.length - 1];
        const dx = current.x - previous.x;
        const dy = current.y - previous.y;
        if (dx > 0) this.facing = 90;
        else if (dx < 0) this.facing = 270;
        else if (dy > 0) this.facing = 180;
        else if (dy < 0) this.facing = 0;
    }

    /**
     * 공격 모드를 모델에 적용하고 대상 캐시를 갱신합니다.
     * @param {object} payload - 행동 종류입니다.
     * @private
     */
    #applyActionSelectionCommand(payload) {
        const action = payload?.action;
        if (this.#isPresentationLocked() || !this.model.selectAction(action)) {
            return;
        }
        this.#appendEvent('공격 대상을 선택하세요.');
        this.#refreshTacticalCache();
    }

    /**
     * 상호작용 대상 ID를 재검증하고 공격 결과 연출을 구성합니다.
     * @param {object} payload - 대상 ID입니다.
     * @private
     */
    #applyInteractionCommand(payload) {
        if (this.#isPresentationLocked() || typeof payload?.targetId !== 'string') {
            return;
        }
        const target = this.model.getValidTargets().find((candidate) => candidate.id === payload.targetId);
        if (!target) {
            return;
        }

        const targetPosition = { x: target.x, y: target.y };
        const result = this.model.performInteraction(payload.targetId);
        if (!result.ok) {
            return;
        }
        this.#faceTarget(targetPosition);

        this.actionAnimation = {
            type: ACTION_ATTACK,
            targetId: result.targetId,
            targetType: result.targetType,
            targetPosition,
            elapsed: 0,
            duration: this.data.ANIMATION.ATTACK_SECONDS,
            ghostBox: result.destroyed === true
        };
        this.turnGateSeconds = this.data.ANIMATION.ATTACK_SECONDS
            + this.data.ANIMATION.TURN_GATE_SECONDS;
        this.screenShakeSeconds = this.data.ANIMATION.SHAKE_SECONDS;
        this.#spawnImpact(targetPosition, result.targetType === 'box');

        if (result.targetType === 'box') {
            this.#appendEvent('상자 파괴 · 길이 열렸습니다.');
            this.#spawnFloatingText(targetPosition, '파괴!', ColorSchemes.Tactics.UI.Warning);
        } else {
            this.#appendEvent(`로라에게 ${result.damage} 피해 · HP ${this.model.lora.hp}/${this.model.lora.maxHp}`);
            this.#spawnFloatingText(targetPosition, `-${result.damage}`, ColorSchemes.Tactics.UI.Danger);
            if (Number.isFinite(result.instabilityChange) && result.instabilityChange !== 0) {
                const sign = result.instabilityChange > 0 ? '+' : '';
                this.#appendEvent(`불안정도 ${sign}${result.instabilityChange} · 현재 ${this.model.lora.instability}`);
            }
        }

        if (result.gateOpened || result.defeated || this.model.lora.alive === false) {
            this.#appendEvent('로라 무력화 · 게이트가 열렸습니다. 이제 탈출하세요.');
            this.turnGateSeconds = this.data.ANIMATION.ATTACK_SECONDS;
        }
        this.#refreshTacticalCache();
    }

    /**
     * 플레이어가 바라보는 방향을 대상 타일 쪽으로 맞춥니다.
     * @param {{x:number,y:number}} target - 대상 타일입니다.
     * @private
     */
    #faceTarget(target) {
        const dx = target.x - this.model.player.x;
        const dy = target.y - this.model.player.y;
        if (dx > 0) this.facing = 90;
        else if (dx < 0) this.facing = 270;
        else if (dy > 0) this.facing = 180;
        else if (dy < 0) this.facing = 0;
    }

    /**
     * 현재 행동을 포기하고 로라 턴으로 전환합니다.
     * @private
     */
    #applyEndTurnCommand() {
        if (this.#isPresentationLocked()) {
            return;
        }
        const completed = typeof this.model.endTurn === 'function'
            ? this.model.endTurn()
            : this.model.wait?.();
        if (!completed) {
            return;
        }
        this.#appendEvent('턴 종료 · 로라에게 차례를 넘겼습니다.');
        this.turnGateSeconds = this.data.ANIMATION.TURN_GATE_SECONDS;
        this.#refreshTacticalCache();
    }

    /**
     * 방어 행동을 적용하고 다음 로라 공격의 피해 감소 상태를 표시합니다.
     * @private
     */
    #applyDefendCommand() {
        if (this.#isPresentationLocked() || typeof this.model.defend !== 'function') {
            return;
        }
        const result = this.model.defend();
        if (!result || result.ok === false) {
            return;
        }
        this.#appendEvent('방어 · 이번 로라 턴에 받는 피해가 30% 감소합니다.');
        this.#spawnFloatingText(this.model.player, 'DEFEND', ColorSchemes.Tactics.UI.Accent);
        this.turnGateSeconds = this.data.ANIMATION.TURN_GATE_SECONDS;
        this.#refreshTacticalCache();
    }

    /**
     * 열린 게이트 타일에서 탈출을 시도합니다.
     * @private
     */
    #applyEscapeCommand() {
        if (this.#isPresentationLocked()
            || typeof this.model.escape !== 'function'
            || !this.#canEscape()) {
            return;
        }
        const result = this.model.escape();
        if (!result || result.ok === false) {
            return;
        }
        this.#appendEvent('탈출 성공 · 게이트를 통과했습니다.');
        this.#refreshTacticalCache();
    }

    /**
     * 강제 대화 선택지를 적용하고 다음 전투 단계의 캐시를 준비합니다.
     * @param {{choice:string}} payload - 선택한 대화 유형입니다.
     * @private
     */
    #applyDialogueCommand(payload) {
        const choice = DIALOGUE_CHOICES.find((candidate) => candidate.id === payload?.choice);
        if (!choice
            || !this.#isDialoguePhase()
            || typeof this.model.chooseDialogue !== 'function') {
            return;
        }
        const result = this.model.chooseDialogue(choice.id);
        if (!result || result.ok === false) {
            return;
        }
        this.#appendEvent(`대화 · ${choice.label} 선택`);
        this.turnGateSeconds = this.data.ANIMATION.TURN_GATE_SECONDS;
        this.#clearPlannedPath();
        this.#refreshTacticalCache();
    }

    /**
     * 확정한 이동을 이번 턴 시작 위치로 되돌립니다.
     * @private
     */
    #applyUndoCommand() {
        if (this.#isPresentationLocked() || this.model.turn !== 'player') {
            return;
        }
        if (this.model.phase === 'move') {
            if (!this.plannedDestinationSelected) {
                return;
            }
            this.#clearPlannedPath();
            this.#appendEvent('선택 경로를 취소했습니다.');
            return;
        }
        if (!this.model.undoMove()) {
            return;
        }
        this.cursorTile = { ...this.model.player };
        this.plannedPath = [{ ...this.model.player }];
        this.plannedPathCost = 0;
        this.plannedDestinationSelected = false;
        this.lastMoveCost = 0;
        this.#appendEvent('이동 취소 · 목적지를 다시 선택하세요.');
        this.#refreshTacticalCache();
    }

    /**
     * 로라의 자동 행동을 종료하고 다음 플레이어 또는 강제 대화 단계를 시작합니다.
     * @private
     */
    #applyLoraTurnCompletion() {
        if (!this.model.completeLoraTurn()) {
            return;
        }
        this.loraTurnState = null;
        this.loraMovementAnimation = null;
        this.#clearPlannedPath();
        this.lastMoveCost = 0;
        if (this.#isDialoguePhase()) {
            this.#appendEvent(`라운드 ${this.model.round} · 강제 대화`);
        } else if (this.#isResultPhase()) {
            this.#appendEvent('전투 종료 · 결과를 확인하세요.');
        } else {
            this.#appendEvent(`라운드 ${this.model.round}/${this.model.maxRounds ?? 8} · 플레이어 턴`);
        }
        this.#refreshTacticalCache();
    }

    /**
     * 현재 단계에서 필요한 이동 범위와 상호작용 대상 목록을 다시 계산합니다.
     * @private
     */
    #refreshTacticalCache() {
        this.reachability = this.model.turn === 'player' && this.model.phase === 'move'
            ? this.model.getReachability()
            : new Map();
        this.actionTargets = this.model.turn === 'player' && this.model.phase === 'action'
            ? this.model.getValidTargets()
            : [];
    }

    /**
     * 로라 턴 진입 시 모델의 이동·행동을 한 번 실행하고 연출 후 완료 명령을 보냅니다.
     * @param {number} deltaSeconds - 가변 프레임 델타입니다.
     * @private
     */
    #updateLoraTurn(deltaSeconds) {
        if (this.model.turn !== 'lora' || this.model.phase !== 'lora') {
            this.loraTurnState = null;
            return;
        }
        if (this.turnGateSeconds > 0 || this.#isPresentationLocked()) {
            return;
        }

        if (!this.loraTurnState) {
            const before = { x: this.model.lora.x, y: this.model.lora.y };
            const result = typeof this.model.performLoraTurn === 'function'
                ? (this.model.performLoraTurn() || {})
                : {};
            this.loraTurnState = {
                elapsed: 0,
                completionQueued: false,
                result
            };
            this.#presentLoraTurnResult(result, before);
            this.#refreshTacticalCache();
        }

        this.loraTurnState.elapsed += deltaSeconds;
        if (this.#isResultPhase()) {
            return;
        }
        const minimumSeconds = Math.max(
            this.data.ANIMATION.LORA_TURN_SECONDS,
            this.loraMovementAnimation?.duration ?? 0,
            this.data.ANIMATION.ATTACK_SECONDS + this.data.ANIMATION.TURN_GATE_SECONDS
        );
        if (this.loraTurnState.elapsed >= minimumSeconds
            && !this.loraTurnState.completionQueued) {
            this.loraTurnState.completionQueued = true;
            enqueueSimulationCommand({ type: TUTORIAL_COMMANDS.COMPLETE_LORA_TURN });
        }
    }

    /**
     * 로라 AI 결과를 이동 애니메이션, 피해 텍스트와 전술 로그로 변환합니다.
     * @param {object} result - 모델의 로라 턴 결과입니다.
     * @param {{x:number,y:number}} before - 행동 전 로라 좌표입니다.
     * @private
     */
    #presentLoraTurnResult(result, before) {
        const movement = result?.movement;
        const rawPath = Array.isArray(movement?.path)
            ? movement.path
            : (movement?.to
                ? [movement.from || before, movement.to]
                : (result?.to
                    ? [result.from || before, result.to]
                    : (before.x !== this.model.lora.x || before.y !== this.model.lora.y
                        ? [before, { x: this.model.lora.x, y: this.model.lora.y }]
                        : [])));
        const path = rawPath
            .filter((point) => point && Number.isInteger(point.x) && Number.isInteger(point.y))
            .map((point) => ({ x: point.x, y: point.y }));
        if (path.length > 1) {
            this.loraMovementAnimation = {
                path,
                elapsed: 0,
                duration: (path.length - 1) * this.data.ANIMATION.MOVE_SECONDS_PER_TILE
            };
            this.#appendEvent(`로라 이동 · (${path[path.length - 1].x}, ${path[path.length - 1].y})`);
        }

        const action = typeof result?.action === 'string'
            ? result.action
            : result?.action?.type;
        const damage = Math.max(0, Number(result?.damage ?? result?.action?.damage) || 0);
        let line = typeof result?.line === 'string'
            ? result.line
            : (typeof result?.action?.line === 'string' ? result.action.line : '');
        if (!line && this.model.lora.alive === true) {
            line = pickDifferentLine(this.data.TEXT.LORA_LINES || [], this.lastLoraLine);
        }
        if (line) {
            this.lastLoraLine = line;
            this.#setSpeech(LORA_ID, line);
        }

        if (damage > 0 || action === 'melee' || action === 'ranged') {
            const playerPosition = { x: this.model.player.x, y: this.model.player.y };
            this.actionAnimation = {
                type: 'lora-attack',
                targetId: PLAYER_ID,
                targetPosition: playerPosition,
                elapsed: 0,
                duration: this.data.ANIMATION.ATTACK_SECONDS
            };
            this.#spawnImpact(playerPosition, false);
            this.#spawnFloatingText(playerPosition, `-${damage}`, ColorSchemes.Tactics.UI.Danger);
            this.screenShakeSeconds = this.data.ANIMATION.SHAKE_SECONDS;
            const attackLabel = action === 'ranged' ? '원거리 공격' : '근접 공격';
            this.#appendEvent(`로라 ${attackLabel} · ${damage} 피해 · HP ${this.model.player.hp}/${this.model.player.maxHp}`);
        } else if (action === 'defend') {
            this.#spawnFloatingText(this.model.lora, 'DEFEND', ColorSchemes.Tactics.UI.Accent);
            this.#appendEvent('로라 방어 · 다음 피해를 50% 줄입니다.');
        } else if (action === 'talk') {
            this.#appendEvent(`로라 · ${line || '말없이 플레이어를 바라봅니다.'}`);
        } else if (action === 'skip' && this.model.lora.alive === false) {
            this.#appendEvent('로라는 무력화되어 행동할 수 없습니다.');
        } else {
            this.#appendEvent(line ? `로라 · ${line}` : '로라가 행동하지 않았습니다.');
        }
    }

    /**
     * 이동, 공격, 파티클, 말풍선과 화면 흔들림 표시 상태를 갱신합니다.
     * @param {number} deltaSeconds - 가변 프레임 델타입니다.
     * @private
     */
    #updatePresentation(deltaSeconds) {
        if (this.movementAnimation) {
            this.movementAnimation.elapsed += deltaSeconds;
            if (this.movementAnimation.elapsed >= this.movementAnimation.duration) {
                this.movementAnimation = null;
            }
        }
        if (this.loraMovementAnimation) {
            this.loraMovementAnimation.elapsed += deltaSeconds;
            if (this.loraMovementAnimation.elapsed >= this.loraMovementAnimation.duration) {
                this.loraMovementAnimation = null;
            }
        }
        if (this.actionAnimation) {
            this.actionAnimation.elapsed += deltaSeconds;
            if (this.actionAnimation.elapsed >= this.actionAnimation.duration) {
                this.actionAnimation = null;
            }
        }
        if (this.speechBubble) {
            this.speechBubble.elapsed += deltaSeconds;
            if (this.speechBubble.elapsed >= this.speechBubble.duration) {
                this.speechBubble = null;
            }
        }

        this.turnGateSeconds = Math.max(0, this.turnGateSeconds - deltaSeconds);
        this.#updateParticles(deltaSeconds);
        this.#updateFloatingTexts(deltaSeconds);
        this.#updateScreenShake(deltaSeconds);
    }

    /**
     * 활성 파티클의 위치와 남은 수명을 갱신합니다.
     * @param {number} deltaSeconds - 가변 프레임 델타입니다.
     * @private
     */
    #updateParticles(deltaSeconds) {
        for (const particle of this.particles) {
            particle.elapsed += deltaSeconds;
            particle.x += particle.vx * deltaSeconds;
            particle.y += particle.vy * deltaSeconds;
            particle.vy += this.tileSize * deltaSeconds;
        }
        this.particles = this.particles.filter((particle) => particle.elapsed < particle.duration);
    }

    /**
     * 피해 및 파괴 텍스트의 상승 위치와 수명을 갱신합니다.
     * @param {number} deltaSeconds - 가변 프레임 델타입니다.
     * @private
     */
    #updateFloatingTexts(deltaSeconds) {
        for (const floatingText of this.floatingTexts) {
            floatingText.elapsed += deltaSeconds;
            floatingText.y -= this.tileSize * 0.35 * deltaSeconds;
        }
        this.floatingTexts = this.floatingTexts.filter((item) => item.elapsed < item.duration);
    }

    /**
     * 짧은 피격 흔들림의 월드 레이어 오프셋을 계산합니다.
     * @param {number} deltaSeconds - 가변 프레임 델타입니다.
     * @private
     */
    #updateScreenShake(deltaSeconds) {
        this.screenShakeSeconds = Math.max(0, this.screenShakeSeconds - deltaSeconds);
        if (this.screenShakeSeconds <= 0) {
            this.shakeX = 0;
            this.shakeY = 0;
            return;
        }

        const strength = this.tileSize * this.data.ANIMATION.SHAKE_TILE_RATIO
            * (this.screenShakeSeconds / this.data.ANIMATION.SHAKE_SECONDS);
        this.shakeX = (Math.random() - 0.5) * strength;
        this.shakeY = (Math.random() - 0.5) * strength;
    }

    /**
     * 대상 타일 중심에서 공격 파편을 생성합니다.
     * @param {{x:number,y:number}} target - 피격 타일입니다.
     * @param {boolean} isBox - 상자 파편 색을 사용할지 여부입니다.
     * @private
     */
    #spawnImpact(target, isBox) {
        const visual = this.#getTileVisual(target.x, target.y);
        const colors = ColorSchemes.Tactics;
        for (let index = 0; index < this.data.ANIMATION.PARTICLE_COUNT; index++) {
            const angle = (Math.PI * 2 * index / this.data.ANIMATION.PARTICLE_COUNT)
                + ((Math.random() - 0.5) * 0.45);
            const speed = this.tileSize * (0.65 + (Math.random() * 0.75));
            this.particles.push({
                x: visual.centerX,
                y: visual.centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                elapsed: 0,
                duration: this.data.ANIMATION.PARTICLE_SECONDS,
                size: this.tileSize * (0.035 + (Math.random() * 0.035)),
                color: isBox ? colors.Effects.Debris : colors.Effects.Hit
            });
        }
    }

    /**
     * 대상 타일 위에 잠시 떠오르는 결과 텍스트를 생성합니다.
     * @param {{x:number,y:number}} target - 기준 타일입니다.
     * @param {string} text - 표시할 문자열입니다.
     * @param {string} color - 텍스트 색상입니다.
     * @private
     */
    #spawnFloatingText(target, text, color) {
        const visual = this.#getTileVisual(target.x, target.y);
        this.floatingTexts.push({
            x: visual.centerX,
            y: visual.centerY - (this.tileSize * 0.42),
            text,
            color,
            elapsed: 0,
            duration: this.data.ANIMATION.SPEECH_SECONDS * 0.6
        });
    }

    /**
     * 지정한 화자의 말풍선을 새 텍스트로 교체합니다.
     * @param {'player'|'lora'} speaker - 화자 ID입니다.
     * @param {string} text - 대사입니다.
     * @private
     */
    #setSpeech(speaker, text) {
        this.speechBubble = {
            speaker,
            text,
            elapsed: 0,
            duration: this.data.ANIMATION.SPEECH_SECONDS
        };
    }

    /**
     * 최근 이벤트를 제한된 길이의 HUD 로그에 추가합니다.
     * @param {string} text - 추가할 이벤트 문구입니다.
     * @private
     */
    #appendEvent(text) {
        if (typeof text !== 'string' || text.length === 0) {
            return;
        }
        this.eventLog.unshift(text);
        this.eventLog.length = Math.min(this.eventLog.length, this.data.RULES.EVENT_LOG_LIMIT);
    }

    /**
     * 입력을 전부 차단하는 결과 단계인지 확인합니다.
     * @returns {boolean} 결과 단계이면 true입니다.
     * @private
     */
    #isResultPhase() {
        return this.model.phase === 'result'
            || this.model.turn === 'result'
            || this.model.phase === 'victory';
    }

    /**
     * 짝수 라운드 강제 대화 단계인지 확인합니다.
     * @returns {boolean} 대화 단계이면 true입니다.
     * @private
     */
    #isDialoguePhase() {
        return this.model.phase === 'dialogue' || this.model.turn === 'dialogue';
    }

    /**
     * 현재 위치에서 게이트 탈출 행동을 사용할 수 있는지 확인합니다.
     * @returns {boolean} 탈출할 수 있으면 true입니다.
     * @private
     */
    #canEscape() {
        return typeof this.model.canEscape === 'function'
            ? this.model.canEscape() === true
            : false;
    }

    /**
     * 이동 또는 공격 연출이 진행 중인지 반환합니다.
     * @returns {boolean} 플레이어 입력을 잠가야 하면 true입니다.
     * @private
     */
    #isPresentationLocked() {
        return Boolean(
            this.movementAnimation
            || this.loraMovementAnimation
            || this.actionAnimation
        );
    }

    /**
     * 타일의 고지 오프셋을 반영한 화면 좌표와 중심을 반환합니다.
     * @param {number} x - 타일 X 좌표입니다.
     * @param {number} y - 타일 Y 좌표입니다.
     * @param {boolean} [includeShake=true] - 화면 흔들림을 적용할지 여부입니다.
     * @returns {{left:number,top:number,centerX:number,centerY:number,height:number}} 표시 좌표입니다.
     * @private
     */
    #getTileVisual(x, y, includeShake = true) {
        const height = this.model.getTileHeight(x, y) ?? 0;
        const shakeX = includeShake ? this.shakeX : 0;
        const shakeY = includeShake ? this.shakeY : 0;
        const left = this.boardX + (x * this.tileSize) + shakeX;
        const top = this.boardY + (y * this.tileSize) - (height * this.elevationLift) + shakeY;
        return {
            left,
            top,
            centerX: left + (this.tileSize * 0.5),
            centerY: top + (this.tileSize * 0.5),
            height
        };
    }

    /**
     * 이동 및 공격 연출을 반영한 플레이어 중심 화면 좌표를 반환합니다.
     * @returns {{x:number,y:number}} 렌더링 중심입니다.
     * @private
     */
    #getPlayerRenderPoint() {
        let point;
        if (this.movementAnimation) {
            const animation = this.movementAnimation;
            const segmentDuration = this.data.ANIMATION.MOVE_SECONDS_PER_TILE;
            const segmentIndex = Math.min(
                animation.path.length - 2,
                Math.floor(animation.elapsed / segmentDuration)
            );
            const segmentProgress = easeOutCubic(
                (animation.elapsed - (segmentIndex * segmentDuration)) / segmentDuration
            );
            const from = this.#getTileVisual(
                animation.path[segmentIndex].x,
                animation.path[segmentIndex].y
            );
            const to = this.#getTileVisual(
                animation.path[segmentIndex + 1].x,
                animation.path[segmentIndex + 1].y
            );
            point = {
                x: lerpNumber(from.centerX, to.centerX, segmentProgress),
                y: lerpNumber(from.centerY, to.centerY, segmentProgress)
            };
        } else {
            const tile = this.#getTileVisual(this.model.player.x, this.model.player.y);
            point = { x: tile.centerX, y: tile.centerY };
        }

        if (this.actionAnimation?.type === ACTION_ATTACK) {
            const target = this.#getTileVisual(
                this.actionAnimation.targetPosition.x,
                this.actionAnimation.targetPosition.y
            );
            const progress = clampNumber(
                this.actionAnimation.elapsed / this.actionAnimation.duration,
                0,
                1
            );
            const lunge = Math.sin(progress * Math.PI) * 0.34;
            point.x = lerpNumber(point.x, target.centerX, lunge);
            point.y = lerpNumber(point.y, target.centerY, lunge);
        }
        return point;
    }

    /**
     * 로라의 자동 이동 연출을 반영한 중심 화면 좌표를 반환합니다.
     * @returns {{x:number,y:number}} 렌더링 중심입니다.
     * @private
     */
    #getLoraRenderPoint() {
        if (!this.loraMovementAnimation) {
            const tile = this.#getTileVisual(this.model.lora.x, this.model.lora.y);
            return { x: tile.centerX, y: tile.centerY };
        }

        const animation = this.loraMovementAnimation;
        const segmentDuration = this.data.ANIMATION.MOVE_SECONDS_PER_TILE;
        const segmentIndex = Math.min(
            animation.path.length - 2,
            Math.floor(animation.elapsed / segmentDuration)
        );
        const segmentProgress = easeOutCubic(
            (animation.elapsed - (segmentIndex * segmentDuration)) / segmentDuration
        );
        const from = this.#getTileVisual(
            animation.path[segmentIndex].x,
            animation.path[segmentIndex].y
        );
        const to = this.#getTileVisual(
            animation.path[segmentIndex + 1].x,
            animation.path[segmentIndex + 1].y
        );
        return {
            x: lerpNumber(from.centerX, to.centerX, segmentProgress),
            y: lerpNumber(from.centerY, to.centerY, segmentProgress)
        };
    }

    /**
     * 전술 화면 전체 배경과 제목 구분선을 그립니다.
     * @private
     */
    #drawBackdrop() {
        const colors = ColorSchemes.Tactics;
        renderGL('background', {
            shape: 'rect',
            x: this.WW * 0.5,
            y: this.WH * 0.5,
            w: this.WW,
            h: this.WH,
            fill: colors.Backdrop
        });
        renderGL('background', {
            shape: 'rect',
            x: this.boardFrame.x + (this.boardFrame.w * 0.5),
            y: this.boardFrame.y + (this.boardFrame.h * 0.5),
            w: this.boardFrame.w,
            h: this.boardFrame.h,
            fill: colors.BoardFrame
        });
    }

    /**
     * 높이 벽면, 타일 상단, 계단과 현재 전술 범위 강조를 그립니다.
     * @private
     */
    #drawBoard() {
        const colors = ColorSchemes.Tactics;
        const tileFaceSize = this.tileSize - (this.tileGap * 2);

        for (let y = 0; y < this.data.MAP.HEIGHT; y++) {
            for (let x = 0; x < this.data.MAP.WIDTH; x++) {
                const tile = this.#getTileVisual(x, y);
                if (tile.height <= 0) {
                    continue;
                }
                const wallHeight = tileFaceSize + (tile.height * this.elevationLift);
                renderGL('background', {
                    shape: 'rect',
                    x: tile.centerX,
                    y: tile.top + (wallHeight * 0.5) + this.tileGap,
                    w: tileFaceSize,
                    h: wallHeight,
                    fill: tile.height > 1 ? colors.Tile.Side2 : colors.Tile.Side1
                });
            }
        }

        for (let y = 0; y < this.data.MAP.HEIGHT; y++) {
            for (let x = 0; x < this.data.MAP.WIDTH; x++) {
                const tile = this.#getTileVisual(x, y);
                const fill = tile.height >= 2
                    ? colors.Tile.High2
                    : (tile.height === 1 ? colors.Tile.High1 : colors.Tile.Low);
                renderGL('background', {
                    shape: 'rect',
                    x: tile.centerX,
                    y: tile.centerY,
                    w: tileFaceSize,
                    h: tileFaceSize,
                    fill
                });
                renderGL('background', {
                    shape: 'rect',
                    x: tile.centerX,
                    y: tile.top + this.tileSize - this.tileGap - (this.tileGap * 0.35),
                    w: tileFaceSize,
                    h: this.tileGap * 0.7,
                    fill: colors.Tile.Edge
                });
            }
        }

        for (const stair of this.data.MAP.STAIRS) {
            const tile = this.#getTileVisual(stair.x, stair.y);
            for (let step = 1; step <= 3; step++) {
                renderGL('background', {
                    shape: 'rect',
                    x: tile.centerX,
                    y: tile.top + (this.tileSize * (step / 4)),
                    w: this.tileSize * 0.64,
                    h: this.tileGap * 0.75,
                    fill: colors.Tile.Stair
                });
            }
        }
        this.#drawTacticalHighlights();
    }

    /**
     * 이동 가능 타일, 현재 호버와 공격·대화 대상 타일을 반투명 색으로 표시합니다.
     * @private
     */
    #drawTacticalHighlights() {
        const colors = ColorSchemes.Tactics;
        const size = this.tileSize - (this.tileGap * 3.2);

        if (this.model.turn === 'player' && this.model.phase === 'move' && !this.#isPresentationLocked()) {
            for (const reachable of this.reachability.values()) {
                const tile = this.#getTileVisual(reachable.x, reachable.y);
                renderGL('background', {
                    shape: 'rect',
                    x: tile.centerX,
                    y: tile.centerY,
                    w: size,
                    h: size,
                    fill: colors.Tile.Reachable
                });
            }
        }

        if (this.model.turn === 'player' && this.model.phase === 'action') {
            for (const target of this.actionTargets) {
                const tile = this.#getTileVisual(target.x, target.y);
                renderGL('background', {
                    shape: 'rect',
                    x: tile.centerX,
                    y: tile.centerY,
                    w: size,
                    h: size,
                    fill: colors.Tile.Attack
                });
            }
        }

        if (this.hoveredTile) {
            const key = toTileKey(this.hoveredTile.x, this.hoveredTile.y);
            const isMoveHover = this.model.phase === 'move' && this.reachability.has(key);
            const isActionHover = this.model.phase === 'action' && this.actionTargets.some((target) => (
                target.x === this.hoveredTile.x && target.y === this.hoveredTile.y
            ));
            if (isMoveHover || isActionHover) {
                const tile = this.#getTileVisual(this.hoveredTile.x, this.hoveredTile.y);
                renderGL('background', {
                    shape: 'rect',
                    x: tile.centerX,
                    y: tile.centerY,
                    w: size * 0.82,
                    h: size * 0.82,
                    fill: colors.Tile.Hover,
                    alpha: 0.36
                });
            }
        }

        if (this.model.turn === 'player' && this.model.phase === 'action') {
            const isCursorTarget = this.actionTargets.some((target) => (
                target.x === this.cursorTile.x && target.y === this.cursorTile.y
            ));
            if (isCursorTarget) {
                const tile = this.#getTileVisual(this.cursorTile.x, this.cursorTile.y);
                render('texteffect', {
                    shape: 'rect',
                    x: tile.centerX - (size * 0.38),
                    y: tile.centerY - (size * 0.38),
                    w: size * 0.76,
                    h: size * 0.76,
                    fill: false,
                    stroke: colors.Tile.Hover,
                    lineWidth: Math.max(2, this.tileSize * 0.045)
                });
            }
        }
    }

    /**
     * 맵 위쪽의 철문을 잠김/개방 상태에 맞춰 그립니다.
     * @private
     */
    #drawDoor() {
        const colors = ColorSchemes.Tactics;
        const door = this.model.door || this.data.OBJECTS.DOOR;
        const tile = this.#getTileVisual(door.x, door.y);
        const doorW = this.tileSize * 0.78;
        const doorH = this.tileSize * 0.76;
        const isOpen = this.model.gateOpen === true;
        if (isOpen) {
            renderGL('object', {
                shape: 'rect',
                x: tile.centerX,
                y: tile.centerY,
                w: doorW * 0.9,
                h: doorH * 0.9,
                fill: colors.UI.Success,
                alpha: 0.22
            });
            for (const direction of [-1, 1]) {
                renderGL('object', {
                    shape: 'rect',
                    x: tile.centerX + (direction * doorW * 0.42),
                    y: tile.centerY,
                    w: doorW * 0.18,
                    h: doorH,
                    fill: colors.Entity.PlayerDark
                });
            }
            return;
        }
        renderGL('object', {
            shape: 'rect',
            x: tile.centerX,
            y: tile.centerY - (this.tileSize * 0.04),
            w: doorW,
            h: doorH,
            fill: colors.Entity.PlayerDark
        });
        renderGL('object', {
            shape: 'rect',
            x: tile.centerX,
            y: tile.centerY,
            w: doorW * 0.78,
            h: doorH * 0.78,
            fill: colors.UI.PanelStrong
        });
        for (let stripe = -1; stripe <= 1; stripe++) {
            renderGL('object', {
                shape: 'rect',
                x: tile.centerX + (stripe * doorW * 0.22),
                y: tile.centerY + (doorH * 0.32),
                w: doorW * 0.12,
                h: doorH * 0.13,
                fill: colors.UI.Warning,
                rotation: 28
            });
        }
    }

    /**
     * 상자, 로라, 플레이어를 화면 깊이 순서대로 그립니다.
     * @private
     */
    #drawEntities() {
        const entities = [];
        for (const box of this.model.boxes) {
            if (!box.destroyed) {
                const tile = this.#getTileVisual(box.x, box.y);
                entities.push({ type: 'box', data: box, sortY: tile.centerY });
            }
        }
        const loraPoint = this.#getLoraRenderPoint();
        entities.push({ type: 'lora', data: loraPoint, sortY: loraPoint.y });
        const playerPoint = this.#getPlayerRenderPoint();
        entities.push({ type: 'player', data: playerPoint, sortY: playerPoint.y });
        entities.sort((left, right) => left.sortY - right.sortY);

        for (const entity of entities) {
            if (entity.type === 'box') this.#drawBox(entity.data, 1);
            else if (entity.type === 'lora') this.#drawLora(entity.data);
            else this.#drawPlayer(entity.data);
        }

        if (this.actionAnimation?.ghostBox) {
            const alpha = 1 - clampNumber(
                this.actionAnimation.elapsed / this.actionAnimation.duration,
                0,
                1
            );
            this.#drawBox({
                id: this.actionAnimation.targetId,
                x: this.actionAnimation.targetPosition.x,
                y: this.actionAnimation.targetPosition.y
            }, alpha);
        }
    }

    /**
     * 전술 유닛의 공통 그림자를 그립니다.
     * @param {number} x - 중심 X 좌표입니다.
     * @param {number} y - 중심 Y 좌표입니다.
     * @param {number} width - 그림자 너비입니다.
     * @param {number} alpha - 그림자 투명도입니다.
     * @private
     */
    #drawEntityShadow(x, y, width, alpha = 1) {
        renderGL('object', {
            shape: 'circle',
            x,
            y: y + (this.tileSize * this.data.LAYOUT.BOARD.SHADOW_OFFSET_RATIO),
            w: width,
            h: width * 0.46,
            fill: ColorSchemes.Tactics.Entity.Shadow,
            alpha
        });
    }

    /**
     * 플레이어 말 모양과 바라보는 방향 화살표를 그립니다.
     * @param {{x:number,y:number}} point - 플레이어 표시 중심입니다.
     * @private
     */
    #drawPlayer(point) {
        const colors = ColorSchemes.Tactics;
        const size = this.tileSize * this.data.LAYOUT.BOARD.ENTITY_SCALE_RATIO;
        this.#drawEntityShadow(point.x, point.y, size * 0.92);
        renderGL('object', {
            shape: 'circle',
            x: point.x,
            y: point.y,
            w: size,
            h: size,
            fill: colors.Entity.PlayerDark
        });
        renderGL('object', {
            shape: 'circle',
            x: point.x,
            y: point.y - (size * 0.04),
            w: size * 0.78,
            h: size * 0.78,
            fill: colors.Entity.Player
        });
        renderGL('object', {
            shape: 'arrow',
            x: point.x,
            y: point.y,
            w: size * 0.25,
            h: size * 0.34,
            fill: colors.Entity.PlayerAccent,
            rotation: this.facing
        });
    }

    /**
     * 로라의 머리, 몸체, 표식과 월드 HP 칸을 그립니다.
     * @private
     */
    #drawLora(point = this.#getLoraRenderPoint()) {
        const colors = ColorSchemes.Tactics;
        const size = this.tileSize * this.data.LAYOUT.BOARD.ENTITY_SCALE_RATIO;
        const attackFlash = this.actionAnimation?.targetId === LORA_ID
            && Math.floor(this.actionAnimation.elapsed * 30) % 2 === 0;
        const bodyColor = this.model.lora.alive
            ? (attackFlash ? colors.Entity.LoraAccent : colors.Entity.Lora)
            : colors.Entity.LoraDark;
        const alpha = this.model.lora.alive ? 1 : 0.62;

        this.#drawEntityShadow(point.x, point.y, size * 0.94, alpha);
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
            y: point.y + (size * 0.03),
            w: size * 0.78,
            h: size * 0.78,
            fill: bodyColor,
            alpha
        });
        renderGL('object', {
            shape: 'circle',
            x: point.x,
            y: point.y - (size * 0.24),
            w: size * 0.52,
            h: size * 0.34,
            fill: colors.Entity.LoraHair,
            alpha
        });
        render('texteffect', {
            shape: 'text',
            x: point.x,
            y: point.y + (size * 0.12),
            text: 'L',
            font: this.fonts.MONO,
            fill: colors.Entity.LoraAccent,
            align: 'center',
            baseline: 'middle',
            alpha
        });

        const hpRatio = clampNumber(this.model.lora.hp / this.model.lora.maxHp, 0, 1);
        const barY = point.y - (size * 0.72);
        renderGL('object', {
            shape: 'rect',
            x: point.x,
            y: barY,
            w: size,
            h: size * 0.11,
            fill: colors.UI.HpEmpty
        });
        if (hpRatio > 0) {
            renderGL('object', {
                shape: 'rect',
                x: point.x - (size * 0.5) + (size * hpRatio * 0.5),
                y: barY,
                w: size * hpRatio,
                h: size * 0.11,
                fill: colors.UI.HpFull
            });
        }
    }

    /**
     * 파괴 가능한 상자를 몸체와 보강 띠로 그립니다.
     * @param {{x:number,y:number}} box - 상자 타일 위치입니다.
     * @param {number} alpha - 파괴 잔상 투명도입니다.
     * @private
     */
    #drawBox(box, alpha) {
        const colors = ColorSchemes.Tactics;
        const tile = this.#getTileVisual(box.x, box.y);
        const size = this.tileSize * 0.58;
        this.#drawEntityShadow(tile.centerX, tile.centerY, size, alpha);
        renderGL('object', {
            shape: 'rect',
            x: tile.centerX,
            y: tile.centerY,
            w: size,
            h: size,
            fill: colors.Entity.Box,
            alpha
        });
        renderGL('object', {
            shape: 'rect',
            x: tile.centerX,
            y: tile.centerY,
            w: size * 0.16,
            h: size,
            fill: colors.Entity.BoxBand,
            alpha
        });
        renderGL('object', {
            shape: 'rect',
            x: tile.centerX,
            y: tile.centerY,
            w: size,
            h: size * 0.14,
            fill: colors.Entity.BoxBand,
            alpha
        });
    }

    /**
     * 호버 또는 키보드 커서 목적지까지의 최단 이동 경로를 선과 순서 점으로 그립니다.
     * @private
     */
    #drawPathPreview() {
        if (this.model.turn !== 'player'
            || this.model.phase !== 'move'
            || this.#isPresentationLocked()) {
            return;
        }
        const previewTile = this.hoveredTile || this.cursorTile;
        const reachability = this.reachability.get(toTileKey(previewTile.x, previewTile.y));
        const selectedDestination = this.plannedPath[this.plannedPath.length - 1];
        const hoverMatchesSelection = this.hoveredTile
            && selectedDestination.x === this.hoveredTile.x
            && selectedDestination.y === this.hoveredTile.y;
        const path = this.plannedDestinationSelected
            && (!this.hoveredTile || hoverMatchesSelection)
            ? this.plannedPath
            : reachability?.path;
        if (!path || path.length < 2) {
            return;
        }

        const colors = ColorSchemes.Tactics;
        for (let index = 1; index < path.length; index++) {
            const previous = this.#getTileVisual(
                path[index - 1].x,
                path[index - 1].y
            );
            const current = this.#getTileVisual(
                path[index].x,
                path[index].y
            );
            render('texteffect', {
                shape: 'line',
                x1: previous.centerX,
                y1: previous.centerY,
                x2: current.centerX,
                y2: current.centerY,
                stroke: colors.Tile.Path,
                lineWidth: Math.max(2, this.tileSize * 0.055),
                lineCap: 'round'
            });
            render('texteffect', {
                shape: 'circle',
                x: current.centerX,
                y: current.centerY,
                radius: this.tileSize * this.data.LAYOUT.BOARD.PATH_MARKER_RATIO,
                fill: colors.UI.PanelStrong,
                stroke: colors.Tile.Path,
                lineWidth: Math.max(1, this.tileSize * 0.035)
            });
            render('texteffect', {
                shape: 'text',
                x: current.centerX,
                y: current.centerY,
                text: `${index}`,
                font: this.fonts.SMALL,
                fill: colors.UI.Text,
                align: 'center',
                baseline: 'middle'
            });
        }
    }

    /**
     * 피격 파티클과 떠오르는 피해 텍스트를 2D 효과 레이어에 그립니다.
     * @private
     */
    #drawWorldEffects() {
        for (const particle of this.particles) {
            const alpha = 1 - (particle.elapsed / particle.duration);
            render('texteffect', {
                shape: 'circle',
                x: particle.x,
                y: particle.y,
                radius: particle.size,
                fill: particle.color,
                alpha
            });
        }
        for (const floatingText of this.floatingTexts) {
            const alpha = 1 - (floatingText.elapsed / floatingText.duration);
            render('texteffect', {
                shape: 'text',
                x: floatingText.x,
                y: floatingText.y,
                text: floatingText.text,
                font: this.fonts.HEADING,
                fill: floatingText.color,
                align: 'center',
                baseline: 'middle',
                alpha
            });
        }
    }

    /**
     * 제목, 임무 상태, 로라 HP, 이벤트 로그와 행동 버튼을 그립니다.
     * @private
     */
    #drawHud() {
        const colors = ColorSchemes.Tactics;
        const header = this.data.LAYOUT.HEADER;
        const headerX = this.UIOffsetX + this.#uww(header.X_UIWW);
        const headerY = this.#uwh(header.Y_WH);
        render('ui', {
            shape: 'text',
            x: headerX,
            y: headerY,
            text: this.data.TEXT.TITLE,
            font: this.fonts.TITLE,
            fill: colors.UI.Text,
            baseline: 'middle'
        });
        render('ui', {
            shape: 'text',
            x: headerX,
            y: headerY + this.#uwh(3.2),
            text: this.data.TEXT.SUBTITLE,
            font: this.fonts.SUBTITLE,
            fill: colors.UI.Muted,
            baseline: 'middle'
        });

        render('ui', {
            shape: 'roundRect',
            x: this.sidebar.x,
            y: this.sidebar.y,
            w: this.sidebar.w,
            h: this.sidebar.h,
            radius: this.sidebar.radius,
            fill: colors.UI.Panel,
            stroke: colors.UI.Border,
            lineWidth: Math.max(1, this.UIWW * 0.0012),
            shadowBlur: this.#uww(0.8),
            shadowColor: colors.Entity.Shadow
        });

        const left = this.sidebar.x + this.sidebar.padding;
        const right = this.sidebar.x + this.sidebar.w - this.sidebar.padding;
        const contentWidth = right - left;
        const turnColor = this.model.turn === 'player' ? colors.UI.Accent : colors.UI.Warning;
        render('ui', {
            shape: 'text',
            x: left,
            y: this.sidebar.y + this.#uwh(4.2),
            text: this.#getTurnLabel(),
            font: this.fonts.HEADING,
            fill: turnColor,
            baseline: 'middle'
        });
        render('ui', {
            shape: 'text',
            x: right,
            y: this.sidebar.y + this.#uwh(4.2),
            text: `ROUND ${this.model.round}/${this.model.maxRounds ?? 8}`,
            font: this.fonts.MONO,
            fill: colors.UI.Muted,
            align: 'right',
            baseline: 'middle'
        });
        this.#drawDivider(this.sidebar.y + this.#uwh(7.2));

        this.#drawHudBar({
            label: '플레이어 HP',
            value: this.model.player.hp,
            max: this.model.player.maxHp,
            y: this.sidebar.y + this.#uwh(9.8),
            color: colors.Entity.Player
        });
        this.#drawHudBar({
            label: `로라 HP${this.model.lora.defending ? ' · 방어 중' : ''}`,
            value: this.model.lora.hp,
            max: this.model.lora.maxHp,
            y: this.sidebar.y + this.#uwh(15.1),
            color: colors.UI.HpFull
        });
        const instabilityState = typeof this.model.getInstabilityState === 'function'
            ? this.model.getInstabilityState()
            : null;
        const instabilityLabel = typeof instabilityState === 'string'
            ? instabilityState
            : (instabilityState?.label || instabilityState?.name || '불안정');
        this.#drawHudBar({
            label: `불안정도 · ${instabilityLabel}`,
            value: this.model.lora.instability,
            max: this.model.lora.maxInstability ?? 100,
            y: this.sidebar.y + this.#uwh(20.4),
            color: (this.model.lora.instability ?? 0) > 60 ? colors.UI.Danger : colors.UI.Warning
        });

        render('ui', {
            shape: 'text',
            x: left,
            y: this.sidebar.y + this.#uwh(27),
            text: `게이트 · ${this.model.gateOpen ? '개방' : '잠김'}${this.model.player.defending ? '  /  플레이어 방어 중' : ''}`,
            font: this.fonts.BODY,
            fill: this.model.gateOpen ? colors.UI.Success : colors.UI.Muted,
            baseline: 'middle'
        });
        this.#drawDivider(this.sidebar.y + this.#uwh(30));

        render('ui', {
            shape: 'text',
            x: left,
            y: this.sidebar.y + this.#uwh(33),
            text: this.#getPhaseLabel(),
            font: this.fonts.HEADING,
            fill: colors.UI.Text,
            baseline: 'middle'
        });
        this.#drawWrappedText({
            text: this.#getTacticalStatusText(),
            x: left,
            y: this.sidebar.y + this.#uwh(36),
            maxWidth: contentWidth,
            font: this.fonts.SMALL,
            color: colors.UI.Accent,
            maxLines: 2
        });

        render('ui', {
            shape: 'text',
            x: left,
            y: this.sidebar.y + this.#uwh(43),
            text: '전술 로그',
            font: this.fonts.BODY,
            fill: colors.UI.Text,
            baseline: 'middle'
        });
        let logY = this.sidebar.y + this.#uwh(46);
        for (let index = 0; index < this.eventLog.length; index++) {
            const lines = this.#drawWrappedText({
                text: `${index === 0 ? '›' : '·'} ${this.eventLog[index]}`,
                x: left,
                y: logY,
                maxWidth: contentWidth,
                font: this.fonts.SMALL,
                color: index === 0 ? colors.UI.Text : colors.UI.Muted,
                maxLines: 2
            });
            logY += lines * this.#getFontSize(this.data.TYPOGRAPHY.SMALL) * 1.24;
            if (logY > this.#uwh(this.data.LAYOUT.ACTIONS.TOP_WH - 1.5)) {
                break;
            }
        }

        if (!this.#isResultPhase() && !this.#isDialoguePhase()) {
            for (const key of ['attack', 'defend', 'endTurn', 'undo', 'escape']) {
                this.buttons[key]?.item.draw();
            }
        }
        render('ui', {
            shape: 'text',
            x: right,
            y: this.sidebar.y + this.sidebar.h - this.#uwh(1.5),
            text: this.data.TEXT.CONTROLS,
            font: this.fonts.SMALL,
            fill: colors.UI.Muted,
            align: 'right',
            baseline: 'bottom'
        });
    }

    /**
     * 현재 턴 소유자에 맞는 짧은 HUD 문구를 반환합니다.
     * @returns {string} 턴 라벨입니다.
     * @private
     */
    #getTurnLabel() {
        if (this.#isResultPhase()) return '전투 결과';
        if (this.#isDialoguePhase()) return '강제 대화';
        if (this.model.turn === 'lora') return '로라의 턴';
        return '플레이어 턴';
    }

    /**
     * 현재 전술 단계 제목을 반환합니다.
     * @returns {string} 단계 라벨입니다.
     * @private
     */
    #getPhaseLabel() {
        if (this.#isResultPhase()) return '전투 종료';
        if (this.#isDialoguePhase()) return '대화 선택';
        if (this.model.phase === 'lora') return '로라가 생각 중...';
        if (this.model.phase === 'action') {
            return '행동 선택';
        }
        return '이동 경로 선택';
    }

    /**
     * 현재 호버 경로 비용이나 행동 안내를 반환합니다.
     * @returns {string} 전술 상태 문구입니다.
     * @private
     */
    #getTacticalStatusText() {
        if (this.#isResultPhase()) {
            return 'R 또는 아래 버튼으로 다시 시작할 수 있습니다.';
        }
        if (this.#isDialoguePhase()) {
            return '회피·공격·이해·거짓말 중 지금의 답을 선택하세요.';
        }
        if (this.model.phase === 'lora') {
            return '로라가 이동하고 상황에 따라 공격하거나 방어합니다.';
        }
        if (this.model.phase === 'action') {
            const targetCount = this.actionTargets.length;
            if (this.#canEscape()) {
                return '게이트 위에 도착했습니다. 게이트 탈출을 선택하세요.';
            }
            return `이동력 ${this.lastMoveCost}/${this.data.MAP.MOVE_RANGE} 사용 · 공격 대상 ${targetCount}개`;
        }

        const preview = this.hoveredTile || this.cursorTile;
        if (this.plannedDestinationSelected) {
            return `선택 경로 ${this.plannedPathCost}/${this.data.MAP.MOVE_RANGE} · 재클릭 또는 Enter로 확정`;
        }
        const reachable = this.reachability.get(toTileKey(preview.x, preview.y));
        if (reachable) {
            return `예상 경로 ${reachable.cost}/${this.data.MAP.MOVE_RANGE} · 첫 클릭으로 선택`;
        }
        return `이동력 ${this.data.MAP.MOVE_RANGE} · 청록색 타일 안에서 선택`;
    }

    /**
     * HUD에 라벨, 숫자와 연속형 상태 바를 그립니다.
     * @param {{label:string,value:number,max:number,y:number,color:string}} options - 바 표시값입니다.
     * @private
     */
    #drawHudBar(options) {
        const colors = ColorSchemes.Tactics;
        const left = this.sidebar.x + this.sidebar.padding;
        const right = this.sidebar.x + this.sidebar.w - this.sidebar.padding;
        const width = right - left;
        const max = Math.max(1, Number(options.max) || 1);
        const value = clampNumber(options.value, 0, max);
        const ratio = value / max;
        render('ui', {
            shape: 'text',
            x: left,
            y: options.y,
            text: options.label,
            font: this.fonts.SMALL,
            fill: colors.UI.Text,
            baseline: 'middle'
        });
        render('ui', {
            shape: 'text',
            x: right,
            y: options.y,
            text: `${Math.round(value)}/${Math.round(max)}`,
            font: this.fonts.MONO,
            fill: colors.UI.Muted,
            align: 'right',
            baseline: 'middle'
        });
        const barY = options.y + this.#uwh(1.7);
        render('ui', {
            shape: 'roundRect',
            x: left,
            y: barY,
            w: width,
            h: this.#uwh(1.15),
            radius: this.#uwh(0.35),
            fill: colors.UI.HpEmpty
        });
        if (ratio > 0) {
            render('ui', {
                shape: 'roundRect',
                x: left,
                y: barY,
                w: width * ratio,
                h: this.#uwh(1.15),
                radius: this.#uwh(0.35),
                fill: options.color
            });
        }
    }

    /**
     * 사이드바 내부 구분선을 그립니다.
     * @param {number} y - 선의 Y 좌표입니다.
     * @private
     */
    #drawDivider(y) {
        render('ui', {
            shape: 'line',
            x1: this.sidebar.x + this.sidebar.padding,
            y1: y,
            x2: this.sidebar.x + this.sidebar.w - this.sidebar.padding,
            y2: y,
            stroke: ColorSchemes.Tactics.UI.Border,
            lineWidth: 1
        });
    }

    /**
     * 한국어 텍스트를 지정 폭과 줄 수에 맞춰 그립니다.
     * @param {{text:string,x:number,y:number,maxWidth:number,font:string,color:string,maxLines:number}} options - 텍스트 배치입니다.
     * @returns {number} 실제로 그린 줄 수입니다.
     * @private
     */
    #drawWrappedText(options) {
        const fontSizeMatch = /([0-9.]+)px/.exec(options.font);
        const fontSize = Number(fontSizeMatch?.[1]) || 12;
        const lines = wrapTextByCharacters(options.text, {
            maxWidth: options.maxWidth,
            maxLines: options.maxLines,
            measureWidth: (line) => measureText(line, options.font)
        });
        lines.forEach((line, index) => {
            render('ui', {
                shape: 'text',
                x: options.x,
                y: options.y + (fontSize * 1.28 * index),
                text: line,
                font: options.font,
                fill: options.color,
                baseline: 'top'
            });
        });
        return lines.length;
    }

    /**
     * 현재 UI 폭에서 폰트 규격의 실제 픽셀 크기를 반환합니다.
     * @param {object} spec - 반응형 폰트 규격입니다.
     * @returns {number} 실제 크기입니다.
     * @private
     */
    #getFontSize(spec) {
        return clampNumber(this.UIWW * (spec.SIZE_UIWW / 100), spec.MIN, spec.MAX);
    }

    /**
     * 현재 화자 위에 대사 말풍선을 그립니다.
     * @private
     */
    #drawSpeechBubble() {
        if (!this.speechBubble) {
            return;
        }
        const colors = ColorSchemes.Tactics;
        const speech = this.data.LAYOUT.SPEECH;
        const actorPoint = this.speechBubble.speaker === LORA_ID
            ? this.#getLoraRenderPoint()
            : this.#getPlayerRenderPoint();
        const actor = { centerX: actorPoint.x, centerY: actorPoint.y };
        const actorX = actor.centerX;
        const actorY = actor.centerY;
        const width = this.#uww(speech.WIDTH_UIWW);
        const height = this.#uwh(speech.HEIGHT_WH);
        const minX = this.UIOffsetX + this.#uww(1);
        const maxX = this.UIOffsetX + this.UIWW - width - this.#uww(1);
        const x = clampNumber(actorX - (width * 0.5), minX, maxX);
        const preferredY = actorY - (this.tileSize * speech.OFFSET_Y_TILES) - height;
        const y = Math.max(this.#uwh(1.4), preferredY);
        const alpha = Math.min(1, (this.speechBubble.duration - this.speechBubble.elapsed) * 3);

        render('ui', {
            shape: 'roundRect',
            x,
            y,
            w: width,
            h: height,
            radius: this.#uwh(speech.RADIUS_WH),
            fill: colors.UI.PanelStrong,
            stroke: this.speechBubble.speaker === LORA_ID ? colors.Entity.Lora : colors.Entity.Player,
            lineWidth: Math.max(1, this.UIWW * 0.0015),
            alpha,
            shadowBlur: this.#uww(0.65),
            shadowColor: colors.Entity.Shadow
        });
        render('ui', {
            shape: 'text',
            x: x + this.#uww(1.1),
            y: y + this.#uwh(1.6),
            text: this.speechBubble.speaker === LORA_ID ? '로라' : '플레이어',
            font: this.fonts.SMALL,
            fill: this.speechBubble.speaker === LORA_ID ? colors.Entity.Lora : colors.Entity.Player,
            baseline: 'top',
            alpha
        });
        this.#drawWrappedText({
            text: this.speechBubble.text,
            x: x + this.#uww(1.1),
            y: y + this.#uwh(4),
            maxWidth: width - this.#uww(2.2),
            font: this.fonts.BODY,
            color: colors.UI.Text,
            maxLines: 2
        });
    }

    /**
     * 짝수 라운드에 전투 입력을 차단하는 4지선다 대화 패널을 그립니다.
     * @private
     */
    #drawDialogueOverlay() {
        if (!this.#isDialoguePhase()) {
            return;
        }
        const colors = ColorSchemes.Tactics;
        const modal = this.data.LAYOUT.MODAL;
        const width = Math.max(this.#uww(modal.WIDTH_UIWW), this.#uww(42));
        const height = Math.max(this.#uwh(modal.HEIGHT_WH), this.#uwh(48));
        const x = this.UIOffsetX + ((this.UIWW - width) * 0.5);
        const y = (this.WH - height) * 0.5;
        render('ui', {
            shape: 'rect',
            x: 0,
            y: 0,
            w: this.WW,
            h: this.WH,
            fill: colors.UI.OverlayDim
        });
        render('ui', {
            shape: 'roundRect',
            x,
            y,
            w: width,
            h: height,
            radius: this.#uwh(modal.RADIUS_WH),
            fill: colors.UI.Panel,
            stroke: colors.Entity.Lora,
            lineWidth: Math.max(2, this.UIWW * 0.0018),
            shadowBlur: this.#uww(1.2),
            shadowColor: colors.Entity.Shadow
        });
        render('ui', {
            shape: 'text',
            x: x + (width * 0.5),
            y: y + (height * 0.13),
            text: `ROUND ${this.model.round} · 대화`,
            font: this.fonts.TITLE,
            fill: colors.Entity.LoraAccent,
            align: 'center',
            baseline: 'middle'
        });
        render('ui', {
            shape: 'text',
            x: x + (width * 0.5),
            y: y + (height * 0.27),
            text: '로라에게 어떻게 답할까?',
            font: this.fonts.HEADING,
            fill: colors.UI.Text,
            align: 'center',
            baseline: 'middle'
        });
        for (const choice of DIALOGUE_CHOICES) {
            this.buttons[`dialogue-${choice.id}`]?.item.draw();
        }
    }

    /**
     * 탈출 성공, 플레이어 전투 불능, 8라운드 초과 결과를 공통 패널에 표시합니다.
     * @private
     */
    #drawResultOverlay() {
        if (!this.#isResultPhase()) {
            return;
        }
        const colors = ColorSchemes.Tactics;
        const modal = this.data.LAYOUT.MODAL;
        const width = this.#uww(modal.WIDTH_UIWW);
        const height = this.#uwh(modal.HEIGHT_WH);
        const x = this.UIOffsetX + ((this.UIWW - width) * 0.5);
        const y = (this.WH - height) * 0.5;
        const presentation = this.#getResultPresentation();
        const result = this.model.result || {};
        const resultRound = result.round ?? this.model.round;
        const resultInstability = result.instability ?? this.model.lora.instability ?? 0;

        render('ui', {
            shape: 'rect',
            x: 0,
            y: 0,
            w: this.WW,
            h: this.WH,
            fill: colors.UI.OverlayDim
        });
        render('ui', {
            shape: 'roundRect',
            x,
            y,
            w: width,
            h: height,
            radius: this.#uwh(modal.RADIUS_WH),
            fill: colors.UI.Panel,
            stroke: presentation.success ? colors.UI.Success : colors.UI.Danger,
            lineWidth: Math.max(2, this.UIWW * 0.0018),
            shadowBlur: this.#uww(1.2),
            shadowColor: colors.Entity.Shadow
        });
        render('ui', {
            shape: 'text',
            x: x + (width * 0.5),
            y: y + (height * 0.2),
            text: presentation.title,
            font: this.fonts.TITLE,
            fill: presentation.success ? colors.UI.Success : colors.UI.Danger,
            align: 'center',
            baseline: 'middle'
        });
        render('ui', {
            shape: 'text',
            x: x + (width * 0.5),
            y: y + (height * 0.4),
            text: presentation.message,
            font: this.fonts.HEADING,
            fill: colors.UI.Text,
            align: 'center',
            baseline: 'middle'
        });
        render('ui', {
            shape: 'text',
            x: x + (width * 0.5),
            y: y + (height * 0.56),
            text: `라운드 ${resultRound}/${this.model.maxRounds ?? 8}  ·  최종 불안정도 ${Math.round(resultInstability)}`,
            font: this.fonts.MONO,
            fill: colors.UI.Muted,
            align: 'center',
            baseline: 'middle'
        });
        this.buttons.resultRestart?.item.draw();
    }

    /**
     * 모델 결과 사유를 결과 패널 제목과 설명으로 변환합니다.
     * @returns {{success:boolean,title:string,message:string}} 결과 표시값입니다.
     * @private
     */
    #getResultPresentation() {
        const result = this.model.result;
        const type = typeof result === 'string'
            ? result
            : (result?.outcome || result?.type || result?.reason || '');
        const reason = typeof result === 'object' ? result?.reason : type;
        const success = result?.success === true
            || result?.outcome === 'success'
            || reason === 'escaped'
            || ['success', 'escaped', 'escape'].includes(type);
        if (success) {
            return {
                success: true,
                title: 'MISSION CLEAR',
                message: '로라를 무력화하고 게이트로 탈출했습니다.'
            };
        }
        if ((result?.playerHp ?? this.model.player.hp) <= 0
            || reason === 'player-defeated'
            || ['player-defeated', 'defeat', 'hp-zero'].includes(type)) {
            return {
                success: false,
                title: 'MISSION FAILED',
                message: '플레이어가 더 이상 싸울 수 없습니다.'
            };
        }
        return {
            success: false,
            title: 'TIME OVER',
            message: '8라운드 안에 게이트를 통과하지 못했습니다.'
        };
    }
}
