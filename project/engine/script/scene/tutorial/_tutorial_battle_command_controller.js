import { cloneTile, toList } from './_tutorial_value_utils.js';

/**
 * 플레이어 전투 명령을 선택 상태와 모델 공개 API에 적용합니다.
 */
export class TutorialBattleCommandController {
    /**
     * @param {object} options - 필요한 작은 협력자 포트입니다.
     */
    constructor(options = {}) {
        this.selection = options.selection;
        this.focus = options.focus;
        this.presentation = options.presentation;
        this.getModel = options.getModel;
        this.canAcceptInput = options.canAcceptInput;
        this.onModelChange = options.onModelChange;
        this.getVisibleFloorIndex = options.getVisibleFloorIndex;
        this.cleanseActionSeconds = Number(options.cleanseActionSeconds) || 0;
    }

    /** 방향 입력으로 경로 또는 대상을 이동합니다. */
    applyPlanStep(payload) {
        const model = this.#getReadyModel();
        if (!model) {
            return;
        }
        const dx = Number(payload?.x) || 0;
        const dy = Number(payload?.y) || 0;
        const selectionKind = this.selection.planStep(model, dx, dy);
        if (selectionKind) {
            this.presentation.startSelection(
                selectionKind === 'path' ? 'path' : 'attack'
            );
        }
    }

    /** 마지막 계획 스텝을 되돌립니다. */
    applyPlanBack() {
        const model = this.#getReadyModel();
        if (!model || !this.selection.backtrackPath(model)) {
            return;
        }
        this.presentation.startSelection('path');
    }

    /** 계획 경로를 플레이어 위치로 초기화합니다. */
    applyPlanReset() {
        const model = this.#getReadyModel();
        if (!model
            || model.movementUsed
            || model.phase !== 'move'
            || !this.selection.resetPath(model)) {
            return;
        }
        this.selection.clearCleanse();
        this.presentation.startSelection('path');
    }

    /** 현재 계획 경로를 확정합니다. */
    applyCommitPath() {
        const model = this.#getReadyModel();
        if (!model || model.movementUsed || model.phase !== 'move') {
            return;
        }
        this.#commitModelPath(model, this.selection.getPlannedPath());
    }

    /** 공격 무기와 대상 선택을 전환합니다. */
    applySelectAttack(payload = {}) {
        const model = this.#getReadyActionModel();
        if (!model) {
            return;
        }
        const result = this.selection.toggleAttack(model, payload?.weapon);
        if (!result.changed) {
            return;
        }
        this.focus.focus(result.focusKey);
        this.selection.refresh(model);
        this.presentation.startSelection('attack');
    }

    /** 선택한 대상을 공격합니다. */
    applyAttack(payload) {
        const model = this.#getReadyActionModel();
        if (!model) {
            return;
        }
        const request = this.selection.createAttackRequest(payload);
        if (!request) {
            return;
        }
        const result = model.attack(request.targetId, { weapon: request.weapon });
        this.selection.clearAttack();
        this.onModelChange(result);
        if (result?.ok === true) {
            this.presentation.startAction();
        }
    }

    /** 플레이어 회복 행동을 적용합니다. */
    applyHeal() {
        const model = this.#getReadyActionModel();
        if (!model) {
            return;
        }
        const result = model.heal();
        this.selection.clearAttack();
        this.onModelChange(result);
        if (result?.ok === true) {
            this.presentation.startAction();
        }
    }

    /** 남은 플레이어 행동을 포기합니다. */
    applyIdle() {
        const model = this.#getReadyActionModel();
        if (!model) {
            return;
        }
        const result = model.wait();
        this.selection.clearActionSelections();
        this.onModelChange(result);
        if (result?.ok === true) {
            this.presentation.startAction();
        }
    }

    /** 이동 단계의 정화 대상 선택을 전환합니다. */
    applySelectCleanse() {
        const model = this.#getReadyModel();
        if (!model || model.phase !== 'move' || model.movementUsed) {
            return;
        }
        if (!this.selection.toggleCleanse(model)) {
            return;
        }
        this.selection.refresh(model);
        this.presentation.startSelection('attack');
    }

    /** 선택한 이벤트 타일에 정화제를 사용합니다. */
    applyCleanseEventTile(payload) {
        const model = this.#getReadyModel();
        if (!model || !this.selection.isCleanseSelected()) {
            return;
        }
        const target = this.selection.getCleanseTarget(payload);
        if (!target) {
            return;
        }
        const result = model.cleanseEventTile(target);
        this.selection.clearCleanse();
        this.onModelChange(result);
        if (result?.ok === true) {
            this.presentation.startAction(this.cleanseActionSeconds);
        }
    }

    /** 인벤토리 아이템을 사용합니다. */
    applyUseItem(payload) {
        const model = this.#getReadyModel();
        const itemId = payload?.itemId;
        if (!model || typeof itemId !== 'string') {
            return;
        }
        if (model.phase === 'move') {
            this.onModelChange({
                ok: false,
                reason: 'movement-command-required',
                events: []
            });
            return;
        }
        if (model.phase !== 'action' || model.actionUsed) {
            return;
        }
        const result = model.useItem(itemId);
        this.selection.clearAttack();
        this.onModelChange(result);
        if (result?.ok === true) {
            this.presentation.startAction();
        }
    }

    /** 검증한 경로를 모델에 전달하고 같은 결과로 이동 연출을 시작합니다. */
    #commitModelPath(model, path) {
        const normalizedPath = this.selection.normalizePath(path);
        if (normalizedPath.length === 0) {
            return;
        }
        const result = model.commitPath(normalizedPath);
        const resultPath = this.selection.normalizePath(result?.path);
        const teleportSegments = toList(result?.events)
            .filter((event) => event?.type === 'teleported')
            .map((event) => ({
                from: cloneTile(event.from),
                to: cloneTile(event.to)
            }))
            .filter((segment) => segment.from && segment.to);
        this.selection.completeMove(model, result?.ok === true);
        this.onModelChange(result);
        if (result?.ok === true) {
            this.presentation.startPlayerPath({
                path: resultPath,
                teleportSegments,
                finalPlayer: model.player,
                logicalFloorIndex: model.floorIndex,
                visibleFloorIndex: this.getVisibleFloorIndex()
            });
        }
    }

    /** @returns {object|null} 공통 장면 입력 경계를 통과한 현재 모델입니다. */
    #getReadyModel() {
        if (typeof this.canAcceptInput !== 'function'
            || !this.canAcceptInput()) {
            return null;
        }
        return typeof this.getModel === 'function' ? this.getModel() : null;
    }

    /** @returns {object|null} 아직 행동을 쓰지 않은 행동 단계 모델입니다. */
    #getReadyActionModel() {
        const model = this.#getReadyModel();
        return model && model.phase === 'action' && !model.actionUsed
            ? model
            : null;
    }
}
