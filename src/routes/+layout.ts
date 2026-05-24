import type { LoadEvent } from "@sveltejs/kit";

import { hasAuthSession } from "$lib/auth/session";

export const ssr = false;

export const load = (_event: LoadEvent) => ({ isAuthenticated: hasAuthSession() });
