const warmed = new Set<string>();

/** Fetch photos into the browser cache ahead of time, a few at a time, so a reveal on the big
 *  screen never waits on the network. Safe to call with the same list again and again. */
export function preloadImages(urls: (string | null | undefined)[], batch = 6) {
  const todo = urls.filter((u): u is string => !!u && !warmed.has(u));
  todo.forEach((u) => warmed.add(u));
  const next = () => {
    todo.splice(0, batch).forEach((url) => {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    });
    if (todo.length) setTimeout(next, 150); // don't compete with the live poll
  };
  next();
}
