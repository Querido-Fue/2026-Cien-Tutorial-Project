import { TUTORIAL_COMMANDS } from '../_tutorial_scene_constants.js';
import {
    TUTORIAL_DIALOGUE_PRESENTATION_DATA
} from '../../../data/game/tutorial_dialogue_presentation_data.js';
import {
    createTutorialTextAnchor,
    drawTutorialText,
    toTutorialUiHeight,
    wrapTutorialText
} from './_tutorial_nonbattle_view_helpers.js';
import { drawTutorialPixelAsset } from './_tutorial_asset_view_helpers.js';
import { TutorialDialogueTypewriter } from './_tutorial_dialogue_typewriter.js';

/**
 * 디자인 공간의 정규화 영역을 현재 UI 좌표로 변환합니다.
 * @param {object} viewport - 직렬화 가능한 뷰포트입니다.
 * @param {{x:number,y:number,w:number,h:number}} spec - 정규화된 영역입니다.
 * @returns {{x:number,y:number,w:number,h:number}} 화면 사각형입니다.
 */
function createDialogueRect(viewport, spec) {
    return {
        x: Number(viewport.UIOffsetX) + (Number(viewport.UIWW) * Number(spec.x)),
        y: Number(viewport.WH) * Number(spec.y),
        w: Number(viewport.UIWW) * Number(spec.w),
        h: Number(viewport.WH) * Number(spec.h)
    };
}

/**
 * 디자인 공간의 정규화 기준점을 현재 UI 좌표로 변환합니다.
 * @param {object} viewport - 직렬화 가능한 뷰포트입니다.
 * @param {{x:number,y:number}} spec - 정규화된 기준점입니다.
 * @returns {{x:number,y:number}} 화면 기준점입니다.
 */
function createDialoguePoint(viewport, spec) {
    return {
        x: Number(viewport.UIOffsetX) + (Number(viewport.UIWW) * Number(spec.x)),
        y: Number(viewport.WH) * Number(spec.y)
    };
}

/**
 * @class TutorialCutsceneView
 * @description 고정 컷씬 카드 모달의 표시와 진행 버튼 사양을 제공합니다.
 */
export class TutorialCutsceneView {
    #renderPort;
    #assetPort;
    #config;
    #typewriter;

