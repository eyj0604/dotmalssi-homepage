import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

const root = process.cwd();
const maxBytes = 5 * 1024 * 1024;
const blockedExtensions = new Set([
  ".3ds",
  ".7z",
  ".a26",
  ".a52",
  ".a78",
  ".bin",
  ".bios",
  ".ccd",
  ".chd",
  ".cia",
  ".col",
  ".cso",
  ".cue",
  ".dll",
  ".dol",
  ".elf",
  ".exe",
  ".fds",
  ".gb",
  ".gba",
  ".gbc",
  ".gcz",
  ".gen",
  ".gg",
  ".gz",
  ".img",
  ".int",
  ".iso",
  ".j64",
  ".jks",
  ".kdbx",
  ".key",
  ".keystore",
  ".lnx",
  ".mdf",
  ".mds",
  ".n64",
  ".nds",
  ".nes",
  ".ngc",
  ".ngp",
  ".p12",
  ".pbp",
  ".pce",
  ".pem",
  ".pfx",
  ".rar",
  ".rom",
  ".rvz",
  ".sav",
  ".sfc",
  ".smc",
  ".sms",
  ".srm",
  ".tar",
  ".v64",
  ".vb",
  ".wad",
  ".wbfs",
  ".ws",
  ".wsc",
  ".z64",
  ".zip",
]);
const sensitiveNames = new Set([
  ".netrc",
  ".npmrc",
  ".pypirc",
  "credentials",
  "credentials.json",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "id_rsa",
]);

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
  return null;
}

const git = findGit();
if (!git) {
  console.error("public-repo-check: Git executable not found");
  process.exit(2);
}

function runGit(args) {
  return spawnSync(git, args, { cwd: root, encoding: "utf8" });
}

const inventory = runGit([
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "-z",
]);
if (inventory.error || inventory.status !== 0) {
  console.error("public-repo-check: git file inventory failed");
  process.exit(2);
}

const files = inventory.stdout.split("\0").filter(Boolean).sort();
const findings = [];
const add = (path, rule) => findings.push({ path, rule });

const textRules = [
  ["private-key-marker", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ["github-fine-grained-token", /\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ["openai-style-secret", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  [
    "generic-secret-assignment",
    /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|password|passwd|secret|token)\s*[:=]\s*["']?[A-Za-z0-9_./+@-]{8,}/i,
  ],
  [
    "absolute-home-path",
    /(?:[A-Za-z]:[\\/]Users[\\/][^\\/\s]+|\/home\/[^/\s]+|\/Users\/[^/\s]+)/,
  ],
];
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const noreplyPattern = /^(?:[^@\s]+@users\.noreply\.github\.com|noreply@github\.com)$/i;
const urlPattern = /https?:\/\/[^\s<>()"']+/gi;
const blockedUrlPayload = /\.(?:3ds|7z|a26|a52|a78|bin|bios|ccd|chd|cia|col|cso|cue|fds|gb|gba|gbc|gcz|gen|gg|gz|img|int|iso|j64|lnx|mdf|mds|n64|nds|nes|ngc|ngp|pbp|pce|rar|rom|rvz|sav|sfc|smc|sms|srm|state[^/?#&=\s]*|tar|v64|vb|wad|wbfs|ws|wsc|z64|zip)(?:$|[/?#&=])/i;

function isSensitivePath(path) {
  const name = basename(path).toLowerCase();
  return (
    name === ".env" ||
    name.startsWith(".env.") ||
    sensitiveNames.has(name) ||
    name.startsWith("credentials.") ||
    name.startsWith("secrets.")
  );
}

function looksBinary(bytes) {
  if (bytes.includes(0)) return true;
  if (bytes.length === 0) return false;
  let controls = 0;
  for (const byte of bytes) {
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) controls += 1;
  }
  return controls / bytes.length > 0.02;
}

function hasBlockedUrl(text) {
  for (const raw of text.match(urlPattern) ?? []) {
    const trimmed = raw.replace(/[.,;:!?]+$/, "");
    try {
      const parsed = new URL(trimmed);
      const payload = decodeURIComponent(`${parsed.pathname}${parsed.search}`);
      if (blockedUrlPayload.test(`${payload}&`)) return true;
    } catch {
      return true;
    }
  }
  return false;
}

for (const path of files) {
  const fullPath = resolve(root, path);
  const stat = lstatSync(fullPath);

  if (stat.isSymbolicLink()) {
    add(path, "symlink");
    continue;
  }
  if (!stat.isFile()) continue;
  if (isSensitivePath(path)) {
    add(path, "sensitive-filename");
    continue;
  }

  const lowerPath = path.toLowerCase();
  const extension = extname(lowerPath);
  if (blockedExtensions.has(extension) || /\.state[^/\\]*$/i.test(lowerPath)) {
    add(path, "blocked-public-file-type");
    continue;
  }
  if (stat.size > maxBytes) {
    add(path, "file-over-5-mib");
    continue;
  }

  const bytes = readFileSync(fullPath);
  if (looksBinary(bytes)) {
    add(path, "unapproved-binary");
    continue;
  }

  const text = bytes.toString("utf8");
  for (const [rule, pattern] of textRules) {
    if (pattern.test(text)) add(path, rule);
  }
  for (const email of text.match(emailPattern) ?? []) {
    if (!noreplyPattern.test(email)) add(path, "personal-email");
  }
  if (hasBlockedUrl(text)) add(path, "direct-rom-or-disc-url");
}

const head = runGit(["rev-parse", "--verify", "HEAD"]);
if (!head.error && head.status === 0) {
  const history = runGit(["log", "HEAD", "--format=%H%x09%ae%x09%ce"]);
  if (history.error || history.status !== 0) {
    console.error("public-repo-check: commit metadata audit failed");
    process.exit(2);
  }
  for (const line of history.stdout.split(/\r?\n/).filter(Boolean)) {
    const [commit, authorEmail, committerEmail] = line.split("\t");
    if (!noreplyPattern.test(authorEmail) || !noreplyPattern.test(committerEmail)) {
      add(commit, "commit-email-not-noreply");
    }
  }
}

if (findings.length > 0) {
  console.error(`public-repo-check: ${findings.length} finding(s)`);
  for (const finding of findings) {
    console.error(`- ${finding.path}: ${finding.rule}`);
  }
  process.exit(1);
}

console.log(`public-repo-check: PASS (${files.length} files)`);
