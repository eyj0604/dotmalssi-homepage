import { appendFileSync, readFileSync } from "node:fs";

const planUrl = new URL("../automation/release-plan.json", import.meta.url);
const plan = JSON.parse(readFileSync(planUrl, "utf8"));
const errors = [];
const projectReports = [];
const sha256Pattern = /^[0-9A-F]{64}$/;

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
  if (
    !project.id ||
    !project.status_source ||
    !project.release_channel ||
    !project.required_sprint_id ||
    !project.expected_release_version ||
    !project.expected_approval_decision ||
    !project.expected_package_sha256 ||
    !project.expected_sprint_evidence_sha256 ||
    !project.expected_readiness_script_sha256
  ) {
    errors.push("project entry is missing a routing field");
    continue;
  }
  if (!/^automation\/projects\/[a-z0-9_-]+\.json$/.test(project.status_source)) {
    errors.push(`${project.id}: status_source must be a local automation snapshot`);
    continue;
  }
  if (project.project_write_enabled !== false) {
    errors.push(`${project.id}: project writes must remain disabled`);
  }

  try {
    const sourceUrl = new URL(`../${project.status_source}`, import.meta.url);
    const snapshot = JSON.parse(readFileSync(sourceUrl, "utf8"));
    const projectChecks = {
      schema: snapshot.schema_version === 1,
      identity: snapshot.id === project.id,
      release_channel: snapshot.release_channel === project.release_channel,
      sprint: snapshot.manual_sprint_id === project.required_sprint_id,
      sprint_passed: snapshot.manual_sprint_result === "pass",
      release_version: snapshot.release_version === project.expected_release_version,
      approval_decision: snapshot.approval_decision === project.expected_approval_decision,
      package_sha256:
        sha256Pattern.test(project.expected_package_sha256) &&
        snapshot.canonical_package_sha256 === project.expected_package_sha256,
      evidence_sha256:
        sha256Pattern.test(project.expected_sprint_evidence_sha256) &&
        snapshot.sprint_evidence_sha256 === project.expected_sprint_evidence_sha256,
      readiness_script_sha256:
        sha256Pattern.test(project.expected_readiness_script_sha256) &&
        snapshot.readiness_script_sha256 === project.expected_readiness_script_sha256,
      public_write_disabled: snapshot.public_write_enabled === false,
      stable_gate:
        snapshot.full_playthrough_verified === true || snapshot.stable_v1_ready === false,
    };
    const failures = Object.entries(projectChecks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);
    if (failures.length) errors.push(`${project.id}: ${failures.join(", ")}`);
    projectReports.push({
      id: project.id,
      release_status: snapshot.release_status,
      release_version: snapshot.release_version,
      manual_sprint_id: snapshot.manual_sprint_id,
      stable_v1_ready: snapshot.stable_v1_ready,
      public_write_enabled: snapshot.public_write_enabled,
      ready: failures.length === 0,
      failures,
    });
  } catch (error) {
    errors.push(`${project.id}: cannot read status snapshot (${error.code ?? "invalid_json"})`);
  }
}

const manualGatesComplete =
  plan.manual_release_sprints_completed >= plan.manual_release_sprints_required &&
  plan.projects.length > 0 &&
  projectReports.length === plan.projects.length &&
  projectReports.every((project) => project.ready);
const readyForWriteAutomation = manualGatesComplete && plan.public_write_enabled === true;
const report = {
  ok: errors.length === 0,
  mode: plan.mode,
  schedule: `${plan.schedule} ${plan.timezone}`,
  configured_projects: plan.projects.length,
  manual_sprints: `${plan.manual_release_sprints_completed}/${plan.manual_release_sprints_required}`,
  manual_gates_complete: manualGatesComplete,
  ready_for_write_automation: readyForWriteAutomation,
  public_write_enabled: plan.public_write_enabled,
  projects: projectReports,
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
      `- 수동 게이트 완료: ${report.manual_gates_complete ? "YES" : "NO"}`,
      `- 반복 공개 쓰기: ${report.public_write_enabled ? "ON" : "OFF"}`,
      `- 쓰기 자동화 준비: ${report.ready_for_write_automation ? "YES" : "NO"}`,
      ...report.projects.map(
        (project) =>
          `- ${project.id}: ${project.release_version} / sprint ${project.manual_sprint_id} / ${project.ready ? "PASS" : "FAIL"}`,
      ),
      "",
    ].join("\n"),
  );
}

console.log(JSON.stringify(report));
if (errors.length) process.exit(1);
