# Lumina Jump: Cosmic Timing Climber

[![Built with SolidJS](https://img.shields.io/badge/Built%20with-SolidJS-4f74b3.svg?style=flat-square)](https://solidjs.com)
[![Runtime Bun](https://img.shields.io/badge/Runtime-Bun-f472b6.svg?style=flat-square)](https://bun.sh)
[![Backend Hono](https://img.shields.io/badge/Backend-Hono-e0a82e.svg?style=flat-square)](https://hono.dev)

**Lumina Jump**는 SolidJS와 Canvas API를 기반으로 제작된 반응형 HTML5 타이밍 점프 게임입니다.
우주의 감각적인 디자인 요소를 담아 마우스 클릭 및 스페이스바의 차지 타이밍을 조율하며 무한히 움직이는 발판을 올라가는 심플하면서도 몰입감 넘치는 아케이드 게임입니다.

---

## 🚀 주요 특징 (Key Features)

1. **차지 타이밍 메커니즘**
   - 기존의 단순 클릭 점프에서 벗어나, 클릭/스페이스바를 **누르고 있는 시간**에 비례하여 에너지가 모이고, 손을 떼는 순간 힘의 크기만큼 도약합니다.
   
2. **다양한 형태의 플랫폼 기믹**
   - **Normal**: 좌우로 부드럽게 움직이는 표준 발판.
   - **Velo**: 높은 이동 속도로 플레이어의 타이밍 조절을 시험하는 발판.
   - **Slim**: 디딤 면적이 극히 좁아 정확한 컨트롤이 요구되는 발판.
   - **Bouncy**: 착지하는 즉시 튕겨 올라 높은 탄성을 제공하는 발판.
   - **Phantom**: 시간이 지나면 서서히 불투명도가 낮아지며 사라지는 발판.

3. **피버(Fever) 타임 시스템**
   - 발판 중심에 가깝게 착지할수록 **Perfect 콤보 보너스** 및 **Fever Gauge**가 충전됩니다.
   - 피버 게이지 100% 도달 시 우주 테마의 화려한 배경 연출과 함께 캐릭터가 무적으로 도약하며 화면 가득 크리스탈을 획득할 수 있습니다.

4. **코스믹 샵 & 고유 스킨 스킬**
   - 게임 플레이 중 수집한 **스페이스 크리스탈(💎)**을 사용해 특별한 능력을 지닌 스킨을 해금할 수 있습니다.
   - **NEON ORB (기본)**: 자석 범위 확장 (패시브)
   - **NOVA CORE**: 보호막을 펼쳐 추락 시 직전 발판으로 복귀 (쿨타임 20초)
   - **NEBULA RING**: 공중에서 더 높이 도약하는 2단 수직 점프 (쿨타임 15초)
   - **PULSAR CUBE**: 화면 안의 모든 크리스탈을 순간 흡수 (쿨타임 18초)
   - **BLACKHOLE**: 중력을 조작해 모든 발판을 중앙으로 끌어당김 (쿨타임 25초)

5. **글로벌 순위표 (Leaderboard)**
   - Hono 백엔드 서버 API와 실시간으로 연동되어 전 세계 플레이어의 최고 기록 순위를 제공합니다.
   - 오프라인 환경에서는 LocalStorage를 연동한 로컬 랭킹 백업 시스템이 활성화됩니다.

6. **PWA (Progressive Web App) 완벽 지원**
   - 오프라인 캐싱 및 Service Worker 기술을 탑재하여 모바일, 태블릿, PC 등 모든 OS 환경에서 네이티브 앱처럼 설치 및 구동이 가능합니다.

---

## 🛠 기술 스택 (Tech Stack)

### Frontend
- **Framework**: SolidJS (Fine-grained Reactive State Management)
- **Rendering**: Canvas 2D API (고성능 게임 그래픽 렌더링)
- **Styling**: Vanilla CSS (CSS Variables 기반 프리미엄 다크 테마 설계)

### Backend & Build Tool
- **Server**: Hono (TypeScript-native Web Framework)
- **Runtime**: Bun (초고속 빌드 및 테스트 환경 구축)
- **Bundler**: Bun Bundler

---

## 🎮 게임 조작 방법 (Controls)

- **점프 게이지 충전**: 마우스 왼쪽 버튼 클릭 또는 `Space` 키 입력 유지 (누르기)
- **점프 도약**: 입력 장치에서 손 떼기 (Release)
- **스킨 고유 액티브 스킬 사용**: 키보드 `S` 또는 `Shift` 키 입력 (혹은 화면 우측 하단의 스킬 아이콘 터치/클릭)
- **배경음 토글**: 화면 우측 상단의 스피커 아이콘(🔊 / 🔇) 클릭

---

## 📦 설치 및 실행 방법 (Getting Started)

### 사전 요구 사항
- [Bun](https://bun.sh/) 런타임이 시스템에 설치되어 있어야 합니다.

### 1. 프로젝트 복제 및 의존성 설치
```bash
bun install
```

### 2. 로컬 개발 서버 실행
```bash
bun run dev
```
개발 모드가 시작되면 브라우저에서 `http://localhost:3001`을 열어 실시간 핫 리로딩(HMR) 기능이 포함된 게임을 플레이할 수 있습니다.

### 3. 배포용 빌드
```bash
bun run build
```
빌드된 파일은 최적화되어 서버 배포용 폴더로 자동 구성됩니다.

### 4. 프로덕션 서버 시작
```bash
bun run start
```
Hono 웹 서버가 시작되며 기본 `http://localhost:3001`에서 운영 환경의 게임 서비스를 제공합니다.

---

## 📂 프로젝트 폴더 구조 (Project Structure)

```text
dodo-jump/
├── .agents/              # AI 에이전트 전용 개발 지침 및 룰 파일
│   └── AGENTS.md
├── assets/               # PWA 아이콘 및 로고 에셋
├── public/               # 정적 파일 (Favicon, SVG 에셋 등)
├── src/
│   ├── assets/           # UI 내부용 비주얼 리소스
│   ├── game/
│   │   ├── AudioEngine.ts # Web Audio API 기반 오디오 제어
│   │   └── Game.ts       # Canvas 게임 루프, 물리엔진, 플랫폼, 스킨 로직
│   ├── App.tsx           # SolidJS 메인 컴포넌트 & 상점/UI 레이어
│   └── index.tsx         # 엔트리 포인트
├── dev.ts                # Bun 기반 로컬 개발 스크립트
├── build.ts              # 빌드 파이프라인 구성 스크립트
├── server.ts             # Hono 백엔드 서버 & API 라우터
├── sw.js                 # PWA 오프라인 캐싱용 서비스 워커
└── tsconfig.json         # TypeScript 컴파일러 설정
```

---

## 📜 라이선스 및 기여 (License & Development Guide)

본 프로젝트는 비공개 독점 소프트웨어(Proprietary Software)로, 무단 복제, 배포 및 상업적 이용을 금지합니다.
개발 및 코드 기여 시 에이전트 지침인 [.agents/AGENTS.md](file:///Users/east/work/dodo-jump/.agents/AGENTS.md)을 엄격히 준수하며 일관된 코딩 스타일을 유지해야 합니다.

---

## 🚀 릴리즈 및 배포 정책 (Release & Deployment)

- 본 프로젝트의 실서비스 배포는 GitHub Actions을 통해 자동으로 이루어집니다.
- 불필요한 배포 빌드를 막기 위해 **`package.json` 파일의 `version` 필드가 변경되었을 때만** 자동 배포 워크플로우가 트리거되도록 설정되어 있습니다.
- 세부적인 버전업 변경 기준(SemVer) 및 빌드/푸시 상세 프로세스는 AI 에이전트 개발 지침인 [.agents/AGENTS.md](file:///Users/east/work/dodo-jump/.agents/AGENTS.md)의 **4.1 릴리즈 및 버전 관리 규칙**을 참고하시기 바랍니다.

---

## 🔄 최근 업데이트 내역 (Changelog)

### [2026-07-05] - 안정성 및 UX 개선 패치
- **물리엔진 안정성 극대화**: CCD(Continuous Collision Detection)의 판정 오차 마진을 2px에서 5px로 보정하여 저사양 기기나 급격한 프레임 드랍, 혹은 매우 높은 곳에서 고속 낙하할 때 플레이어가 발판을 뚫고 지나가던 터널링 현상을 예방했습니다.
- **블랙홀(Event Horizon) 모션 부드러움 개선**: 블랙홀 스킬의 온/오프 전환 시, 발판이 중앙선과 원래의 사인파 진동 궤도 사이를 순간이동하던 덜컹거림을 해결했습니다. 프레임 레이트 독립적인 **지수 보간(Smooth Lerp)** 방식을 도입하여 스킬 작동 시 부드럽게 수축하고, 종료 시 제자리로 자연스럽게 흩어져 복귀하게 만들었습니다.
- **리더보드 백업 및 병합 동기화 고도화**: 오프라인 상태일 때 최고 점수를 기록할 경우, 단일 점수만 보여주는 대신 로컬스토리지에 캐싱되어 있던 기존 랭킹 목록에 사용자의 신규 점수를 반영하여 재정렬(Top 5) 후 캐시를 업데이트하도록 설계하여 온/오프라인 전환이 매끄럽게 연결되도록 처리했습니다.

