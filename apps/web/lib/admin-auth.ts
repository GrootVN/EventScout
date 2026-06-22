import { env } from "@/lib/config/env";

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function getAdminToken() {
  return clean(env.adminToken);
}

export function requireAdminToken(headerValue: string | null) {
  const adminToken = getAdminToken();
  if (!adminToken) {
    return true;
  }

  return clean(headerValue) === adminToken;
}

export function isAdminPageAuthorized(queryKey: string | undefined) {
  const adminToken = getAdminToken();
  if (!adminToken) {
    return true;
  }

  return clean(queryKey) === adminToken;
}
