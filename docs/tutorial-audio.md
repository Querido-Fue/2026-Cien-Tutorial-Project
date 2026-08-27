# 튜토리얼 오디오 계약

## 1. 책임 경계

```text
TUTORIAL_AUDIO_MANIFEST
          │ cue ID / bus / path / policy / fallback
          v
AudioManifestResolver
   ┌──────┴───────────────┐
   v                      v
MusicBus              AudioBus × 2
crossfade·dedupe      SFX / UI·cooldown·polyphony·loop
   └──────────┬───────────┘
              v
         SoundSystem
 settings·unlock·pause facade
              ^
              │ small sound port
     TutorialAudioDirector
 scene BGM·breathing·UI command·presentation cue
```

- `SoundSystem`은 기존 `playBgm()`, `stopBgm()`, 진단 샘플 API를 유지하는 조립 파사드다.
- `MusicBus`는 BGM 두 채널, 동일 해석 곡 중복 방지와 crossfade만 소유한다.
- `AudioBus` 인스턴스 두 개가 SFX와 UI의 음성 수명, cooldown, polyphony와 loop 중복을
  각각 소유한다.
- `AudioManifestResolver`는 누락 항목의 비순환 fallback만 해석하며 Audio 객체를 만들지 않는다.
- `TutorialAudioDirector`는 작은 장면 상태와 명령/cue만 받는다. 모델, 뷰, 저장 시스템 또는
  실제 파일 경로를 알지 않는다.

각 클래스는 별도 파일 하나에 있고 장면 역참조가 없다. 데이터 항목과 숫자 보정은 상태 없는
값/함수 모듈로 둔다.

## 2. 매니페스트와 원본 보존

`TUTORIAL_AUDIO_MANIFEST`의 각 항목은 다음 필드를 고정한다.

| 필드 | 의미 |
| --- | --- |
| `id` | 프레젠터·장면이 쓰는 안정 의미 ID |
| `sourceName` | `project/asset` 기준 제공 원본 이름 |
| `runtimePath` | `project/engine` 기준 ASCII 안전 복사본 경로 |
| `bus` | `bgm`, `sfx`, `ui` 중 하나 |
| `loop` | 지속 재생 여부 |
| `defaultVolume` | 버스 볼륨에 곱할 0~1 gain |
| `polyphony` | 같은 해석 ID의 동시 음성 상한 |
| `cooldownSeconds` | 같은 ID 재시작 최소 간격 |
| `required` / `available` | 원본 필수 여부와 실제 제공 여부 |
| `fallback` | 미제공 항목의 다음 의미 ID |

사용자 지시에 따라 `incoming_assets`가 아니라 `project/asset/audio`의 BGM 5개와 효과음
20개를 원본으로 사용한다. 기존 진단용 `project/asset/old/audio/기다려줘.mp3`도 호환 ID로
등록해 실제 복사 대상은 26개다. `npm run import:assets`는 원본을 바꾸지 않고
`project/asset/tutorial/audio` 아래로 `COPYFILE_EXCL` 복사하며, 기존 파일은 SHA-256이
같을 때만 멱등 성공한다. `check:assets`는 MPEG frame sync/ID3 헤더와 원본-복사본 해시를
함께 검사한다.

## 3. 장면별 BGM 정책

| 장면 상태 | 요청 ID | 실제 파일 또는 해석 |
| --- | --- | --- |
| 로딩·메뉴·스타터·갤러리 | `bgm.main` | `mainpage_backgroundmusic.mp3` |
| 컷씬 카드가 열림 | `bgm.opening` | `opening_scene.mp3` |
| 1층 전투 | `bgm.floor1` | `ingame_floor1.mp3` |
| 지하층 전투 | `bgm.basement` | 미제공 → `bgm.floor1` |
| `endingId === 'true'` 결과 | `bgm.ending.stabilized` | `안정화엔딩.mp3` |
| 그 외 결과 | `bgm.ending.subdued` | `무력화엔딩.mp3` |

