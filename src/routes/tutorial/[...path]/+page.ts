import { redirect } from "@sveltejs/kit";

// The tutorial is archived in src/lib/archive/tutorial; keep old links working.
export const load = () => {
  throw redirect(307, "/about");
};
