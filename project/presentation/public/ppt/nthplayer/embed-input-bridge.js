(() => {
    const PAUSE_GAME_BGM_MESSAGE = 'nthplayer:presentation-pause-bgm';
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

    document.documentElement.dataset.embedPointerMode = 'native';
    document.documentElement.dataset.embedPointerState = 'idle';
    document.addEventListener('pointerlockchange', () => {
        document.documentElement.dataset.embedPointerState = document.pointerLockElement
            ? 'locked'
            : 'released';
    });
    document.addEventListener('pointerlockerror', () => {
        document.documentElement.dataset.embedPointerState = 'error';
    });
})();
