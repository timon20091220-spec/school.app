# Firebase 연결 후 반드시 할 작업

## 1. Firestore 보안 규칙 게시

Firebase 콘솔에서:

`Firestore → 규칙`

으로 이동한 뒤, 프로젝트에 포함된 `firestore.rules` 파일 내용을 전부 복사해 붙여 넣고 **게시**를 누르세요.

규칙을 게시하지 않으면 로그인 후 학생 프로필과 커뮤니티 데이터 저장이 `permission-denied` 오류로 차단됩니다.

## 2. 관리자 계정

Authentication의 사용자 목록에 다음 계정이 있어야 합니다.

- 이메일: `admin@school-fe512.firebaseapp.com`
- 앱 로그인 ID: `admin`
- 비밀번호: 사용자가 Firebase에 직접 등록한 관리자 비밀번호

관리자 비밀번호는 HTML이나 JavaScript에 저장되지 않습니다.

## 3. 학생 로그인 베타 구조

학생이 최초 로그인하면 다음 내부 이메일 계정이 자동 생성됩니다.

`2026-2-05-05@student.baemoon.app`

학생 화면에는 이메일이 표시되지 않습니다.

현재 베타 버전은 학교 명단을 아직 업로드하지 않았기 때문에, 해당 학번으로 **처음 로그인한 이름이 서버 프로필에 등록**됩니다. 정식 출시 전에는 학교 학생 명단 CSV와 Cloud Functions 검증을 추가해야 합니다.

## 4. 현재 Firebase에 연결된 기능

- 학생 Firebase 계정 생성 및 로그인
- 관리자 Firebase 로그인
- 익명 게스트 로그인
- 로그인 상태 유지
- 학생 프로필 Firestore 저장
- 실명 커뮤니티 게시글 공유
- 좋아요, 댓글, 신고
- 관리자 게시글 고정·숨김·삭제
- 관리자 학생 계정 활성·정지

## 5. 아직 기기 내부 저장 방식인 기능

- 학교 공지
- 오늘의 배문
- 축제·부스·메뉴·일정
- 예약
- 알림함
- 게스트 공개 설정
- 사진 전용 Storage 업로드

다음 단계에서 이 항목들을 Firestore와 Cloud Storage로 순서대로 옮겨야 합니다.


## v10에서 추가된 Firestore 컬렉션

- `festivals`: 축제, 부스, 먹거리, 행사 일정
- `meals`: 날짜별 급식

기존 규칙을 사용하면 이 두 컬렉션이 차단됩니다. ZIP에 포함된 최신 `firestore.rules` 전체를 다시 복사해 Firebase 콘솔의 Firestore → 규칙에 붙여 넣고 게시하세요.

관리자가 v9에서 수정해 둔 축제가 있다면 **그 수정 작업을 했던 기기에서 v10 관리자 로그인을 한 번 해야** 해당 localStorage 축제가 Firestore로 자동 이전됩니다.
