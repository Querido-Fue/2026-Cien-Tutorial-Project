import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { TutorialCutsceneView } from '../project/engine/script/scene/tutorial/view/_tutorial_cutscene_view.js';
import { TutorialChangelogView } from '../project/engine/script/scene/tutorial/view/_tutorial_changelog_view.js';
import { TutorialGalleryView } from '../project/engine/script/scene/tutorial/view/_tutorial_gallery_view.js';
import { TutorialLoadingView } from '../project/engine/script/scene/tutorial/view/_tutorial_loading_view.js';
import { TutorialMenuView } from '../project/engine/script/scene/tutorial/view/_tutorial_menu_view.js';
import { TutorialPauseView } from '../project/engine/script/scene/tutorial/view/_tutorial_pause_view.js';
import { TutorialResultView } from '../project/engine/script/scene/tutorial/view/_tutorial_result_view.js';
import { TutorialStarterView } from '../project/engine/script/scene/tutorial/view/_tutorial_starter_view.js';
import { isTutorialRectWithinUi } from '../project/engine/script/scene/tutorial/view/_tutorial_nonbattle_view_helpers.js';
import { TUTORIAL_UI_LAYOUT_TOKENS } from '../project/engine/script/scene/tutorial/view/_tutorial_ui_layout_tokens.js';

const NOOP_RENDER_PORT = Object.freeze({
    render() {},
    renderGL() {},
    wrapText(text) {
        return [String(text)];
    }
});

const FONTS = Object.freeze({
    TITLE: '800 40px sans-serif',
    SUBTITLE: '600 24px sans-serif',
    HEADING: '700 28px sans-serif',
    BODY: '500 20px sans-serif',
    SMALL: '500 16px sans-serif',
    MONO: '600 16px monospace'
});

const COLORS = Object.freeze({
    UI: Object.freeze({
        Text: '#fff',
        Muted: '#aaa',
        Panel: '#222',
        PanelStrong: '#111',
        CardIconBackground: '#fff',
        Accent: '#0ff',
        Success: '#0f0',
        Danger: '#f00',
        OverlayDim: '#000'
    })
});

const VIEWPORTS = Object.freeze([
    Object.freeze({ name: '1280×720', WW: 1280, WH: 720, UIWW: 1280, UIOffsetX: 0 }),
    Object.freeze({ name: '1600×720', WW: 1600, WH: 720, UIWW: 1280, UIOffsetX: 160 }),
    Object.freeze({
        name: '최소 높이',
        WW: 1280,
        WH: 640,
        UIWW: 1137.7777777778,
        UIOffsetX: 71.1111111111
    })
]);

const CHOICES = Object.freeze([
    Object.freeze({ id: 'bow', label: '활과 화살', description: '원거리 공격' }),
    Object.freeze({ id: 'mascot-costume', label: '인형탈', description: '피해 감소' })
]);

const GALLERY_SECTIONS = Object.freeze([
    ['achievements', '업적', 'galleryBookmarkRedLeft'],
    ['lora-diary', '로라의 일기', 'galleryBookmarkYellowLeft'],
    ['developer-diary', '개발자의 일기', 'galleryBookmarkYellowRight'],
    ['endings', '엔딩', 'galleryBookmarkRedRight'],
    ['cutscenes', '컷씬', 'galleryBookmarkBlueRight']
].map(([id, title, bookmarkAssetKey], index) => Object.freeze({
    id,
    title,
    bookmarkAssetKey,
    selected: index === 0
})));

const GALLERY_ENTRIES = Object.freeze(Array.from({ length: 6 }, (_, index) => Object.freeze({
    id: 'achievement-' + String(index),
    kind: 'achievement',
    title: '업적 ' + String(index + 1),
    secondary: 'Achievement ' + String(index + 1),
    body: '간단 설명 미확정',
    unlocked: index % 2 === 0,
    playable: false,
    replayCutsceneId: null
})));

const CHANGELOG_ENTRIES = Object.freeze(Array.from({ length: 10 }, (_, index) => Object.freeze({
    version: `0830_0${String(index).padStart(3, '0')}`,
    commit: String(index).padStart(7, '0'),
    summary: `게임 화면과 전투 시스템 개선 ${index + 1}`
})));

