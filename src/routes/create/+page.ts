import { redirect } from "@sveltejs/kit";
import { base } from "$app/paths";

export const load = () => {
  throw redirect(307, `${base}/studio`);
};
