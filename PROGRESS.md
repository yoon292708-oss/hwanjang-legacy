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
- `public/index.html` — 시작 화면(비밀번호 4자리 + 로그인/회원가입/게스트) 및 게임 HUD (스킬 1~4, 퀘스트, 도감)
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
   - **꿀벌(`Bee.glb`), 말벌(`Wasp.glb`), 게(`Crab.glb`) 등 모습이 안 보이던 버그 수정**: `skinWeight`의 `NaN` 값을 로딩 시 자동 보정하고(`assets.js`), `Flying` 애니메이션 폴백 추가(`combat.js`)
4. **입장 비밀번호 잠금**: 사이트 입장 시 4자리 숫자 비밀번호 `5090` 입력 필수 적용 (`public/index.html`, `public/js/game.js`, `server.js`)
5. **신규 직업 4종 추가 (총 15종) & 4번 필살기 추가**:
   - 추가 직업: `신궁수(ranger)`, `용기사(lancer)`, `성기사(paladin)`, `검성(samurai)`
   - 모든 직업에 4번째 필살기 추가 + `barrage` 다발 투사체 스킬 추가
6. **레벨별 2·3·4번 기술 해금**: `[1]` Lv.1 / `[2]` Lv.3 / `[3]` Lv.7 / `[4]` Lv.12 달성 시 해금 (`SKILL_REQ_LEVELS`)
7. **숨겨진 전직관 14인 (1인 1직업 · 0G 무료 · 전직 퀘스트 필수)**:
   - 숨겨진 직업 도감(`[J]`) & 전직관 힌트 UI 완전 제거
   - 14명의 전직관이 대륙 곳곳에 1직업씩 담당해 숨어 있으며, 직접 찾아 대화(`[E]`) 후 해당 전직관의 시험 퀘스트를 완료해야 무료(`0G`)로 전직 가능
8. **퀘스트 확장**: 메인 퀘스트 14종 + 서브 퀘스트 7종 + 전직 퀘스트 트래킹 & 퀘스트 게시판 (`[L]`)
9. **캐시 방지 & GitHub/Render 자동 배포**: `server.js`에서 HTML/JS/CSS `no-cache` 헤더 적용, `https://github.com/yoon292708-oss/hwanjang-legacy` (`main` 푸시 시 Render 자동 업데이트)

---

## 🤖 다음 AI 세션을 위한 인수인계 메모
1. 개발자 호칭은 **윤마스터** (만 12세)이며, 한 번에 딱 1개의 작은 단계씩 쉽게 안내하고 확인받은 뒤 진행하세요.
2. 코드를 수정한 뒤 `git add`, `git commit`, `git push origin main`을 하면 Render(`https://hwanjang-legacy.onrender.com/`)에 자동으로 새 버전이 반영됩니다.
3. 새로운 기능을 추가하거나 버그를 고칠 때마다 이 `PROGRESS.md`도 함께 업데이트해 주세요.
