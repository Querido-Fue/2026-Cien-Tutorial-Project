import { EASE_OUT_EXPO, PresentationDeck } from './presentation-deck.js?v=3';
import { PlayerPathOverlay } from './player-path-overlay.js?v=1';

const DEFAULT_GAME_SOURCE = '/game/nthplayer/';
const PROTOTYPE_TRANSITION_MS = 600;
const SNAPSHOT_MAX_WIDTH = 1280;

const toCssLength = (value) => (
    typeof value === 'number' ? `${value}px` : String(value)
);

const setOptionalProperty = (style, name, value, transform = String) => {
    if (value === undefined || value === null) {
        return;
    }
    style.setProperty(name, transform(value));
};

const wait = (milliseconds) => new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
});

/**
 * 게임 문서를 한 번만 로드하고 정지 화면과 실제 iframe의 수명을 함께 관리합니다.
 */
class NthPlayerGameFrame extends HTMLElement {
    #frame = null;
    #resolveReady;
    #ready;
    #snapshot = null;
    #snapshotUrl = null;

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

    /** 게임 iframe과 정지 화면 레이어를 최초 연결 시 한 번만 생성합니다. */
    connectedCallback() {
        if (this.#frame) {
            return;
        }

        this.dataset.loadState = 'loading';
        this.dataset.interactive = 'false';
        this.dataset.frozen = 'false';
        this.dataset.cssMotion = 'false';
        this.inert = true;

        const iframe = document.createElement('iframe');
        iframe.src = new URL(this.dataset.source || DEFAULT_GAME_SOURCE, document.baseURI).href;
        iframe.title = 'N번째 플레이어 게임';
        iframe.loading = 'eager';
        iframe.referrerPolicy = 'strict-origin';
        iframe.allow = 'fullscreen; gamepad; pointer-lock';
        iframe.allowFullscreen = true;
        iframe.tabIndex = -1;
        iframe.addEventListener('load', () => this.#markReady());

        const snapshot = document.createElement('img');
        snapshot.className = 'game-frame-snapshot';
        snapshot.alt = '';
        snapshot.setAttribute('aria-hidden', 'true');

        this.#frame = iframe;
        this.#snapshot = snapshot;
        this.append(iframe, snapshot);
    }

    /** 정지 화면의 객체 URL을 정리합니다. */
    disconnectedCallback() {
        if (this.#snapshotUrl) {
            URL.revokeObjectURL(this.#snapshotUrl);
            this.#snapshotUrl = null;
        }
    }

    /**
     * 프레임의 다음 기하와 전환 값을 CSS 변수로 반영합니다.
     * @param {{x?: string|number, y?: string|number, width?: string|number,
     * height?: string|number, opacity?: number, radius?: string|number,
     * duration?: string|number, easing?: string}} [layout]
     * @returns {NthPlayerGameFrame} 연속 호출용 현재 프레임입니다.
     */
    setLayout(layout = {}) {
        const rootStyle = document.documentElement.style;
        setOptionalProperty(rootStyle, '--game-frame-x', layout.x, toCssLength);
        setOptionalProperty(rootStyle, '--game-frame-y', layout.y, toCssLength);
        setOptionalProperty(rootStyle, '--game-frame-width', layout.width, toCssLength);
        setOptionalProperty(rootStyle, '--game-frame-height', layout.height, toCssLength);
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
     * 실제 iframe을 다시 로드하지 않고 지정된 상자로 드러냅니다.
     * @param {object} [layout] setLayout과 같은 기하·전환 값입니다.
     * @returns {NthPlayerGameFrame} 현재 프레임입니다.
     */
    show(layout = {}) {
        this.setLayout({ ...layout, opacity: layout.opacity ?? 1 });
        this.dataset.interactive = 'true';
        this.inert = false;
        this.setAttribute('aria-hidden', 'false');
        this.#syncFrameTabIndex();
        return this;
    }

    /**
     * 게임 상태는 유지한 채 프레임을 숨기고 입력 대상에서 제외합니다.
     * @param {{duration?: string|number, easing?: string}} [transition]
     * @returns {NthPlayerGameFrame} 현재 프레임입니다.
     */
    hide(transition = {}) {
        this.setLayout({ ...transition, opacity: 0 });
        this.dataset.interactive = 'false';
        this.inert = true;
        this.setAttribute('aria-hidden', 'true');
        this.#syncFrameTabIndex();
        return this;
    }

    /** iframe의 현재 캔버스 합성 결과를 이미지로 저장합니다. */
    async captureSnapshot() {
        const frameDocument = this.#frame?.contentDocument;
        const frameWindow = this.#frame?.contentWindow;
        if (!frameDocument || !frameWindow || !this.#snapshot) {
            return false;
        }

        const viewportWidth = Math.max(1, Number(frameWindow.innerWidth) || this.clientWidth);
        const viewportHeight = Math.max(1, Number(frameWindow.innerHeight) || this.clientHeight);
        const outputWidth = Math.min(SNAPSHOT_MAX_WIDTH, Math.round(viewportWidth));
        const outputHeight = Math.max(1, Math.round(outputWidth * viewportHeight / viewportWidth));
        const scaleX = outputWidth / viewportWidth;
        const scaleY = outputHeight / viewportHeight;
        const captureCanvas = frameDocument.createElement('canvas');
        captureCanvas.width = outputWidth;
        captureCanvas.height = outputHeight;
        const context = captureCanvas.getContext('2d', { alpha: false });
        if (!context) {
            return false;
        }

        const background = frameWindow.getComputedStyle(frameDocument.body).backgroundColor;
        context.fillStyle = background && background !== 'rgba(0, 0, 0, 0)'
            ? background
            : '#050507';
        context.fillRect(0, 0, outputWidth, outputHeight);

        const canvases = [...frameDocument.querySelectorAll('canvas')]
            .map((canvas, order) => ({
                canvas,
                order,
                style: frameWindow.getComputedStyle(canvas),
            }))
            .filter(({ canvas, style }) => (
                canvas.width > 0
                && canvas.height > 0
                && style.display !== 'none'
                && style.visibility !== 'hidden'
                && Number.parseFloat(style.opacity || '1') > 0
            ))
            .sort((a, b) => {
                const zA = Number.parseInt(a.style.zIndex, 10) || 0;
                const zB = Number.parseInt(b.style.zIndex, 10) || 0;
                return zA === zB ? a.order - b.order : zA - zB;
            });

        let paintedCanvases = 0;
        canvases.forEach(({ canvas, style }) => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) {
                return;
            }
            try {
                context.globalAlpha = Math.min(1, Math.max(0, Number.parseFloat(style.opacity || '1')));
                context.drawImage(
                    canvas,
                    rect.left * scaleX,
                    rect.top * scaleY,
                    rect.width * scaleX,
                    rect.height * scaleY
                );
                paintedCanvases += 1;
            } catch {
                // 보안 설정 또는 WebGL 버퍼 정책으로 읽을 수 없는 표면만 건너뜁니다.
            }
        });
        context.globalAlpha = 1;

        if (paintedCanvases === 0) {
            return false;
        }

        const blob = await new Promise((resolve) => captureCanvas.toBlob(resolve, 'image/png'));
        if (!blob) {
            return false;
        }

        const nextUrl = URL.createObjectURL(blob);
        const previousUrl = this.#snapshotUrl;
        this.#snapshotUrl = nextUrl;
        this.#snapshot.src = nextUrl;
        await this.#snapshot.decode?.().catch(() => {});
        if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
        }
        return true;
    }

