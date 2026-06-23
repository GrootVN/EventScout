import { env } from "@/lib/config/env";
import { isProduction } from "@/lib/config/runtime";

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function getAdminToken() {
  return clean(env.adminToken);
}

export function requireAdminToken(headerValue: string | null) {
  const adminToken = getAdminToken();
  if (!adminToken) {
    return !isProduction();
  }

  return clean(headerValue) === adminToken;
}

export function isAdminPageAuthorized(queryKey: string | undefined) {
  const adminToken = getAdminToken();
  if (!adminToken) {
    return !isProduction();
  }

  return clean(queryKey) === adminToken;
}
