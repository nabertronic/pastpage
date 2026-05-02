import { FileSearch } from "lucide-react";
import { useI18n } from "../i18n";
import { CopyButton, OpenLinkButton } from "./CopyButton";

export function SourceSummary({ url }: { url: string }) {
  const { t } = useI18n();

  return (
    <section className="rounded-md border border-stone-200 bg-white/95 p-4 shadow-sm backdrop-blur dark:border-stone-800 dark:bg-stone-950/92">
      <div className="flex gap-3">
        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-yellow-400 text-stone-950">
          <FileSearch aria-hidden="true" size={19} />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-stone-950 dark:text-yellow-50">{t("sourceSummary.title")}</h2>
          <p className="mt-1 text-sm leading-6 text-stone-700 dark:text-stone-300">
            {t("sourceSummary.description")}
          </p>
          <div className="mt-3 rounded-md bg-stone-100 p-2 dark:bg-stone-900">
            <p className="break-all px-1 text-xs text-stone-700 dark:text-stone-300">{url}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <OpenLinkButton href={url} label={t("common.openCurrentPage")} />
              <CopyButton value={url} label={t("common.copyUrl")} copiedLabel={t("common.urlCopied")} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