/**
 * 공통 표시값을 포함한 뷰 모델을 만듭니다.
 * @param {object} viewport - 검사할 뷰포트입니다.
 * @param {object} values - 화면별 값입니다.
 * @returns {object} 뷰 모델입니다.
 */
function createViewModel(viewport, values = {}) {
    return {
        viewport,
        fonts: FONTS,
        colors: COLORS,
        ...values
    };
}

test('비전투 화면의 핵심 콘텐츠와 버튼은 세 기준 화면의 UI 영역 안에 있다', () => {
    const loadingView = new TutorialLoadingView(NOOP_RENDER_PORT);
    const menuView = new TutorialMenuView(NOOP_RENDER_PORT);
    const changelogView = new TutorialChangelogView(NOOP_RENDER_PORT);
    const starterView = new TutorialStarterView(NOOP_RENDER_PORT);
    const pauseView = new TutorialPauseView(NOOP_RENDER_PORT);
    const galleryView = new TutorialGalleryView(NOOP_RENDER_PORT);
    const resultView = new TutorialResultView(NOOP_RENDER_PORT);
    const cutsceneView = new TutorialCutsceneView(NOOP_RENDER_PORT);

    for (const viewport of VIEWPORTS) {
        const cases = [
            [loadingView, createViewModel(viewport, { message: '로딩' })],
            [menuView, createViewModel(viewport, {
                title: 'N번째 플레이어',
                subtitle: '프로토타입',
                playCount: 1,
                releaseVersion: '0830_0500'
            })],
            [changelogView, createViewModel(viewport, {
                version: '0830_0500',
                entries: CHANGELOG_ENTRIES,
                page: 0
            })],
            [starterView, createViewModel(viewport, {
                choices: CHOICES,
                selectedIndex: 0,
                selectionProgress: 1,
                selectionMinScale: 0.72
            })],
            [pauseView, createViewModel(viewport, { selectedIndex: 0 })],
            [galleryView, createViewModel(viewport, {
                sections: GALLERY_SECTIONS,
                selectedSectionIndex: 0,
                selectedSectionId: 'achievements',
                selectedSectionTitle: '업적',
                entries: GALLERY_ENTRIES,
                selectedIndex: 0,
                selectedEntry: GALLERY_ENTRIES[0],
                selectionProgress: 1,
                selectionMinScale: 0.72
            })],
            [resultView, createViewModel(viewport, {
                result: {
                    displayName: '완벽주의자',
                    endingId: 'true',
                    neutralized: false,
                    reason: 'turn-limit',
                    loraActionsCompleted: 12,
                    instability: 20
                },
                presentationLocked: false
            })],
            [cutsceneView, createViewModel(viewport, {
                state: {
                    title: '컷씬',
                    cardIndex: 0,
                    cardCount: 1,
                    hasNextCard: false
                },
                card: { speaker: '로라', text: '테스트 카드' },
                presentationLocked: false
            })]
        ];

        for (const [view, viewModel] of cases) {
            const layout = view.getLayout(viewModel);
            const buttonSpecs = view.getButtonSpecs(viewModel);
            for (const rect of [...layout.contentRects, ...buttonSpecs]) {
                assert.equal(
                    isTutorialRectWithinUi(rect, viewport),
                    true,
                    `${viewport.name} ${view.constructor.name} 영역이 화면 밖입니다: ${JSON.stringify(rect)}`
                );
            }
            assert.doesNotThrow(() => JSON.stringify(buttonSpecs));
        }
    }
});

