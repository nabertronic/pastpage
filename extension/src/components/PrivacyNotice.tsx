import { ShieldCheck } from "lucide-react";
import { useI18n } from "../i18n";

export function PrivacyNotice({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();

  return (
    <section className="rounded-md border border-yellow-300/70 bg-yellow-50 p-3 text-sm text-stone-700 shadow-sm dark:border-yellow-400/40 dark:bg-yellow-300/10 dark:text-yellow-50">
      <div className="flex gap-2">
        <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-yellow-700 dark:text-yellow-300" size={16} />
        <div>
          <p className="font-medium text-stone-950 dark:text-yellow-50">{t("common.noTrackingShort")}</p>
          {!compact ? (
            <p className="mt-1 text-xs leading-5 text-stone-600 dark:text-stone-300">{t("common.noTrackingLong")}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
