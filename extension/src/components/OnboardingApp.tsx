import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GitBranch,
  Layers,
  Link2,
  Menu,
  MousePointerClick,
  PanelTopOpen,
  Pin,
  Search,
  Settings2,
  Star
} from "lucide-react";
import { Button, LinkButton } from "./Button";
import { BrowserPuzzleIcon } from "./BrowserPuzzleIcon";
import { LogoMark } from "./LogoMark";
import { PageShell } from "./PageShell";
import {
  EXTENSION_NAME,
  GITHUB_URL,
  PRIVACY_URL
} from "../core/constants";
import { DEFAULT_SETTINGS, type Settings } from "../core/settings";
import { getSettings } from "../platform/storage";
import { getExtensionStoreUrl, hasExtensionStoreListing } from "../platform/runtimeInfo";
import { optionsPageUrl } from "../platform/urls";
import { useAppliedTheme } from "./useAppliedTheme";

type BrowserKind = "firefox" | "chromium";
type CopyLocale = "de" | "en" | "es" | "fr" | "it" | "pl" | "pt" | "uk";

function detectBrowserKind(): BrowserKind {
  if (typeof browser === "undefined") return "chromium";
  return browser.runtime.getURL("").startsWith("moz-extension://") ? "firefox" : "chromium";
}

function detectLocale(): CopyLocale {
  const language =
    typeof browser !== "undefined" && browser.i18n?.getUILanguage
      ? browser.i18n.getUILanguage()
      : typeof navigator !== "undefined"
        ? navigator.language
        : "en";
  const normalized = language.toLowerCase();
  if (normalized.startsWith("de")) return "de";
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("fr")) return "fr";
  if (normalized.startsWith("it")) return "it";
  if (normalized.startsWith("pl")) return "pl";
  if (normalized.startsWith("pt")) return "pt";
  if (normalized.startsWith("uk")) return "uk";
  return "en";
}

function openExtensionPage(url: string) {
  void browser.tabs.create({ url, active: true });
}

