import { TUTORIAL_COMMANDS as COMMANDS } from './_tutorial_scene_constants.js';
import {
    clampNumber,
    cloneTile,
    cloneValue,
    toList,
    toTileKey
} from './_tutorial_value_utils.js';

const LORA_ID = 'lora';

/**
 * 전투의 경로·공격·정화·호버 선택 상태와 그 불변식을 소유합니다.
 */
export class TutorialBattleSelectionController {
    constructor() {
        this.reset();
    }

    /** @param {object|null} [model] 새 런에서 기준으로 삼을 전투 모델입니다. */
    reset(model = null) {
        this.hoveredTile = null;
        this.hoveredTileKey = '';
        this.plannedPath = [];
        this.reachability = new Map();
        this.actionTargets = [];
        this.attackSelected = false;
        this.attackWeapon = 'melee';
        this.targetIndex = 0;
        this.cleanseSelected = false;
        this.cleanseTargets = [];
        this.cleanseTargetIndex = 0;
        this.resetPath(model);
    }

    /** 포인터 호버만 지웁니다. */
    clearHover() {
        this.hoveredTile = null;
        this.hoveredTileKey = '';
    }

    /** @returns {boolean} 보드 위에 유효한 호버 타일이 있는지 반환합니다. */
    hasHoveredTile() {
        return this.hoveredTile !== null;
    }

    /** 공격 선택만 닫습니다. */
    clearAttack() {
        this.attackSelected = false;
    }

    /** @returns {boolean} 공격 대상 선택이 열려 있는지 반환합니다. */
    isAttackSelected() {
        return this.attackSelected;
    }

    /** 정화 선택과 계산된 대상을 닫습니다. */
    clearCleanse() {
        this.cleanseSelected = false;
        this.cleanseTargets = [];
    }

    /** @returns {boolean} 정화 대상 선택이 열려 있는지 반환합니다. */
    isCleanseSelected() {
        return this.cleanseSelected;
    }

    /** 공격과 정화 선택을 함께 닫습니다. */
    clearActionSelections() {
        this.clearAttack();
        this.clearCleanse();
    }

