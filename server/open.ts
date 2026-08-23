export function openBrowser(url: string) {
  const op = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
  Bun.spawn([op, url]);
}
