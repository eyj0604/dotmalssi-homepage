import Image from "next/image";
import FeedbackSection from "./feedback-section";

const projects = [
  {
    id: "lunar",
    title: "Lunar Legend GBA",
    platform: "GAME BOY ADVANCE",
    status: "번역 · 교차 검수",
    tone: "active",
    summary:
      "검수 대기분을 먼저 줄이는 활성 프로젝트입니다. 새 번역보다 검수 부채 해소를 우선합니다.",
    next: "다음 게이트 · 검수 대기 505건 축소와 단계 상태 일치",
    stats: ["전체 10,144", "완료 1,049", "검수 대기 505"],
  },
  {
    id: "dbz2",
    title: "DBZ: Legacy of Goku 2",
    platform: "GAME BOY ADVANCE",
    status: "공개 RC2",
    tone: "release",
    summary:
      "v1.0-rc2가 현재 공개 배포 정본입니다. RC는 안정판과 구분해 표시합니다.",
    next: "주간 릴리스 리허설 1/3 · 공개 쓰기 OFF · 다음 게이트는 연속 플레이스루",
  },
  {
    id: "dbz1",
    title: "DBZ: Legacy of Goku 1",
    platform: "GAME BOY ADVANCE",
    status: "릴리스 전 QA",
    tone: "qa",
    summary:
      "번역 결과와 기술 상태를 다시 확인하고, 사람 플레이스루와 최종 승인을 기다립니다.",
    next: "다음 게이트 · 전체 플레이스루와 정확한 릴리스 승인",
  },
  {
    id: "aretha",
    title: "Aretha",
    platform: "RESEARCH ARCHIVE",
    status: "분석 자료 보존",
    tone: "archive",
    summary:
      "과거 자료는 분석 단서로만 보존합니다. 오염된 삽입·빌드 계통은 현행 작업으로 승격하지 않습니다.",
    next: "다음 게이트 · 검증된 원본에서 새 라운드트립 빌드",
  },
];

const staff = [
  {
    number: "01",
    name: "매듭",
    role: "코디네이터",
    line: "범위와 담당, revision을 묶고 증거가 갖춰질 때만 작업을 닫습니다.",
  },
  {
    number: "02",
    name: "이음",
    role: "번역 · 문맥",
    line: "원문과 장면, 인물 관계를 이어 자연스러운 한국어를 만들고 추측은 표시합니다.",
  },
  {
    number: "03",
    name: "되짚",
    role: "독립 교차검수",
    line: "번역자와 다른 눈으로 원문부터 다시 읽어 오류와 취향을 구분합니다.",
  },
  {
    number: "04",
    name: "눈금",
    role: "운영 · 엔지니어링 QA",
    line: "해시와 수치, diff와 테스트로 결과와 실패 지점을 재현합니다.",
  },
];

const workflow = [
  {
    number: "01",
    title: "문맥을 잇습니다",
    body: "한 장면만 떼어 보지 않고 인물 관계, 앞뒤 대사, 승인 용어를 함께 읽습니다.",
    owner: "이음",
  },
  {
    number: "02",
    title: "다른 눈으로 되짚습니다",
    body: "번역자가 아닌 검수자가 원문과 승인 규칙부터 독립적으로 다시 읽습니다.",
    owner: "되짚",
  },
  {
    number: "03",
    title: "수치로 확인합니다",
    body: "허용 범위, 해시, diff, 검사 명령과 종료 코드를 증거에 남깁니다.",
    owner: "눈금",
  },
  {
    number: "04",
    title: "사람이 마지막을 정합니다",
    body: "용어·말투·의역·배포는 정확한 revision을 본 사용자가 최종 승인합니다.",
    owner: "사용자",
  },
];

