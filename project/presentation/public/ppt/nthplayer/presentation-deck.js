const EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';
const TRANSITION_GUARD_MS = 480;
const SLIDE_TRANSITION_MS = 920;

/**
 * 단일 클릭과 키보드 입력을 슬라이드·카메라 상태 전환으로 연결합니다.
 */
export class PresentationDeck {
    #announcer;
    #currentIndex = 0;
    #lastTransitionAt = Number.NEGATIVE_INFINITY;
    #root;
    #slides;
    #statusCurrent;
    #statusTotal;

    /**
     * @param {HTMLElement} root - 슬라이드가 들어 있는 발표 루트입니다.
     */
    constructor(root) {
        this.#root = root;
        this.#slides = [...root.querySelectorAll('[data-slide]')];
        this.#announcer = document.querySelector('#slide-announcer');
        this.#statusCurrent = document.querySelector('.deck-status__current');
        this.#statusTotal = document.querySelector('.deck-status__total');
    }

    /** 발표 입력을 연결하고 첫 장면 상태를 적용합니다. */
    connect() {
        document.addEventListener('click', (event) => this.#handleClick(event));
        document.addEventListener('keydown', (event) => this.#handleKeydown(event));
        window.addEventListener('popstate', () => this.#readHash());
        this.#statusTotal.textContent = this.#formatNumber(this.#slides.length);
        this.#readHash({ announce: false });
    }

    /**
     * 지정한 슬라이드로 이동합니다.
     * @param {number} index - 0부터 시작하는 슬라이드 순서입니다.
     * @param {{announce?:boolean, updateHistory?:boolean}} [options] - 부가 동작입니다.
     */
    goTo(index, { announce = true, updateHistory = true } = {}) {
        const nextIndex = Math.min(this.#slides.length - 1, Math.max(0, Number(index) || 0));
        if (nextIndex === this.#currentIndex && this.#slides[nextIndex]?.classList.contains('is-active')) {
            const activeSlide = this.#slides[nextIndex];
            this.#applyCamera(activeSlide);
            this.#updateStatus();
            this.#dispatchSlideChange(activeSlide);
            return;
        }

        this.#currentIndex = nextIndex;
        this.#slides.forEach((slide, slideIndex) => {
            const isActive = slideIndex === nextIndex;
            slide.classList.toggle('is-active', isActive);
            slide.classList.toggle('is-before', slideIndex < nextIndex);
            slide.classList.toggle('is-after', slideIndex > nextIndex);
            slide.setAttribute('aria-hidden', String(!isActive));
        });

        const activeSlide = this.#slides[nextIndex];
        this.#applyCamera(activeSlide);
        this.#pulseTransition();
        this.#updateStatus();
        this.#dispatchSlideChange(activeSlide);

        if (updateHistory) {
            history.replaceState(null, '', `#${nextIndex + 1}`);
        }
        if (announce && this.#announcer) {
            const heading = activeSlide.querySelector('h1, h2')?.textContent?.trim() || '슬라이드';
            this.#announcer.textContent = `${nextIndex + 1}장. ${heading}`;
        }
    }

    /** 다음 슬라이드로 이동합니다. */
    next() {
        if (!this.#canTransition() || this.#currentIndex >= this.#slides.length - 1) {
            return;
        }
        this.goTo(this.#currentIndex + 1);
    }

    /** 이전 슬라이드로 이동합니다. */
    previous() {
        if (!this.#canTransition() || this.#currentIndex <= 0) {
            return;
        }
        this.goTo(this.#currentIndex - 1);
    }

    /** @param {HTMLElement} slide - 활성 슬라이드입니다. */
    #applyCamera(slide) {
        const style = document.documentElement.style;
        const cameraX = slide?.dataset.cameraX || '0vw';
        const cameraY = slide?.dataset.cameraY || '0vh';
        const numericX = Number.parseFloat(cameraX) || 0;
        const numericY = Number.parseFloat(cameraY) || 0;
        style.setProperty('--camera-x', cameraX);
        style.setProperty('--camera-y', cameraY);
        style.setProperty('--camera-scale', slide?.dataset.cameraScale || '1');
        style.setProperty('--camera-far-x', `${numericX * -0.05}vw`);
        style.setProperty('--camera-far-y', `${numericY * -0.05}vh`);
        style.setProperty('--camera-near-x', `${numericX * 0.045}vw`);
        style.setProperty('--camera-near-y', `${numericY * 0.04}vh`);
        document.body.dataset.tone = slide?.dataset.tone || 'ember';
    }

    /** @param {HTMLElement} slide - 새 활성 슬라이드입니다. */
    #dispatchSlideChange(slide) {
        this.#root.dispatchEvent(new CustomEvent('nthplayer:slide-change', {
            bubbles: true,
            detail: {
                index: this.#currentIndex,
                slide,
                total: this.#slides.length,
            },
        }));
    }

    /** @returns {boolean} 연속 오입력 방지 시간이 지났는지 반환합니다. */
    #canTransition() {
        const now = performance.now();
        if (now - this.#lastTransitionAt < TRANSITION_GUARD_MS) {
            return false;
        }
        this.#lastTransitionAt = now;
        return true;
    }

    /** @param {MouseEvent} event - 문서 클릭 이벤트입니다. */
    #handleClick(event) {
        if (event.defaultPrevented || event.button !== 0) {
            return;
        }
        if (event.composedPath().some((node) => (
            node instanceof Element && node.matches('button, a, input, textarea, select, iframe, [data-no-advance]')
        ))) {
            return;
        }
        this.next();
    }

    /** @param {KeyboardEvent} event - 문서 키보드 이벤트입니다. */
    #handleKeydown(event) {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }
        if (event.target instanceof Element
            && event.target.matches('button, a, input, textarea, select, [contenteditable="true"]')) {
            return;
        }
        if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(event.key)) {
            event.preventDefault();
            this.next();
            return;
        }
        if (['ArrowLeft', 'PageUp'].includes(event.key)) {
            event.preventDefault();
            this.previous();
            return;
        }
        if (event.key === 'Home') {
            event.preventDefault();
            this.goTo(0);
        }
        if (event.key === 'End') {
            event.preventDefault();
            this.goTo(this.#slides.length - 1);
        }
    }

    /** @param {{announce?:boolean}} [options] - 알림 여부입니다. */
    #readHash({ announce = true } = {}) {
        const requested = Number.parseInt(location.hash.slice(1), 10) - 1;
        this.goTo(Number.isFinite(requested) ? requested : 0, {
            announce,
            updateHistory: false,
        });
    }

    /** 장면 사이에 얇은 광량 베일을 한 번 통과시킵니다. */
    #pulseTransition() {
        document.body.classList.remove('is-transitioning');
        requestAnimationFrame(() => {
            document.body.classList.add('is-transitioning');
            window.setTimeout(
                () => document.body.classList.remove('is-transitioning'),
                SLIDE_TRANSITION_MS
            );
        });
    }

    /** 하단 진행 상태를 현재 슬라이드에 맞춥니다. */
    #updateStatus() {
        this.#statusCurrent.textContent = this.#formatNumber(this.#currentIndex + 1);
        document.documentElement.style.setProperty(
            '--deck-progress',
            `${((this.#currentIndex + 1) / this.#slides.length) * 100}%`
        );
    }

    /** @param {number} value - 표시할 정수입니다. @returns {string} 두 자리 숫자입니다. */
    #formatNumber(value) {
        return String(value).padStart(2, '0');
    }
}

export { EASE_OUT_EXPO };
