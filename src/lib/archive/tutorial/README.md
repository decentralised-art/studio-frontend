# Archived tutorial

The tutorial pages (`/tutorial`, `/tutorial/introduction`, `/tutorial/hello-world`,
`/tutorial/core-collection`, `/tutorial/technical-stack`) are hidden from the platform for now.
Their content stays in `src/lib/site/astro-html/tutorial/`.

`routes/` holds the original SvelteKit route files. Outside `src/routes` they are not served;
`src/routes/tutorial/[...path]` redirects old tutorial links to `/about`.

To restore: delete `src/routes/tutorial/[...path]`, move `routes/` back to `src/routes/tutorial`,
and add the Tutorial link back to `docsNavLinks` in `src/lib/site/navigation.ts`.
