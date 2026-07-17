const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.join(__dirname, "..");
const nginxRoot = path.join(root, "infra", "docker", "nginx");
const entrypointRel = "infra/docker/nginx/entrypoint.d/20-render-the-eye-conf.sh";
const entrypointPath = path.join(root, entrypointRel);

function fail(message) {
  console.error(`validate-nginx-config: ${message}`);
  process.exit(1);
}

function run(command, options = {}) {
  return execSync(command, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function dockerAvailable() {
  const result = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    encoding: "utf8",
  });
  return result.status === 0;
}

function normalizeGitText(text) {
  return text.replace(/\r\n/g, "\n");
}

function read(relPath) {
  const abs = path.join(root, relPath);
  if (!fs.existsSync(abs)) {
    fail(`missing file: ${relPath}`);
  }
  return fs.readFileSync(abs, "utf8");
}

function readGitFile(relPath) {
  try {
    return normalizeGitText(run(`git show HEAD:${relPath}`, { cwd: root }));
  } catch {
    return normalizeGitText(read(relPath));
  }
}

function assertEntrypointExecutableInGit() {
  if (!fs.existsSync(entrypointPath)) {
    fail(`entrypoint missing: ${entrypointRel}`);
  }

  let modeLine;
  try {
    modeLine = run(`git ls-files -s ${entrypointRel}`, { cwd: root });
  } catch {
    fail("unable to read git index mode for entrypoint (is this a git checkout?)");
  }

  const mode = modeLine.split(/\s+/)[0];
  if (mode !== "100755") {
    fail(`entrypoint git mode is ${mode}, expected 100755 (run: git update-index --chmod=+x ${entrypointRel})`);
  }

  const content = readGitFile(entrypointRel);
  if (!content.startsWith("#!/bin/sh\n")) {
    fail("entrypoint must start with #!/bin/sh shebang");
  }
  if (content.includes("\r")) {
    fail("entrypoint must use LF line endings");
  }
}

function renderHttp(serverName, httpBlock, healthBlock) {
  const template = read("infra/docker/nginx/render/http.conf.template");
  return template
    .replace(/\$\{THE_EYE_SERVER_NAME\}/g, serverName)
    .replace("${THE_EYE_HTTP_BLOCK}", httpBlock)
    .replace("${THE_EYE_HEALTH_BLOCK}", healthBlock);
}

function renderHttps(serverName) {
  const template = read("infra/docker/nginx/render/https.conf.template");
  return template.replace(/\$\{THE_EYE_SERVER_NAME\}/g, serverName);
}

function expandSnippetIncludes(configText) {
  const snippetsDir = path.join(nginxRoot, "snippets");
  return configText.replace(
    /include\s+\/etc\/nginx\/snippets\/([^;]+);/g,
    (_match, snippetName) => fs.readFileSync(path.join(snippetsDir, snippetName.trim()), "utf8"),
  );
}

