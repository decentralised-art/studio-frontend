import { redirect } from "@sveltejs/kit";

// The former API documentation page is replaced by the API reference.
export const load = () => {
  throw redirect(308, "/api-reference");
};
