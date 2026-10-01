<script lang="ts">
  import AstroPageFragment from "$lib/site/AstroPageFragment.svelte";
  import html from "$lib/site/astro-html/tutorial/hello-world.html?raw";
</script>

<AstroPageFragment
  {html}
  title="HELLO WORLD"
  description="Hello World tutorial page."
  canonicalUrl="https://decentralised.art/tutorial/hello-world"
/>
