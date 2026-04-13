# 📐 발전소 위험성평가 UI 명세서 (UI Spec v35.8.14)

프리미엄 모바일 웹 경험을 위한 상세 디자인 및 UI 명세입니다.

## 1. 디자인 시스템 (Design Tokens)
- **Brand Identity**: '발전소 위험성평가' (Modern Blue Tech 테마)
- **Base Style**: `Flat & Frameless` (불필요한 카드 테두리 및 쉐도우 제거)
- **Typography**: 
  - Main: `Inter`, Sub: `Pretendard`, Fallback: `sans-serif`
  - Body: `line-height: 1.5`, `letter-spacing: -0.4px`
  - Word-wrap: `keep-all` (한글 단어 단위 줄바꿈)

## 2. 주요 컴포넌트 규격 (Component Specs)
### [Flat Risk Checklist]
- **Padding**: 상하 `1.25rem`, 좌우 `0` (배경 여백 제거)
- **Border**: 하단 `1.2px solid #f1f5f9` (섹션 구분선)
- **Indicator**: `점검필요` (Gray), `점검완료` (Blue) 뱃지 스타일.

### [Step Numbering]
- **Size**: `28px × 28px` 원형 프레임.
- **Font**: `1rem` 고정, `900 weight`.
- **Align**: `flex-start` (내용이 길어져도 숫자는 상단 고정).

### [Alert Sections (Phase 3)]
- **Background**: `#fff1f2` (Light Red)
- **Border**: `1.5px solid #fecaca`
- **Text Color**: `#b91c1c` (Deep Red)

## 3. 모바일 최적화 규칙
- **Viewport**: `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`
- **Safety Margin**: 모바일 하단 내비게이션 바 영역 확보.
- **Tap Targets**: 모든 클릭 영역(버튼, 선택박스)은 최소 `44px` 이상의 높이 확보.

---
**※ 본 명세서는 시스템의 시각적 일관성과 사용자 경험 품질을 일정하게 유지하기 위한 표준 문서입니다.**
