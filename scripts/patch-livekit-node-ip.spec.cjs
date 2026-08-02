const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  patchLivekitYaml,
  verifyLivekitYaml,
  patchLivekitConfigFile,
  validateNodeIp,
  countRtcSections,
  extractNodeIpLines,
} = require("./lib/patch-livekit-node-ip.cjs");

const TEMPLATE = `port: 7880
bind_addresses:
  - 0.0.0.0
rtc:
  tcp_port: 7881
  udp_port: 7882
  # node_ip patched at deploy (LIVEKIT_NODE_IP or public IP auto-detect).
  use_external_ip: false
logging:
  level: info
`;

const PUBLIC_IP = "203.0.113.50";

function tempYaml(initial = TEMPLATE) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "livekit-patch-"));
  const file = path.join(dir, "livekit.yaml");
  fs.writeFileSync(file, initial, "utf8");
  return { dir, file };
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}: ${err.message}`);
  }
}

test("node_ip absent — patch inserts exactly one line", () => {
  const patched = patchLivekitYaml(TEMPLATE, PUBLIC_IP);
  assert.strictEqual(extractNodeIpLines(patched).length, 1);
  assert.match(patched, /^  node_ip: 203\.0\.113\.50$/m);
  assert.strictEqual(countRtcSections(patched), 1);
  const verify = verifyLivekitYaml(patched, PUBLIC_IP);
  assert.strictEqual(verify.ok, true);
});

test("node_ip already exists — replace value, no duplicate", () => {
  const existing = patchLivekitYaml(TEMPLATE, "198.51.100.10");
  const replaced = patchLivekitYaml(existing, PUBLIC_IP);
  assert.strictEqual(extractNodeIpLines(replaced).length, 1);
  assert.match(replaced, /^  node_ip: 203\.0\.113\.50$/m);
  assert.doesNotMatch(replaced, /198\.51\.100\.10/);
});

test("invalid IP — private RFC1918 rejected", () => {
  assert.throws(() => patchLivekitYaml(TEMPLATE, "10.0.0.1"), /private RFC1918/);
  assert.throws(() => patchLivekitYaml(TEMPLATE, "192.168.1.1"), /private RFC1918/);
  assert.throws(() => patchLivekitYaml(TEMPLATE, "172.17.0.2"), /private RFC1918/);
});

test("invalid IP — localhost rejected", () => {
  assert.throws(() => patchLivekitYaml(TEMPLATE, "127.0.0.1"), /localhost/);
});

test("empty variable rejected", () => {
  const v = validateNodeIp("");
  assert.strictEqual(v.ok, false);
  assert.throws(() => patchLivekitYaml(TEMPLATE, ""), /empty/);
});

test("repeated deployments — idempotent identical output", () => {
  let content = TEMPLATE;
  for (let i = 0; i < 10; i += 1) {
    content = patchLivekitYaml(content, PUBLIC_IP);
  }
  assert.strictEqual(extractNodeIpLines(content).length, 1);
  assert.strictEqual(countRtcSections(content), 1);
  const expected = patchLivekitYaml(TEMPLATE, PUBLIC_IP);
  assert.strictEqual(content, expected);
});

test("duplicate node_ip lines cleaned on re-patch", () => {
  const broken = TEMPLATE.replace(
    "  use_external_ip: false",
    "  node_ip: 1.2.3.4\n  node_ip: 5.6.7.8\n  use_external_ip: false"
  );
  const fixed = patchLivekitYaml(broken, PUBLIC_IP);
  assert.strictEqual(extractNodeIpLines(fixed).length, 1);
  assert.match(fixed, /^  node_ip: 203\.0\.113\.50$/m);
});

test("verify fails DEP-LIVEKIT-001 when node_ip missing", () => {
  const verify = verifyLivekitYaml(TEMPLATE, PUBLIC_IP);
  assert.strictEqual(verify.ok, false);
  assert.strictEqual(verify.code, "DEP-LIVEKIT-001");
  assert.match(verify.reason, /missing after patch/);
});

test("patchLivekitConfigFile writes and verifies on disk", () => {
  const { dir, file } = tempYaml();
  try {
    const first = patchLivekitConfigFile(file, PUBLIC_IP);
    assert.strictEqual(first.changed, true);
    assert.strictEqual(first.nodeIp, PUBLIC_IP);
    const second = patchLivekitConfigFile(file, PUBLIC_IP);
    assert.strictEqual(second.changed, false);
    const onDisk = fs.readFileSync(file, "utf8");
    assert.strictEqual(extractNodeIpLines(onDisk).length, 1);
  } finally {
    cleanup(dir);
  }
});

test("valid public IPv4 accepted", () => {
  const v = validateNodeIp("8.8.8.8");
  assert.strictEqual(v.ok, true);
  const patched = patchLivekitYaml(TEMPLATE, "8.8.8.8");
  assert.match(patched, /^  node_ip: 8\.8\.8\.8$/m);
});

console.log(`\nLiveKit node_ip patch tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
