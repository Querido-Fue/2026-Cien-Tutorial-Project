import { EASE_OUT_EXPO, PresentationDeck } from './presentation-deck.js';

const DEFAULT_GAME_SOURCE = '/game/nthplayer/';
const PROTOTYPE_TRANSITION_MS = 600;

const toCssLength = (value) => (
    typeof value === 'number' ? `${value}px` : String(value)
);

const setOptionalProperty = (style, name, value, transform = String) => {
    if (value === undefined || value === null) {
        return;
    }
    style.setProperty(name, transform(value));
};

/**
 * 게임 문서를 한 번만 로드한 뒤 발표 무대 위에서 크기와 위치를 애니메이션하는 프레임입니다.
 */
class NthPlayerGameFrame extends HTMLElement {
    #frame = null;
    #resolveReady;
    #ready;

    constructor() {
        super();
        this.#ready = new Promise((resolve) => {
            this.#resolveReady = resolve;
        });
    }

    /** @returns {Promise<HTMLIFrameElement>} 게임 문서의 첫 load를 기다립니다. */
    get ready() {
        return this.#ready;
    }

    /** @returns {HTMLIFrameElement|null} 재사용 중인 실제 iframe입니다. */
    get frame() {
        return this.#frame;
    }

    /** 게임 iframe을 최초 연결 시 한 번만 생성해 백그라운드 로드를 시작합니다. */
    connectedCallback() {
        if (this.#frame) {
            return;
        }

        this.dataset.loadState = 'loading';
        this.dataset.interactive = 'false';
        this.inert = true;

        const iframe = document.createElement('iframe');
        iframe.src = new URL(this.dataset.source || DEFAULT_GAME_SOURCE, document.baseURI).href;
        iframe.title = 'N번째 플레이어 게임';
        iframe.loading = 'eager';
        iframe.referrerPolicy = 'strict-origin';
        iframe.allow = 'fullscreen; gamepad';
        iframe.allowFullscreen = true;
        iframe.tabIndex = -1;
        iframe.addEventListener('load', () => this.#markReady());
        this.#frame = iframe;
        this.append(iframe);
    }

    /**
     * 프레임의 다음 기하와 전환 값을 CSS 변수로 반영합니다.
     * @param {{x?: string|number, y?: string|number, width?: string|number,
     * height?: string|number, scale?: number, opacity?: number,
     * radius?: string|number, duration?: string|number, easing?: string}} [layout]
     * @returns {NthPlayerGameFrame} 연속 호출용 현재 프레임입니다.
     */
    setLayout(layout = {}) {
        const rootStyle = document.documentElement.style;
        setOptionalProperty(rootStyle, '--game-frame-x', layout.x, toCssLength);
        setOptionalProperty(rootStyle, '--game-frame-y', layout.y, toCssLength);
        setOptionalProperty(rootStyle, '--game-frame-width', layout.width, toCssLength);
        setOptionalProperty(rootStyle, '--game-frame-height', layout.height, toCssLength);
        setOptionalProperty(rootStyle, '--game-frame-scale', layout.scale);
        setOptionalProperty(rootStyle, '--game-frame-opacity', layout.opacity);
        setOptionalProperty(rootStyle, '--game-frame-radius', layout.radius, toCssLength);
        setOptionalProperty(
            rootStyle,
            '--game-frame-duration',
            layout.duration,
            (value) => typeof value === 'number' ? `${value}ms` : String(value)
        );
        setOptionalProperty(rootStyle, '--game-frame-easing', layout.easing);
        return this;
    }

    /**
     * 현재 iframe을 다시 로드하지 않고 지정된 상자로 드러냅니다.
     * @param {object} [layout] setLayout과 같은 기하·전환 값입니다.
     * @returns {NthPlayerGameFrame} 현재 프레임입니다.
     */
    show(layout = {}) {
        this.setLayout({ ...layout, opacity: layout.opacity ?? 1 });
        this.dataset.interactive = 'true';
        this.inert = false;
        this.setAttribute('aria-hidden', 'false');
        if (this.#frame) {
            this.#frame.tabIndex = 0;
        }
        return this;
    }

    /**
     * 게임 상태는 유지한 채 프레임을 투명하게 만들고 입력 대상에서 제외합니다.
     * @param {{duration?: string|number, easing?: string}} [transition]
     * @returns {NthPlayerGameFrame} 현재 프레임입니다.
     */
    hide(transition = {}) {
        this.setLayout({ ...transition, opacity: 0 });
        this.dataset.interactive = 'false';
        this.inert = true;
        this.setAttribute('aria-hidden', 'true');
        if (this.#frame) {
            this.#frame.tabIndex = -1;
        }
        return this;
    }

    #markReady() {
        this.dataset.loadState = 'ready';
        document.documentElement.dataset.gameLoadState = 'ready';
        this.#resolveReady?.(this.#frame);
        this.#resolveReady = null;
        this.dispatchEvent(new CustomEvent('nthplayer:game-ready', {
            bubbles: true,
            detail: { source: this.#frame?.src || null },
        }));
    }
}

customElements.define('nthplayer-game-frame', NthPlayerGameFrame);

