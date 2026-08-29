# 월드 후처리 파이프라인

## 레이어 경계

정적 화면 순서는 다음과 같다.

```text
background ─┐
object ─────┼─> WorldPostProcessPipeline ─> world-postprocess
effect ─────┘                                  │
                                              ├─ texteffect
                                              ├─ ui / overlay
                                              └─ top
```

`background`, `object`, `effect` 명령은 별도 canvas에 즉시 그리지 않고
`WorldPostProcessPipeline`의 큐에 저장한다. 프레임 끝에 세 큐를 이 순서로 공유
RGBA FBO에 실행하므로 배치 내부의 텍스처 전환 flush가 레이어 순서를 앞지르지
않는다. `texteffect`, `ui`, 동적 overlay와 `top`은 후처리 입력에서 제외한다.

## 패스와 픽셀 정책

1. 전체 해상도 scene target에 nearest-neighbor로 월드를 합성한다.
2. 밝기 임계값을 넘는 픽셀만 1/4 해상도 Bloom target으로 추출한다.
3. 품질 단계에 따라 분리 Gaussian blur를 1~3회 수행한다.
4. 최종 패스에서 어두운 자주색 그림자와 따뜻한 금색 하이라이트 색보정,
   약한 대비·채도, Bloom, ordered dither·미세 grain, 기존 테마 비네팅을 합성한다.

원본 scene 텍스처는 `NEAREST`, Bloom 보조 텍스처만 `LINEAR`를 사용한다. 전체
화면 블러, 모션 블러, 색수차는 사용하지 않는다. `flameParticles`와
`magneticShield` 프래그먼트는 기본 2픽셀 화면 격자에 좌표와 중심을 스냅한다.
명령의 선택적 `pixelSize`는 1~8 범위로 제한된다.

## 품질과 폴백

렌더 스케일 95 이상은 `high`, 82 이상은 `medium`, 나머지는 `low`를 사용한다.
모든 단계에서 Bloom target은 정확히 1/4이며 pass 횟수와 색보정 강도만 달라진다.

셰이더·FBO 생성 실패, 지원 texture unit 부족, 프레임 GL 오류, context loss가
발생하면 `WebGLHandler`가 `world-postprocess`를 숨기고 기존 세 월드 canvas를
다시 표시한다. 현재 프레임에 모은 명령도 기존 렌더러에 재생해 빈 프레임을
피한다. 출력 canvas의 `data-world-postprocess-*` 속성과
`getWorldPostProcessDiagnostics()`로 활성 상태, 품질, Bloom 크기와 최근 CPU
제출 시간을 확인할 수 있다.

계약 회귀는 `test/world_postprocess.test.mjs`가 검사한다.
