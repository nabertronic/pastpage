export function supportsOverlayUi(doc: Document): boolean {
  const root = doc.documentElement;

  if (!root) return false;
  if (root.namespaceURI !== "http://www.w3.org/1999/xhtml") return false;
  if (root.tagName.toLowerCase() !== "html") return false;
  if (!(doc.body instanceof HTMLBodyElement)) return false;

  return true;
}
