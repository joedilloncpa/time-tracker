function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getCanonicalOrigin() {
  const configured = process.env.APP_CANONICAL_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "";
  if (!configured) {
    return "";
  }

  try {
    const parsed = new URL(configured);
    return trimTrailingSlash(parsed.origin);
  } catch {
    return "";
  }
}

export function getOriginFromHeaders(headersList: Headers) {
  const forwardedProto = headersList.get("x-forwarded-proto") || "https";
  const forwardedHost = headersList.get("x-forwarded-host") || headersList.get("host");
  if (!forwardedHost) {
    return "";
  }
  return `${forwardedProto}://${forwardedHost}`;
}

export function getAuthRedirectOrigin(headersList?: Headers) {
  const canonical = getCanonicalOrigin();
  if (canonical) {
    return canonical;
  }
  if (!headersList) {
    return "";
  }
  return trimTrailingSlash(getOriginFromHeaders(headersList));
}
