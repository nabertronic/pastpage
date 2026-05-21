import type { ReactNode } from "react";
import { motion } from "motion/react";
import { LogoMark } from "./LogoMark";

export function PageShell({
  title,
  description,
  children,
  narrow = false
}: {
  title: string;
  description?: string;
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgba(245,200,0,0.08),transparent_55%),linear-gradient(160deg,#fffdfa_0%,var(--wf-bg)_100%)] px-4 py-6 text-stone-950 dark:bg-[radial-gradient(circle_at_top_left,rgba(255,212,0,0.18),transparent_35%),linear-gradient(135deg,#12100b_0%,#1d1a10_48%,#0d0c09_100%)] dark:text-yellow-50">
      <div className={narrow ? "mx-auto max-w-xl" : "mx-auto max-w-5xl"}>
        <header className="mb-6 flex items-start gap-3">
          <motion.div
            className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-md bg-yellow-400 text-stone-950 shadow-[0_10px_30px_rgba(255,212,0,0.28)]"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <LogoMark size={21} variant="white" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
            {description ? (
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--wf-muted)] dark:text-stone-300">
                {description}
              </p>
            ) : null}
          </div>
        </header>
        <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.24 }}>
          {children}
        </motion.div>
      </div>
    </main>
  );
}
