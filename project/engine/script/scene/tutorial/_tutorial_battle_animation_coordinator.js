import { TutorialBattleEffectAnimator } from './_tutorial_battle_effect_animator.js';
import { TutorialAttackDistortionAnimator } from './_tutorial_attack_distortion_animator.js';
import { TutorialSpriteAnimator } from './_tutorial_sprite_animator.js';
import { TutorialSpriteClipResolver } from './_tutorial_sprite_clip_resolver.js';
import { TutorialSpriteCueRouter } from './_tutorial_sprite_cue_router.js';
import { TutorialSpriteRoster } from './_tutorial_sprite_roster.js';

/**
 * @class TutorialBattleAnimationCoordinator
 * @description 배우 클립과 월드 효과의 라우팅·갱신·수명을 한 접점으로 조립합니다.
 */
export class TutorialBattleAnimationCoordinator {
    #spriteAnimator;
    #spriteRoster;
    #spriteCueRouter;
    #effectAnimator;
    #attackDistortionAnimator;
    #destroyed;

    /** @param {object} options - 스프라이트·효과 데이터와 파생 cue 소비자입니다. */
    constructor({ spriteClips, effectData, onCue = () => {} } = {}) {
        this.#spriteAnimator = new TutorialSpriteAnimator({
            resolver: new TutorialSpriteClipResolver(spriteClips)
        });
        this.#spriteRoster = new TutorialSpriteRoster(this.#spriteAnimator);
        this.#spriteCueRouter = new TutorialSpriteCueRouter({
            animator: this.#spriteAnimator,
            onCue
        });
        this.#effectAnimator = new TutorialBattleEffectAnimator(effectData);
        this.#attackDistortionAnimator = new TutorialAttackDistortionAnimator(
            effectData?.PLAYER_ATTACK_DISTORTION,
            {
                resolveImpactDelay: (actorId, animationId, facing) => (
                    this.#spriteAnimator.getImpactDelay(actorId, animationId, facing)
                )
            }
        );
        this.#destroyed = false;
    }

    /** @param {readonly object[]} cues @returns {readonly object[]} 충격 지연이 적용된 cue입니다. */
    route(cues = []) {
        if (this.#destroyed) {
            return Object.freeze([]);
        }
        const effectImpactDelays = this.#effectAnimator.route(cues);
        this.#attackDistortionAnimator.route(cues, effectImpactDelays);
        return this.#spriteCueRouter.route(cues, effectImpactDelays);
    }

    /**
     * 표시 배우를 동기화한 뒤 배우와 월드 효과 시간을 함께 진행합니다.
     * @param {number} deltaSeconds - 가변 프레임 경과 초입니다.
     * @param {object|null} rosterFrame - 표시 층 배우 입력입니다.
     */
    update(deltaSeconds, rosterFrame = null) {
        if (this.#destroyed) {
            return;
        }
        if (rosterFrame) {
            this.#spriteRoster.sync(rosterFrame);
        } else {
            this.#spriteAnimator.syncActors([]);
        }
        this.#spriteCueRouter.update(deltaSeconds);
        this.#effectAnimator.update(deltaSeconds);
        this.#attackDistortionAnimator.update(deltaSeconds);
    }

    /** @returns {Readonly<object>} 배우와 월드 효과의 렌더 스냅샷입니다. */
    snapshot() {
        return Object.freeze({
            spriteAnimations: this.#spriteAnimator.getSnapshot(),
            battleEffects: Object.freeze([
                ...this.#effectAnimator.getSnapshot(),
                ...this.#attackDistortionAnimator.getSnapshot()
            ])
        });
    }

    /** @returns {boolean} 완료 전 배우 또는 월드 효과가 있는지 여부입니다. */
    isBusy() {
        return !this.#destroyed && (
            this.#spriteCueRouter.isBusy()
            || this.#effectAnimator.isBusy()
            || this.#attackDistortionAnimator.isBusy()
        );
    }

    /** 새 런에서 모든 배우·효과 상태를 비웁니다. */
    reset() {
        this.#spriteCueRouter.reset();
        this.#effectAnimator.reset();
        this.#attackDistortionAnimator.reset();
    }

    /** 하위 재생기와 콜백을 정리합니다. */
    destroy() {
        if (this.#destroyed) {
            return;
        }
        this.#spriteCueRouter.destroy();
        this.#effectAnimator.destroy();
        this.#attackDistortionAnimator.destroy();
        this.#destroyed = true;
    }
}