export function OnboardingApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const browserKind = useMemo(detectBrowserKind, []);
  const locale = useMemo(detectLocale, []);
  const copy = COPY[locale];
  const isFirefox = browserKind === "firefox";
  const storeUrl = getExtensionStoreUrl(isFirefox ? "firefox" : "chrome");
  const browserName = isFirefox ? "Firefox" : "Chrome";

  useAppliedTheme(settings.themeMode);

  useEffect(() => {
    let active = true;
    void getSettings().then((current) => {
      if (active) setSettings(current);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <PageShell title={copy.title} description={copy.description}>
      <div className="space-y-5">
        <PinSection copy={copy} browser={isFirefox ? "firefox" : "chrome"} isFirefox={isFirefox} />
        <PrimaryActionsSection copy={copy} />
        <CustomizeSection copy={copy} />
        <Footer copy={copy} storeUrl={storeUrl} browserName={browserName} />
      </div>
    </PageShell>
  );
}

function PinSection({
  copy,
  browser,
  isFirefox
}: {
  copy: Copy;
  browser: "chrome" | "firefox";
  isFirefox: boolean;
}) {
  const steps = isFirefox ? copy.pinStepsFirefox : copy.pinStepsChromium;

  return (
    <motion.section
      id="pin"
      className="rounded-md border border-stone-200 bg-white/95 p-5 shadow-sm dark:border-stone-800 dark:bg-stone-950/92"
      initial={{ y: 6, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.24, delay: 0.08 }}
    >
      <SectionHeading kicker={copy.pinKicker} title={copy.pinTitle} />
      <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600 dark:text-stone-300">{copy.pinBody}</p>

      <ol className="mt-4 flex flex-col gap-2 md:flex-row md:items-stretch md:gap-0">
        {steps.map((step, index) => (
          <li key={step.label} className="flex flex-1 items-center gap-2 md:gap-0">
            <div className="flex flex-1 items-center gap-3 rounded-md border border-stone-200 bg-stone-50/80 px-3 py-3 dark:border-stone-800 dark:bg-stone-900/60">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-stone-200 bg-white text-stone-700 dark:border-stone-700 dark:bg-stone-950 dark:text-yellow-50">
                <PinStepIcon name={step.icon} browser={browser} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  {copy.stepLabel} {index + 1}
                </p>
                <p className="truncate text-sm font-medium text-stone-900 dark:text-yellow-50">{step.label}</p>
              </div>
            </div>
            {index < steps.length - 1 ? (
              <ArrowRight
                aria-hidden="true"
                size={16}
                className="hidden shrink-0 text-stone-400 md:mx-2 md:block dark:text-stone-500"
              />
            ) : null}
          </li>
        ))}
      </ol>

      <p className="mt-4 text-xs leading-5 text-stone-500 dark:text-stone-400">{copy.pinHint}</p>
    </motion.section>
  );
}

function PinStepIcon({
  name,
  browser
}: {
  name: "puzzle" | "click" | "pin" | "settings";
  browser: "chrome" | "firefox";
}) {
  switch (name) {
    case "puzzle":
      return <BrowserPuzzleIcon browser={browser} size={16} />;
    case "click":
      return <MousePointerClick aria-hidden="true" size={16} />;
    case "pin":
      return <Pin aria-hidden="true" size={16} />;
    case "settings":
      return <Settings2 aria-hidden="true" size={16} />;
  }
}

function PrimaryActionsSection({ copy }: { copy: Copy }) {
  return (
    <motion.section
      id="how-it-works"
      className="rounded-md border border-stone-200 bg-white/95 p-5 shadow-sm dark:border-stone-800 dark:bg-stone-950/92"
      initial={{ y: 6, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.24, delay: 0.12 }}
    >
      <SectionHeading kicker={copy.actionsKicker} title={copy.actionsTitle} />
      {copy.actionsBody ? (
        <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600 dark:text-stone-300">{copy.actionsBody}</p>
      ) : null}
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        <Capability
          icon={<PanelTopOpen aria-hidden="true" size={16} />}
          title={copy.primaryOneTitle}
          body={copy.primaryOneBody}
        />
        <Capability
          icon={<MousePointerClick aria-hidden="true" size={16} />}
          title={copy.primaryTwoTitle}
          body={copy.primaryTwoBody}
        />
      </ul>
      <MoreActionsSection copy={copy} />
    </motion.section>
  );
}

function Capability({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-stone-200 bg-stone-50/70 p-3 dark:border-stone-800 dark:bg-stone-900/50">
      <div className="grid h-8 w-8 place-items-center rounded-md border border-stone-200 bg-white text-stone-700 dark:border-stone-700 dark:bg-stone-950 dark:text-yellow-50">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-stone-950 dark:text-yellow-50">{title}</h3>
      <p className="text-xs leading-5 text-stone-600 dark:text-stone-300">{body}</p>
    </li>
  );
}

function MoreActionsSection({ copy }: { copy: Copy }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4 rounded-md border border-stone-200 bg-stone-50/70 dark:border-stone-800 dark:bg-stone-900/40">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={isOpen}
        aria-controls="more-actions-panel"
        onClick={() => setIsOpen((current) => !current)}
      >
        <div>
          <p className="text-sm font-semibold text-stone-950 dark:text-yellow-50">{copy.moreTitle}</p>
          <p className="mt-1 text-xs leading-5 text-stone-600 dark:text-stone-300">{copy.moreBody}</p>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-stone-200 bg-white text-stone-700 dark:border-stone-700 dark:bg-stone-950 dark:text-yellow-50">
          {isOpen ? <ChevronUp aria-hidden="true" size={16} /> : <ChevronDown aria-hidden="true" size={16} />}
        </span>
      </button>

      {isOpen ? (
        <div
          id="more-actions-panel"
          className="border-t border-stone-200 px-4 py-4 dark:border-stone-800"
        >
          <ul className="grid gap-3 md:grid-cols-2">
            <Capability
              icon={<Menu aria-hidden="true" size={16} />}
              title={copy.moreOneTitle}
              body={copy.moreOneBody}
            />
            <Capability
              icon={<Link2 aria-hidden="true" size={16} />}
              title={copy.moreTwoTitle}
              body={copy.moreTwoBody}
            />
            <Capability
              icon={<Search aria-hidden="true" size={16} />}
              title={copy.moreThreeTitle}
              body={copy.moreThreeBody}
            />
            <Capability
              icon={<Layers aria-hidden="true" size={16} />}
              title={copy.moreFourTitle}
              body={copy.moreFourBody}
            />
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CustomizeSection({ copy }: { copy: Copy }) {
  return (
    <motion.section
      className="rounded-md border border-stone-200 bg-white/95 p-5 shadow-sm dark:border-stone-800 dark:bg-stone-950/92"
      initial={{ y: 6, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.24, delay: 0.16 }}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <SectionHeading kicker={copy.customizeKicker} title={copy.customizeTitle} />
          <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600 dark:text-stone-300">
            {copy.customizeBody}
          </p>
        </div>
        <Button size="lg" onClick={() => openExtensionPage(optionsPageUrl())}>
          <Settings2 aria-hidden="true" size={16} />
          {copy.openSettingsCta}
          <ArrowRight aria-hidden="true" size={14} />
        </Button>
      </div>
    </motion.section>
  );
}

function Footer({ copy, storeUrl, browserName }: { copy: Copy; storeUrl: string | null; browserName: string }) {
  const hasStore = hasExtensionStoreListing(browserName === "Firefox" ? "firefox" : "chrome");
  return (
    <motion.footer
      className="rounded-md border border-stone-200 bg-white/80 p-4 shadow-sm dark:border-stone-800 dark:bg-stone-950/80"
      initial={{ y: 6, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.24, delay: 0.2 }}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-yellow-400 shadow-[0_10px_24px_rgba(255,212,0,0.2)]">
            <LogoMark size={18} variant="white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-950 dark:text-yellow-50">{EXTENSION_NAME}</p>
            <p className="text-xs leading-5 text-stone-500 dark:text-stone-400">{copy.footerNote}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasStore && storeUrl ? (
            <LinkButton href={storeUrl} target="_blank" rel="noreferrer" variant="quiet" size="sm">
              <Star aria-hidden="true" size={13} />
              {copy.rateOn.replace("{{browser}}", browserName)}
            </LinkButton>
          ) : null}
          <LinkButton href={GITHUB_URL} target="_blank" rel="noreferrer" variant="quiet" size="sm">
            <GitBranch aria-hidden="true" size={13} />
            GitHub
          </LinkButton>
          <a
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-stone-600 underline-offset-4 transition-colors hover:bg-yellow-100 hover:text-stone-950 hover:underline focus-visible:outline-yellow-400 dark:text-stone-300 dark:hover:bg-yellow-300/10 dark:hover:text-yellow-100"
            href={PRIVACY_URL}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink aria-hidden="true" size={13} />
            {copy.privacyLink}
          </a>
        </div>
      </div>
    </motion.footer>
  );
}

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      {kicker ? (
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
          {kicker}
        </span>
      ) : null}
      <h2 className="text-base font-semibold text-stone-950 dark:text-yellow-50">{title}</h2>
    </div>
  );
}

type PinStep = { label: string; icon: "puzzle" | "click" | "pin" | "settings" };

type Copy = {
  title: string;
  description: string;
  pinKicker: string;
  pinTitle: string;
  pinBody: string;
  pinHint: string;
  stepLabel: string;
  pinStepsChromium: PinStep[];
  pinStepsFirefox: PinStep[];
  actionsKicker: string;
  actionsTitle: string;
  actionsBody: string;
  primaryOneTitle: string;
  primaryOneBody: string;
  primaryTwoTitle: string;
  primaryTwoBody: string;
  moreTitle: string;
  moreBody: string;
  moreOneTitle: string;
  moreOneBody: string;
  moreTwoTitle: string;
  moreTwoBody: string;
  moreThreeTitle: string;
  moreThreeBody: string;
  moreFourTitle: string;
  moreFourBody: string;
  customizeKicker: string;
  customizeTitle: string;
  customizeBody: string;
  openSettingsCta: string;
  footerNote: string;
  rateOn: string;
  privacyLink: string;
};

const COPY: Record<CopyLocale, Copy> = {
  en: {
    title: `Welcome to ${EXTENSION_NAME}`,
    description: "Find an earlier version when a page is gone or changed.",
    pinKicker: "",
    pinTitle: "Pin the toolbar icon",
    pinBody: "Pin PastPage so manual lookup is always one click away.",
    pinHint: "Once it is pinned, you can check the current page at any time.",
    stepLabel: "Step",
    pinStepsChromium: [
      { label: "Open puzzle by bar", icon: "puzzle" },
      { label: "Find PastPage", icon: "click" },
      { label: "Click the pin", icon: "pin" }
    ],
    pinStepsFirefox: [
      { label: "Open the puzzle menu", icon: "puzzle" },
      { label: "Open PastPage gear menu", icon: "settings" },
      { label: "Pin to Toolbar", icon: "pin" }
    ],
    actionsKicker: "",
    actionsTitle: "Start with these two options",
    actionsBody: "",
    primaryOneTitle: "Recovery bar",
    primaryOneBody: "When a page breaks, PastPage can show a bar with a button to look for an archived version.",
    primaryTwoTitle: "Look up the current page",
    primaryTwoBody: "Click the PastPage icon on any page to search archives for the page you are viewing.",
    moreTitle: "More ways to look up pages",
    moreBody: "Open this if you want extra lookup options.",
    moreOneTitle: "Pick one archive",
    moreOneBody: "Right-click a page to open Wayback Machine, Archive.today, or another archive directly.",
    moreTwoTitle: "Search archives for a link target",
    moreTwoBody: "Right-click a link to search archives for the page behind it without opening the page first.",
    moreThreeTitle: "Look up any URL",
    moreThreeBody: "Use Custom URL in the popup to search for a page that is not currently open.",
    moreFourTitle: "Open all archives",
    moreFourBody: "Open every enabled archive in separate tabs when you want to compare results side by side.",
    customizeKicker: "",
    customizeTitle: "Adjust the details",
    customizeBody: "Choose how lookup results open, how the recovery bar looks, and which sites PastPage ignores.",
    openSettingsCta: "Open settings",
    footerNote: "Open source source-recovery tooling for reporters, researchers, and anyone tracking what changed.",
    rateOn: "Rate on {{browser}}",
    privacyLink: "Privacy"
  },
  de: {
    title: `Willkommen bei ${EXTENSION_NAME}`,
    description: "Finde eine frühere Version, wenn eine Seite weg ist oder verändert wurde.",
    pinKicker: "",
    pinTitle: "Symbol an die Toolbar pinnen",
    pinBody: "So ist „Aktuelle Seite nachschlagen“ immer nur einen Klick entfernt.",
    pinHint: "Sobald das Symbol angeheftet ist, kannst du jede offene Seite direkt prüfen.",
    stepLabel: "Schritt",
    pinStepsChromium: [
      { label: "Puzzle an Leiste", icon: "puzzle" },
      { label: "PastPage finden", icon: "click" },
      { label: "Pin-Symbol klicken", icon: "pin" }
    ],
    pinStepsFirefox: [
      { label: "Puzzle-Menü öffnen", icon: "puzzle" },
      { label: "PastPage-Zahnradmenü öffnen", icon: "settings" },
      { label: "An Symbolleiste anheften", icon: "pin" }
    ],
    actionsKicker: "",
    actionsTitle: "Starte mit diesen zwei Möglichkeiten",
    actionsBody: "",
    primaryOneTitle: "Rettungsleiste",
    primaryOneBody: "Wenn eine Seite kaputt ist, zeigt PastPage oben eine Leiste mit einem Button zur Suche nach einer Archivversion.",
    primaryTwoTitle: "Aktuelle Seite nachschlagen",
    primaryTwoBody: "Klicke auf das PastPage-Symbol, um für die aktuelle Seite nach Archivversionen zu suchen.",
    moreTitle: "Mehr Möglichkeiten",
    moreBody: "Hier findest du die zusätzlichen Wege für die Suche.",
    moreOneTitle: "Ein Archiv direkt öffnen",
    moreOneBody: "Per Rechtsklick kannst du eine Seite direkt in Wayback Machine, Archive.today oder einem anderen Archiv öffnen.",
    moreTwoTitle: "Linkziel im Archiv suchen",
    moreTwoBody:
      'Rechtsklicke auf einen Link und wähle "In Archiv nachschlagen", um in Archiven nach der Zielseite zu suchen, ohne sie zuerst zu öffnen.',
    moreThreeTitle: "Beliebige URL eingeben",
    moreThreeBody: 'Im Menü kannst du unter "URL" auch Seiten suchen, die gerade nicht offen sind.',
    moreFourTitle: "Alle Archive öffnen",
    moreFourBody: "Öffne alle aktivierten Archive in eigenen Tabs, wenn du Ergebnisse nebeneinander vergleichen willst.",
    customizeKicker: "",
    customizeTitle: "Details anpassen",
    customizeBody: "Lege fest, wie Ergebnisse geöffnet werden, wie die Rettungsleiste aussieht und welche Seiten PastPage ignoriert.",
    openSettingsCta: "Settings öffnen",
    footerNote: "Open-Source-Tool für Webarchiv-Suche in der Online-Recherche.",
    rateOn: "Auf {{browser}} bewerten",
    privacyLink: "Datenschutz"
  },
  es: {
    title: `Bienvenido a ${EXTENSION_NAME}`,
    description: "Encuentra una versión anterior cuando una página desaparece o cambia.",
    pinKicker: "",
    pinTitle: "Fija el icono en la barra",
    pinBody: "Así podrás buscar la página actual con un solo clic.",
    pinHint: "Cuando el icono esté fijado, cualquier página abierta se podrá consultar enseguida.",
    stepLabel: "Paso",
    pinStepsChromium: [
      { label: "Abre el menú del puzzle", icon: "puzzle" },
      { label: "Busca PastPage", icon: "click" },
      { label: "Haz clic en el pin", icon: "pin" }
    ],
    pinStepsFirefox: [
      { label: "Abre el menú del puzzle", icon: "puzzle" },
      { label: "Abre el menú de ajustes de PastPage", icon: "settings" },
      { label: "Fijar en la barra", icon: "pin" }
    ],
    actionsKicker: "",
    actionsTitle: "Empieza con estas dos opciones",
    actionsBody: "",
    primaryOneTitle: "Barra de recuperación",
    primaryOneBody: "Cuando una página falla, PastPage puede mostrar una barra con un botón para buscar una versión archivada.",
    primaryTwoTitle: "Buscar la página actual",
    primaryTwoBody: "Haz clic en el icono de PastPage para buscar versiones archivadas de la página que estás viendo.",
    moreTitle: "Más opciones",
    moreBody: "Ábrelo si quieres formas extra de buscar páginas.",
    moreOneTitle: "Abrir un archivo concreto",
    moreOneBody: "Haz clic derecho en una página para abrirla directamente en Wayback Machine, Archive.today u otro archivo.",
    moreTwoTitle: "Buscar en archivos el destino de un enlace",
    moreTwoBody: "Haz clic derecho en un enlace para buscar en archivos la página a la que apunta sin abrirla primero.",
    moreThreeTitle: "Introducir cualquier URL",
    moreThreeBody: "Usa «URL personalizada» en el panel para buscar una página que no tienes abierta.",
    moreFourTitle: "Abrir todos los archivos",
    moreFourBody: "Abre todos los archivos activados en pestañas separadas para comparar resultados lado a lado.",
    customizeKicker: "",
    customizeTitle: "Ajusta los detalles",
    customizeBody: "Elige cómo se abren los resultados, cómo se ve la barra de recuperación y qué sitios debe ignorar PastPage.",
    openSettingsCta: "Abrir ajustes",
    footerNote: "Herramienta de código abierto para recuperar fuentes y seguir qué cambió.",
    rateOn: "Valorar en {{browser}}",
    privacyLink: "Privacidad"
  },
  fr: {
    title: `Bienvenue sur ${EXTENSION_NAME}`,
    description: "Retrouvez une version antérieure quand une page disparaît ou change.",
    pinKicker: "",
    pinTitle: "Épingler l'icône dans la barre",
    pinBody: "Ainsi, la recherche de la page actuelle reste à un clic.",
    pinHint: "Une fois l'icône épinglée, vous pouvez vérifier n'importe quelle page ouverte immédiatement.",
    stepLabel: "Étape",
    pinStepsChromium: [
      { label: "Ouvrez le menu puzzle", icon: "puzzle" },
      { label: "Trouvez PastPage", icon: "click" },
      { label: "Cliquez sur l'épingle", icon: "pin" }
    ],
    pinStepsFirefox: [
      { label: "Ouvrez le menu puzzle", icon: "puzzle" },
      { label: "Ouvrez le menu de réglages de PastPage", icon: "settings" },
      { label: "Épingler à la barre", icon: "pin" }
    ],
    actionsKicker: "",
    actionsTitle: "Commencez par ces deux options",
    actionsBody: "",
    primaryOneTitle: "Barre de récupération",
    primaryOneBody: "Quand une page casse, PastPage peut afficher une barre avec un bouton pour chercher une version archivée.",
    primaryTwoTitle: "Rechercher la page actuelle",
    primaryTwoBody: "Cliquez sur l'icône PastPage pour chercher des versions archivées de la page en cours.",
    moreTitle: "Plus d'options",
    moreBody: "Ouvrez cette section pour afficher les autres façons de chercher.",
    moreOneTitle: "Ouvrir une archive précise",
    moreOneBody: "Faites un clic droit sur une page pour l'ouvrir directement dans Wayback Machine, Archive.today ou une autre archive.",
    moreTwoTitle: "Chercher la cible d'un lien dans les archives",
    moreTwoBody: "Faites un clic droit sur un lien pour chercher dans les archives la page visée sans l'ouvrir d'abord.",
    moreThreeTitle: "Saisir n'importe quelle URL",
    moreThreeBody: "Utilisez « URL personnalisée » dans le panneau pour chercher une page qui n'est pas ouverte.",
    moreFourTitle: "Ouvrir toutes les archives",
    moreFourBody: "Ouvrez toutes les archives activées dans des onglets séparés pour comparer les résultats côte à côte.",
    customizeKicker: "",
    customizeTitle: "Réglez les détails",
    customizeBody: "Choisissez comment les résultats s'ouvrent, l'apparence de la barre de récupération et les sites que PastPage doit ignorer.",
    openSettingsCta: "Ouvrir les réglages",
    footerNote: "Outil open source pour retrouver des sources et suivre ce qui a changé.",
    rateOn: "Évaluer sur {{browser}}",
    privacyLink: "Confidentialité"
  },
  it: {
    title: `Benvenuto in ${EXTENSION_NAME}`,
    description: "Trova una versione precedente quando una pagina non c'è più o è cambiata.",
    pinKicker: "",
    pinTitle: "Fissa l'icona nella barra degli strumenti",
    pinBody: "In questo modo `Controlla la pagina corrente` è sempre a un clic.",
    pinHint: "Una volta fissata l'icona, puoi controllare subito qualsiasi pagina aperta.",
    stepLabel: "Passaggio",
    pinStepsChromium: [
      { label: "Apri il menu puzzle", icon: "puzzle" },
      { label: "Trova PastPage", icon: "click" },
      { label: "Fai clic sul pin", icon: "pin" }
    ],
    pinStepsFirefox: [
      { label: "Apri il menu puzzle", icon: "puzzle" },
      { label: "Apri il menu ingranaggio di PastPage", icon: "settings" },
      { label: "Fissa alla barra degli strumenti", icon: "pin" }
    ],
    actionsKicker: "",
    actionsTitle: "Inizia da queste due opzioni",
    actionsBody: "",
    primaryOneTitle: "Barra di recupero",
    primaryOneBody: "Quando una pagina si rompe, PastPage mostra in alto una barra con un pulsante per cercare una versione archiviata.",
    primaryTwoTitle: "Controlla la pagina corrente",
    primaryTwoBody: "Fai clic sull'icona di PastPage per cercare versioni archiviate della pagina che stai guardando.",
    moreTitle: "Altre possibilità",
    moreBody: "Apri questa sezione se vuoi altri modi per cercare.",
    moreOneTitle: "Apri un archivio specifico",
    moreOneBody: "Con il clic destro puoi aprire una pagina direttamente in Wayback Machine, Archive.today o un altro archivio.",
    moreTwoTitle: "Cerca negli archivi la destinazione di un link",
    moreTwoBody: "Fai clic destro su un link per cercare negli archivi la pagina di destinazione senza aprirla prima.",
    moreThreeTitle: "Inserisci qualsiasi URL",
    moreThreeBody: "Nel menu, sotto `URL`, puoi cercare anche pagine che non sono aperte in questo momento.",
    moreFourTitle: "Apri tutti gli archivi",
    moreFourBody: "Apri tutti gli archivi attivati in schede separate se vuoi confrontare i risultati fianco a fianco.",
    customizeKicker: "",
    customizeTitle: "Regola i dettagli",
    customizeBody: "Scegli come si aprono i risultati, come appare la barra di recupero e quali siti PastPage deve ignorare.",
    openSettingsCta: "Apri impostazioni",
    footerNote: "Strumento open source per la ricerca negli archivi web durante la ricerca online.",
    rateOn: "Valuta su {{browser}}",
    privacyLink: "Privacy"
  },
  pl: {
    title: `Witamy w ${EXTENSION_NAME}`,
    description: "Znajdź wcześniejszą wersję strony, gdy zniknęła albo została zmieniona.",
    pinKicker: "",
    pinTitle: "Przypnij ikonę do paska narzędzi",
    pinBody: "Dzięki temu `Sprawdź bieżącą stronę` jest zawsze o jedno kliknięcie.",
    pinHint: "Gdy ikona jest przypięta, możesz od razu sprawdzić każdą otwartą stronę.",
    stepLabel: "Krok",
    pinStepsChromium: [
      { label: "Otwórz menu puzzli", icon: "puzzle" },
      { label: "Znajdź PastPage", icon: "click" },
      { label: "Kliknij pinezkę", icon: "pin" }
    ],
    pinStepsFirefox: [
      { label: "Otwórz menu puzzli", icon: "puzzle" },
      { label: "Otwórz menu koła zębatego PastPage", icon: "settings" },
      { label: "Przypnij do paska narzędzi", icon: "pin" }
    ],
    actionsKicker: "",
    actionsTitle: "Zacznij od tych dwóch opcji",
    actionsBody: "",
    primaryOneTitle: "Pasek ratunkowy",
    primaryOneBody: "Gdy strona przestaje działać, PastPage pokazuje u góry pasek z przyciskiem do szukania wersji archiwalnej.",
    primaryTwoTitle: "Sprawdź bieżącą stronę",
    primaryTwoBody: "Kliknij ikonę PastPage, aby wyszukać wersje archiwalne strony, którą właśnie oglądasz.",
    moreTitle: "Więcej możliwości",
    moreBody: "Otwórz tę sekcję, jeśli chcesz skorzystać z dodatkowych sposobów wyszukiwania.",
    moreOneTitle: "Otwórz wybrane archiwum",
    moreOneBody: "Kliknięciem prawym przyciskiem możesz otworzyć stronę bezpośrednio w Wayback Machine, Archive.today albo innym archiwum.",
    moreTwoTitle: "Szukaj w archiwach celu linku",
    moreTwoBody: "Kliknij prawym przyciskiem link, aby wyszukać w archiwach stronę docelową bez otwierania jej najpierw.",
    moreThreeTitle: "Wpisz dowolny URL",
    moreThreeBody: "W menu, pod `URL`, możesz wyszukać także strony, które nie są teraz otwarte.",
    moreFourTitle: "Otwórz wszystkie archiwa",
    moreFourBody: "Otwórz wszystkie włączone archiwa w osobnych kartach, jeśli chcesz porównać wyniki obok siebie.",
    customizeKicker: "",
    customizeTitle: "Dopasuj szczegóły",
    customizeBody: "Ustaw, jak mają się otwierać wyniki, jak ma wyglądać pasek ratunkowy i które strony PastPage ma ignorować.",
    openSettingsCta: "Otwórz ustawienia",
    footerNote: "Narzędzie open source do wyszukiwania w archiwach webowych podczas researchu online.",
    rateOn: "Oceń w {{browser}}",
    privacyLink: "Prywatność"
  },
  pt: {
    title: `Bem-vindo ao ${EXTENSION_NAME}`,
    description: "Encontre uma versão anterior quando uma página desapareceu ou foi alterada.",
    pinKicker: "",
    pinTitle: "Fixe o ícone na barra de ferramentas",
    pinBody: "Assim, `Consultar a página atual` fica sempre a um clique.",
    pinHint: "Depois de fixar o ícone, pode verificar imediatamente qualquer página aberta.",
    stepLabel: "Passo",
    pinStepsChromium: [
      { label: "Abra o menu do puzzle", icon: "puzzle" },
      { label: "Encontre o PastPage", icon: "click" },
      { label: "Clique no alfinete", icon: "pin" }
    ],
    pinStepsFirefox: [
      { label: "Abra o menu do puzzle", icon: "puzzle" },
      { label: "Abra o menu de engrenagem do PastPage", icon: "settings" },
      { label: "Fixar à barra de ferramentas", icon: "pin" }
    ],
    actionsKicker: "",
    actionsTitle: "Comece por estas duas opções",
    actionsBody: "",
    primaryOneTitle: "Barra de recuperação",
    primaryOneBody: "Quando uma página falha, o PastPage mostra uma barra no topo com um botão para procurar uma versão arquivada.",
    primaryTwoTitle: "Consultar a página atual",
    primaryTwoBody: "Clique no ícone do PastPage para procurar versões arquivadas da página que está a ver.",
    moreTitle: "Mais possibilidades",
    moreBody: "Abra esta secção se quiser outras formas de procurar.",
    moreOneTitle: "Abrir um arquivo específico",
    moreOneBody: "Com o clique direito, pode abrir uma página diretamente no Wayback Machine, Archive.today ou noutro arquivo.",
    moreTwoTitle: "Procurar nos arquivos o destino de um link",
    moreTwoBody: "Clique com o botão direito num link para procurar nos arquivos a página de destino sem a abrir primeiro.",
    moreThreeTitle: "Introduzir qualquer URL",
    moreThreeBody: "No menu, em `URL`, também pode procurar páginas que não estão abertas neste momento.",
    moreFourTitle: "Abrir todos os arquivos",
    moreFourBody: "Abra todos os arquivos ativados em separadores próprios se quiser comparar os resultados lado a lado.",
    customizeKicker: "",
    customizeTitle: "Ajustar detalhes",
    customizeBody: "Escolha como os resultados são abertos, como a barra de recuperação aparece e que sites o PastPage deve ignorar.",
    openSettingsCta: "Abrir definições",
    footerNote: "Ferramenta open source para pesquisa em arquivos web durante a investigação online.",
    rateOn: "Avaliar no {{browser}}",
    privacyLink: "Privacidade"
  },
  uk: {
    title: `Ласкаво просимо до ${EXTENSION_NAME}`,
    description: "Знайдіть попередню версію сторінки, якщо вона зникла або була змінена.",
    pinKicker: "",
    pinTitle: "Закріпіть піктограму на панелі інструментів",
    pinBody: "Так `Перевірити поточну сторінку` завжди буде на відстані одного кліку.",
    pinHint: "Коли піктограму закріплено, ви можете одразу перевірити будь-яку відкриту сторінку.",
    stepLabel: "Крок",
    pinStepsChromium: [
      { label: "Відкрийте меню пазла", icon: "puzzle" },
      { label: "Знайдіть PastPage", icon: "click" },
      { label: "Натисніть шпильку", icon: "pin" }
    ],
    pinStepsFirefox: [
      { label: "Відкрийте меню пазла", icon: "puzzle" },
      { label: "Відкрийте меню шестерні PastPage", icon: "settings" },
      { label: "Закріпити на панелі інструментів", icon: "pin" }
    ],
    actionsKicker: "",
    actionsTitle: "Почніть із цих двох варіантів",
    actionsBody: "",
    primaryOneTitle: "Панель відновлення",
    primaryOneBody: "Коли сторінка ламається, PastPage показує вгорі панель із кнопкою для пошуку архівної версії.",
    primaryTwoTitle: "Перевірити поточну сторінку",
    primaryTwoBody: "Натисніть піктограму PastPage, щоб знайти архівні версії сторінки, яку ви зараз переглядаєте.",
    moreTitle: "Більше можливостей",
    moreBody: "Відкрийте цей розділ, якщо хочете інші способи пошуку.",
    moreOneTitle: "Відкрити конкретний архів",
    moreOneBody: "Клацніть правою кнопкою, щоб відкрити сторінку безпосередньо у Wayback Machine, Archive.today або в іншому архіві.",
    moreTwoTitle: "Шукати в архівах ціль посилання",
    moreTwoBody: "Клацніть правою кнопкою на посиланні, щоб шукати в архівах цільову сторінку, не відкриваючи її спочатку.",
    moreThreeTitle: "Ввести будь-який URL",
    moreThreeBody: "У меню, в розділі `URL`, можна шукати навіть сторінки, які зараз не відкриті.",
    moreFourTitle: "Відкрити всі архіви",
    moreFourBody: "Відкрийте всі увімкнені архіви в окремих вкладках, якщо хочете порівняти результати поруч.",
    customizeKicker: "",
    customizeTitle: "Налаштувати деталі",
    customizeBody: "Виберіть, як відкривати результати, як має виглядати панель відновлення і які сайти PastPage має ігнорувати.",
    openSettingsCta: "Відкрити налаштування",
    footerNote: "Інструмент open source для пошуку у вебархівах під час онлайн-досліджень.",
    rateOn: "Оцінити у {{browser}}",
    privacyLink: "Конфіденційність"
  }
};
