import { TUTORIAL_KEY_DIRECTIONS as KEY_DIRECTIONS } from './_tutorial_input_bindings.js';
import {
    cloneValue,
    toList
} from './_tutorial_value_utils.js';

const LORA_ID = 'lora';

/**
 * 모델 읽기 결과와 한 프레임 표현 snapshot을 전투 뷰 모델로 조립합니다.
 */
export class TutorialBattleViewModelFactory {
    /** @param {object} options - 정적 데이터와 표시 전용 협력 객체입니다. */
    constructor({ data, inventoryPresenter, combatReadability, battleFocus }) {
        this.data = data;
        this.inventoryPresenter = inventoryPresenter;
        this.combatReadability = combatReadability;
        this.battleFocus = battleFocus;
    }

    /**
     * 한 프레임의 읽기 전용 전투 뷰 모델을 생성합니다.
     * @param {object} input - 모델·표현·선택 snapshot입니다.
     * @returns {object|null} 월드·HUD·피드백 뷰가 공유할 모델입니다.
     */
    create(input) {
        const model = input.model;
        const snapshot = model?.getSnapshot?.();
        if (!model || !snapshot) {
            return null;
        }
        const floor = cloneValue(input.floor || snapshot.floor);
        const presentation = Object.freeze(cloneValue(input.presentation));
        const selection = input.selection;
        const ready = input.ready === true;
        const actionReady = ready && snapshot.phase === 'action' && !snapshot.actionUsed;
        const meleeTargets = toList(model.getValidTargets({ weapon: 'melee' }));
        const bowTargets = toList(model.getValidTargets({ weapon: 'bow' }));
        const cleanseTargets = toList(model.getCleanseTargets?.());
        const inventoryView = this.inventoryPresenter.createView({
            model,
            snapshot,
            ready,
            actionReady,
            cleanseTargetCount: cleanseTargets.length
        });
        const hasBow = inventoryView.entries.some(
            (entry) => entry.itemId === 'bow'
        );
        const preferredAttackWeapon = selection.attackSelected
            ? selection.attackWeapon
            : (hasBow ? 'bow' : 'melee');
        const pathExtensions = this.#createPathExtensions({
            model,
            snapshot,
            presentation,
            plannedPath: selection.plannedPath
        });
        const movePreview = snapshot.phase === 'move'
            ? cloneValue(model.previewPath(selection.plannedPath))
            : null;
        const inventoryFocusKeys = inventoryView.pagedInventory.entries.map(
            (entry) => 'item-' + entry.itemId
        );
        const actionFocusKeys = [
            preferredAttackWeapon === 'bow' ? 'battle-ranged' : 'battle-melee',
            'battle-heal',
            'battle-idle'
        ];
        this.battleFocus.setKeys(snapshot.phase === 'move'
            ? inventoryFocusKeys
            : [...actionFocusKeys, ...inventoryFocusKeys]);
        const focusedControlKey = this.battleFocus.getFocusedKey();
        const actionSelection = this.#createActionPreviewSelection({
            model,
            selection,
            focusedControlKey
        });
        const inspectedItem = focusedControlKey?.startsWith('item-')
            ? inventoryView.pagedInventory.entries.find(
                (entry) => entry.itemId === focusedControlKey.slice('item-'.length)
            ) || null
            : null;
        const readability = this.combatReadability.create({
            snapshot,
            loraIntent: model.getLoraIntent({ allowForecast: true }),
            actionPreview: actionSelection.preview,
            selectionLabel: actionSelection.label,
            inspectedItem
        });
        const cursor = this.#createCursorPresentation({
            input,
            selection,
            actionReady,
            readability
        });

        return Object.freeze({
            viewport: input.layout.viewport,
            layout: input.layout,
            fonts: Object.freeze({ ...input.fonts }),
            colors: input.colors,
            cursor,
            snapshot: Object.freeze(snapshot),
            floor: Object.freeze(floor || {}),
            world: this.#createWorldView({
                input,
                snapshot,
                presentation,
                selection,
                pathExtensions,
                itemMetadata: inventoryView.itemMetadata,
                readability
            }),
            hud: Object.freeze({
                presentationLocked: input.presentationLocked === true,
                attackSelected: selection.attackSelected,
                attackWeapon: selection.attackWeapon,
                cleanseSelected: selection.cleanseSelected,
                focusedControlKey,
                buttonHoverScales: Object.freeze({
                    ...(input.buttonHoverScales || {})
                }),
                instabilityState: Object.freeze(cloneValue(
                    model.getInstabilityState?.() || {}
                )),
                movePreview: movePreview ? Object.freeze(movePreview) : null,
                readability,
                eventLog: input.feedback.eventLog,
                inventory: inventoryView.pagedInventory,
                controls: Object.freeze({
                    ready,
                    actionReady,
                    meleeTargetCount: meleeTargets.length,
                    bowTargetCount: bowTargets.length,
                    hasBow,
                    preferredAttackWeapon,
                    cleanseTargetCount: cleanseTargets.length
                }),
                config: Object.freeze({
                    actions: this.data.LAYOUT.ACTIONS,
                    inventory: this.data.LAYOUT.INVENTORY,
                    itemIcon: this.data.SPRITES.ITEM,
                    text: this.data.TEXT,
                    floorTransitionAfterTurn:
                        this.data.RULES.FLOOR_TRANSITION_AFTER_TURN,
                    playerMoveRange: this.data.ACTORS.PLAYER.MOVE_RANGE,
                    healAmount: this.data.ACTORS.PLAYER.HEAL_AMOUNT
                })
            }),
            achievement: input.achievement,
            feedback: Object.freeze({
                floatingTexts: input.feedback.floatingTexts,
                notices: Object.freeze(toList(input.feedback.notices).map(
                    (notice) => Object.freeze(cloneValue(notice))
                )),
                particles: input.feedback.particles
            })
        });
    }

    /** 전투 월드 뷰가 소비할 선택·표현 상태를 조립합니다. */
    #createWorldView({
        input,
        snapshot,
        presentation,
        selection,
        pathExtensions,
        itemMetadata,
        readability
    }) {
        return Object.freeze({
            elapsedSeconds: input.elapsedSeconds,
            presentation,
            spriteAnimations: input.spriteAnimations,
            battleEffects: Object.freeze(toList(input.battleEffects).map(
                (effect) => Object.freeze(cloneValue(effect))
            )),
            floorActors: input.floorActors
                ? Object.freeze(cloneValue(input.floorActors))
                : null,
            plannedPath: Object.freeze(selection.plannedPath.map(
                (tile) => Object.freeze({ ...tile })
            )),
            reachability: Object.freeze(Array.from(selection.reachability.values()).map(
                (entry) => Object.freeze(cloneValue(entry))
            )),
            pathExtensions: Object.freeze(pathExtensions),
            hoveredTile: selection.hoveredTile
                ? Object.freeze({ ...selection.hoveredTile })
                : null,
            attackSelected: selection.attackSelected,
            attackWeapon: selection.attackWeapon,
            actionTargets: Object.freeze(selection.actionTargets.map(
                (target) => Object.freeze(cloneValue(target))
            )),
            targetIndex: selection.targetIndex,
            cleanseSelected: selection.cleanseSelected,
            cleanseTargets: Object.freeze(selection.cleanseTargets.map(
                (target) => Object.freeze(cloneValue(target))
            )),
            cleanseTargetIndex: selection.cleanseTargetIndex,
            itemMetadata,
            readability,
            feedback: Object.freeze({
                flashSeconds: input.feedback.flashSeconds,
                stabilizeSeconds: input.feedback.stabilizeSeconds
            }),
            config: Object.freeze({
                attackRange: this.data.ACTORS.PLAYER.ATTACK_RANGE,
                pathPreview: this.data.LAYOUT.BOARD.PATH_PREVIEW,
                shadowProjection: this.data.LAYOUT.BOARD.SHADOW_PROJECTION,
                selectionMinScale: this.data.ANIMATION.SELECTION_MIN_SCALE,
                actionPlayerScale: this.data.ANIMATION.ACTION_PLAYER_SCALE,
                actionLoraScale: this.data.ANIMATION.ACTION_LORA_SCALE,
                itemIcon: this.data.SPRITES.ITEM,
                recordIcon: this.data.SPRITES.RECORD,
                loraSprite: this.data.SPRITES.LORA
            })
        });
    }

    /** 이동 경로 끝에서 한 칸 더 진행할 때 생기는 포탈 포함 세그먼트를 만듭니다. */
    #createPathExtensions({ model, snapshot, presentation, plannedPath }) {
        const extensions = [];
        if (Number(presentation.floorIndex) !== (Number(snapshot.floorIndex) || 0)
            || snapshot.phase !== 'move') {
            return extensions;
        }
        for (const direction of KEY_DIRECTIONS) {
            const extension = this.#normalizePath(model.extendPath(
                plannedPath,
                direction.x,
                direction.y
            ));
            extensions.push(Object.freeze(
                extension.slice(plannedPath.length)
                    .map((tile) => Object.freeze({ ...tile }))
            ));
        }
        return extensions;
    }

    /** 공격·회복·아이템 포커스를 모델의 비변이 행동 미리보기로 바꿉니다. */
    #createActionPreviewSelection({
        model,
        selection,
        focusedControlKey
    }) {
        if (model.phase !== 'action' || model.result) {
            return { preview: null, label: '이동 경로' };
        }
        if (selection.attackSelected) {
            const target = selection.actionTargets[selection.targetIndex];
            return {
                preview: model.previewPlayerAction('attack', {
                    targetId: target?.id || LORA_ID,
                    weapon: selection.attackWeapon
                }),
                label: selection.attackWeapon === 'bow'
                    ? '원거리 공격'
                    : '근접 공격'
            };
        }
        if (focusedControlKey === 'battle-melee'
            || focusedControlKey === 'battle-ranged') {
            const weapon = focusedControlKey === 'battle-ranged'
                ? 'bow'
                : 'melee';
            const target = toList(model.getValidTargets({ weapon }))[0];
            return {
                preview: model.previewPlayerAction('attack', {
                    targetId: target?.id || LORA_ID,
                    weapon
                }),
                label: weapon === 'bow' ? '원거리 공격' : '근접 공격'
            };
        }
        if (focusedControlKey === 'battle-heal') {
            return { preview: model.previewPlayerAction('heal'), label: '회복' };
        }
        if (focusedControlKey === 'battle-idle') {
            return { preview: model.previewPlayerAction('wait'), label: '대기' };
        }
        if (focusedControlKey?.startsWith('item-')) {
            const itemId = focusedControlKey.slice('item-'.length);
            return {
                preview: model.previewPlayerAction('use-item', { itemId }),
                label: this.data.ITEMS[itemId]?.label || itemId
            };
        }
        return { preview: null, label: '행동을 선택하세요' };
    }

    /**
     * 공격 선택과 실제 호버 대상을 공용 UI 커서 표시 모델로 변환합니다.
     * @param {object} values - 프레임 입력, 선택 상태와 모델 기반 표시값입니다.
     * @returns {object} 일반 또는 공격 커서 표시 모델입니다.
     * @private
     */
    #createCursorPresentation({ input, selection, actionReady, readability }) {
        if (!actionReady || selection.attackSelected !== true) {
            return Object.freeze({ type: 'normal', info: null });
        }
        const hoveredTarget = selection.hoveredTile
            ? selection.actionTargets.find((target) => (
                target.x === selection.hoveredTile.x
                && target.y === selection.hoveredTile.y
            ))
            : null;
        const previewTarget = readability.playerPreview?.target;
        const matchesHoveredTarget = hoveredTarget?.id
            && previewTarget?.id === hoveredTarget.id;
        const colors = input.colors?.UI || {};
        const info = matchesHoveredTarget
            ? Object.freeze({
                title: previewTarget.label,
                detail: `HP ${previewTarget.hpBefore} → ${previewTarget.hpAfter}`,
                titleFont: input.fonts?.BUTTON,
                detailFont: input.fonts?.SMALL,
                colors: Object.freeze({
                    panel: colors.Panel,
                    border: colors.Accent,
                    title: colors.Text,
                    detail: colors.Danger
                })
            })
            : null;
        return Object.freeze({ type: 'attack', icon: input.attackCursorIcon || null, info });
    }

    /** 모델 반환 경로를 정수 좌표 배열로 정규화합니다. */
    #normalizePath(source) {
        const rawPath = Array.isArray(source) ? source : source?.path;
        if (!Array.isArray(rawPath)) {
            return [];
        }
        return rawPath
            .map((tile) => ({ x: Number(tile?.x), y: Number(tile?.y) }))
            .filter((tile) => Number.isInteger(tile.x) && Number.isInteger(tile.y));
    }
}
