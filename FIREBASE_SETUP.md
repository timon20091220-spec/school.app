# 배문고 앱 v11 Firebase 설정

## 1. Authentication
- 이메일/비밀번호 사용 설정
- 익명 로그인 사용 설정
- 관리자 사용자 이메일: `admin@school-fe512.firebaseapp.com`

## 2. Firestore 규칙
ZIP에 포함된 `firestore.rules` 전체를 Firebase 콘솔 → Firestore Database → 규칙에 붙여 넣고 게시하세요.

## 3. v11에서 사용하는 데이터
- users
- communityPosts
- communityReports
- festivals
- meals
- notices
- dailySchedules
- settings/guestAccess
- reservations
- broadcastNotifications
- userNotifications/{uid}/items
- notificationPreferences/{uid}
- notificationStates/{uid}/items
- media
- adminBackups

## 4. 기존 데이터 이전
- 관리자 기기에서 처음 로그인하면 축제·급식·공지·오늘 일정·게스트 설정·예약을 이전합니다.
- 학생 기기에서 처음 로그인하면 해당 학생의 커뮤니티 글·예약·알림을 이전합니다.
- 이전이 끝날 때까지 해당 기기의 사이트 데이터는 삭제하지 마세요.

## 5. 사진 저장 방식
Firebase Storage 대신 Firestore의 `media` 컬렉션에 압축 사진을 개별 문서로 저장합니다. 따라서 별도의 Storage 설정이나 결제 업그레이드 없이 실행할 수 있지만, 사진 한 장은 압축 후 약 600KB 이하로 제한됩니다.
