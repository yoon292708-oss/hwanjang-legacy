# ⚔️ 환장 래거시 (Hwanjang Legacy) 작업 일지 (`PROGRESS.md`)

> 이 문서는 다음 AI 세션이나 윤마스터가 언제든 끊김 없이 이어서 개발할 수 있도록 **현재 상태, 배포 주소, 작업 기록**을 정리해 둔 파일입니다.

---

## 🌐 공식 주소 & 접속 정보
- **라이브 게임 주소 (Render)**: https://hwanjang-legacy.onrender.com/
- **GitHub 저장소**: https://github.com/yoon292708-oss/hwanjang-legacy
- **입장 비밀번호 (4자리)**: `5090` (`server.js`의 `ENTRY_PIN` / 환경변수 `ODY_ENTRY_PIN`)
- **참고**: Render 무료 플랜 특성상 15분 동안 접속이 없으면 서버가 잠깐 잠들었다가, 다시 열 때 첫 로딩만 30~50초 정도 걸릴 수 있습니다.

---

## 📁 폴더 구조 (`crazy-odyssey/`)
- `public/index.html` — 시작 화면(비밀번호 4자리 + 로그인/회원가입/게스트) 및 게임 HUD
- `public/style.css` — 게임 화면 및 UI 스타일
- `public/js/` — 게임 로직 (`game.js`, `world.js`, `combat.js`, `assets.js`, `audio.js`, `data.js`)
- `public/assets/` — 3D 캐릭터, 몬스터, 성, 마을, 자연물, 아이템 GLB 모델
- `public/lib/three/` — Three.js 라이브러리
- `server.js` — Node.js HTTP + WebSocket 게임 서버 (포트 `3005`, `0.0.0.0` 바인딩)
- `render.yaml` — Render 무료 클라우드 서버 배포 설정
- `README.md` — 실행 및 배포 안내서

---

## ✅ 지금까지 완료된 작업
1. **맵 & 몬스터 확장**: 마을·봄·대초원·여름·바다·사막·가을·고대 유적지·겨울·결투장 등 10개 지역 및 몬스터 추가
2. **로그인 편의 기능**: 최근 로그인 계정 기억 및 재접속 시 자동 로그인
3. **비주얼 버그 수정**:
   - 용사(검사 등) GLB 내장 무기가 겹쳐 검이 3개로 보이던 문제 수정 (`public/js/assets.js`, `public/js/data.js`, `public/js/game.js`)
   - 일부 몬스터가 어둡거나 텍스처가 누락된 것처럼 보이던 재질/조명 문제 수정
4. **입장 비밀번호 잠금**: 사이트 입장 시 4자리 숫자 비밀번호 `5090` 입력 필수 적용 (`public/index.html`, `public/js/game.js`, `server.js`)
5. **GitHub 저장소 생성 및 업로드**: `https://github.com/yoon292708-oss/hwanjang-legacy` (`main` 브랜치)
6. **웹 배포 및 플레이 테스트 완료**: Render 무료 웹 서비스 배포 성공 & `5090` 입장/플레이 정상 확인

---

## 🤖 다음 AI 세션을 위한 인수인계 메모
1. 개발자 호칭은 **윤마스터** (만 12세)이며, 한 번에 딱 1개의 작은 단계씩 쉽게 안내하고 확인받은 뒤 진행하세요.
2. 코드를 수정한 뒤 `git add`, `git commit`, `git push origin main`을 하면 Render(`https://hwanjang-legacy.onrender.com/`)에 자동으로 새 버전이 반영됩니다.
3. 새로운 기능을 추가하거나 버그를 고칠 때마다 이 `PROGRESS.md`도 함께 업데이트해 주세요.