test('메인 메뉴는 타이틀과 버튼 외 안내 문구·카메라 오버레이를 그리지 않는다', () => {
    const requestedAssetKeys = [];
    const renderCommands = [];
    const renderPort = {
        render(layer, command) {
            renderCommands.push({ layer, command });
        },
        renderGL() {},
        wrapText: NOOP_RENDER_PORT.wrapText
    };
    const assetPort = {
        getUiAsset(key) {
            requestedAssetKeys.push(key);
            return key === 'mainTitle' ? { width: 360, height: 180 } : null;
        }
    };
    const view = new TutorialMenuView(renderPort, assetPort);

    view.draw(createViewModel(VIEWPORTS[0], {
        title: 'N번째 플레이어',
        subtitle: '프로토타입',
        playCount: 5,
        releaseVersion: '0830_0500'
    }));

    assert.deepEqual(requestedAssetKeys, ['mainTitle']);
    assert.deepEqual(renderCommands
        .filter(({ command }) => command.shape === 'text')
        .map(({ command }) => command.text), ['ver 0830_0500']);
    const buttons = view.getButtonSpecs(createViewModel(VIEWPORTS[0], {
        canContinue: false
    }));
    assert.deepEqual(buttons.map((button) => button.key), [
        'menu-continue',
        'menu-start',
        'menu-gallery',
        'menu-changelog'
    ]);
    assert.equal(buttons[0].enabled, false);
    assert.equal(buttons.every((button) => button.fitHitToBackground === true), true);
    assert.equal(buttons.every((button) => button.drawSolidBackground === false), true);
    assert.equal(buttons[3].fontScale, 0.72);

    const layout = view.getLayout(createViewModel(VIEWPORTS[0]));
    const logoCenterX = layout.logo.x + (layout.logo.w * 0.5);
    const baseButtonWidth = Math.round(
        TUTORIAL_UI_LAYOUT_TOKENS.MAIN.BUTTON_GROUP.w * VIEWPORTS[0].UIWW
    );
    for (const button of layout.buttons) {
        const buttonCenterX = button.x + (button.w * 0.5);
        assert.ok(Math.abs(buttonCenterX - logoCenterX) <= 1);
        assert.ok(Math.abs(
            (button.w / baseButtonWidth)
            - TUTORIAL_UI_LAYOUT_TOKENS.MAIN.BUTTON_SCALE
        ) <= 0.01);
    }
});

test('체인지로그는 Git 기반 한글 기록을 책 양쪽 페이지에 나누어 표시한다', () => {
    const renderCommands = [];
    const view = new TutorialChangelogView({
        ...NOOP_RENDER_PORT,
        render(layer, command) {
            renderCommands.push({ layer, command });
        }
    });
    const viewModel = createViewModel(VIEWPORTS[0], {
        version: '0830_0500',
        entries: CHANGELOG_ENTRIES,
        page: 0
    });

    assert.equal(view.getPageCount(viewModel), 2);
    view.draw(viewModel);
    const texts = renderCommands
        .filter(({ command }) => command.shape === 'text')
        .map(({ command }) => command.text);
    assert.ok(texts.includes('변경 내역'));
    assert.ok(texts.includes('현재 ver 0830_0500'));
    assert.ok(texts.some((text) => text.includes('게임 화면과 전투 시스템 개선')));
    assert.deepEqual(
        view.getButtonSpecs(viewModel).map((button) => button.key),
        ['changelog-prev', 'changelog-next', 'changelog-back']
    );
});

test('스타터 카드와 Pause 메뉴는 보이는 영역 자체를 클릭 계약으로 사용한다', () => {
    const starter = new TutorialStarterView(NOOP_RENDER_PORT);
    const starterModel = createViewModel(VIEWPORTS[0], {
        choices: CHOICES,
        selectedIndex: 0,
        selectionProgress: 1,
        selectionMinScale: 0.72
    });
    const starterLayout = starter.getLayout(starterModel);
    const starterButtons = starter.getButtonSpecs(starterModel);
    assert.equal(starterButtons.length, 2);
    assert.deepEqual(
        starterButtons.map(({ x, y, w, h }) => ({ x, y, w, h })),
        starterLayout.cards.map(({ x, y, w, h }) => ({ x, y, w, h }))
    );
    assert.equal(starterButtons.every((button) => button.drawBackground === false), true);
    assert.equal(starterButtons.every((button) => button.label === ''), true);

    const pause = new TutorialPauseView(NOOP_RENDER_PORT);
    const pauseButtons = pause.getButtonSpecs(createViewModel(VIEWPORTS[0], {
        selectedIndex: 1
    }));
    assert.deepEqual(pauseButtons.map((button) => button.command.type), [
        'tutorial/resume',
        'tutorial/restart',
        'tutorial/return-menu'
    ]);
    assert.equal(pauseButtons[1].active, true);
});

