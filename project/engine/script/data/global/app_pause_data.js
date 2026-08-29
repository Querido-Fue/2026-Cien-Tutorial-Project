/**
 * 앱 레벨 일시정지 이유와 기본 정책 데이터입니다.
 */
export const APP_PAUSE_DATA = Object.freeze({
    REASONS: Object.freeze({
        APP_INACTIVE: 'app-inactive',
        POINTER_LOCK_RELEASED: 'pointer-lock-released'
    }),
    INACTIVE_POLICY: Object.freeze({
        keepLoopRunning: true,
        runFrameTimeUpdate: true,
        runFixedStep: false,
        runSoundUpdate: false,
        runAnimationUpdate: true,
        runInputUpdate: true,
        runUiUpdate: true,
        runOverlayUpdate: true,
        runObjectUpdate: false,
        runSceneUpdate: false,
        runDebugUpdate: true,
        pauseBgm: true,
        resetInputOnEnter: true,
        setMouseInactiveOnEnter: true
    }),
    POINTER_LOCK_RELEASED_POLICY: Object.freeze({
        keepLoopRunning: true,
        runFrameTimeUpdate: true,
        runFixedStep: false,
        runSoundUpdate: false,
        runAnimationUpdate: true,
        runInputUpdate: true,
        runUiUpdate: true,
        runOverlayUpdate: true,
        runObjectUpdate: false,
        runSceneUpdate: false,
        runDebugUpdate: true,
        pauseBgm: true,
        resetInputOnEnter: true,
        setMouseInactiveOnEnter: true
    })
});
