import { EXTENSION_STORE_URL } from "@/lib/extension";

/** The extension's install button: opens the Chrome Web Store listing, or says "Coming soon" until it's live. */
export function AddToChrome({ className }: { className: string }) {
  if (!EXTENSION_STORE_URL) {
    return <span className={`${className} is-soon`} aria-disabled="true" data-testid="store-soon">Coming soon to the Chrome Web Store</span>;
  }
  return <a className={className} href={EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer" data-testid="store-link">Add to Chrome</a>;
}
