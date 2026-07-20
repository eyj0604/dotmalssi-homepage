import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const checker = fileURLToPath(
  new URL("../scripts/public-repo-check.mjs", import.meta.url),
);
const approvedSupportContact = readFileSync(
  fileURLToPath(new URL("../public/support-contact.json", import.meta.url)),
  "utf8",
);
const approvedSupportEmail = JSON.parse(approvedSupportContact).email;
const approvedSocialPreview = readFileSync(
  fileURLToPath(new URL("../public/og.png", import.meta.url)),
);

function findGit() {
  const candidates = [
    process.env.GIT_BINARY,
    "git",
    "C:\\Program Files\\Git\\cmd\\git.exe",
  ].filter(Boolean);
  for (const candidate of [...new Set(candidates)]) {
    const probe = spawnSync(candidate, ["--version"], { stdio: "ignore" });
    if (!probe.error && probe.status === 0) return candidate;
  }
  throw new Error("Git executable not found for test");
}

const git = findGit();
const safeEmail = ["eyj0604", "@", "users.noreply.github.com"].join("");

function run(root, command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function makeRepo(commitEmail = safeEmail) {
  const root = mkdtempSync(join(tmpdir(), "dotmalssi-repo-check-"));
  run(root, git, ["init", "-q"]);
  run(root, git, ["config", "user.name", "DOTMALSSI Test"]);
  run(root, git, ["config", "user.email", commitEmail]);
  writeFileSync(join(root, "README.md"), "safe public text\n", "utf8");
  run(root, git, ["add", "README.md"]);
  run(root, git, ["commit", "-qm", "test baseline"]);
  return root;
}

function check(root) {
  return spawnSync(process.execPath, [checker], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GIT_BINARY: git },
  });
}

function approveSupportContact(root) {
  const publicDir = join(root, "public");
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(
    join(publicDir, "support-contact.json"),
    approvedSupportContact,
    "utf8",
  );
}

function expectBlocked(name, create, rule, hiddenText = null) {
  test(name, () => {
    const root = makeRepo();
    try {
      create(root);
      const result = check(root);
      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, new RegExp(rule));
      if (hiddenText) assert.equal(result.stderr.includes(hiddenText), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("accepts a clean text-only public repository", () => {
  const root = makeRepo();
  try {
    const result = check(root);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("accepts the documented blank environment example", () => {
  const root = makeRepo();
  try {
    writeFileSync(
      join(root, ".env.example"),
      "FEEDBACK_ID_PEPPER=\nFEEDBACK_WRITE_ENABLED=false\n",
      "utf8",
    );
    const result = check(root);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("accepts GitHub's synthetic pull-request noreply identity", () => {
  const githubNoreply = ["noreply", "@", "github.com"].join("");
  const root = makeRepo(githubNoreply);
  try {
    const result = check(root);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("accepts only the exact approved social preview binary", () => {
  const root = makeRepo();
  try {
    const publicDir = join(root, "public");
    mkdirSync(publicDir, { recursive: true });
    writeFileSync(join(publicDir, "og.png"), approvedSocialPreview);
    const result = check(root);
    assert.equal(result.status, 0, result.stderr);

    const tampered = Buffer.from(approvedSocialPreview);
    tampered[tampered.length - 1] ^= 0xff;
    writeFileSync(join(publicDir, "og.png"), tampered);
    const rejected = check(root);
    assert.equal(rejected.status, 1, rejected.stdout);
    assert.match(rejected.stderr, /unapproved-binary/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("accepts only the exact user-approved public support contact", () => {
  const root = makeRepo();
  try {
    approveSupportContact(root);
    writeFileSync(join(root, "CONTACT.md"), `${approvedSupportEmail}\n`, "utf8");
    const result = check(root);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("still rejects a different personal email when support contact is approved", () => {
  const root = makeRepo();
  try {
    approveSupportContact(root);
    writeFileSync(
      join(root, "CONTACT.md"),
      `${["owner", "@", "example.com"].join("")}\n`,
      "utf8",
    );
    const result = check(root);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /personal-email/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const [name, mutate] of [
  [
    "email",
    (contact) => {
      contact.email = ["attacker", "@", "example.com"].join("");
    },
  ],
  [
    "revision",
    (contact) => {
      contact.revision += 1;
    },
  ],
  [
    "approval reference",
    (contact) => {
      contact.approval_reference = "FORGED-REFERENCE";
    },
  ],
]) {
  test(`rejects a normal-form support contact with tampered ${name}`, () => {
    const root = makeRepo();
    try {
      const publicDir = join(root, "public");
      mkdirSync(publicDir, { recursive: true });
      const contact = JSON.parse(approvedSupportContact);
      mutate(contact);
      writeFileSync(
        join(publicDir, "support-contact.json"),
        `${JSON.stringify(contact, null, 2)}\n`,
        "utf8",
      );
      const result = check(root);
      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, /invalid-public-contact-approval/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("rejects a malformed public support contact approval", () => {
  const root = makeRepo();
  try {
    const publicDir = join(root, "public");
    mkdirSync(publicDir, { recursive: true });
    const malformedEmail = ["support", "@", "example.com"].join("");
    writeFileSync(
      join(publicDir, "support-contact.json"),
      `${JSON.stringify({ status: "user_approved", email: malformedEmail })}\n`,
      "utf8",
    );
    const result = check(root);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /invalid-public-contact-approval/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

expectBlocked(
  "rejects a binary disguised as source",
  (root) => writeFileSync(join(root, "payload.tsx"), Buffer.from([77, 90, 0, 1])),
  "unapproved-binary",
);
expectBlocked(
  "rejects sensitive filenames",
  (root) => writeFileSync(join(root, ".env"), "safe-looking=true\n", "utf8"),
  "sensitive-filename",
);
const genericSecret = ["api", "_key = ", "test-secret-value-12345"].join("");
expectBlocked(
  "rejects generic secret assignments without printing the value",
  (root) => writeFileSync(join(root, "settings.txt"), genericSecret, "utf8"),
  "generic-secret-assignment",
  genericSecret,
);
expectBlocked(
  "rejects personal email addresses",
  (root) => {
    const email = ["owner", "@", "example.com"].join("");
    writeFileSync(join(root, "contact.txt"), email, "utf8");
  },
  "personal-email",
);
expectBlocked(
  "rejects direct ROM URLs hidden in query parameters",
  (root) => {
    const url = ["https", "://example.com/download?file=game", ".gba"].join("");
    writeFileSync(join(root, "links.md"), url, "utf8");
  },
  "direct-rom-or-disc-url",
);
expectBlocked(
  "rejects additional retro ROM extensions",
  (root) => writeFileSync(join(root, "game.pce"), "payload\n", "utf8"),
  "blocked-public-file-type",
);
expectBlocked(
  "rejects mutable GitHub Action tags",
  (root) => {
    const workflowDir = join(root, ".github", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "unsafe.yml"),
      "jobs:\n  check:\n    steps:\n      - uses: actions/checkout@v4\n",
      "utf8",
    );
  },
  "unpinned-github-action",
);

test("rejects commit metadata that exposes a personal email", () => {
  const personalEmail = ["owner", "@", "example.com"].join("");
  const root = makeRepo(personalEmail);
  try {
    const result = check(root);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /commit-email-not-noreply/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