const gameFrame = document.querySelector('#nthplayer-game');
const fullscreenButton = document.querySelector('#prototype-fullscreen');
const fullscreenButtonIcon = fullscreenButton.querySelector('span');
const fullscreenButtonLabel = fullscreenButton.querySelector('b');
const stage = document.querySelector('#presentation-stage');
const deck = new PresentationDeck(stage);
let prototypeActive = false;
let prototypeExpanded = false;
let prototypeLayoutFrame = 0;
document.documentElement.dataset.gameLoadState = 'loading';

/** 현재 프로토타입 슬롯의 기하에 게임 iframe을 맞춥니다. */
function fitGameToPrototypeSlot() {
    prototypeLayoutFrame = 0;
    if (!prototypeActive || prototypeExpanded) {
        return;
    }

    const slot = document.querySelector('.slide.is-active [data-game-slot]');
    if (!slot) {
        return;
    }

    const rect = slot.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
        return;
    }

    gameFrame.show({
        x: rect.left + (rect.width / 2),
        y: rect.top + (rect.height / 2),
        width: rect.width,
        height: rect.height,
        scale: 1,
        radius: 2,
        duration: PROTOTYPE_TRANSITION_MS,
        easing: EASE_OUT_EXPO,
    });
}

/** 다음 애니메이션 프레임에 프로토타입 슬롯 배치를 다시 계산합니다. */
function requestPrototypeLayout() {
    if (prototypeLayoutFrame) {
        cancelAnimationFrame(prototypeLayoutFrame);
    }
    prototypeLayoutFrame = requestAnimationFrame(() => {
        requestAnimationFrame(fitGameToPrototypeSlot);
    });
}

/** 프로토타입 iframe을 0.6초 easeOutExpo로 뷰포트 전체에 확장합니다. */
function expandPrototypeGame() {
    if (!prototypeActive || prototypeExpanded) {
        return;
    }
    prototypeExpanded = true;
    document.body.classList.add('is-game-expanded');
    fullscreenButton.setAttribute('aria-pressed', 'true');
    fullscreenButtonIcon.textContent = '↙';
    fullscreenButtonLabel.textContent = '축소';
    gameFrame.show({
        x: '50%',
        y: '50%',
        width: '100vw',
        height: '100vh',
        scale: 1,
        radius: 0,
        duration: PROTOTYPE_TRANSITION_MS,
        easing: EASE_OUT_EXPO,
    });
}

/** 전체 화면 프로토타입을 원래 슬라이드 슬롯으로 되돌립니다. */
function collapsePrototypeGame() {
    if (!prototypeExpanded) {
        return;
    }
    prototypeExpanded = false;
    document.body.classList.remove('is-game-expanded');
    fullscreenButton.setAttribute('aria-pressed', 'false');
    fullscreenButtonIcon.textContent = '↗';
    fullscreenButtonLabel.textContent = '전체화면';
    requestPrototypeLayout();
}

/** @param {KeyboardEvent} event - 부모 또는 게임 문서에서 발생한 키 입력입니다. */
function handlePrototypeEscape(event) {
    if (event.key !== 'Escape' || !prototypeExpanded) {
        return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    collapsePrototypeGame();
}

/** @param {HTMLIFrameElement} frame - 키 입력을 연결할 게임 iframe입니다. */
function installGameKeyboardBridge(frame) {
    try {
        frame.contentWindow?.addEventListener('keydown', handlePrototypeEscape, true);
    } catch {
        // 배포 경로가 동일 출처가 아닐 때도 부모 문서의 Escape 동작은 유지합니다.
    }
}

/** @param {CustomEvent} event - 발표 덱의 활성 슬라이드 변경 이벤트입니다. */
function handleSlideChange(event) {
    prototypeActive = Boolean(event.detail?.slide?.matches('[data-prototype-slide]'));
    document.body.classList.toggle('is-prototype-active', prototypeActive);
    fullscreenButton.hidden = !prototypeActive;

    if (prototypeActive) {
        requestPrototypeLayout();
        return;
    }

    prototypeExpanded = false;
    document.body.classList.remove('is-game-expanded');
    fullscreenButton.setAttribute('aria-pressed', 'false');
    fullscreenButtonIcon.textContent = '↗';
    fullscreenButtonLabel.textContent = '전체화면';
    gameFrame.hide({ duration: PROTOTYPE_TRANSITION_MS, easing: EASE_OUT_EXPO });
}

stage.addEventListener('nthplayer:slide-change', handleSlideChange);
fullscreenButton.addEventListener('click', () => {
    if (prototypeExpanded) {
        collapsePrototypeGame();
        return;
    }
    expandPrototypeGame();
});
document.addEventListener('keydown', handlePrototypeEscape, true);
window.addEventListener('resize', requestPrototypeLayout);
gameFrame.addEventListener('nthplayer:game-ready', () => {
    if (gameFrame.frame) {
        installGameKeyboardBridge(gameFrame.frame);
    }
});
gameFrame.ready.then(installGameKeyboardBridge);

deck.connect();

Object.defineProperty(window, 'nthPlayerPresentation', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({
        deck,
        gameFrame,
        ready: gameFrame.ready,
        setGameLayout: (layout) => gameFrame.setLayout(layout),
        showGame: (layout) => gameFrame.show(layout),
        hideGame: (transition) => gameFrame.hide(transition),
        expandGame: expandPrototypeGame,
        collapseGame: collapsePrototypeGame,
    }),
});
