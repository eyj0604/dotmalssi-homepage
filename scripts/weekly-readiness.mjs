import { appendFileSync, readFileSync } from "node:fs";

const planUrl = new URL("../automation/release-plan.json", import.meta.url);
const plan = JSON.parse(readFileSync(planUrl, "utf8"));
const errors = [];

if (plan.schema_version !== 1) errors.push("unsupported schema_version");
if (plan.mode !== "read_only_readiness") errors.push("mode must remain read_only_readiness");
if (plan.public_write_enabled !== false) errors.push("public writes must remain disabled");
if (plan.kill_switch !== true) errors.push("kill switch is required");
if (plan.max_retries !== 2) errors.push("max_retries must be 2");
if (!Array.isArray(plan.projects)) errors.push("projects must be an array");
if (plan.manual_release_sprints_completed > plan.manual_release_sprints_required) {
  errors.push("manual sprint count is invalid");
}

for (const project of plan.projects ?? []) {
  if (!project.id || !project.status_source || !project.release_channel) {
    errors.push("project entry is missing a routing field");
  }
}

const readyForWriteAutomation =
  plan.manual_release_sprints_completed >= plan.manual_release_sprints_required &&
  plan.projects.length > 0;
const report = {
  ok: errors.length === 0,
  mode: plan.mode,
  schedule: `${plan.schedule} ${plan.timezone}`,
  configured_projects: plan.projects.length,
  manual_sprints: `${plan.manual_release_sprints_completed}/${plan.manual_release_sprints_required}`,
  ready_for_write_automation: readyForWriteAutomation,
  public_write_enabled: plan.public_write_enabled,
  errors,
};

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      "## 도트말씨 주간 배포 준비 점검",
      "",
      `- 모드: ${report.mode}`,
      `- 대상 프로젝트: ${report.configured_projects}`,
      `- 수동 릴리스 스프린트: ${report.manual_sprints}`,
      `- 반복 공개 쓰기: ${report.public_write_enabled ? "ON" : "OFF"}`,
      `- 쓰기 자동화 준비: ${report.ready_for_write_automation ? "YES" : "NO"}`,
      "",
    ].join("\n"),
  );
}

console.log(JSON.stringify(report));
if (errors.length) process.exit(1);
