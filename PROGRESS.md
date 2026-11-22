# ⚔️ 환장 래거시 (Hwanjang Legacy) 작업 일지 (`PROGRESS.md`)

> 이 문서는 다음 AI 세션이나 윤마스터가 언제든 이어서 개발할 수 있도록 **현재 상태와 작업 기록**을 정리해 둔 파일입니다.

---

## 📁 폴더 구조 (`crazy-odyssey/`)
- `public/index.html` — 시작 화면(비밀번호 4자리 + 로그인/회원가입/게스트) 및 게임 HUD
- `public/style.css` — 게임 화면 및 UI 스타일
- `public/js/` — 게임 로직 (`game.js`, `world.js`, `combat.js`, `assets.js`, `audio.js`, `data.js`)
- `public/assets/` — 3D 캐릭터, 몬스터, 성, 마을, 자연물, 아이템 GLB 모델
- `public/lib/three/` — Three.js 라이브러리
- `server.js` — Node.js HTTP + WebSocket 게임 서버 (포트 `3005`)
- `render.yaml` — Render 무료 클라우드 서버 배포 설정
- `README.md` — 실행 및 배포 안내서

---

## ✅ 지금까지 완료된 작업
1. **맵 & 몬스터 확장**: 마을·봄·대초원·여름·바다·사막·가을·고대 유적지·겨울·결투장 등 10개 지역 및 몬스터 추가
2. **로그인 편의 기능**: 최근 로그인 계정 기억 및 재접속 시 자동 로그인
3. **비주얼 버그 수정**:
   - 용사(검사 등) GLB 내장 무기가 겹쳐 검이 3개로 보이던 문제 수정 ([assets.js](public/js/assets.js), [data.js](public/js/data.js), [game.js](public/js/game.js))
   - 일부 몬스터가 어둡거나 텍스처가 누락된 것처럼 보이던 재질/조명 문제 수정
4. **입장 비밀번호 잠금**: 사이트 입장 시 4자리 숫자 비밀번호 `5090` 입력 필수 적용 ([index.html](public/index.html), [game.js](public/js/game.js), [server.js](server.js))
5. **파일 정리 & 작업 일지 생성**: [PROGRESS.md](PROGRESS.md) 작성

---

## 🚀 다음 진행 순서
- [ ] GitHub 계정 확인 및 새 저장소 만들기
- [ ] 코드 GitHub에 업로드(커밋 & 푸시)
- [ ] 웹 배포 후 브라우저에서 실제 플레이 테스트