test('스타터 카드는 별도 버튼 패널 없이 불투명 프레임과 흰 아이콘 배경을 그린다', () => {
    const starterCard = { width: 143, height: 206 };
    const bowIcon = { width: 48, height: 48 };
    const mascotIcon = { width: 48, height: 48 };
    const renderCommands = [];
    const renderGlCommands = [];
    const renderPort = {
        render(layer, command) {
            renderCommands.push({ layer, command });
        },
        renderGL(layer, command) {
            renderGlCommands.push({ layer, command });
        },
        wrapText() {
            return ['첫째 줄', '둘째 줄', '셋째 줄'];
        }
    };
    const assetPort = {
        getUiAsset(key) {
            return key === 'starterCard' ? starterCard : null;
        },
        getItemIcon(id) {
            return id === 'bow' ? bowIcon : mascotIcon;
        }
    };
    const view = new TutorialStarterView(renderPort, assetPort);
    const viewModel = createViewModel(VIEWPORTS[0], {
        choices: CHOICES,
        selectedIndex: 0,
        selectionProgress: 1,
        selectionMinScale: 0.72
    });

    view.draw(viewModel);

    assert.deepEqual(renderGlCommands, []);
    const iconBackgrounds = renderCommands.filter(({ command }) => (
        command.shape === 'rect'
        && command.fill === COLORS.UI.CardIconBackground
    ));
    assert.equal(iconBackgrounds.length, 2);
    assert.equal(iconBackgrounds.every(({ command }) => command.alpha === 1), true);

    const frameCommands = renderCommands.filter(({ command }) => (
        command.image === starterCard
    ));
    const iconCommands = renderCommands.filter(({ command }) => (
        command.image === bowIcon || command.image === mascotIcon
    ));
    assert.equal(frameCommands.length, 2);
    assert.equal(iconCommands.length, 2);
    assert.equal(frameCommands.every(({ command }) => command.alpha === 1), true);
    assert.equal(iconCommands.every(({ command }) => command.alpha === 1), true);

    const firstFrame = frameCommands[0].command;
    const descriptionToken = TUTORIAL_UI_LAYOUT_TOKENS.STARTER.CARD_DESCRIPTION;
    const descriptionTop = firstFrame.y + (firstFrame.h * descriptionToken.y);
    const descriptionBottom = descriptionTop + (firstFrame.h * descriptionToken.h);
    const firstDescriptionLines = renderCommands
        .filter(({ command }) => ['첫째 줄', '둘째 줄', '셋째 줄'].includes(command.text))
        .slice(0, 3)
        .map(({ command }) => command);
    assert.equal(firstDescriptionLines.length, 3);
    assert.ok(firstDescriptionLines[0].y >= descriptionTop);
    assert.ok(firstDescriptionLines[2].y <= descriptionBottom);
});

