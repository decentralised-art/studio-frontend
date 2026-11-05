/** Keep feed cursor separators readable by API deployments that do not decode them. */
export const fetchStudioFeed: typeof fetch = (input, init) => {
  const isRequest = input instanceof Request;
  const rawUrl = isRequest ? input.url : String(input);
  const method = (init?.method ?? (isRequest ? input.method : "GET")).toUpperCase();
  const pathname = new URL(rawUrl, "https://studio.invalid").pathname;
  if (method !== "GET" || !pathname.endsWith("/feed")) {
    return globalThis.fetch(input, init);
  }

  // Colons are legal query data. Keep every other escape intact so an opaque
  // cursor cannot introduce another parameter or a fragment into the URL.
  const queryStart = rawUrl.indexOf("?");
  const fragmentStart = rawUrl.indexOf("#");
  if (queryStart < 0 || (fragmentStart >= 0 && fragmentStart < queryStart)) {
    return globalThis.fetch(input, init);
  }
  const queryEnd = fragmentStart < 0 ? rawUrl.length : fragmentStart;
  const query = rawUrl
    .slice(queryStart + 1, queryEnd)
    .replace(
      /(^|&)before=([^&]*)/,
      (_match, prefix, cursor: string) => `${prefix}before=${cursor.replace(/%3a/gi, ":")}`,
    );
  const url = rawUrl.slice(0, queryStart + 1) + query + rawUrl.slice(queryEnd);
  return globalThis.fetch(url === rawUrl ? input : isRequest ? new Request(url, input) : url, init);
};
