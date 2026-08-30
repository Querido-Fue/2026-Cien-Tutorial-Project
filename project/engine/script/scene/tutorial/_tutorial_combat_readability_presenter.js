const ACTION_LABELS = Object.freeze({
    melee: '근접 공격',
    area: '전체 공격',
    none: '공격 없음'
});

const TARGET_LABELS = Object.freeze({
    lora: '로라',
    mob: '슬라임'
});

/** @param {*} value @param {number} [fallback=0] @returns {number} 유한 숫자입니다. */
function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

/** @param {*} value @returns {object} 보관 후 안전한 객체입니다. */
function freezeRecord(value) {
    return Object.freeze({ ...(value || {}) });
}

/**
 * @class TutorialCombatReadabilityPresenter
 * @description 모델 미리보기를 HUD가 계산 없이 표시할 짧은 문구로 변환합니다.
 */
export class TutorialCombatReadabilityPresenter {
    #items;
    #reasonCopy;

    /** @param {{items?:object,reasonCopy?:object}} config - 아이템 메타와 reason 표시 문구입니다. */
    constructor(config = {}) {
        this.#items = Object.freeze({ ...(config.items || {}) });
        this.#reasonCopy = Object.freeze({ ...(config.reasonCopy || {}) });
    }

    /**
     * 로라 의도와 플레이어 행동 미리보기를 한 표시 모델로 조립합니다.
     * @param {object} values - 스냅샷, 의도, 행동 미리보기와 선택 정보입니다.
     * @returns {object} 읽기 전용 HUD 표시 모델입니다.
     */
    create(values = {}) {
        const snapshot = values.snapshot || {};
        return Object.freeze({
            loraIntent: this.#createLoraIntent(values.loraIntent),
            playerPreview: this.#createPlayerPreview(
                values.actionPreview,
                snapshot,
                values.selectionLabel
            ),
            inspectedItem: this.#createInspectedItem(values.inspectedItem)
        });
    }

    /** @param {object} intent @returns {object} 로라 의도 표시값입니다. @private */
    #createLoraIntent(intent = {}) {
        const actionType = ACTION_LABELS[intent.actionType]
            ? intent.actionType
            : 'none';
        const affectedTiles = Array.isArray(intent.affectedTiles)
            ? intent.affectedTiles.map((tile) => Object.freeze({ ...tile }))
            : [];
        const rangeLabel = intent.affectsAll === true
            ? '전장 전체'
            : affectedTiles.length > 0
                ? '근접 타일 ' + String(affectedTiles.length) + '칸'
                : '없음';
        return Object.freeze({
            ok: intent.ok === true,
            forecast: intent.forecast === true,
            actionType,
            actionLabel: ACTION_LABELS[actionType],
            stateId: intent.stateId ?? null,
            stateLabel: String(intent.stateLabel || '상태 확인 중'),
            finalDamage: Math.max(0, toFiniteNumber(intent.finalDamage)),
            rangeLabel,
            affectsAll: intent.affectsAll === true,
            affectedTiles: Object.freeze(affectedTiles),
            reasonId: String(intent.reason || 'not-lora-turn'),
            reasonLabel: this.#getReasonCopy(intent.reason)
        });
    }

    /**
     * @param {object|null} preview - 모델 행동 미리보기입니다.
     * @param {object} snapshot - 현재 모델 스냅샷입니다.
     * @param {string} selectionLabel - 선택한 행동 표시명입니다.
     * @returns {object} 플레이어 행동 표시값입니다.
     * @private
     */
    #createPlayerPreview(preview, snapshot, selectionLabel) {
        const fallback = {
            playerHp: toFiniteNumber(snapshot.player?.hp),
            loraHp: toFiniteNumber(snapshot.lora?.hp),
            instability: toFiniteNumber(snapshot.lora?.instability),
            peaceTurns: toFiniteNumber(snapshot.lora?.peaceTurns),
            extraPlayerTurns: toFiniteNumber(snapshot.extraPlayerTurns),
            consecutiveAttackCount: toFiniteNumber(snapshot.consecutiveAttackCount),
            mushroomActive: snapshot.player?.mushroomActive === true
        };
        const before = freezeRecord(preview?.before || fallback);
        const expected = freezeRecord(preview?.expected || fallback);
        const consumedItemId = preview?.changes?.consumedItemId || null;
        const consumedItemCount = Math.max(
            0,
            toFiniteNumber(preview?.changes?.consumedItemCount)
        );
        return Object.freeze({
            available: Boolean(preview),
            ok: preview?.ok === true,
            title: String(selectionLabel || '이동 경로'),
            reasonId: String(preview?.reason || 'movement-preview'),
            reasonLabel: preview
                ? this.#getReasonCopy(preview.reason)
                : '이동 확정 후 행동을 선택하세요.',
            before,
            expected,
            consumedItemId,
            consumedItemLabel: consumedItemId
                ? String(this.#items[consumedItemId]?.label || consumedItemId)
                : '없음',
            consumedItemCount,
            persistentLabel: this.#formatPersistentEffects(expected, preview),
            target: this.#createTargetPreview(preview),
            changes: freezeRecord(preview?.changes)
        });
    }

    /**
     * 공격 계획의 대상명과 실제 적용 예정 HP를 표시값으로 변환합니다.
     * @param {object|null} preview - 모델 행동 미리보기입니다.
     * @returns {object|null} 공격 대상 표시값 또는 null입니다.
     * @private
     */
    #createTargetPreview(preview) {
        if (preview?.ok !== true
            || preview?.action !== 'attack'
            || typeof preview?.targetId !== 'string') {
            return null;
        }
        const type = String(preview.targetType || 'unknown');
        return Object.freeze({
            id: preview.targetId,
            type,
            label: String(TARGET_LABELS[type] || preview.targetId),
            hpBefore: Math.max(0, toFiniteNumber(preview.targetHpBefore)),
            hpAfter: Math.max(0, toFiniteNumber(preview.targetHpAfter))
        });
    }

    /** @param {object|null} inspectedItem @returns {object|null} 선택 아이템 정보입니다. @private */
    #createInspectedItem(inspectedItem) {
        if (!inspectedItem?.itemId) {
            return null;
        }
        return Object.freeze({
            itemId: inspectedItem.itemId,
            label: String(inspectedItem.label || inspectedItem.itemId),
            description: String(inspectedItem.description || '효과 확인 중'),
            count: Math.max(0, toFiniteNumber(inspectedItem.count)),
            statusLabel: String(inspectedItem.statusLabel || '보유')
        });
    }

    /**
     * @param {object} expected - 행동 후 상태입니다.
     * @param {object|null} preview - 행동 변화 요약입니다.
     * @returns {string} 지속 효과와 연속 공격 요약입니다.
     * @private
     */
    #formatPersistentEffects(expected, preview) {
        const parts = [];
        if (toFiniteNumber(expected.peaceTurns) > 0) {
            parts.push('평화 ' + String(expected.peaceTurns) + '턴');
        }
        const grantedExtraTurns = Math.max(
            0,
            toFiniteNumber(preview?.changes?.grantedExtraPlayerTurns)
        );
        if (grantedExtraTurns > 0) {
            parts.push('추가 턴 +' + String(grantedExtraTurns));
        } else if (toFiniteNumber(expected.extraPlayerTurns) > 0) {
            parts.push('추가 턴 ' + String(expected.extraPlayerTurns));
        }
        if (expected.mushroomActive === true) {
            parts.push('버섯 유지');
        }
        parts.push('연속 공격 ' + String(
            Math.max(0, toFiniteNumber(expected.consecutiveAttackCount))
        ) + '회');
        return parts.join(' · ');
    }

    /** @param {*} reason @returns {string} 안정된 reason ID의 짧은 표시 문구입니다. @private */
    #getReasonCopy(reason) {
        const id = String(reason || 'unknown');
        return String(this.#reasonCopy[id] || '현재 상태를 확인하세요.');
    }
}