    /**
     * @param {object} renderPort - 주입된 렌더 의존성입니다.
     * @param {object|null} [assetPort=null] - 논리 UI 에셋 조회 포트입니다.
     * @param {object} [options={}] - 대화 표현 데이터와 교체 가능한 타이핑 상태입니다.
     */
    constructor(renderPort, assetPort = null, {
        config = TUTORIAL_DIALOGUE_PRESENTATION_DATA,
        typewriter = null
    } = {}) {
        this.#renderPort = renderPort;
        this.#assetPort = assetPort;
        this.#config = config;
        this.#typewriter = typewriter || new TutorialDialogueTypewriter({
            characterIntervalSeconds: config.CHARACTER_INTERVAL_SECONDS
        });
    }

    /**
     * 컷씬 모달의 순수 레이아웃을 계산합니다.
     * @param {object} viewModel - 컷씬 뷰 모델입니다.
     * @returns {object} 모달·텍스트·버튼 레이아웃입니다.
     */
    getLayout(viewModel) {
        const { viewport } = viewModel;
        const layoutData = this.#config.LAYOUT;
        const bubble = createDialogueRect(viewport, layoutData.BUBBLE);
        const title = createDialoguePoint(viewport, layoutData.TITLE);
        const progress = createDialoguePoint(viewport, layoutData.PROGRESS);
        return {
            modal: bubble,
            bubble,
            title,
            progress,
            contentRects: [
                bubble,
                createTutorialTextAnchor(title.x, title.y),
                createTutorialTextAnchor(progress.x, progress.y)
            ],
            buttons: [
                createDialogueRect(viewport, layoutData.NEXT_BUTTON),
                createDialogueRect(viewport, layoutData.SKIP_BUTTON)
            ]
        };
    }

    /**
     * 현재 카드의 타이핑 진행도를 갱신합니다.
     * @param {object|null} viewModel - 컷씬 뷰 모델 또는 닫힌 상태의 null입니다.
     * @param {number} deltaSeconds - 가변 프레임 델타입니다.
     * @returns {Readonly<object>} 갱신된 타이핑 스냅샷입니다.
     */
    update(viewModel, deltaSeconds) {
        return this.#typewriter.update(
            this.#createDialogueState(viewModel),
            deltaSeconds
        );
    }

    /**
     * 타이핑 중인 현재 문장을 먼저 전부 표시합니다.
     * @param {object} viewModel - 현재 컷씬 뷰 모델입니다.
     * @returns {boolean} 새로 공개한 글자가 있으면 true입니다.
     */
    revealAll(viewModel) {
        return this.#typewriter.revealAll(this.#createDialogueState(viewModel));
    }

    /** 닫힌 컷씬의 타이핑 상태를 비웁니다. */
    reset() {
        this.#typewriter.reset();
    }

    /**
     * 현재 컷씬 카드를 모달로 그립니다.
     * @param {object} viewModel - 읽기 전용 컷씬 상태입니다.
     */
    draw(viewModel) {
        const layout = this.getLayout(viewModel);
        const { viewport, colors, fonts, state, card } = viewModel;
        const textPresentation = this.#typewriter.sync(
            this.#createDialogueState(viewModel)
        );
        this.#renderPort.render('ui', {
            shape: 'rect',
            x: 0,
            y: 0,
            w: viewport.WW,
            h: viewport.WH,
            fill: colors.UI.OverlayDim,
            alpha: 0.78
        });
        const bubbleImage = this.#assetPort?.getUiAsset?.(
            this.#config.BUBBLE_ASSET_KEY
        ) || null;
        if (!drawTutorialPixelAsset(this.#renderPort, {
            image: bubbleImage,
            rect: layout.bubble,
            layer: 'ui'
        })) {
            this.#renderPort.render('ui', {
                shape: 'roundRect',
                x: layout.bubble.x,
                y: layout.bubble.y,
                w: layout.bubble.w,
                h: layout.bubble.h,
                radius: toTutorialUiHeight(viewport, 1),
                fill: colors.UI.CardIconBackground,
                alpha: 0.98
            });
        }
        drawTutorialText(this.#renderPort, {
            text: state.title,
            x: layout.title.x,
            y: layout.title.y,
            font: fonts.HEADING,
            fill: colors.UI.Text,
            align: 'center'
        });
        drawTutorialText(this.#renderPort, {
            text: String(state.cardIndex + 1) + ' / ' + String(state.cardCount),
            x: layout.progress.x,
            y: layout.progress.y,
            font: fonts.MONO,
            fill: colors.UI.Muted,
            align: 'right'
        });
        const content = this.#config.BUBBLE_CONTENT;
        const textX = layout.bubble.x + (layout.bubble.w * content.LEFT_RATIO);
        drawTutorialText(this.#renderPort, {
            text: card.speaker || '',
            x: textX,
            y: layout.bubble.y + (layout.bubble.h * content.SPEAKER_Y_RATIO),
            font: fonts.BODY,
            fill: colors.UI.Primary
        });
        const lines = wrapTutorialText(
            this.#renderPort,
            textPresentation.visibleText,
            fonts.BODY,
            layout.bubble.w * (1 - content.LEFT_RATIO - content.RIGHT_RATIO),
            this.#config.MAX_TEXT_LINES
        );
        lines.forEach((line, index) => {
            drawTutorialText(this.#renderPort, {
                text: line,
                x: textX,
                y: layout.bubble.y + (layout.bubble.h * content.TEXT_Y_RATIO)
                    + (index * toTutorialUiHeight(
                        viewport,
                        this.#config.TEXT_LINE_HEIGHT_WH
                    )),
                font: fonts.BODY,
                fill: colors.UI.GaugeValue
            });
        });
    }

    /**
     * 컷씬 진행과 닫기 명령 버튼 사양을 반환합니다.
     * @param {object} viewModel - 컷씬 뷰 모델입니다.
     * @returns {object[]} 직렬화 가능한 버튼 사양입니다.
     */
    getButtonSpecs(viewModel) {
        const layout = this.getLayout(viewModel);
        return [
            {
                key: 'cutscene-next',
                ...layout.buttons[0],
                label: viewModel.state.hasNextCard
                    ? '다음  [Enter]'
                    : '완료  [Enter]',
                enabled: !viewModel.presentationLocked,
                command: { type: TUTORIAL_COMMANDS.CUTSCENE_NEXT }
            },
            {
                key: 'cutscene-close',
                ...layout.buttons[1],
                label: '스킵  [Esc]',
                enabled: !viewModel.presentationLocked,
                command: { type: TUTORIAL_COMMANDS.CUTSCENE_CLOSE }
            }
        ];
    }

    /**
     * 뷰 모델을 타이핑 상태가 소비할 작은 카드 식별자로 변환합니다.
     * @param {object|null} viewModel - 현재 컷씬 뷰 모델입니다.
     * @returns {{key:string,text:string}|null} 타이핑 대상 또는 null입니다.
     * @private
     */
    #createDialogueState(viewModel) {
        if (!viewModel?.card || viewModel?.state?.open === false) {
            return null;
        }
        const state = viewModel.state || {};
        return {
            key: [
                String(state.cutsceneId || state.title || 'cutscene'),
                String(Number(state.cardIndex) || 0)
            ].join(':'),
            text: String(viewModel.card.text || '')
        };
    }
}
