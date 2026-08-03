const fs = require("fs");
const path = require("path");

const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

const DEP_CODE = "DEP-LIVEKIT-001";

function isPrivateOrLocalIp(ip) {
  if (!ip || typeof ip !== "string" || !ip.trim()) {
    return "empty";
  }
  const trimmed = ip.trim();
  if (!IPV4_REGEX.test(trimmed)) {
    return "invalid IPv4";
  }
  if (trimmed === "0.0.0.0") {
    return "zero address";
  }
  if (trimmed.startsWith("127.")) {
    return "localhost";
  }
  if (trimmed.startsWith("10.")) {
    return "private RFC1918";
  }
  if (trimmed.startsWith("192.168.")) {
    return "private RFC1918";
  }
  const parts = trimmed.split(".").map(Number);
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return "private RFC1918";
  }
  if (trimmed.startsWith("169.254.")) {
    return "link-local";
  }
  return null;
}

function validateNodeIp(nodeIp) {
  const reason = isPrivateOrLocalIp(nodeIp);
  if (reason) {
    return { ok: false, reason: `LIVEKIT_NODE_IP ${reason}: ${nodeIp || "<empty>"}` };
  }
  return { ok: true, nodeIp: nodeIp.trim() };
}

function countRtcSections(content) {
  return (content.match(/^rtc:\s*$/gm) || []).length;
}

function extractNodeIpLines(content) {
  return content.match(/^  node_ip:.*$/gm) || [];
}

/**
 * Idempotently patch rtc.node_ip — removes duplicate node_ip lines, never duplicates rtc blocks.
 */
function patchLivekitYaml(content, nodeIp) {
  const validation = validateNodeIp(nodeIp);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }
  const ip = validation.nodeIp;
  const nodeIpLine = `  node_ip: ${ip}`;

  if (!/^rtc:\s*$/m.test(content)) {
    throw new Error("livekit.yaml missing rtc: section");
  }
  if (countRtcSections(content) > 1) {
    throw new Error("livekit.yaml has duplicate rtc: sections");
  }

  let result = content.replace(/^  # node_ip patched[^\n]*\n/m, "");
  result = result.replace(/^  node_ip:.*\n?/gm, "");

  if (/^  udp_port:/m.test(result)) {
    result = result.replace(/^([ \t]*udp_port:.*)$/m, `$1\n${nodeIpLine}`);
  } else if (/^  use_external_ip:/m.test(result)) {
    result = result.replace(/^([ \t]*use_external_ip:.*)$/m, `${nodeIpLine}\n$1`);
  } else {
    result = result.replace(/^(rtc:\s*)$/m, `$1\n${nodeIpLine}`);
  }

  const nodeIpLines = extractNodeIpLines(result);
  if (nodeIpLines.length !== 1) {
    throw new Error(`expected exactly 1 node_ip line after patch, got ${nodeIpLines.length}`);
  }
  if (nodeIpLines[0] !== nodeIpLine) {
    throw new Error("node_ip line mismatch after patch");
  }
  if (countRtcSections(result) !== 1) {
    throw new Error("duplicate rtc: sections after patch");
  }

  return result;
}

function verifyLivekitYaml(content, expectedIp) {
  const lines = extractNodeIpLines(content);
  if (lines.length === 0) {
    return { ok: false, code: DEP_CODE, reason: "rtc.node_ip missing after patch" };
  }
  if (lines.length > 1) {
    return { ok: false, code: DEP_CODE, reason: "duplicate node_ip keys in livekit.yaml" };
  }
  const match = lines[0].match(/^  node_ip:\s*(\S+)/);
  const ip = match ? match[1] : "";
  const validation = validateNodeIp(ip);
  if (!validation.ok) {
    return { ok: false, code: DEP_CODE, reason: validation.reason };
  }
  if (expectedIp && validation.nodeIp !== expectedIp.trim()) {
    return {
      ok: false,
      code: DEP_CODE,
      reason: `rtc.node_ip ${validation.nodeIp} != LIVEKIT_NODE_IP ${expectedIp.trim()}`,
    };
  }
  return { ok: true, nodeIp: validation.nodeIp };
}

function patchLivekitConfigFile(configPath, nodeIp) {
  const abs = path.resolve(configPath);
  const before = fs.readFileSync(abs, "utf8");
  const after = patchLivekitYaml(before, nodeIp);
  if (after === before) {
    const verify = verifyLivekitYaml(before, nodeIp);
    if (!verify.ok) {
      throw new Error(verify.reason);
    }
    return { changed: false, nodeIp: verify.nodeIp, content: before };
  }
  fs.writeFileSync(abs, after, "utf8");
  const verify = verifyLivekitYaml(after, nodeIp);
  if (!verify.ok) {
    throw new Error(verify.reason);
  }
  return { changed: true, nodeIp: verify.nodeIp, content: after };
}

function failDep(reason) {
  console.error(`FAIL ${DEP_CODE}: ${reason}`);
  process.exit(1);
}

function main() {
  const root = path.join(__dirname, "..", "..");
  const configPath =
    process.env.LIVEKIT_CONFIG_PATH ||
    path.join(root, "infra", "docker", "livekit", "livekit.yaml");
  const nodeIp = process.env.LIVEKIT_NODE_IP || "";

  if (!nodeIp.trim()) {
    failDep("LIVEKIT_NODE_IP is required (set in .env before deploy)");
  }

  try {
    const result = patchLivekitConfigFile(configPath, nodeIp);
    console.log(`LiveKit rtc.node_ip=${result.nodeIp}${result.changed ? "" : " (unchanged)"}`);
    const verify = verifyLivekitYaml(result.content, nodeIp);
    if (!verify.ok) {
      failDep(verify.reason);
    }
    console.log(`PASS ${DEP_CODE}: rtc.node_ip present in ${configPath}`);
  } catch (err) {
    failDep(err.message || String(err));
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  DEP_CODE,
  IPV4_REGEX,
  isPrivateOrLocalIp,
  validateNodeIp,
  patchLivekitYaml,
  verifyLivekitYaml,
  patchLivekitConfigFile,
  countRtcSections,
  extractNodeIpLines,
};