    /**
     * 모델의 현재 단계에 맞춰 도달 범위와 대상 캐시를 갱신합니다.
     * @param {object|null} model - 전투 모델입니다.
     */
    refresh(model) {
        this.reachability = new Map();
        this.actionTargets = [];
        if (!model) {
            return;
        }
        if (model.phase === 'move') {
            this.reachability = this.#normalizeReachability(model.getReachability());
        }
        if (model.phase === 'action' && !model.actionUsed && this.attackSelected) {
            this.actionTargets = toList(model.getValidTargets({
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
        if (model.phase === 'move' && this.cleanseSelected) {
            this.cleanseTargets = toList(model.getCleanseTargets()).map((target) => ({
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
        const player = cloneTile(model.player);
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
     * 방향 입력을 경로 연장 또는 선택 대상 이동으로 적용합니다.
     * @returns {'path'|'attack'|'cleanse'|null} 표시 애니메이션 종류입니다.
     */
    planStep(model, dx, dy) {
        if (this.cleanseSelected) {
            return this.#shiftCleanseTarget(dx || dy) ? 'cleanse' : null;
        }
        if (this.attackSelected) {
            return this.#shiftAttackTarget(dx || dy) ? 'attack' : null;
        }
        if (!model || model.movementUsed || model.phase !== 'move') {
            return null;
        }
        const path = this.normalizePath(model.extendPath(this.plannedPath, dx, dy));
        if (path.length === 0) {
            return null;
        }
        this.plannedPath = path;
        return 'path';
    }

    /** 포탈 진입·출구 쌍을 보존하며 마지막 경로 스텝을 취소합니다. */
    backtrackPath(model) {
        if (!model
            || model.movementUsed
            || model.phase !== 'move'
            || this.plannedPath.length <= 1) {
            return false;
        }
        const last = this.plannedPath.at(-1);
        const previous = this.plannedPath.at(-2);
        this.plannedPath.pop();
        if (previous
            && Math.abs(last.x - previous.x) + Math.abs(last.y - previous.y) > 1
            && this.plannedPath.length > 1) {
            this.plannedPath.pop();
        }
        this.clearCleanse();
        return true;
    }

    /** 현재 경로를 플레이어 시작점 하나로 되돌립니다. */
    resetPath(model) {
        const player = cloneTile(model?.player);
        const changed = this.plannedPath?.length > 1;
        this.plannedPath = player ? [player] : [];
        return changed;
    }

    /** @returns {Array<{x:number,y:number}>} 현재 계획 경로의 방어 복제본입니다. */
    getPlannedPath() {
        return this.plannedPath.map(cloneTile).filter(Boolean);
    }

    /** 성공한 이동 뒤 선택 상태와 새 시작 경로를 맞춥니다. */
    completeMove(model, succeeded) {
        if (succeeded) {
            this.clearCleanse();
            this.resetPath(model);
        }
    }

    /** 같은 무기 재선택은 닫고 다른 무기는 유효 대상이 있을 때 엽니다. */
    toggleAttack(model, weapon) {
        const normalizedWeapon = weapon === 'bow' ? 'bow' : 'melee';
        const selectingSameWeapon = this.attackSelected
            && this.attackWeapon === normalizedWeapon;
        if (!selectingSameWeapon
            && toList(model?.getValidTargets({ weapon: normalizedWeapon })).length === 0) {
            return { changed: false, focusKey: null };
        }
        this.attackSelected = !selectingSameWeapon;
        this.attackWeapon = normalizedWeapon;
        this.clearCleanse();
        this.targetIndex = 0;
        return {
            changed: true,
            focusKey: normalizedWeapon === 'bow' ? 'battle-ranged' : 'battle-melee'
        };
    }

    /** @param {object} [payload] @returns {{targetId:string,weapon:string}|null} */
    createAttackRequest(payload = {}) {
        const targetId = payload.targetId
            || this.actionTargets[this.targetIndex]?.id
            || LORA_ID;
        if (!this.actionTargets.some((target) => target.id === targetId)) {
            return null;
        }
        return { targetId, weapon: this.attackWeapon };
    }

    /** 이동 단계의 정화 대상 선택을 토글합니다. */
    toggleCleanse(model) {
        const targets = toList(model?.getCleanseTargets?.());
        if (targets.length === 0) {
            this.clearCleanse();
            return false;
        }
        this.cleanseSelected = !this.cleanseSelected;
        this.clearAttack();
        this.cleanseTargetIndex = 0;
        return true;
    }

    /** @param {object} [payload] @returns {object|null} 선택한 정화 대상입니다. */
    getCleanseTarget(payload = {}) {
        return payload.id
            ? payload
            : this.cleanseTargets[this.cleanseTargetIndex] || null;
    }

    /**
     * 새 호버 타일을 반영하고 선택 대상이 함께 바뀌었는지 반환합니다.
     * @param {object|null} tile - 히트테스트된 타일입니다.
     * @returns {{hoverChanged:boolean,targetChanged:boolean}}
     */
    setHoveredTile(tile) {
        const nextTile = cloneTile(tile);
        const nextKey = nextTile ? toTileKey(nextTile.x, nextTile.y) : '';
        const hoverChanged = Boolean(nextKey && nextKey !== this.hoveredTileKey);
        let targetChanged = false;
        if (nextTile && this.attackSelected) {
            const index = this.actionTargets.findIndex((target) => (
                target.x === nextTile.x && target.y === nextTile.y
            ));
            if (index >= 0 && index !== this.targetIndex) {
                this.targetIndex = index;
                targetChanged = true;
            }
        } else if (nextTile && this.cleanseSelected) {
            const index = this.cleanseTargets.findIndex((target) => (
                target.x === nextTile.x && target.y === nextTile.y
            ));
            if (index >= 0 && index !== this.cleanseTargetIndex) {
                this.cleanseTargetIndex = index;
                targetChanged = true;
            }
        }
        this.hoveredTile = nextTile;
        this.hoveredTileKey = nextKey;
        return { hoverChanged, targetChanged };
    }

    /** 현재 호버와 선택 상태를 보드 클릭 명령으로 변환합니다. */
    createPointerCommand(model) {
        if (!model || !this.hoveredTile) {
            return null;
        }
        if (this.cleanseSelected) {
            const target = this.cleanseTargets.find((entry) => (
                entry.x === this.hoveredTile.x && entry.y === this.hoveredTile.y
            ));
            return target
                ? { type: COMMANDS.CLEANSE_EVENT_TILE, payload: target }
                : null;
        }
        if (this.attackSelected) {
            const target = this.actionTargets.find((entry) => (
                entry.x === this.hoveredTile.x && entry.y === this.hoveredTile.y
            ));
            return target
                ? { type: COMMANDS.ATTACK, payload: { targetId: target.id } }
                : null;
        }
        const endpoint = this.plannedPath.at(-1);
        const dx = this.hoveredTile.x - (endpoint?.x ?? model.player.x);
        const dy = this.hoveredTile.y - (endpoint?.y ?? model.player.y);
        return model.phase === 'move' && Math.abs(dx) + Math.abs(dy) === 1
            ? { type: COMMANDS.PLAN_STEP, payload: { x: dx, y: dy } }
            : null;
    }

    /** @returns {object} 키 명령 매퍼가 읽을 작은 선택 snapshot입니다. */
    createKeyboardState() {
        return {
            attackSelected: this.attackSelected,
            cleanseSelected: this.cleanseSelected,
            selectedCleanseTarget: this.cleanseTargets[this.cleanseTargetIndex],
            selectedAttackTargetId: this.actionTargets[this.targetIndex]?.id
        };
    }

    /** @returns {object} 전투 뷰 모델 팩토리가 읽을 방어 snapshot입니다. */
    getSnapshot() {
        return {
            hoveredTile: cloneTile(this.hoveredTile),
            plannedPath: this.plannedPath.map(cloneTile).filter(Boolean),
            reachability: new Map(Array.from(this.reachability, ([key, value]) => (
                [key, cloneValue(value)]
            ))),
            actionTargets: this.actionTargets.map((target) => cloneValue(target)),
            attackSelected: this.attackSelected,
            attackWeapon: this.attackWeapon,
            targetIndex: this.targetIndex,
            cleanseSelected: this.cleanseSelected,
            cleanseTargets: this.cleanseTargets.map((target) => cloneValue(target)),
            cleanseTargetIndex: this.cleanseTargetIndex
        };
    }

    /** @returns {readonly string[]} 버튼 구성 서명에 사용할 안정 값 목록입니다. */
    getSignatureParts() {
        return Object.freeze([
            String(this.attackSelected),
            String(this.attackWeapon),
            String(this.cleanseSelected),
            String(this.cleanseTargetIndex),
            this.plannedPath.map((point) => toTileKey(point.x, point.y)).join('>')
        ]);
    }

    /** @param {*} source @returns {Array<{x:number,y:number}>} */
    normalizePath(source) {
        const rawPath = Array.isArray(source) ? source : source?.path;
        return Array.isArray(rawPath)
            ? rawPath.map(cloneTile).filter(Boolean)
            : [];
    }

    /** 모델 도달 가능 결과를 좌표 키 Map으로 정규화합니다. */
    #normalizeReachability(source) {
        const normalized = new Map();
        if (source instanceof Map) {
            for (const [key, value] of source.entries()) {
                if (value
                    && Number.isInteger(Number(value.x))
                    && Number.isInteger(Number(value.y))) {
                    normalized.set(
                        toTileKey(Number(value.x), Number(value.y)),
                        value
                    );
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

    /** 공격 대상 커서를 순환합니다. */
    #shiftAttackTarget(delta) {
        const count = this.actionTargets.length;
        if (count <= 0 || delta === 0) {
            return false;
        }
        this.targetIndex = (this.targetIndex + Math.sign(delta) + count) % count;
        return true;
    }

    /** 정화 대상 커서를 순환합니다. */
    #shiftCleanseTarget(delta) {
        const count = this.cleanseTargets.length;
        if (count <= 0 || delta === 0) {
            return false;
        }
        this.cleanseTargetIndex = (
            this.cleanseTargetIndex + Math.sign(delta) + count
        ) % count;
        return true;
    }
}