같은 요청 ID뿐 아니라 fallback 뒤 같은 실제 ID가 된 경우에도 Audio를 다시 만들지 않는다.
곡이 바뀌면 기본 0.55초 동안 새 곡은 올라오고 이전 곡은 내려간 뒤 이전 채널을 정지·초기화한다.

## 4. 사건별 SFX와 UI

| 의미 | ID |
| --- | --- |
| 플레이어 발걸음·근접·원거리·회복·피격·사망 | `sfx.player.footstep/melee/ranged/heal/hurt/death` |
| 로라 근접·범위·피격·사망 | `sfx.lora.melee/area/hurt/death` |
| 로라 불안정/붕괴 호흡 loop | `loop.lora.heavy-breathing` |
| 슬라임 피격 | `sfx.slime.hurt` |
| 아이템 획득/장착·사용 | `sfx.item.equip`, `sfx.item.apply` |
| 포탈·층 붕괴 | `sfx.world.teleport`, `sfx.world.floor-break` |
| 업적·버튼·책장 넘김·책 닫기 | `ui.achievement/click/book-turn/book-close` |

공격 시작음은 배우 공격 cue와 함께 시작한다. 피격/사망음은 sprite impact 지연 필드를
따라 떠오르는 글자·플래시와 같은 시점에 `TutorialFeedbackQueue`에서 drain된다. 로라 HP가
남아 있고 불안정 상태의 데이터 기준 최솟값 61 이상일 때만 호흡 loop를 시작하며, 안정화,
결과 진입, 런 이탈과 장면 destroy에서 중지한다.

## 5. 설정·일시정지·자동재생

- `bgmVolume`, `sfxVolume`, `uiVolume`은 각각 0~100이며 구버전 파일에 없는 키는 100으로
  추가 저장한다. 문자열·범위 밖 값은 정수 범위로 보정한다.
- `SystemHandler.applyRuntimeSettings()`가 세 버스를 즉시 갱신하고 프레임 delta를 음악
  crossfade에 전달한다.
- blur/일시정지는 BGM, 활성 SFX/UI와 loop를 모두 pause한다. resume 시 정지 전 실제로
  재생 중이던 음성만 이어서 재생한다.
- 자동재생 정책으로 `play()`가 실패하면 one-shot은 버리고 BGM/loop만 대기시킨다.
  첫 pointer/key/touch 입력에서 재시도하며 계속 실패해도 장면이나 메인 루프에 예외를
  전파하지 않는다.
- 누락 ID, Audio 생성 실패, 파일 재생 실패는 모두 `{ ok: false, reason }` 결과로 끝난다.

## 6. 확인 자료와 임의 결정

지정된 Drive의 사운드 폴더와 로컬 원본을 대조해 BGM 5개·효과음 20개의 이름과 크기가
일치함을 확인했다. 별도 지하층 BGM과 엔딩 ID↔곡 대응표는 찾지 못했다.

따라서 다음은 명시된 기획이 아니라 현재 데이터와 파일명에 기반한 임시 결정이다.

- 지하층은 제공 파일이 없으므로 `bgm.basement`를 숨기지 않고 `available: false`로 선언한 뒤
  1층 BGM으로 fallback한다.
- 시스템 기획에서 낮은 불안정도의 무력화를 안정/true 엔딩으로 설명하므로 `true`만
  안정화 곡에 연결하고 `special`, `hollow`, 실패 결과는 무력화 곡에 연결했다.
- 0.55초 crossfade, 항목별 0.06~0.25초 cooldown, gain과 polyphony 값은 clipping과 반복
  소음을 줄이기 위한 초기 튜닝값이다. 정식 믹싱 표가 나오면 매니페스트 데이터만 바꾼다.

## 7. 검증

```text
npm run import:assets
npm run test:audio
npm run check:assets
npm run check:repo
npm test
```

Fake Audio 테스트는 crossfade 완료, 실제 해석 ID 중복 방지, cooldown/polyphony, loop 중복,
pause/resume, 자동재생 차단, 누락 cue, 볼륨 보정과 설정 마이그레이션을 검사한다. 에셋 감사는
MP3 26개와 지하층 선언 폴백 1개를 별도 집계한다.
