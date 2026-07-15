import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import { isFeedbackWriteEnabled } from "@/db/runtime";
import FeedbackForm from "./feedback-form";

export default async function FeedbackSection() {
  const [user, writeEnabled] = await Promise.all([
    getChatGPTUser(),
    isFeedbackWriteEnabled().catch(() => false),
  ]);

  return (
    <section className="section feedback-section" id="feedback" aria-labelledby="feedback-title">
      <div className="shell">
        <div className="section-heading">
          <div>
            <p className="section-kicker">VISITOR NOTES</p>
            <h2 id="feedback-title">남긴 글은 검토하고, 답변은 근거를 확인합니다.</h2>
          </div>
          <p>
            답변 생성기는 아직 꺼져 있습니다. 개인정보·스팸·권리 검사를 통과해 사람이
            승인한 글만 나중에 답변 작업 큐로 보낼 수 있도록 기반을 준비합니다.
          </p>
        </div>

        <div className="automation-status" role="status">
          <span>주간 점검 · READ ONLY</span>
          <span>답변 큐 · APPROVED ONLY</span>
          <span>자동 생성·공개 · OFF</span>
        </div>

        <FeedbackForm
          signedIn={Boolean(user)}
          signInPath={chatGPTSignInPath("/#feedback")}
          writeEnabled={writeEnabled}
        />
      </div>
    </section>
  );
}
