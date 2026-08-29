/**
 * 소스 파일 책임 감사에 사용하는 기본 예산입니다.
 * 기존 부채 예산은 리팩터링 후 삭제하며 값을 늘리지 않습니다.
 */
export const SOURCE_RESPONSIBILITY_POLICY = Object.freeze({
    sourceRoots: Object.freeze([
        'project/engine/script',
        'scripts'
    ]),
    extensions: Object.freeze(['.js', '.mjs']),
    targetFileLines: 500,
    maximumFileLines: 700,
    maximumClassesPerFile: 1,
    exceptions: Object.freeze({
        'project/engine/script/data/game/tutorial_game_data.js': Object.freeze({
            maximumFileLines: 900,
            reason: '두 층 전투의 선언형 튜닝·콘텐츠 데이터 단일 원본입니다.'
        })
    }),
    legacyBudgets: Object.freeze({
        'project/engine/script/scene/tutorial/_tutorial_scene.js': Object.freeze({
            maximumFileLines: 1929
        }),
        'project/engine/script/scene/tutorial/_tutorial_battle_model.js': Object.freeze({
            maximumFileLines: 2185
        }),
        'project/engine/script/ui/layout/_layout_handler.js': Object.freeze({
            maximumFileLines: 1180
        }),
        'project/engine/script/scene/tutorial/view/_tutorial_battle_actor_view.js': Object.freeze({
            maximumFileLines: 1158
        }),
        'project/engine/script/scene/tutorial/view/_tutorial_battle_hud_view.js': Object.freeze({
            maximumFileLines: 800
        }),
        'project/engine/script/overlay/_diagnostic_test_overlay.js': Object.freeze({
            maximumFileLines: 944
        }),
        'project/engine/script/display/webgl/_overlay_effect_renderer.js': Object.freeze({
            maximumFileLines: 914
        }),
        'project/engine/script/scene/tutorial/_tutorial_combat_rules.js': Object.freeze({
            maximumFileLines: 753
        }),
        'project/engine/script/display/display_system.js': Object.freeze({
            maximumFileLines: 713
        }),
        'project/engine/script/overlay/_base_overlay.js': Object.freeze({
            maximumFileLines: 709
        }),
        'project/engine/script/util/_browser_file_system.js': Object.freeze({
            maximumClassesPerFile: 2
        })
    })
});
