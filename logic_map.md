# 🗺 발전소 위험성평가 로직 맵 (Logic Map v35.8.14)

시스템의 데이터 흐름과 비즈니스 로직의 상호작용을 정의합니다.

## 1. 데이터 라이프사이클 (Data Flow)
`init()` ➔ `master_data.js` 로드 ➔ **지능형 키 탐색** ➔ `normalizeSearch` 정규화 ➔ `currentState.risks` 인덱싱 ➔ `renderDeptBanners()`

## 2. 평가 단계별 로직 (Assessment Logic)
### [Phase 2: 위험성 평가]
- **Measure Separation**: `smartSplit`을 통한 줄바꿈/숫자 기반 텍스트 분리.
- **Intelligent Filter**: `normalizeSearch(measure) !== normalizeSearch(hazard)` 검사.
- **Deduplication**: 중복 항목은 `finalMeasures`에서 제외.

### [Phase 3: 추가 개선대책]
- **Gap Analysis Engine**: 
  - `checkedMeasures`에 없는 항목을 `uncheckedMeasures`로 추출.
  - 추출된 항목을 자동으로 개선대책 섹션의 **Red Theme** 리스트로 전이.

## 3. 위험도 연산 로직 (Risk Calculation)
- `getTaskRiskScore(key)`: 로컬 저장된 점수와 기본 마스터 데이터 비교.
- `updateRiskScore()`: `R = L × S` 연산 즉시 실행 및 `currentState` 반영.

## 4. 최종 데이터 제출 (Submission Flow)
`submitLog()` ➔ `preparePreviewData()` ➔ **Deduplicated Join** (중복 제거된 텍스트 합치기) ➔ `fetch(GAS_URL)` ➔ 결과 기록 및 완료 안내.

---
**※ 본 로직 맵은 시스템의 무결성과 데이터 처리의 일관성을 보장하는 기술 설계도입니다.**