function countHealthzPerServerBlock(configText) {
  const blocks = configText.split(/\bserver\s*\{/);
  const violations = [];

  for (let index = 1; index < blocks.length; index += 1) {
    const block = blocks[index];
    const count = (block.match(/location\s*=\s*\/healthz/g) || []).length;
    if (count !== 1) {
      violations.push({ serverIndex: index, count });
    }
  }

  return violations;
}

function assertNoDuplicateHealthz(label, configText) {
  const violations = countHealthzPerServerBlock(expandSnippetIncludes(configText));
  if (violations.length) {
    const detail = violations.map((v) => `server#${v.serverIndex}=${v.count}`).join(", ");
    fail(`${label}: expected exactly one /healthz per server block (${detail})`);
  }
}

function assertSharedSnippetMarkers() {
  const upstreams = read("infra/docker/nginx/snippets/upstreams.conf");
  const locations = read("infra/docker/nginx/snippets/the-eye-locations.conf");

  for (const needle of ["upstream the_eye_api", "upstream the_eye_admin_web", "upstream the_eye_livekit"]) {
    if (!upstreams.includes(needle)) {
      fail(`upstreams.conf missing ${needle}`);
    }
  }

  for (const needle of [
    "proxy_pass http://the_eye_api",
    "proxy_pass http://the_eye_livekit",
    "proxy_set_header Upgrade $http_upgrade",
    "proxy_set_header Connection $connection_upgrade",
    "location = /healthz",
    "default_type text/plain",
  ]) {
    if (!locations.includes(needle)) {
      fail(`the-eye-locations.conf missing ${needle}`);
    }
  }

  if ((locations.match(/location\s*=\s*\/healthz/g) || []).length !== 1) {
    fail("the-eye-locations.conf must define /healthz exactly once");
  }

  const httpTemplate = read("infra/docker/nginx/render/http.conf.template");
  if (/location\s*=\s*\/healthz/.test(httpTemplate)) {
    fail("http.conf.template must not define /healthz (use snippet or THE_EYE_HEALTH_BLOCK)");
  }
}

function buildFixtureConfigs() {
  const healthBlock = `location = /healthz {
  access_log off;
  default_type text/plain;
  return 200 "ok\\n";
}`;

  return {
    httpBootstrap: renderHttp(
      "staging-admin.example.test",
      'include /etc/nginx/snippets/the-eye-locations.conf;',
      "",
    ),
    httpTlsBootstrap503: renderHttp(
      "staging-admin.example.test",
      `location / {
    return 503 "TLS bootstrap in progress — retry after certificate issuance\\n";
    add_header Content-Type text/plain;
  }`,
      healthBlock,
    ),
    httpRedirect: renderHttp(
      "staging-admin.example.test",
      `location / {
    return 301 https://$host$request_uri;
  }`,
      healthBlock,
    ),
    https: renderHttps("staging-admin.example.test"),
  };
}

function dockerRunAsCurrentUserArgs() {
  const uid = process.getuid?.();
  const gid = process.getgid?.();
  if (uid === undefined || gid === undefined) {
    return [];
  }
  return ["--user", `${uid}:${gid}`];
}

function writeDevTlsMaterial(certsLive) {
  const keyPath = path.join(certsLive, "privkey.pem");
  const certPath = path.join(certsLive, "fullchain.pem");

  const finalizeTlsMaterial = () => {
    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
      return false;
    }
    try {
      fs.chmodSync(keyPath, 0o600);
      fs.chmodSync(certPath, 0o644);
    } catch {
      // alpine/openssl may leave root-owned files on bind mounts; nginx -t reads them in-container.
    }
    return true;
  };

  if (dockerAvailable()) {
    const result = spawnSync(
      "docker",
      [
        "run",
        "--rm",
        ...dockerRunAsCurrentUserArgs(),
        "-v",
        `${certsLive}:/certs:rw`,
        "alpine/openssl",
        "req",
        "-x509",
        "-nodes",
        "-days",
        "1",
        "-newkey",
        "rsa:2048",
        "-keyout",
        "/certs/privkey.pem",
        "-out",
        "/certs/fullchain.pem",
        "-subj",
        "/CN=localhost",
      ],
      { encoding: "utf8" },
    );
    if (result.status === 0 && finalizeTlsMaterial()) {
      return;
    }

    const detail = [result.stderr, result.stdout, result.error?.message].filter(Boolean).join("\n");
    fail(`failed to generate TLS fixtures for nginx -t:\n${detail}`);
  }

  const result = spawnSync(
    "openssl",
    [
      "req",
      "-x509",
      "-nodes",
      "-days",
      "1",
      "-newkey",
      "rsa:2048",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-subj",
      "/CN=localhost",
    ],
    { encoding: "utf8" },
  );
  if (result.status === 0 && finalizeTlsMaterial()) {
    return;
  }

  // Hosts without docker/openssl skip nginx -t entirely.
  fs.writeFileSync(keyPath, "REPLACE_WITH_TEST_KEY\n", "utf8");
  fs.writeFileSync(certPath, "REPLACE_WITH_TEST_CERT\n", "utf8");
}

