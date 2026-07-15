![도트말씨](public/brand/dotmalssi-horizontal.svg)

# 홈페이지 현황

- 현재 공개 버전: `0.1.1`
- 다음 코드 후보: `0.1.2`, 주간 준비 점검·이용자 글 DB 기반
- 상태: v0.1.1 공개 운영 중, v0.1.2 자동 검사 31/31·독립 검수 통과, exact 후보 생성 대기
- 현재 공개 Sites revision: `31f50ffae6591672c6016025b86c8e1288dab882`
- 공개 주소: `https://dotmalssi.eyj0604.chatgpt.site`
- GitHub 저장소: `main` 공개 운영 중
- GitHub 주소: `https://github.com/eyj0604/dotmalssi-homepage`
- 자동 공개 동기화: 꺼짐
- 주간 패치 공개 자동화: 꺼짐, 읽기 전용 준비 점검만 후보
- 이용자 글 접수: 꺼짐, `FEEDBACK_WRITE_ENABLED=false`; 물리 삭제 게이트와 별도 사용자 승인 전 활성화 금지
- 자동답변 생성·공개: 꺼짐, 사람 승인 뒤에만 답변 큐로 보낼 수 있는 DB 기반 후보
- 패치 다운로드·브라우저 패처: 현재 공개 범위 밖
- 기준 프로젝트 현황: `2026-07-14`

## v0.1.2 후보 게이트

- 구현: 보존·철회·승인 후 큐와 기본 OFF 접수 게이트 보완 완료
- 프로덕션 빌드: 통과
- 렌더·브랜드·금지 파일 자동 검사: 31/31 통과
- TypeScript: 통과
- ESLint: 통과
- 의존성 취약점: 0건
- 공개 저장소 안전 검사: 49파일 통과
- 독립 검수: 읽기 전용 v0.1.2 후보 PASS
- 이용자 글 접수 활성화: BLOCKED, 물리 삭제·실제 D1·별도 호스팅 승인 필요
- 현재 Sites v0.1.1의 HTTPS·robots·sitemap·공개 로고: 통과
- D1 migration·개인정보·스팸·권한 검사: 로컬 SQLite/service 주입 테스트 통과; 실제 Sites 로그인·D1 검사는 미실행
- GitHub·Sites v0.1.2 공개: 새 exact revision 승인 전 금지

로컬 변경은 홈페이지에 자동 반영하지 않는다. 자동 검사와 독립 검수 뒤 정확한
revision을 사용자가 승인한 경우에만 GitHub와 OpenAI Sites를 갱신한다. 수동
스프린트 세 번이 상태 드리프트 없이 끝난 뒤 읽기 전용 현황 자동화부터 검토한다.
