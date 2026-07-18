import { EngineApp } from 'engine/app/engine_app.js';
import { SystemHandler } from 'core/system_handler.js';
import { TutorialScene } from 'scene/tutorial/_tutorial_scene.js';
import { TimeHandler } from 'engine/time_handler.js';
import { MathUtil } from 'util/math_util.js';
import { ColorUtil } from 'util/color_util.js';
import { RuntimeTool } from 'util/runtime_tool.js';

let systemHandler;
let tutorialGame;

/**
 * 로라 전술 튜토리얼 프로토타입의 엔진 런타임을 초기화합니다.
 */
window.onload = async () => {
    try {
        new TimeHandler();
        new MathUtil();
        new ColorUtil();
        new RuntimeTool();

        const createTutorialScene = (sceneSystem) => new TutorialScene(sceneSystem);
        systemHandler = new SystemHandler({
            sceneSystem: {
                initialSceneState: 'active',
                initialSceneFactory: createTutorialScene,
                playSceneFactory: createTutorialScene
            }
        });
        await systemHandler.init();

        tutorialGame = new EngineApp(systemHandler);
        window.Game = tutorialGame;
        window.TutorialGame = tutorialGame;
        tutorialGame.start();
    } catch (error) {
        console.warn('로라 전술 튜토리얼 초기화 중 오류가 발생했습니다.\n', error);
    }
};

/**
 * 창 크기 변경을 현재 전술 씬과 디스플레이 시스템에 반영합니다.
 */
window.addEventListener('resize', () => {
    tutorialGame?.resize();
});
