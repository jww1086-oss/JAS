# Anti-Gravity Safety System 🚀

현장 안전 점검 및 위험성 평가를 위한 웹 애플리케이션입니다. Google Sheets를 데이터베이스로 사용하며, Netlify를 통해 전 세계 어디서든 접속 가능합니다.

## 🛠️ 배포 가이드 (GitHub & Netlify)

### 1단계: GitHub에 코드 올리기
1. [GitHub](https://github.com/)에 로그인하여 새로운 저장소(Repository)를 생성합니다. (이름: `anti-gravity-safety`)
2. 내 컴퓨터의 터미널(CMD) 또는 VS Code 터미널에서 다음 명령어를 입력합니다.
   ```bash
   git init
   git add .
   git commit -m "Initial commit for safety app"
   git branch -M main
   git remote add origin https://github.com/사용자아이디/anti-gravity-safety.git
   git push -u origin main
   ```

### 2단계: Netlify 연결 및 배포
1. [Netlify](https://www.netlify.com/)에 접속하여 로그인합니다.
2. **[Add new site] > [Import an existing project]** 를 선택합니다.
3. **[Deploy with GitHub]** 를 클릭하여 위에서 만든 저장소를 선택합니다.
4. 설정값은 기본값(Build command: 없음, Publish directory: `/`)으로 두고 **[Deploy]** 버튼을 누릅니다.
5. 배포가 완료되면 `https://xxxx-xxxx.netlify.app` 형식의 전용 URL이 생성됩니다!

## 🔧 기술 설정 필수 사항

- **GAS URL 연동**: `app.js` 파일의 `GAS_URL` 변수가 본인의 구글 앱스 스크립트 배포 URL과 일치해야 합니다.
- **구글 시트 탭**: `위험성_마스터`, `실시_로그`, `사용자_명단` 탭이 존재해야 하며, `Code.gs`의 `setupDatabase` 함수를 1회 실행하여 구조를 맞춰야 합니다.

## 📱 주요 기능
- **Step 1**: 근로자 및 작업 선택
- **Step 2**: 위험 요인 및 개선 대책 확인 (체크리스트)
- **Step 3**: 현장 사진 촬영 및 자동 업로드
- **Step 4**: 디지털 서명 및 리포트 자동 생성
