const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const workspaceRoot = path.resolve(__dirname, "..");
const appsWebRoot = path.join(workspaceRoot, "apps/web");
const sharedRoot = path.join(workspaceRoot, "packages/shared/src");

function toAbsoluteTsPath(request) {
  if (request.startsWith("@/")) {
    return path.join(appsWebRoot, request.slice(2).replace(/^[/\\]/, "")) + ".ts";
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
  const { getTicketmasterLiveQaPreflight, writeTicketmasterLiveQaReport } = require("../apps/web/lib/events/ticketmasterLiveQa.ts");
  const preflight = getTicketmasterLiveQaPreflight();

  if (!preflight.ok) {
    console.error(preflight.message);
    process.exitCode = 1;
    return;
  }

  const { htmlPath, jsonPath, report } = await writeTicketmasterLiveQaReport();

  console.log(`Ticketmaster live QA report written to ${htmlPath}`);
  console.log(`Ticketmaster live QA data written to ${jsonPath}`);
  console.log(
    `Ticketmaster counts: raw=${report.ticketmasterProvider?.rawCount ?? 0}, valid=${report.ticketmasterProvider?.validCount ?? 0}, dropped=${report.ticketmasterProvider?.droppedCount ?? 0}, final=${report.finalCount}`
  );
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`Ticketmaster live QA failed: ${reason}`);
  process.exitCode = 1;
});
