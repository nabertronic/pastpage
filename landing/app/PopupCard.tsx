"use client";

import { useRef } from "react";

export function PopupCard() {
  const tiltRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = tiltRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      el.style.setProperty("--ry", `${px * 9}deg`);
      el.style.setProperty("--rx", `${-py * 9}deg`);
      el.style.setProperty("--gx", `${(px + 0.5) * 100}%`);
      el.style.setProperty("--gy", `${(py + 0.5) * 100}%`);
    });
  }

  function reset() {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--rx", "0deg");
  }

  return (
    <div className="tilt-scene" onMouseMove={handleMove} onMouseLeave={reset}>
      <div className="tilt" ref={tiltRef}>
        <div className="float">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="pp-shot"
            src="/popup.png"
            alt="The PastPage popup: check archived versions across Wayback Machine, Archive.today, Ghostarchive, WebCite, Megalodon and Yandex Cache."
            width={732}
            height={776}
          />
          <span className="pp-glare" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