    /** 직전 게임 화면을 캡처하고 실제 iframe 합성을 잠시 멈춥니다. */
    async freeze() {
        const captured = await this.captureSnapshot();
        if (!captured) {
            return false;
        }
        this.dataset.frozen = 'true';
        this.#syncFrameTabIndex();
        return true;
    }

    /** 정지 화면을 실제 게임 iframe으로 다시 교체합니다. */
    resume() {
        this.dataset.frozen = 'false';
        this.#syncFrameTabIndex();
    }

    /** iframe의 포커스 가능 상태를 발표 상호작용 상태와 맞춥니다. */
    #syncFrameTabIndex() {
        if (!this.#frame) {
            return;
        }
        const interactive = this.dataset.interactive === 'true';
        const frozen = this.dataset.frozen === 'true';
        this.#frame.tabIndex = interactive && !frozen ? 0 : -1;
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
let prototypeSettleTimer = 0;
let prototypeTransitioning = false;
document.documentElement.dataset.gameLoadState = 'loading';
new PlayerPathOverlay(document.querySelector('[data-player-path-overlay]')).connect(stage);

/** @returns {object|null} 현재 프로토타입 슬롯의 화면 기하입니다. */
function getPrototypeSlotLayout() {
    const slot = document.querySelector('.slide.is-active [data-game-slot]');
    if (!slot) {
        return null;
    }

    const rect = slot.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
        return null;
    }

    return {
        x: rect.left + (rect.width / 2),
        y: rect.top + (rect.height / 2),
        width: rect.width,
        height: rect.height,
        radius: 0,
        opacity: 1,
    };
}

/** 현재 프로토타입 슬롯에 실제 게임 프레임을 맞춥니다. */
function fitGameToPrototypeSlot() {
    prototypeLayoutFrame = 0;
    if (!prototypeActive || prototypeExpanded || prototypeTransitioning) {
        return;
    }

    const layout = getPrototypeSlotLayout();
    if (!layout) {
        return;
    }
    gameFrame.dataset.cssMotion = 'false';
    gameFrame.show(layout);
    gameFrame.resume();
}

