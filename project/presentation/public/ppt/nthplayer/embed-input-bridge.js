(() => {
    const PAUSE_GAME_BGM_MESSAGE = 'nthplayer:presentation-pause-bgm';
    let virtualPointerLockElement = null;
    let soundModulePromise = null;

    const pauseGameBgm = async () => {
        try {
            soundModulePromise ||= import('sound/sound_system.js');
            const { getSoundSystemInstance } = await soundModulePromise;
            getSoundSystemInstance()?.pauseBgm?.();
        } catch {
            soundModulePromise = null;
        }
    };

    window.addEventListener('message', (event) => {
        if (event.source !== window.parent
            || event.origin !== window.location.origin
            || event.data?.type !== PAUSE_GAME_BGM_MESSAGE) {
            return;
        }
        void pauseGameBgm();
    });

    Object.defineProperty(Document.prototype, 'pointerLockElement', {
        configurable: true,
        get() {
            return this === document ? virtualPointerLockElement : null;
        },
    });

    Object.defineProperty(Element.prototype, 'requestPointerLock', {
        configurable: true,
        value() {
            virtualPointerLockElement = this;
            document.documentElement.dataset.embedPointerState = 'locked';
            document.dispatchEvent(new Event('pointerlockchange'));
            return Promise.resolve();
        },
    });

    Object.defineProperty(Document.prototype, 'exitPointerLock', {
        configurable: true,
        value() {
            if (this !== document || !virtualPointerLockElement) {
                return;
            }
            virtualPointerLockElement = null;
            document.documentElement.dataset.embedPointerState = 'released';
            document.dispatchEvent(new Event('pointerlockchange'));
        },
    });

    Object.defineProperty(document, 'pointerLockElement', {
        configurable: true,
        get() {
            return virtualPointerLockElement;
        },
    });
    document.documentElement.requestPointerLock = Element.prototype.requestPointerLock;
    document.exitPointerLock = Document.prototype.exitPointerLock;
    const nativeHasFocus = document.hasFocus.bind(document);
    document.hasFocus = () => Boolean(virtualPointerLockElement) || nativeHasFocus();

    document.documentElement.dataset.embedPointerMode = 'virtual';
    document.documentElement.dataset.embedPointerState = 'idle';
})();
