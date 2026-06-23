const { existsSync } = require("node:fs");
function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readFlag(name, fallback) {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  return value === "true";
}

function isProductionMode() {
  return process.argv.includes("--production") || process.env.NODE_ENV === "production";
}

function validateProductionSafety() {
  const warnings = [];
  const errors = [];

  if (!isProductionMode()) {
    return { ok: true, warnings, errors };
  }

  if (!clean(process.env.ADMIN_TOKEN)) {
    errors.push("ADMIN_TOKEN is required in production.");
  }

  if (readFlag("ENABLE_SAMPLE_SUBMISSIONS", false)) {
    errors.push("ENABLE_SAMPLE_SUBMISSIONS must be false in production.");
  }

  if (readFlag("ENABLE_SAMPLE_TRUSTED_SOURCES", false)) {
    errors.push("ENABLE_SAMPLE_TRUSTED_SOURCES must be false in production.");
  }

  if (readFlag("ENABLE_DETAILED_HEALTH", false)) {
    warnings.push("ENABLE_DETAILED_HEALTH is enabled in production; detailed health must stay admin-protected.");
  }

  if (readFlag("ENABLE_TICKETMASTER_PROVIDER", false) && !clean(process.env.TICKETMASTER_API_KEY)) {
    warnings.push("Ticketmaster provider is enabled but TICKETMASTER_API_KEY is not configured.");
  }

  if (readFlag("ENABLE_MEETUP_PROVIDER", false) && !clean(process.env.MEETUP_ACCESS_TOKEN)) {
    warnings.push("Meetup provider is enabled but MEETUP_ACCESS_TOKEN is not configured.");
  }

  if (readFlag("ENABLE_ICS_PROVIDER", false) && !clean(process.env.ICS_SOURCE_URLS)) {
    warnings.push("ICS provider is enabled but ICS_SOURCE_URLS is empty.");
  }

  if (readFlag("ENABLE_RSS_PROVIDER", false) && !clean(process.env.RSS_SOURCE_URLS)) {
    warnings.push("RSS provider is enabled but RSS_SOURCE_URLS is empty.");
  }

  if (readFlag("ENABLE_CURATED_PROVIDER", false) && !existsSync(process.env.CURATED_EVENTS_PATH || "apps/web/data/curated-events.json")) {
    warnings.push("Curated provider is enabled but the curated events file is missing.");
  }

  return {
    ok: errors.length === 0,
    warnings,
    errors
  };
}

function printSummary(check) {
  const mode = isProductionMode() ? "production" : "development";
  console.log(`Environment check (${mode})`);

  if (check.warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of check.warnings) {
      console.log(`- ${warning}`);
    }
  } else {
    console.log("Warnings: none");
  }

  if (check.errors.length > 0) {
    console.log("Errors:");
    for (const error of check.errors) {
      console.log(`- ${error}`);
    }
  } else {
    console.log("Errors: none");
  }
}

function main() {
  const check = validateProductionSafety();
  printSummary(check);

  if (isProductionMode() && check.errors.length > 0) {
    process.exitCode = 1;
  }
}

main();
