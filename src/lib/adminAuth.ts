import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, isSessionValid } from "./adminSession";

// Convenience wrapper around next/headers for use in Route Handlers and
// Server Components. Kept out of adminSession.ts so that proxy.ts - which
// reads the cookie straight off the request instead - never pulls in
// next/headers.
export async function hasAdminSession(): Promise<boolean> {
  const store = await cookies();
  return isSessionValid(store.get(ADMIN_SESSION_COOKIE)?.value);
}
