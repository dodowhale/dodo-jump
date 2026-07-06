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
- 클라이언트 오프라인 환경에 대응하기 위해 로컬스토리지 백업 로직(`lumina_leaderboard_backup`)을 반드시 연동 상태로 유지해야 합니다. 오프라인 점수 등록 시 백업된 로컬 랭킹 목록에 사용자의 기록을 강제로 병합(Merge) 및 정렬하여 로컬스토리지에 재저장해야 합니다.

### 3.5 물리엔진 및 연출 개선 지침 ([src/game/Game.ts](file:///Users/east/work/dodo-jump/src/game/Game.ts))
- **CCD 충돌 검출**: 고속 낙하 혹은 프레임 레이트 저하로 인한 발판 관통 현상을 막기 위해 CCD 오차 보정치를 최소 5px 이상 유지해야 합니다.
- **블랙홀 스킬 X축 보간**: 블랙홀 활성화 시와 타이머가 종료되어 복귀할 때 플랫폼의 X 좌표가 갑작스럽게 튀는 현상을 방지해야 합니다. 항상 목표 지점(`targetX`)을 향해 프레임 레이트 독립적인 **지수 감쇠 보간(Smooth Lerp)** 방식으로 가동되도록 코드를 유지해야 합니다.

---

## 4. 커밋 및 문서화 규칙

- 기능 구현 후 반드시 `git status`를 확인하여 찌꺼기 파일이 올라가지 않도록 제어합니다.
- 새로운 기믹을 구현할 때 [README.md](file:///Users/east/work/dodo-jump/README.md)에 주요 변경 사항과 플레이 규칙을 업데이트하고 에이전트 지침도 최신화합니다.

### 4.1 릴리즈 및 버전 관리 규칙 (Release & Versioning)

사용자가 `"릴리즈해줘"`, `"버전업 해줘"`, `"배포해줘"` 등 명시적으로 릴리즈/버전업에 관련된 의사를 표시할 경우, AI 에이전트는 다음 규칙에 따라 `package.json`의 버전을 변경하고 푸시해야 합니다.

1. **버전 변경 기준 (Semantic Versioning - SemVer)**
   - **Patch 버전업 (x.y.Z -> x.y.Z+1)**: 버그 수정, 밸런스 조정, 리팩토링, 단순 스타일 수정 등 기존 기능의 하위 호환성을 유지하는 경미한 수정일 때.
   - **Minor 버전업 (x.Y.z -> x.Y+1.0)**: 새로운 캐릭터 추가, 신규 플랫폼 타입/기믹 추가, 신규 API 기능 연동 등 하위 호환성을 지닌 새로운 기능 및 화면 추가일 때.
   - **Major 버전업 (X.y.z -> X+1.0.0)**: 전체 프레임워크 교체, 대규모 아키텍처 개편 등 이전 버전과의 하위 호환성이 단절되는 변경일 때.
2. **배포 트리거 조건**
   - GitHub Actions 워크플로우([deploy.yml](file:///Users/east/work/dodo-jump/.github/workflows/deploy.yml))는 `package.json` 파일의 변경을 감지했을 때만 빌드 및 배포를 트리거하도록 설정되어 있습니다. 따라서, 버전을 수정하지 않은 일반 코드 수정 사항은 커밋/푸시 시 배포되지 않으며, 오직 버전업 커밋이 동반될 때만 실서비스에 배포됩니다.
3. **릴리즈 진행 프로세스**
   - 지난 커밋 내역과 변경 사항의 크기를 파악하여 SemVer 기준에 알맞은 버전을 결정합니다.
   - `package.json`의 `version` 값을 수정합니다.
   - 로컬에서 `bun run build`를 실행하여 빌드 오류가 없는지 최종 확인합니다.
   - 변경 사항을 스테이징하고, `"release: vX.Y.Z"` 또는 `"chore: bump version to X.Y.Z"` 형식의 커밋 메시지로 커밋한 후 원격지에 푸시합니다.
