/**
 * 쿼터뷰 격자의 진행축을 실제 전·후면 스프라이트 방향으로 변환합니다.
 * 양의 X/Y는 화면 아래쪽의 전면, 음의 X/Y는 화면 위쪽의 후면입니다.
 * @param {object} from - 바라보는 배우 좌표입니다.
 * @param {object} to - 목표 배우 좌표입니다.
 * @param {string} fallback - 같은 칸이거나 좌표가 없을 때 방향입니다.
 * @returns {string} 목표 방향입니다.
 */
function faceToward(from, to, fallback = 'left') {
    const dx = Number(to?.x) - Number(from?.x);
    const dy = Number(to?.y) - Number(from?.y);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
        return fallback;
    }
    if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) > 0.001) {
        return dx < 0 ? 'up' : 'right';
    }
    if (Math.abs(dy) > 0.001) {
        return dy < 0 ? 'down' : 'left';
    }
    return fallback;
}

/**
 * @class TutorialSpriteRoster
 * @description 표시 층의 플레이어·로라·슬라임을 스프라이트 재생기 입력으로 변환합니다.
 */
export class TutorialSpriteRoster {
    #animator;

    /** @param {object} animator - TutorialSpriteAnimator입니다. */
    constructor(animator) {
        this.#animator = animator;
    }

    /** @param {object} frame - 표시 층, 배우 스냅샷과 이동 표현 상태입니다. */
    sync(frame = {}) {
        const floor = frame.floor || {};
        const snapshot = frame.snapshot || {};
        const presentation = frame.presentation || {};
        const floorActors = frame.floorActors || null;
        const sameFloor = Number(presentation.floorIndex) === Number(snapshot.floorIndex);
        const player = floorActors?.player || (sameFloor ? snapshot.player : null);
        const lora = floorActors?.lora || (sameFloor ? snapshot.lora : null);
        const actors = [];
        if (player) {
            actors.push({
                id: 'player',
                actorType: 'player',
                x: Number(presentation.playerX),
                y: Number(presentation.playerY),
                alive: player.alive !== false && Number(player.hp) > 0,
                detectMovement: true,
                ambientAnimationId: 'idle'
            });
        }
        if (lora) {
            const instability = Number(lora.instability) || 0;
            actors.push({
                id: 'lora',
                actorType: 'lora',
                x: Number(lora.x),
                y: Number(lora.y),
                alive: lora.alive !== false && Number(lora.hp) > 0,
                facing: faceToward(lora, player),
                ambientAnimationId: instability >= 81
                    ? 'collapse'
                    : instability >= 61 ? 'unstable' : 'idle'
            });
        }
        for (const mob of Array.isArray(floor.mobs) ? floor.mobs : []) {
            actors.push({
                id: mob.id,
                actorType: 'slime',
                variant: Number(presentation.floorIndex) === 0 ? 'blue' : 'green',
                x: Number(mob.x),
                y: Number(mob.y),
                alive: mob.alive !== false && Number(mob.hp) > 0,
                ambientAnimationId: 'idle'
            });
        }
        this.#animator?.syncActors?.(actors);
    }
}