/** 다음 애니메이션 프레임에 프로토타입 슬롯 배치를 다시 계산합니다. */
function requestPrototypeLayout() {
    if (prototypeLayoutFrame) {
        cancelAnimationFrame(prototypeLayoutFrame);
    }
    window.clearTimeout(prototypeSettleTimer);
    prototypeLayoutFrame = requestAnimationFrame(() => {
        requestAnimationFrame(fitGameToPrototypeSlot);
    });
    prototypeSettleTimer = window.setTimeout(fitGameToPrototypeSlot, 980);
}

/** @param {boolean} expanded - 전체 화면 UI 상태입니다. */
function setExpandedUi(expanded) {
    document.body.classList.toggle('is-game-expanded', expanded);
    fullscreenButton.setAttribute('aria-pressed', String(expanded));
    fullscreenButtonIcon.textContent = expanded ? '↙' : '↗';
    fullscreenButtonLabel.textContent = expanded ? '축소' : '전체화면';
}

/**
 * 정지 화면을 합성 레이어에서 이동시킨 뒤 실제 iframe으로 되돌립니다.
 * @param {object} targetLayout - 최종 게임 프레임 기하입니다.
 * @param {boolean} expanded - 최종 전체 화면 상태입니다.
 */
async function transitionPrototypeGame(targetLayout, expanded) {
    if (prototypeTransitioning || !targetLayout) {
        return;
    }
    prototypeTransitioning = true;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frozen = await gameFrame.freeze();
    const applyTarget = () => {
        setExpandedUi(expanded);
        gameFrame.dataset.cssMotion = 'false';
        gameFrame.show({
            ...targetLayout,
            duration: reducedMotion ? 1 : PROTOTYPE_TRANSITION_MS,
            easing: EASE_OUT_EXPO,
        });
    };

    if (!reducedMotion && frozen && typeof document.startViewTransition === 'function') {
        try {
            const transition = document.startViewTransition(applyTarget);
            await transition.finished;
        } catch {
            applyTarget();
        }
    } else if (!reducedMotion && frozen) {
        gameFrame.dataset.cssMotion = 'true';
        gameFrame.getBoundingClientRect();
        setExpandedUi(expanded);
        gameFrame.show({
            ...targetLayout,
            duration: PROTOTYPE_TRANSITION_MS,
            easing: EASE_OUT_EXPO,
        });
        await wait(PROTOTYPE_TRANSITION_MS);
    } else {
        applyTarget();
    }

    gameFrame.dataset.cssMotion = 'false';
    if (prototypeActive) {
        gameFrame.resume();
    }
    prototypeTransitioning = false;
}

/** 프로토타입 게임을 0.6초 easeOutExpo로 뷰포트 전체에 확장합니다. */
async function expandPrototypeGame() {
    if (!prototypeActive || prototypeExpanded || prototypeTransitioning) {
        return;
    }
    prototypeExpanded = true;
    await transitionPrototypeGame({
        x: '50%',
        y: '50%',
        width: '100vw',
        height: '100vh',
        radius: 0,
        opacity: 1,
    }, true);
}

/** 전체 화면 프로토타입을 원래 슬라이드 슬롯으로 되돌립니다. */
async function collapsePrototypeGame() {
    if (!prototypeExpanded || prototypeTransitioning) {
        return;
    }
    const layout = getPrototypeSlotLayout();
    if (!layout) {
        return;
    }
    prototypeExpanded = false;
    await transitionPrototypeGame(layout, false);
}

/** @param {KeyboardEvent} event - 부모 또는 게임 문서에서 발생한 키 입력입니다. */
function handlePrototypeEscape(event) {
    if (event.key !== 'Escape' || !prototypeExpanded) {
        return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    void collapsePrototypeGame();
}

/** @param {HTMLIFrameElement} frame - 키와 포인터 잠금 경계를 연결할 게임 iframe입니다. */
function installGameKeyboardBridge(frame) {
    try {
        frame.contentWindow?.addEventListener('keydown', handlePrototypeEscape, true);
        frame.contentDocument?.addEventListener('pointerlockchange', () => {
            if (prototypeExpanded && !frame.contentDocument?.pointerLockElement) {
                void collapsePrototypeGame();
            }
        });
    } catch {
        // 동일 출처가 아닐 때도 부모 문서의 Escape 동작은 유지합니다.
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
    setExpandedUi(false);
    void gameFrame.freeze().finally(() => {
        gameFrame.hide({ duration: PROTOTYPE_TRANSITION_MS, easing: EASE_OUT_EXPO });
    });
}

stage.addEventListener('nthplayer:slide-change', handleSlideChange);
fullscreenButton.addEventListener('click', () => {
    if (prototypeExpanded) {
        void collapsePrototypeGame();
        return;
    }
    void expandPrototypeGame();
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
        captureGameSnapshot: () => gameFrame.captureSnapshot(),
        setGameLayout: (layout) => gameFrame.setLayout(layout),
        showGame: (layout) => gameFrame.show(layout),
        hideGame: (transition) => gameFrame.hide(transition),
        expandGame: expandPrototypeGame,
        collapseGame: collapsePrototypeGame,
    }),
});
