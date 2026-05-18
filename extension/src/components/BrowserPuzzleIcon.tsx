type BrowserPuzzleIconProps = {
  browser: "chrome" | "firefox";
  size?: number;
  className?: string;
};

export function BrowserPuzzleIcon({ browser, size = 16, className }: BrowserPuzzleIconProps) {
  if (browser === "firefox") {
    return (
      <svg
        aria-hidden="true"
        data-browser-icon="firefox-puzzle"
        viewBox="0 0 16 16"
        width={size}
        height={size}
        className={className}
        fill="currentColor"
      >
        <path d="m13 3 0-1a1 1 0 0 0-1-1l-2 0a1 1 0 0 0-1 1l0 1-2 0 0-1a1 1 0 0 0-1-1L4 1a1 1 0 0 0-1 1l0 1a2 2 0 0 0-2 2l0 7a2 2 0 0 0 2 2l10 0a2 2 0 0 0 2-2l0-7a2 2 0 0 0-2-2zm.75 9.15-.6.6-10.3 0-.6-.6 0-7.3.6-.6 10.3 0 .6.6 0 7.3z" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      data-browser-icon="chrome-puzzle"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" />
    </svg>
  );
}
