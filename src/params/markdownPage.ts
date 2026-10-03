import type { ParamMatcher } from "@sveltejs/kit";

import { isMarkdownPageSlug } from "$lib/seo/agentDocs";

export const match: ParamMatcher = (param) => isMarkdownPageSlug(param);
