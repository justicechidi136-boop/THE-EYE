const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const NUMERIC_ID_PATTERN = /\/\d+(?=\/|$)/g;

export function normalizeRoute(path: string) {
  let route = path.split("?")[0] ?? path;
  route = route.replace(UUID_PATTERN, ":id");
  route = route.replace(NUMERIC_ID_PATTERN, "/:id");
  if (route.startsWith("/v1")) route = route.slice(3) || "/";
  return route || "/";
}

export function statusClass(statusCode: number) {
  if (statusCode >= 500) return "5xx";
  if (statusCode >= 400) return "4xx";
  if (statusCode >= 300) return "3xx";
  if (statusCode >= 200) return "2xx";
  return "other";
}