const releaseWave = ["마침", "꾸림", "기록", "첫빛"];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "도트말씨",
  alternateName: "DOTMALSSI",
  description:
    "원문·독립 검수·기술 QA·사용자 승인을 근거로 레트로 게임을 한국어로 잇는 비공식 팬 한글화 공방",
  sameAs: ["https://github.com/eyj0604/dotmalssi-homepage"],
};

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        본문으로 바로가기
      </a>

      <header className="site-header">
        <div className="shell header-inner">
          <a className="brand-link" href="#top" aria-label="도트말씨 홈으로">
            <picture>
              <source
                media="(max-width: 239px)"
                srcSet="/brand/dotmalssi-mark.svg"
              />
              <source
                media="(max-width: 639px)"
                srcSet="/brand/dotmalssi-compact.svg"
              />
              <img
                className="brand-logo"
                src="/brand/dotmalssi-horizontal.svg"
                alt="도트말씨 — 레트로 게임 한글화 공방"
                width="800"
                height="188"
              />
            </picture>
            <span className="micro-brand-credit">도트말씨</span>
          </a>

          <nav className="primary-nav" aria-label="주요 메뉴">
            <a href="#projects">프로젝트</a>
            <a href="#team">팀</a>
            <a href="#workflow">작업 방식</a>
            <a href="#feedback">이야기함</a>
            <a href="#principles">안전 원칙</a>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="shell hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">
                <span aria-hidden="true" /> EVIDENCE-LED LOCALIZATION
              </p>
              <h1 id="hero-title">
                옛 게임의 말씨를
                <strong>한 칸씩, 근거로 완성한다.</strong>
              </h1>
              <p className="hero-lede">
                원문과 인물 관계를 잇고, 번역자와 다른 눈으로 되짚고,
                해시·수치·테스트로 확인합니다. 마지막 결정은 사용자에게
                있습니다.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href="#projects">
                  진행 현황 보기 <span aria-hidden="true">↓</span>
                </a>
                <a className="button button-secondary" href="#workflow">
                  작업 원칙 보기
                </a>
              </div>
              <p className="hero-note">
                현황 기준 <time dateTime="2026-07-15">2026.07.15</time> ·
                배정 전 정본에서 다시 측정합니다.
              </p>
            </div>

            <aside className="proof-console" aria-label="도트말씨 검증 흐름">
              <div className="console-topline">
                <span>DOTMALSSI / CONTROL ROOM</span>
                <span className="console-status">LOCAL</span>
              </div>
              <div className="console-mark-row">
                <Image
                  src="/brand/dotmalssi-mark.svg"
                  width={168}
                  height={168}
                  alt=""
                  aria-hidden="true"
                />
                <p>
                  네 개의 실행 자리,
                  <br />한 사람의 최종 승인.
                </p>
              </div>
              <ol className="console-steps">
                <li>
                  <span>01</span> 원문 · 문맥
                </li>
                <li>
                  <span>02</span> 독립 검수
                </li>
                <li>
                  <span>03</span> 기술 QA
                </li>
                <li className="is-human">
                  <span>04</span> 사용자 승인
                </li>
              </ol>
              <p className="console-foot">AUTO RELEASE: OFF</p>
            </aside>
          </div>
        </section>

        <section className="signal-strip" aria-label="도트말씨 핵심 운영 수치">
          <div className="shell signal-grid">
            <p>
              <strong>4석</strong>
              <span>상황 기반 자동 배치</span>
            </p>
            <p>
              <strong>1개</strong>
              <span>한 작업의 대상 프로젝트</span>
            </p>
            <p>
              <strong>필수</strong>
              <span>자동 검증 게이트</span>
            </p>
            <p>
              <strong>사용자</strong>
              <span>최종 언어·배포 승인</span>
            </p>
          </div>
        </section>

        <section className="section projects-section" id="projects">
          <div className="shell">
            <div className="section-heading">
              <div>
                <p className="section-kicker">PROJECT STATUS</p>
                <h2>작업실은 상태를 과장하지 않습니다.</h2>
              </div>
              <p>
                작업 완료, 공개 후보, 정식판을 서로 다른 상태로 기록합니다.
                아래 수치는 정본 문서의 기준일 스냅샷입니다.
              </p>
            </div>

            <div className="project-grid">
              {projects.map((project) => (
                <article className={`project-card project-${project.id}`} key={project.id}>
                  <div className="project-meta">
                    <span>{project.platform}</span>
                    <span className={`status-badge status-${project.tone}`}>
                      {project.status}
                    </span>
                  </div>
                  <h3>{project.title}</h3>
                  <p className="project-summary">{project.summary}</p>
                  {project.stats ? (
                    <ul className="project-stats" aria-label="2026년 7월 14일 참고 수치">
                      {project.stats.map((stat) => (
                        <li key={stat}>{stat}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="project-next">{project.next}</p>
                </article>
              ))}
            </div>

            <p className="snapshot-note">
              Lunar 수치는 참고 스냅샷입니다. 실제 배치 전에는 프로젝트의
              실시간 상태 명령으로 다시 측정합니다.
            </p>
          </div>
        </section>

        <section className="section team-section" id="team">
          <div className="shell">
            <div className="section-heading section-heading-light">
              <div>
                <p className="section-kicker">THE FOUR SEATS</p>
                <h2>이름보다 역할이 먼저 움직입니다.</h2>
              </div>
              <p>
                호출명은 실제 인간 직원 계정이 아니라 네 실행 자리의 업무 습관입니다.
                사용자가 이름을 부르지 않아도 상황에 맞는 자리가 자동으로 참여합니다.
              </p>
            </div>

            <div className="staff-grid">
              {staff.map((member) => (
                <article className="staff-card" key={member.number}>
                  <div className="staff-card-top">
                    <span className="staff-number">{member.number}</span>
                    <span className="staff-role">{member.role}</span>
                  </div>
                  <h3>{member.name}</h3>
                  <p>{member.line}</p>
                </article>
              ))}
            </div>

            <div className="human-gate">
              <span className="human-tile" aria-hidden="true" />
              <div>
                <p className="section-kicker">FINAL AUTHORITY</p>
                <h3>네 자리 밖의 사용자</h3>
              </div>
              <p>
                용어, 말투, 의역, 공개 배포는 사용자가 정확한 revision과 산출물을
                보고 최종 결정합니다.
              </p>
            </div>
          </div>
        </section>

        <section className="section workflow-section" id="workflow">
          <div className="shell">
            <div className="section-heading">
              <div>
                <p className="section-kicker">HOW WE WORK</p>
                <h2>한 문장을 네 번 믿는 대신, 네 단계로 확인합니다.</h2>
              </div>
              <p>
                확정 사실, 가설, 사람 결정 대기를 분리하고 다음 담당자가 같은
                결과를 재현할 수 있게 증거를 남깁니다.
              </p>
            </div>

            <ol className="workflow-grid">
              {workflow.map((step) => (
                <li className="workflow-card" key={step.number}>
                  <span className="workflow-number">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  <span className="workflow-owner">담당 · {step.owner}</span>
                </li>
              ))}
            </ol>

            <div className="release-wave" aria-labelledby="release-title">
              <div>
                <p className="section-kicker">RELEASE WAVE</p>
                <h3 id="release-title">공개 직전에는 같은 네 자리가 옷을 바꿉니다.</h3>
              </div>
              <ol aria-label="배포 검증 순서">
                {releaseWave.map((name, index) => (
                  <li key={name}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {name}
                  </li>
                ))}
              </ol>
              <p>
                후보 동결 → 패키지 구성 → 독립 기록 검수 → 빈 환경 클린 적용.
                로컬 완료는 자동 업로드가 아닙니다.
              </p>
            </div>
          </div>
        </section>

        <section className="section principles-section" id="principles">
          <div className="shell principles-grid">
            <div className="principles-intro">
              <p className="section-kicker">TRUST BY DESIGN</p>
              <h2>좋은 한글화는 공개하지 않는 것도 분명합니다.</h2>
              <p>
                원작을 존중하고 사용자가 재현할 수 있는 차분과 문서만 안전하게
                전달합니다.
              </p>
            </div>
            <div className="principle-list">
              <article>
                <span aria-hidden="true">01</span>
                <div>
                  <h3>ROM은 다루되 배포하지 않습니다.</h3>
                  <p>원본·패치 ROM, BIOS, 세이브, 세이브스테이트는 공개 저장소와 패키지에서 제외합니다.</p>
                </div>
              </article>
              <article>
                <span aria-hidden="true">02</span>
                <div>
                  <h3>승인은 정확한 파일에만 묶습니다.</h3>
                  <p>한 바이트라도 바뀌면 검수와 배포 승인을 다시 받습니다.</p>
                </div>
              </article>
              <article>
                <span aria-hidden="true">03</span>
                <div>
                  <h3>실패도 위치를 남깁니다.</h3>
                  <p>검사 명령, 종료 코드, 전후 해시와 다음 담당자를 기록합니다.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <FeedbackSection />

        <section className="closing-section" aria-labelledby="closing-title">
          <div className="shell closing-grid">
            <div>
              <p className="section-kicker">BUILD WITH US</p>
              <h2 id="closing-title">기록이 쌓일수록 말씨는 더 또렷해집니다.</h2>
            </div>
            <div>
              <p>
                공개 가능한 코드와 작업 기록은 GitHub에서 차근차근 정리합니다.
                패치 다운로드는 정확한 릴리스 승인과 검증이 끝난 항목에만 열립니다.
              </p>
              <a
                className="button button-gold"
                href="https://github.com/eyj0604/dotmalssi-homepage"
                target="_blank"
                rel="noreferrer"
              >
                GitHub에서 보기 <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell footer-grid">
          <div className="footer-brand">
            <Image
              src="/brand/dotmalssi-compact.svg"
              width={480}
              height={120}
              alt="도트말씨"
            />
            <p>한글화: 도트말씨</p>
          </div>
          <div className="footer-notice">
            <p>비공식 팬 한글화이며 원작 권리자와 무관합니다.</p>
            <p>이 사이트는 ROM·BIOS·세이브 파일을 제공하지 않습니다.</p>
          </div>
          <p className="footer-copy">© 2026 DOTMALSSI. 기록과 근거로 이어갑니다.</p>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
}