function writeFixtureTree(label, fixtures) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `the-eye-nginx-${label}-`));
  const etcNginx = path.join(tmp, "etc", "nginx");
  const confD = path.join(etcNginx, "conf.d");
  const snippets = path.join(etcNginx, "snippets");
  const certsLive = path.join(etcNginx, "certs", "live");

  fs.mkdirSync(confD, { recursive: true });
  fs.mkdirSync(snippets, { recursive: true });
  fs.mkdirSync(certsLive, { recursive: true });

  fs.copyFileSync(path.join(nginxRoot, "nginx.conf"), path.join(etcNginx, "nginx.conf"));
  fs.copyFileSync(path.join(nginxRoot, "snippets", "upstreams.conf"), path.join(confD, "00-upstreams.conf"));
  fs.copyFileSync(path.join(nginxRoot, "snippets", "the-eye-locations.conf"), path.join(snippets, "the-eye-locations.conf"));
  fs.copyFileSync(path.join(nginxRoot, "snippets", "ssl-params.conf"), path.join(snippets, "ssl-params.conf"));
  fs.writeFileSync(
    path.join(etcNginx, "mime.types"),
    "types { text/plain txt; application/octet-stream bin; }\n",
    "utf8",
  );

  if (fixtures.http) {
    fs.writeFileSync(path.join(confD, "10-http.conf"), fixtures.http, "utf8");
  }
  if (fixtures.https) {
    fs.writeFileSync(path.join(confD, "20-https.conf"), fixtures.https, "utf8");
    writeDevTlsMaterial(certsLive);
  }

  return tmp;
}

const VALIDATION_UPSTREAM_HOSTS = [
  "api:127.0.0.1",
  "admin-web:127.0.0.1",
  "livekit:127.0.0.1",
];

function nginxTestWithDocker(label, fixtureRoot) {
  if (!dockerAvailable()) {
    if (label === "http-bootstrap") {
      console.warn("validate-nginx-config: docker unavailable — skipped nginx -t (static checks passed)");
    }
    return;
  }

  const mount = `${fixtureRoot}/etc/nginx`;
  const result = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      ...VALIDATION_UPSTREAM_HOSTS.flatMap((host) => ["--add-host", host]),
      "--entrypoint",
      "nginx",
      "-v",
      `${mount}:/etc/nginx:ro`,
      "nginx:1.27-alpine",
      "-t",
      "-c",
      "/etc/nginx/nginx.conf",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    fail(`${label} nginx -t failed:\n${result.stdout}\n${result.stderr}`);
  }
}

function main() {
  assertEntrypointExecutableInGit();
  assertSharedSnippetMarkers();

  const fixtures = buildFixtureConfigs();
  const scenarios = [
    {
      label: "http-bootstrap",
      fixtures: {
        http: fixtures.httpBootstrap,
      },
      rendered: fixtures.httpBootstrap,
    },
    {
      label: "http-tls-bootstrap",
      fixtures: {
        http: fixtures.httpTlsBootstrap503,
      },
      rendered: fixtures.httpTlsBootstrap503,
    },
    {
      label: "http-redirect",
      fixtures: {
        http: fixtures.httpRedirect,
      },
      rendered: fixtures.httpRedirect,
    },
    {
      label: "https",
      fixtures: {
        http: fixtures.httpBootstrap,
        https: fixtures.https,
      },
      rendered: `${fixtures.httpBootstrap}\n${fixtures.https}`,
    },
  ];

  for (const scenario of scenarios) {
    assertNoDuplicateHealthz(scenario.label, scenario.rendered);
    const fixtureRoot = writeFixtureTree(scenario.label, scenario.fixtures);
    try {
      nginxTestWithDocker(scenario.label, fixtureRoot);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }

  console.log("validate-nginx-config: all checks passed");
}

main();
