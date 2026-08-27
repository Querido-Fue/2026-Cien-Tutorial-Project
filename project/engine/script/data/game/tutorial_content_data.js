/**
 * 객체와 모든 하위 값을 재귀적으로 동결합니다.
 * @param {*} value - 동결할 값입니다.
 * @returns {*} 전달받은 값입니다.
 */
function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
        return value;
    }
    for (const child of Object.values(value)) {
        deepFreeze(child);
    }
    return Object.freeze(value);
}

/**
 * 확정 콘텐츠 문구와 현재 프로토타입에서만 사용하는 임시 해금 정책입니다.
 * `provisional` 조건은 표시 설명으로 승인된 문구가 아니며 안정된 모델 사건에만 연결됩니다.
 */
export const TUTORIAL_CONTENT_DATA = deepFreeze({
    VERSION: 1,
    ACHIEVEMENTS: [
        {
            id: 'steve-pickaxe',
            title: '스티브..?',
            englishTitle: 'Steve? Is that you?',
            description: null,
            descriptionStatus: 'unconfirmed',
            conditionStatus: 'provisional',
            condition: {
                eventType: 'item-picked',
                field: 'itemId',
                equals: 'diamond-pickaxe'
            }
        },
        {
            id: 'legend-of-lora',
            title: '로라의 전설',
            englishTitle: 'The Legend of Lora',
            description: null,
            descriptionStatus: 'unconfirmed',
            conditionStatus: 'provisional',
            condition: {
                eventType: 'item-picked',
                field: 'itemId',
                equals: 'ocarina'
            }
        },
        {
            id: 'just-the-beginning',
            title: '이건 시작에 불과해',
            englishTitle: "It's Just the Beginning",
            description: null,
            descriptionStatus: 'unconfirmed',
            conditionStatus: 'provisional',
            condition: { eventType: 'floor-transition' }
        },
        {
            id: 'another-random-player',
            title: '그녀를 스쳐가는 또 한 명의 플레이어',
            englishTitle: 'Just Another Random Player',
            description: null,
            descriptionStatus: 'unconfirmed',
            conditionStatus: 'provisional',
            condition: { eventType: 'battle-finished' }
        },
        {
            id: 'you-are-my-sunshine',
            title: '너는 나의 빛이야',
            englishTitle: 'You Are My Sunshine',
            description: null,
            descriptionStatus: 'unconfirmed',
            conditionStatus: 'provisional',
            condition: {
                eventType: 'battle-finished',
                field: 'endingId',
                equals: 'true'
            }
        },
        {
            id: 'peekaboo',
            title: '깜짝 놀랐지?',
            englishTitle: 'Peekaboo!',
            description: null,
            descriptionStatus: 'unconfirmed',
            conditionStatus: 'provisional',
            condition: { eventType: 'teleported' }
        }
    ],
    DIARIES: {
        LORA: [
            '이 세계에는 나랑 알파, 둘뿐이다. 그래도 괜찮아. 알파가 있으니까.',
            '알파가 그랬다. 여긴 아무것도 변하지 않는다고. 계절도, 하늘도, 우리도. 나는 변하지 않는 게 좋은데. 알파는 아닌가 봐.',
            '알파가 바깥을 찾았다고 했다. “먼저 나가볼게. 확인만 하고, 꼭 데리러 올게.” 꼭, 이라고 했다. 나는 그 말을 믿기로 했다.',
            '오늘도 문 앞에서 기다렸다. 어제도 기다렸다. 그저께도. 여기는 시간이라는 개념이 없어서, 얼마나 기다렸는지 셀 수가 없다. 오히려 다행인 걸까.',
            '알파는 길을 잃은 거야. 분명 그래. 아니면 내가 너무 싫어서… 아니야. 그런 생각 하면 안 돼. 그런데 왜 눈물이 나지.',
            '새 친구를 만드는 법을 알아냈다. 이번에는 잘할 거야. 꼭 붙어 있어야지. 한 순간도 혼자 두지 않을 거야. 그러면 아무도 떠나지 않겠지.',
            '또 나갔다. 또. 또. 또. 내가 뭘 잘못했지. 그저 붙어 있었을 뿐인데. 다들 왜 그런 눈으로 나를 쳐다 봐.'
        ],
        DEVELOPER: [
            '내가 이 게임으로 성공할 수 있을까? 부모님은 나를 계속 한심하게 쳐다보시는데… 그만하고 싶다. — 2013년 10월 1일',
            '오늘은 로라와 알파를 만들었다. 이제 오프닝은 다 만들었으니 다음 스테이지를 만들어야 하는데… 매일 같이 알바를 하다 보니 시간을 쪼개서 개발하기가 점점 더 어려워진다. — 2013년 9월 14일',
            '직장을 구했다. 게임과는 관련이 없는 직장이지만, 일이 너무 바빠서 개발을 더 이상 진행할 수 없을 것 같다. 미안하다, 완성시키지 못해서. — 2013년 12월 7일'
        ]
    },
    ENDINGS: [
        {
            id: 'true',
            displayName: '완벽주의자',
            displayNameStatus: 'confirmed',
            cutsceneId: 'true'
        },
        {
            id: 'hollow',
            displayName: '학살자',
            displayNameStatus: 'confirmed',
            cutsceneId: 'hollow'
        },
        {
            id: 'special',
            displayName: 'happily ever after..?',
            displayNameStatus: 'unconfirmed',
            cutsceneId: 'special'
        },
        {
            id: 'failure',
            displayName: 'happily ever after..?',
            displayNameStatus: 'fallback',
            cutsceneId: null
        }
    ],
    CUTSCENE_TRIGGERS: {
        openingCutsceneId: 'opening',
        eventRules: [
            {
                id: 'old-teddy-use',
                eventType: 'item-used',
                field: 'itemId',
                equals: 'old-teddy',
                cutsceneId: 'teddy'
            },
            {
                id: 'memory-photo-use',
                eventType: 'item-used',
                field: 'itemId',
                equals: 'memory-photo',
                cutsceneId: 'extra-interaction'
            },
            {
                id: 'mirror-eyeliner-synergy',
                eventType: 'item-used-all',
                itemIds: ['mirror', 'eyeliner'],
                cutsceneId: 'item-synergy'
            },
            {
                id: 'basement-transition',
                eventType: 'floor-transition',
                cutsceneId: 'basement-transition'
            },
            {
                id: 'ending-cutscene',
                eventType: 'battle-finished',
                cutsceneField: 'endingId',
                allowedCutsceneIds: ['true', 'special', 'hollow']
            }
        ]
    },
    GALLERY: {
        sections: [
            {
                id: 'achievements',
                title: '업적',
                source: 'achievements',
                bookmarkAssetKey: 'galleryBookmarkRedLeft'
            },
            {
                id: 'lora-diary',
                title: '로라의 일기',
                source: 'lora-diary',
                bookmarkAssetKey: 'galleryBookmarkYellowLeft'
            },
            {
                id: 'developer-diary',
                title: '개발자의 일기',
                source: 'developer-diary',
                bookmarkAssetKey: 'galleryBookmarkYellowRight'
            },
            {
                id: 'endings',
                title: '엔딩',
                source: 'endings',
                bookmarkAssetKey: 'galleryBookmarkRedRight'
            },
            {
                id: 'cutscenes',
                title: '컷씬',
                source: 'cutscenes',
                bookmarkAssetKey: 'galleryBookmarkBlueRight'
            }
        ],
        cutsceneIds: [
            'opening',
            'teddy',
            'item-synergy',
            'extra-interaction',
            'basement-transition'
        ]
    }
});
