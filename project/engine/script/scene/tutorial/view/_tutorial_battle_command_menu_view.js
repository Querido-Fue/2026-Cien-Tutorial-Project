import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import {
    clampBattleViewNumber,
    drawBattleViewText,
    truncateBattleViewText
} from './_tutorial_battle_view_helpers.js';
import {
    drawTutorialPixelAsset,
    fitTutorialAssetRect
} from './_tutorial_asset_view_helpers.js';
import {
    resolveTutorialCommandHoverScale,
    scaleTutorialCommandFont,
    scaleTutorialCommandRect
} from './_tutorial_command_hover_presentation.js';

const MOVE_PHASE = 'move';
const ACTION_PHASE = 'action';

/** @param {number} value @returns {number} 0~1 범위 진행도입니다. */
function clampProgress(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

/** @param {number} progress @returns {number} 지수 감속 보간값입니다. */
function easeOutExpo(progress) {
    const value = clampProgress(progress);
    return value >= 1 ? 1 : 1 - Math.pow(2, -10 * value);
}

/** @param {number} progress @returns {number} 지수 가속 보간값입니다. */
function easeInExpo(progress) {
    const value = clampProgress(progress);
    return value <= 0 ? 0 : Math.pow(2, (10 * value) - 10);
}

/** @param {number} from @param {number} to @param {number} progress @returns {number} 선형 보간값입니다. */
function lerp(from, to, progress) {
    return Number(from) + ((Number(to) - Number(from)) * clampProgress(progress));
}

/**
 * @class TutorialBattleCommandMenuView
 * @description 이동 확정과 전투 행동 사이의 커맨드 배치·플립 연출·히트 영역을 소유합니다.
 */
export class TutorialBattleCommandMenuView {
    #renderPort;
    #assetPort;
    #frame;
    #phase;
    #transition;

    /**
     * @param {object} renderPort - HUD 렌더 포트입니다.
     * @param {object} assetPort - UI 에셋 읽기 포트입니다.
     */
    constructor(renderPort, assetPort = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
        this.#frame = null;
        this.#phase = null;
        this.#transition = null;
    }

    /**
     * 현재 단계와 전환 진행도에 맞춰 커맨드 프레임을 그립니다.
     * @param {object} viewModel - 현재 BattleViewModel입니다.
     */
    draw(viewModel) {
        if (!viewModel?.snapshot || !viewModel?.layout) {
            return;
        }
        this.#frame = viewModel;
        try {
            this.#syncPhase();
            const geometry = this.#resolveGeometry();
            const presentation = this.#resolvePresentation();
            if (!presentation.transitioning) {
                this.#drawPhaseFace(presentation.phase, geometry, 1);
                if (presentation.phase === ACTION_PHASE) {
                    this.#drawSideButtons(geometry, 1);
                }
                return;
            }
            if (presentation.fromPhase === MOVE_PHASE) {
                this.#drawFlip(
                    MOVE_PHASE,
                    ACTION_PHASE,
                    geometry,
                    presentation.flipProgress
                );
                this.#drawSideButtons(geometry, presentation.sideProgress);
                return;
            }
            this.#drawSideButtons(geometry, presentation.sideProgress);
            this.#drawFlip(
                ACTION_PHASE,
                MOVE_PHASE,
                geometry,
                presentation.flipProgress
            );
        } finally {
            this.#frame = null;
        }
    }

    /**
     * 현재 논리 단계에 노출되는 커맨드의 직렬화 가능한 버튼 사양을 만듭니다.
     * @param {object} viewModel - 현재 BattleViewModel입니다.
     * @returns {object[]} 커맨드 버튼 사양입니다.
     */
    getButtonSpecs(viewModel) {
        if (!viewModel?.snapshot || !viewModel?.layout) {
            return [];
        }
        this.#frame = viewModel;
        try {
            this.#syncPhase();
            const geometry = this.#resolveGeometry();
            const hoverScale = Math.max(
                1,
                Number(this.#config().HOVER_SCALE) || 1
            );
            return this.#resolveActions(viewModel.snapshot.phase).map((action) => ({
                key: action.key,
                ...geometry[action.slot],
                label: '',
                tooltip: action.tooltip,
                drawBackground: false,
                drawSolidBackground: false,
                enabled: action.enabled,
                active: action.active,
                focused: action.focused,
                hoverScale,
                inspectable: true,
                command: { type: action.type, payload: action.payload }
            }));
        } finally {
            this.#frame = null;
        }
    }

    /** 현재 논리 단계를 감지해 정순 또는 역순 전환을 시작합니다. @private */
    #syncPhase() {
        const nextPhase = this.#frame.snapshot.phase === ACTION_PHASE
            ? ACTION_PHASE
            : MOVE_PHASE;
        if (this.#phase === null) {
            this.#phase = nextPhase;
            return;
        }
        if (this.#phase === nextPhase) {
            return;
        }
        this.#transition = {
            fromPhase: this.#phase,
            toPhase: nextPhase,
            startedAt: this.#elapsedSeconds()
        };
        this.#phase = nextPhase;
    }

    /**
     * 원시 경과 시간과 정·역순 이징을 플립 및 보조 버튼 진행도로 변환합니다.
     * @returns {object} 현재 커맨드 표현 상태입니다.
     * @private
     */
    #resolvePresentation() {
        const transition = this.#transition;
        if (!transition) {
            return { transitioning: false, phase: this.#phase };
        }
        const config = this.#config();
        const flipSeconds = Math.max(0.01, Number(config.FLIP_SECONDS) || 0.5);
        const sideSeconds = Math.max(0.01, Number(config.SIDE_TRAVEL_SECONDS) || 0.26);
        const sideStartRatio = clampBattleViewNumber(
            config.SIDE_START_AT_FLIP_RATIO,
            0,
            1
        );
        const elapsed = Math.max(0, this.#elapsedSeconds() - transition.startedAt);
        const forward = transition.fromPhase === MOVE_PHASE;
        let flipProgress;
        let sideProgress;
        let complete;
        if (forward) {
            const flipRaw = clampProgress(elapsed / flipSeconds);
            const sideDelay = flipSeconds * sideStartRatio;
            const sideRaw = clampProgress((elapsed - sideDelay) / sideSeconds);
            flipProgress = easeOutExpo(flipRaw);
            sideProgress = easeOutExpo(sideRaw);
            complete = elapsed >= sideDelay + sideSeconds && flipRaw >= 1;
        } else {
            const sideRaw = clampProgress(elapsed / sideSeconds);
            const flipRaw = clampProgress((elapsed - sideSeconds) / flipSeconds);
            sideProgress = 1 - easeInExpo(sideRaw);
            flipProgress = easeOutExpo(flipRaw);
            complete = elapsed >= sideSeconds + flipSeconds;
        }
        if (complete) {
            this.#transition = null;
            return { transitioning: false, phase: transition.toPhase };
        }
        return {
            transitioning: true,
            fromPhase: transition.fromPhase,
            toPhase: transition.toPhase,
            flipProgress,
            sideProgress
        };
    }

    /**
     * X축 3D 회전을 세로 원근 압축으로 투영해 앞·뒷면을 교체합니다.
     * @param {string} outgoingPhase - 사라지는 면입니다.
     * @param {string} incomingPhase - 나타나는 면입니다.
     * @param {object} geometry - 커맨드 배치입니다.
     * @param {number} progress - 0~1 플립 진행도입니다.
     * @private
     */
    #drawFlip(outgoingPhase, incomingPhase, geometry, progress) {
        const value = clampProgress(progress);
        if (value < 0.5) {
            this.#drawPhaseFace(
                outgoingPhase,
                geometry,
                Math.max(0, Math.cos(Math.PI * value))
            );
            return;
        }
        this.#drawPhaseFace(
            incomingPhase,
            geometry,
            Math.max(0, -Math.cos(Math.PI * value))
        );
    }

    /**
     * 이동 확정 면 또는 공격 면을 지정 원근 배율로 그립니다.
     * @param {string} phase - 그릴 논리 단계입니다.
     * @param {object} geometry - 커맨드 배치입니다.
     * @param {number} verticalScale - X축 회전에 따른 세로 배율입니다.
     * @private
     */
    #drawPhaseFace(phase, geometry, verticalScale) {
        if (verticalScale <= 0.015) {
            return;
        }
        const actions = Object.fromEntries(
            this.#resolveActions(phase).map((action) => [action.slot, action])
        );
        if (phase === MOVE_PHASE) {
            this.#drawPrimaryButton(
                geometry.primary,
                actions.primary,
                verticalScale,
                'move'
            );
            this.#drawResetButton(geometry.reset, actions.reset, verticalScale);
            return;
        }
        this.#drawPrimaryButton(
            geometry.primary,
            actions.primary,
            verticalScale,
            'attack'
        );
    }

    /**
     * 이동 확정 또는 공격용 큰 프레임과 내부 콘텐츠를 그립니다.
     * @param {object} rect - 큰 프레임 영역입니다.
     * @param {object} action - 현재 버튼 상태입니다.
     * @param {number} verticalScale - 플립 세로 배율입니다.
     * @param {'move'|'attack'} kind - 버튼 콘텐츠 종류입니다.
     * @private
     */
    #drawPrimaryButton(rect, action, verticalScale, kind) {
        if (!action) {
            return;
        }
        const { colors, fonts } = this.#frame;
        const config = this.#config();
        const alpha = this.#resolveActionAlpha(action);
        const hoverScale = resolveTutorialCommandHoverScale(
            this.#frame.hud,
            action.key
        );
        const visualRect = scaleTutorialCommandRect(
            rect,
            hoverScale
        );
        const transformed = this.#scaleRectY(visualRect, verticalScale);
        drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: this.#assetPort.getUiAsset?.('actionButton'),
            rect: transformed,
            mode: 'exact',
            alpha
        });
        const contentAlpha = alpha * clampProgress(verticalScale * 2.4);
        if (verticalScale < 0.18) {
            return;
        }
        const labelY = visualRect.y + (
            visualRect.h * (Number(config.PRIMARY_LABEL_Y_RATIO) || 0.52)
        );
        if (kind === 'move') {
            const label = truncateBattleViewText(
                this.#renderPort,
                action.label,
                scaleTutorialCommandFont(fonts.SMALL, hoverScale),
                visualRect.w * 0.72
            );
            drawBattleViewText(this.#renderPort, {
                layer: 'ui',
                text: label,
                x: visualRect.x + (visualRect.w * 0.5),
                y: labelY,
                font: scaleTutorialCommandFont(fonts.SMALL, hoverScale),
                fill: colors.UI.OnPrimary || colors.UI.Text,
                align: 'center',
                alpha: contentAlpha
            });
            return;
        }
        const iconSize = Math.max(
            1,
            Math.round(visualRect.h * (Number(config.PRIMARY_ICON_SIZE_RATIO) || 0.28))
        );
        const iconCenterX = visualRect.x + (visualRect.w * 0.36);
        this.#drawIcon(
            'attackIcon',
            {
                x: iconCenterX - (iconSize * 0.5),
                y: visualRect.y + ((visualRect.h - iconSize) * 0.5),
                w: iconSize,
                h: iconSize
            },
            contentAlpha,
            verticalScale
        );
        drawBattleViewText(this.#renderPort, {
            layer: 'ui',
            text: action.label,
            x: visualRect.x + (visualRect.w * 0.59),
            y: labelY,
            font: scaleTutorialCommandFont(
                fonts.BUTTON || fonts.SMALL,
                hoverScale
            ),
            fill: colors.UI.OnPrimary || colors.UI.Text,
            align: 'center',
            alpha: contentAlpha
        });
    }

    /**
     * 이동 확정 버튼 위에 초기화 프레임과 원형 화살표를 그립니다.
     * @param {object} rect - 초기화 프레임 영역입니다.
     * @param {object} action - 버튼 상태입니다.
     * @param {number} verticalScale - 플립 세로 배율입니다.
     * @private
     */
    #drawResetButton(rect, action, verticalScale) {
        if (!action || verticalScale <= 0.015) {
            return;
        }
        const config = this.#config();
        const alpha = this.#resolveActionAlpha(action);
        const visualRect = scaleTutorialCommandRect(
            rect,
            resolveTutorialCommandHoverScale(this.#frame.hud, action.key)
        );
        drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: this.#assetPort.getUiAsset?.('waitHealButton'),
            rect: this.#scaleRectY(visualRect, verticalScale),
            mode: 'exact',
            alpha
        });
        const iconSize = Math.max(
            1,
            Math.round(visualRect.w * (Number(config.RESET_ICON_SIZE_RATIO) || 0.46))
        );
        this.#drawIcon('resetIcon', {
            x: visualRect.x + ((visualRect.w - iconSize) * 0.5),
            y: visualRect.y + ((visualRect.h - iconSize) * 0.5),
            w: iconSize,
            h: iconSize
        }, alpha * clampProgress(verticalScale * 2.4), verticalScale);
    }

    /**
     * 회복·대기 버튼을 공격 중심에서 양옆 최종 위치로 이동시키며 그립니다.
     * @param {object} geometry - 커맨드 배치입니다.
     * @param {number} progress - 위치와 투명도의 0~1 진행도입니다.
     * @private
     */
    #drawSideButtons(geometry, progress) {
        const value = clampProgress(progress);
        if (value <= 0.001) {
            return;
        }
        const actions = Object.fromEntries(
            this.#resolveActions(ACTION_PHASE).map((action) => [action.slot, action])
        );
        const config = this.#config();
        const iconRatio = Number(config.SIDE_ICON_SIZE_RATIO) || 0.42;
        const origin = {
            x: geometry.primary.x + (geometry.primary.w * 0.5),
            y: geometry.primary.y + (geometry.primary.h * 0.5)
        };
        for (const slot of ['heal', 'idle']) {
            const action = actions[slot];
            const target = geometry[slot];
            const baseRect = {
                x: Math.round(lerp(
                    origin.x - (target.w * 0.5),
                    target.x,
                    value
                )),
                y: Math.round(lerp(
                    origin.y - (target.h * 0.5),
                    target.y,
                    value
                )),
                w: target.w,
                h: target.h
            };
            const rect = scaleTutorialCommandRect(
                baseRect,
                resolveTutorialCommandHoverScale(this.#frame.hud, action.key)
            );
            const alpha = this.#resolveActionAlpha(action) * value;
            drawTutorialPixelAsset(this.#renderPort, {
                layer: 'ui',
                image: this.#assetPort.getUiAsset?.('waitHealButton'),
                rect,
                mode: 'exact',
                alpha
            });
            const iconSize = Math.max(1, Math.round(rect.w * iconRatio));
            this.#drawIcon(
                slot === 'heal' ? 'healIcon' : 'waitIcon',
                {
                    x: rect.x + ((rect.w - iconSize) * 0.5),
                    y: rect.y + ((rect.h - iconSize) * 0.5),
                    w: iconSize,
                    h: iconSize
                },
                alpha,
                1
            );
        }
    }

    /**
     * 투명 픽셀 아이콘을 지정 영역에 nearest-neighbor로 그립니다.
     * @param {string} assetKey - UI 에셋 의미 키입니다.
     * @param {object} rect - 아이콘 대상 영역입니다.
     * @param {number} alpha - 투명도입니다.
     * @param {number} verticalScale - 플립 세로 배율입니다.
     * @private
     */
    #drawIcon(assetKey, rect, alpha, verticalScale) {
        drawTutorialPixelAsset(this.#renderPort, {
            layer: 'ui',
            image: this.#assetPort.getUiAsset?.(assetKey),
            rect: this.#scaleRectY(rect, verticalScale),
            alpha
        });
    }

    /**
     * 현재 논리 단계를 표시 버튼과 명령으로 변환합니다.
     * @param {string} phase - 이동 또는 행동 단계입니다.
     * @returns {object[]} 커맨드 목록입니다.
     * @private
     */
    #resolveActions(phase) {
        const { hud } = this.#frame;
        const controls = hud.controls;
        const focusedKey = hud.focusedControlKey;
        if (phase === MOVE_PHASE) {
            const steps = Math.max(0, Math.floor(Number(hud.movePreview?.stepsUsed) || 0));
            return [
                {
                    key: 'battle-reset-path',
                    slot: 'reset',
                    label: '',
                    tooltip: '이동 초기화',
                    enabled: controls.ready && steps > 0,
                    type: TUTORIAL_COMMANDS.PLAN_RESET,
                    focused: focusedKey === 'battle-reset-path'
                },
                {
                    key: 'battle-end',
                    slot: 'primary',
                    label: `${steps}칸 이동 확정`,
                    tooltip: `${steps}칸 이동 확정`,
                    enabled: controls.ready && hud.movePreview?.ok === true,
                    type: TUTORIAL_COMMANDS.COMMIT_PATH,
                    focused: focusedKey === 'battle-end'
                }
            ];
        }
        const weapon = controls.preferredAttackWeapon
            || (controls.hasBow ? 'bow' : 'melee');
        const targetCount = weapon === 'bow'
            ? Number(controls.bowTargetCount) || 0
            : Number(controls.meleeTargetCount) || 0;
        return [
            {
                key: weapon === 'bow' ? 'battle-ranged' : 'battle-melee',
                slot: 'primary',
                label: '공격',
                tooltip: hud.attackSelected ? '공격 취소' : '공격',
                enabled: controls.actionReady && targetCount > 0,
                active: hud.attackSelected,
                type: TUTORIAL_COMMANDS.SELECT_ATTACK,
                payload: { weapon },
                focused: focusedKey === (
                    weapon === 'bow' ? 'battle-ranged' : 'battle-melee'
                )
            },
            {
                key: 'battle-heal',
                slot: 'heal',
                label: '회복',
                tooltip: '회복',
                enabled: controls.actionReady,
                type: TUTORIAL_COMMANDS.HEAL,
                focused: focusedKey === 'battle-heal'
            },
            {
                key: 'battle-idle',
                slot: 'idle',
                label: '대기',
                tooltip: '대기',
                enabled: controls.actionReady,
                type: TUTORIAL_COMMANDS.IDLE,
                focused: focusedKey === 'battle-idle'
            }
        ];
    }

    /**
     * 30% 확대된 중앙 프레임과 60% 보조 프레임을 안전 영역 안에 배치합니다.
     * @returns {object} primary/reset/heal/idle 사각형입니다.
     * @private
     */
    #resolveGeometry() {
        const { layout } = this.#frame;
        const config = this.#config();
        const primaryRect = layout.hudRects.PRIMARY_ACTION;
        const primaryHeight = Math.min(
            primaryRect.h,
            clampBattleViewNumber(
                this.#uwh(config.PRIMARY_HEIGHT_WH),
                config.PRIMARY_MIN_HEIGHT_PX,
                config.PRIMARY_MAX_HEIGHT_PX
            )
        );
        const container = {
            x: primaryRect.x,
            y: primaryRect.y + ((primaryRect.h - primaryHeight) * 0.5),
            w: primaryRect.w,
            h: primaryHeight
        };
        const fitted = fitTutorialAssetRect(
            this.#assetPort.getUiAsset?.('actionButton'),
            container
        ) || container;
        const primaryScale = Math.max(0.1, Number(config.PRIMARY_SCALE) || 1.3);
        const primary = {
            x: Math.round(fitted.x + (fitted.w * (1 - primaryScale) * 0.5)),
            y: Math.round(fitted.y + (fitted.h * (1 - primaryScale) * 0.5)),
            w: Math.max(1, Math.round(fitted.w * primaryScale)),
            h: Math.max(1, Math.round(fitted.h * primaryScale))
        };
        const sideSize = Math.max(
            1,
            Math.round(primary.h * (Number(config.SIDE_BUTTON_SCALE_RATIO) || 0.6))
        );
        const sideGap = Math.max(
            0,
            Math.round(primary.w * (
                Number(config.SIDE_GAP_TO_PRIMARY_WIDTH_RATIO) || 0.08
            ))
        );
        const sideY = Math.round(primary.y + ((primary.h - sideSize) * 0.5));
        const resetSize = Math.max(
            1,
            Math.round(primary.h * (Number(config.RESET_BUTTON_SCALE_RATIO) || 0.6))
        );
        const resetGap = Math.max(
            0,
            Math.round(primary.h * (
                Number(config.RESET_GAP_TO_PRIMARY_HEIGHT_RATIO) || 0.08
            ))
        );
        const geometry = {
            primary,
            heal: {
                x: primary.x - sideGap - sideSize,
                y: sideY,
                w: sideSize,
                h: sideSize
            },
            idle: {
                x: primary.x + primary.w + sideGap,
                y: sideY,
                w: sideSize,
                h: sideSize
            },
            reset: {
                x: Math.round(primary.x + ((primary.w - resetSize) * 0.5)),
                y: primary.y - resetGap - resetSize,
                w: resetSize,
                h: resetSize
            }
        };
        return this.#fitGeometryToSafeArea(geometry);
    }

    /**
     * 커맨드 묶음 전체를 디자인 안전 영역 안으로 평행 이동합니다.
     * @param {object} geometry - 보정 전 사각형 묶음입니다.
     * @returns {object} 안전 영역에 맞춘 사각형 묶음입니다.
     * @private
     */
    #fitGeometryToSafeArea(geometry) {
        const safe = this.#frame.layout.designSpace;
        const rects = Object.values(geometry);
        const minX = Math.min(...rects.map((rect) => rect.x));
        const maxX = Math.max(...rects.map((rect) => rect.x + rect.w));
        const minY = Math.min(...rects.map((rect) => rect.y));
        const maxY = Math.max(...rects.map((rect) => rect.y + rect.h));
        let dx = minX < safe.x ? safe.x - minX : 0;
        if (maxX + dx > safe.x + safe.w) {
            dx += (safe.x + safe.w) - (maxX + dx);
        }
        let dy = minY < safe.y ? safe.y - minY : 0;
        if (maxY + dy > safe.y + safe.h) {
            dy += (safe.y + safe.h) - (maxY + dy);
        }
        return Object.freeze(Object.fromEntries(Object.entries(geometry).map(
            ([key, rect]) => [key, Object.freeze({
                x: Math.round(rect.x + dx),
                y: Math.round(rect.y + dy),
                w: rect.w,
                h: rect.h
            })]
        )));
    }

    /** @param {object} rect @param {number} scale @returns {object} 중심 기준 세로 압축 사각형입니다. @private */
    #scaleRectY(rect, scale) {
        const value = clampProgress(scale);
        const height = Math.max(1, Math.round(rect.h * value));
        return {
            x: Math.round(rect.x),
            y: Math.round(rect.y + ((rect.h - height) * 0.5)),
            w: Math.max(1, Math.round(rect.w)),
            h: height
        };
    }

    /** @param {object} action @returns {number} 활성·포커스 상태를 반영한 투명도입니다. @private */
    #resolveActionAlpha(action) {
        if (!action?.enabled) {
            return 0.38;
        }
        return action.focused || action.active ? 1 : 0.92;
    }

    /** @returns {object} 커맨드 클러스터 정적 설정입니다. @private */
    #config() {
        return this.#frame.hud.config.actions.CLUSTER || {};
    }

    /** @returns {number} 같은 BattleViewModel이 제공하는 장면 경과 시간입니다. @private */
    #elapsedSeconds() {
        const value = Number(this.#frame.world?.elapsedSeconds);
        return Number.isFinite(value) ? value : 0;
    }

    /** @param {number} value @returns {number} 화면 높이 백분율을 픽셀로 변환합니다. @private */
    #uwh(value) {
        return this.#frame.layout.designSpace.h * (Number(value) / 100);
    }
}