test('갤러리 책갈피와 결과 버튼은 Figma 관찰 좌표와 책 내부 흐름을 따른다', () => {
    const galleryModel = createViewModel(VIEWPORTS[0], {
        sections: GALLERY_SECTIONS,
        selectedSectionIndex: 0,
        selectedSectionId: 'achievements',
        selectedSectionTitle: '업적',
        entries: GALLERY_ENTRIES,
        selectedIndex: 0,
        selectedEntry: GALLERY_ENTRIES[0],
        selectionProgress: 1,
        selectionMinScale: 0.72
    });
    const gallery = new TutorialGalleryView(NOOP_RENDER_PORT);
    const galleryButtons = gallery.getButtonSpecs(galleryModel);
    const sectionButtons = galleryButtons.slice(0, 5);
    const bookmarkTokens = [
        ...TUTORIAL_UI_LAYOUT_TOKENS.GALLERY.LEFT_BOOKMARKS,
        ...TUTORIAL_UI_LAYOUT_TOKENS.GALLERY.RIGHT_BOOKMARKS
    ];
    assert.deepEqual(
        sectionButtons.map(({ x, y, w, h }) => ({ x, y, w, h })),
        bookmarkTokens.map((token) => ({
            x: Math.round(token.x * 1280),
            y: Math.round(token.y * 720),
            w: Math.round(token.w * 1280),
            h: Math.round(token.h * 720)
        }))
    );
    assert.equal(galleryButtons.some((button) => button.key === 'gallery-play'), false);
    assert.equal(
        galleryButtons.find((button) => button.key === 'gallery-prev').backgroundImageFlipX,
        true
    );
    assert.equal(
        galleryButtons.find((button) => button.key === 'gallery-back').fitHitToBackground,
        true
    );
    assert.deepEqual(
        ['gallery-prev', 'gallery-next', 'gallery-back'].map((key) => (
            galleryButtons.find((button) => button.key === key).label
        )),
        ['', '', '']
    );

    const playableEntry = {
        ...GALLERY_ENTRIES[0],
        kind: 'cutscene',
        playable: true,
        replayCutsceneId: 'opening'
    };
    const playableModel = createViewModel(VIEWPORTS[0], {
        ...galleryModel,
        entries: [playableEntry],
        selectedEntry: playableEntry
    });
    const playableLayout = gallery.getLayout(playableModel);
    const playButton = gallery.getButtonSpecs(playableModel).find(
        (button) => button.key === 'gallery-play'
    );
    assert.ok(playButton.w >= playableLayout.rightPage.w * 0.53);
    assert.ok(playButton.h >= playableLayout.rightPage.h * 0.1);
    assert.ok(Math.abs(
        playButton.x + (playButton.w * 0.5)
        - (playableLayout.rightPage.x + (playableLayout.rightPage.w * 0.5))
    ) < 0.001);

    const renderCommands = [];
    const galleryWithCapture = new TutorialGalleryView({
        ...NOOP_RENDER_PORT,
        render(layer, command) {
            renderCommands.push({ layer, command });
        }
    });
    const mediaModel = {
        ...galleryModel,
        selectedSectionId: 'cutscenes',
        selectedSectionTitle: '컷씬'
    };
    const galleryLayout = galleryWithCapture.getLayout(mediaModel);
    galleryWithCapture.draw(mediaModel);
    const pageText = renderCommands.find(({ command }) => command.text === '1/6').command;
    assert.equal(pageText.font, FONTS.SMALL);
    assert.equal(pageText.x, galleryLayout.pageIndicator.x + (galleryLayout.pageIndicator.w * 0.5));
    assert.equal(pageText.y, galleryLayout.pageIndicator.y + (galleryLayout.pageIndicator.h * 0.5));

    const result = new TutorialResultView(NOOP_RENDER_PORT);
    const resultButtons = result.getButtonSpecs(createViewModel(VIEWPORTS[0], {
        result: {},
        presentationLocked: false
    }));
    assert.equal(resultButtons[0].x, resultButtons[1].x);
    assert.equal(resultButtons[0].w, resultButtons[1].w);
    assert.ok(resultButtons[0].y + resultButtons[0].h < resultButtons[1].y);
    assert.equal(resultButtons.every((button) => button.fitHitToBackground), true);
});

test('비전투 뷰는 장면·모델·저장·명령 큐를 직접 import하지 않는다', async () => {
    const names = [
        '_tutorial_loading_view.js',
        '_tutorial_menu_view.js',
        '_tutorial_changelog_view.js',
        '_tutorial_pause_view.js',
        '_tutorial_starter_view.js',
        '_tutorial_gallery_view.js',
        '_tutorial_result_view.js',
        '_tutorial_cutscene_view.js'
    ];
    const sources = await Promise.all(names.map((name) => readFile(new URL(
        `../project/engine/script/scene/tutorial/view/${name}`,
        import.meta.url
    ), 'utf8')));
    const forbidden = [
        '_tutorial_scene.js',
        '_tutorial_battle_model.js',
        '_tutorial_meta_progress.js',
        'simulation_command_queue.js'
    ];
    for (const [index, source] of sources.entries()) {
        for (const dependency of forbidden) {
            assert.equal(
                source.includes(dependency),
                false,
                `${names[index]}가 ${dependency}에 직접 의존합니다.`
            );
        }
        assert.equal(
            (source.match(/export class /g) || []).length,
            1,
            `${names[index]}는 정확히 한 클래스를 내보내야 합니다.`
        );
    }
});
