const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const workspaceRoot = path.resolve(__dirname, "..");
const appsWebRoot = path.join(workspaceRoot, "apps/web");
const sharedRoot = path.join(workspaceRoot, "packages/shared/src");

function toAbsoluteTsPath(request) {
  if (request.startsWith("@/")) {
    const absoluteBase = path.join(appsWebRoot, request.slice(2).replace(/^[/\\]/, ""));
    const directFile = `${absoluteBase}.ts`;
    const indexFile = path.join(absoluteBase, "index.ts");

    if (fs.existsSync(directFile)) {
      return directFile;
    }

    if (fs.existsSync(indexFile)) {
      return indexFile;
    }

    return directFile;
  }

  if (request === "@eventscout/shared") {
    return path.join(sharedRoot, "index.ts");
  }

  if (request.startsWith("@eventscout/shared/")) {
    return path.join(sharedRoot, `${request.slice("@eventscout/shared/".length)}.ts`);
  }

  return null;
}

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  const mapped = toAbsoluteTsPath(request);
  if (mapped) {
    return originalResolveFilename.call(this, mapped, parent, isMain, options);
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.Preserve,
      resolveJsonModule: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Preserve
    },
    fileName: filename
  });

  module._compile(outputText, filename);
};

async function main() {
  const { writeCityPresetQaReport } = require("../apps/web/lib/events/cityPresetQa.ts");
  const { htmlPath, jsonPath, report } = await writeCityPresetQaReport();

  console.log(`City preset QA report written to ${htmlPath}`);
  console.log(`City preset QA data written to ${jsonPath}`);
  console.log(
    `City preset counts: total=${report.totalConfiguredSources}, enabled=${report.enabledSources}, disabled=${report.disabledSources}, placeholder=${report.placeholderSources}, verified=${report.verifiedSources}, needs_review=${report.needsReviewSources}`
  );
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`City preset QA failed: ${reason}`);
  process.exitCode = 1;
});
