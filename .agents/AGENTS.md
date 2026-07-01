# Custom Workspace Rules & Agent Instructions

본 프로젝트는 SolidJS와 Hono, 그리고 Canvas API를 활용해 제작된 모바일 및 웹 기반 타이밍 점프 게임인 **Lumina Jump (Cosmic Timing Climber)** 입니다. 
본 가이드는 AI 에이전트가 이 프로젝트를 안전하고 효율적으로 유지보수하고 기능을 확장하기 위한 지침과 아키텍처 규칙을 설명합니다.

---

## 1. 커뮤니케이션 규칙 (CRITICAL)

- **모든 사용자 피드백 요청, 권한 요청 이유 설명, 선택지 질문(예: `ask_question`, `ask_permission` 등의 도구 호출 시 설명 또는 대화창 질문)은 반드시 한국어(한글)로 작성해야 합니다.**
- 사용자와의 대화는 명료하고 간결하게 유지하며, 불필요한 추측보다는 확인 질문을 활용합니다.
- 변경된 파일은 반드시 마크다운 링크 형식을 제공하여 사용자가 쉽게 클릭할 수 있도록 합니다. (예: `[.gitignore](file:///Users/east/work/dodo-jump/.gitignore)`)

---

## 2. 프로젝트 기술 스택 (Tech Stack)

- **런타임 및 빌드 도구**: Bun (`dev.ts`, `build.ts`)
- **프론트엔드**: SolidJS, Canvas API, Vanilla CSS
- **백엔드**: Hono (TypeScript)
- **PWA**: Service Worker (`sw.js`), `manifest.json`

---

## 3. 에이전트 코딩 및 설계 원칙

### 3.1 파일 관리
- 임시 작업 파일이나 스크래치 파일은 반드시 `scratch/` 폴더 내에 생성해야 하며, 이는 Git 커밋에 포함되지 않습니다 ([.gitignore](file:///Users/east/work/dodo-jump/.gitignore) 규칙 준수).
- 핵심 컴포넌트는 [src/App.tsx](file:///Users/east/work/dodo-jump/src/App.tsx)에 있으며, 게임 루프와 물리엔진은 [src/game/Game.ts](file:///Users/east/work/dodo-jump/src/game/Game.ts)에 정의되어 있습니다.

### 3.2 SolidJS UI 및 Styling 규칙
- Styling은 전반적으로 Vanilla CSS와 인라인 스타일을 혼용합니다. HTML5 Canvas 요소를 감싸는 프레임은 화면 크기에 맞춰 반응형 스케일(`scale()`)이 계산되도록 구성되어 있습니다.
- 새로운 캐릭터 추가, 상점 UI 수정 시 상태 관리 신호(`createSignal`)의 일관성을 유지해야 합니다.

### 3.3 게임 엔진 아키텍처 ([src/game/Game.ts](file:///Users/east/work/dodo-jump/src/game/Game.ts))
에이전트는 게임 플레이 로직을 변경할 때 다음 변수와 메커니즘을 숙지해야 합니다.

- **물리 상수**:
  - `gravity` (기본값 `-1100`): y축으로 작용하는 중력값입니다.
  - `minJumpVelocity` (`400`) / `maxJumpVelocity` (`880`): 플레이어 도약 속도 한계치입니다.
  - `chargeSpeed` (`4.5`): 점프 게이지가 충전되는 속도계수입니다.
- **플랫폼(Platform) 기믹**:
  - `normal`: 좌우로 정적인 기본 발판.
  - `velo`: 속도가 빠른 발판.
  - `slim`: 너비가 매우 좁은 발판.
  - `bouncy`: 착지 시 고탄성 점프가 발동하는 발판.
  - `phantom`: 시간이 지나면 서서히 투명해지며 사라지는 발판.
- **캐릭터 스킬 시스템 (`CHARACTERS`)**:
  - **NEON ORB**: `CRYSTAL MAGNET` (패시브: 크리스탈 자석 범위 120px 확장)
  - **NOVA CORE**: `STAR SHIELD` (액티브: 5초간 보호막 작동, 낙사 방지 및 복귀)
  - **NEBULA RING**: `SUPER BOUNCE` (액티브: 공중에서 1.5배 속도로 수직 즉시 점프)
  - **PULSAR CUBE**: `SOLAR FLARE` (액티브: 화면 내 모든 크리스탈 흡수)
  - **BLACKHOLE**: `EVENT HORIZON` (액티브: 모든 발판을 x=240 중앙선으로 정렬)
- **피버(Fever) 게이지**:
  - 퍼펙트 착지 콤보 또는 크리스탈 획득 시 충전되며, 100% 도달 시 일정 시간 동안 피버 모드(무적 도약 및 코인 대량 출현 등)가 작동합니다.

### 3.4 백엔드 API & Leaderboard ([server.ts](file:///Users/east/work/dodo-jump/server.ts))
- 점수 조회 및 업로드는 Hono 서버 API `/api/leaderboard`를 사용합니다.
- 클라이언트 오프라인 환경에 대응하기 위해 로컬스토리지 백업 로직을 반드시 구현 상태로 유지해야 합니다.

---

## 4. 커밋 및 문서화 규칙

- 기능 구현 후 반드시 `git status`를 확인하여 찌꺼기 파일이 올라가지 않도록 제어합니다.
- 새로운 기믹을 구현할 때 [README.md](file:///Users/east/work/dodo-jump/README.md)에 주요 변경 사항과 플레이 규칙을 업데이트하고 에이전트 지침도 최신화합니다.
