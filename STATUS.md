![도트말씨](public/brand/dotmalssi-horizontal.svg)

# 홈페이지 현황

- 현재 공개 버전: `0.1.2`
- 다음 코드 후보: `0.1.4`, 브라우저 로컬 BPS 패처와 제보 메일
- 상태: v0.1.2 공개 운영 중, D1·주간 읽기 전용 준비 점검 배포 및 실환경 확인 완료
- 현재 공개 Sites revision: `43e22a1b2b2718b9b0cca42b4c6770bf009a8aac`
- 공개 주소: `https://dotmalssi.eyj0604.chatgpt.site`
- GitHub 저장소: `main` 공개 운영 중
- GitHub 주소: `https://github.com/eyj0604/dotmalssi-homepage`
- 자동 공개 동기화: 꺼짐
- 주간 패치 공개 자동화: 꺼짐, DBZ2 수동 리허설 `1/3`, 읽기 전용 준비 점검만 활성
- 이용자 글 접수: 꺼짐, `FEEDBACK_WRITE_ENABLED=false`; 물리 삭제 게이트와 별도 사용자 승인 전 활성화 금지
- 자동답변 생성·공개: 꺼짐, 사람 승인 뒤에만 답변 큐로 보낼 수 있는 DB 기반 후보
- 패치 다운로드: 승인된 패치가 없어 계속 꺼짐
- 브라우저 패처: 로컬 후보에만 구현, 사용자가 직접 선택한 원본·BPS를 브라우저
  안에서 적용하며 서버 전송 없음
- 오류·수정 제보: `eyj79@naver.com`
- 기준 프로젝트 현황: `2026-07-20`

## v0.1.2 공개 배포

- exact revision `43e22a1b2b2718b9b0cca42b4c6770bf009a8aac` GitHub·Sites 공개 완료
- Sites D1 baseline migration과 비공개 pepper 적용, `FEEDBACK_WRITE_ENABLED=false` 유지
- 실제 `/api/feedback` 읽기 200, 비로그인 쓰기 401, 공개 글 0건 확인
- GitHub Validate website와 Weekly release readiness 수동 실행 통과
- 이용자 글 접수 활성화: BLOCKED, 물리 삭제·실제 D1·별도 호스팅 승인 필요

## v0.1.4 로컬 후보 게이트

- DBZ2 기존 공개 RC2 수동 릴리스 리허설 01: 제작자·검수자 29/29, mGBA 6/6, 독립 PASS
- DBZ2 고정 상태 스냅샷: ROM·패치 파일 없이 해시·승인·stable 차단 상태만 포함
- 반복 공개 쓰기: OFF, 리허설 `1/3`, kill switch ON
- Lunar Legend v0.9.0-rc2: 기술 후보 확인, 구형 갈무리M 권리 조건과 공개
  패키지 게이트 미충족으로 다운로드·내장 패치 목록 등록 금지
- 범용 BPS 패처: 원본·패치 CRC32와 BPS 자체 체크섬 검증, 64 MiB 상한,
  브라우저 로컬 처리, 결과 SHA-256 표시
- GitHub·Sites v0.1.4 공개: 자동 검사·독립 검수·새 exact revision 사용자 승인 전 금지

로컬 변경은 홈페이지에 자동 반영하지 않는다. 자동 검사와 독립 검수 뒤 정확한
revision을 사용자가 승인한 경우에만 GitHub와 OpenAI Sites를 갱신한다. 수동
스프린트 세 번이 상태 드리프트 없이 끝나도 공개 쓰기는 별도 승인을 받아야 한다.
