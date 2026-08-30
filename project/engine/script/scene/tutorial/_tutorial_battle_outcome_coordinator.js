import { cloneValue, toList } from './_tutorial_value_utils.js';

/**
 * 모델 결과를 전투 표현·진행도·기록·컷씬 트리거 구독자에게 순서대로 배포합니다.
 */
export class TutorialBattleOutcomeCoordinator {
    /** @param {object} options - 결과 구독자와 작은 투영 포트입니다. */
    constructor(options = {}) {
        this.presenter = options.presenter;
        this.animationCoordinator = options.animationCoordinator;
        this.feedbackQueue = options.feedbackQueue;
        this.presentationTimeline = options.presentationTimeline;
        this.achievementEvaluator = options.achievementEvaluator;
        this.metaSession = options.metaSession;
        this.achievementBanner = options.achievementBanner;
        this.audioDirector = options.audioDirector;
        this.recordPopups = options.recordPopups;
        this.cutsceneTriggers = options.cutsceneTriggers;
        this.results = options.results;
        this.projectTile = options.projectTile;
        this.getFeedbackColors = options.getFeedbackColors;
        this.reset();
    }

    /** @param {object|null} [snapshot] 새 런의 최초 표현 기준 snapshot입니다. */
    reset(snapshot = null) {
        this.previousSnapshot = snapshot ? cloneValue(snapshot) : null;
    }

    /**
     * 한 모델 결과를 모든 구독자에게 동일 순서로 전달합니다.
     * @param {object} input - 결과, 다음 snapshot, 레이아웃과 현재 업적 목록입니다.
     * @returns {{cutsceneIds:readonly string[]}} 즉시 열 수 있는 일반 컷씬 ID입니다.
     */
    process(input = {}) {
        const result = input.result;
        const nextSnapshot = input.nextSnapshot;
        const events = result?.events;
        const cues = this.presenter.createCues({
            events,
            previousSnapshot: this.previousSnapshot || nextSnapshot,
            nextSnapshot,
            path: result?.ok === true ? result?.path : [],
            failureReason: result?.ok === false ? result.reason : ''
        });
        const routedCues = this.animationCoordinator.route(cues);
        const layout = input.layout || {};
        const orderedCues = this.feedbackQueue.enqueue(routedCues, {
            actors: {
                player: nextSnapshot?.player,
                lora: nextSnapshot?.lora
            },
            projectTile: (tile) => this.projectTile(layout, tile),
            tileSide: layout.tileSide,
            colors: this.getFeedbackColors()
        });
        this.presentationTimeline.applyCues(orderedCues);

        const achievementResult = this.achievementEvaluator.evaluate(
            events,
            input.unlockedAchievementIds
        );
        this.metaSession.unlockAchievements(achievementResult.unlockedIds);
        const achievementCount = this.achievementBanner.enqueue(
            achievementResult.notifications
        );
        this.audioDirector.notifyAchievements(achievementCount);

        this.previousSnapshot = nextSnapshot ? cloneValue(nextSnapshot) : null;
        this.metaSession.syncBattleSnapshot(nextSnapshot);
        this.recordPopups.enqueue(toList(events)
            .filter((event) => event?.type === 'record-picked')
            .map((event) => event.recordId));

        const cutsceneIds = [];
        for (const cutsceneId of this.cutsceneTriggers.consume(events)) {
            if (this.results.isEndingCutsceneId(cutsceneId)) {
                this.results.queueEndingCutscene(cutsceneId);
            } else {
                cutsceneIds.push(cutsceneId);
            }
        }
        return Object.freeze({
            cutsceneIds: Object.freeze(cutsceneIds)
        });
    }
}
