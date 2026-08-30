const PAUSE_GAME_BGM_MESSAGE = 'nthplayer:presentation-pause-bgm';

/**
 * 프로토타입 슬라이드 경계에서 게임 iframe의 BGM만 일시정지합니다.
 */
export class PrototypeAudioBoundary {
    #stage;
    #gameFrame;
    #prototypeActive;

    constructor(stage, gameFrame) {
        this.#stage = stage;
        this.#gameFrame = gameFrame;
        this.#prototypeActive = Boolean(
            stage?.querySelector('.slide.is-active[data-prototype-slide]')
        );
    }

    /** 덱의 슬라이드 변경 이벤트를 한 번 연결합니다. */
    connect() {
        this.#stage?.addEventListener('nthplayer:slide-change', (event) => {
            const nextPrototypeActive = Boolean(
                event.detail?.slide?.matches('[data-prototype-slide]')
            );
            const leavingPrototype = this.#prototypeActive && !nextPrototypeActive;
            this.#prototypeActive = nextPrototypeActive;
            if (leavingPrototype) {
                this.#pauseGameBgm();
            }
        });
        return this;
    }

    #pauseGameBgm() {
        this.#gameFrame?.frame?.contentWindow?.postMessage(
            { type: PAUSE_GAME_BGM_MESSAGE },
            window.location.origin
        );
    }
}

new PrototypeAudioBoundary(
    document.querySelector('#presentation-stage'),
    document.querySelector('#nthplayer-game')
).connect();
