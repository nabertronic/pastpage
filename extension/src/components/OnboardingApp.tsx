import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowDown,
  ExternalLink,
  GitBranch,
  Layers,
  Link2,
  Menu,
  MousePointerClick,
  PanelTopOpen,
  Pin,
  Puzzle,
  Search,
  Settings2,
  Star
} from "lucide-react";
import { Button, LinkButton } from "./Button";
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
type CopyLocale = "de" | "en" | "es" | "fr";

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
        <Hero copy={copy} />
        <PinSection copy={copy} isFirefox={isFirefox} />
        <CapabilitiesSection copy={copy} />
        <CustomizeSection copy={copy} />
        <Footer copy={copy} storeUrl={storeUrl} browserName={browserName} />
      </div>
    </PageShell>
  );
}

function Hero({ copy }: { copy: Copy }) {
  return (
    <motion.section
      className="rounded-md border border-stone-200 bg-white/95 p-5 shadow-sm dark:border-stone-800 dark:bg-stone-950/92"
      initial={{ y: 6, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.24, delay: 0.04 }}
    >
      <div className="min-w-0">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-normal text-balance text-stone-950 dark:text-yellow-50">
            {copy.heroHeading}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600 dark:text-stone-300">
            {copy.heroBody.replace("{{name}}", EXTENSION_NAME)}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm font-semibold text-yellow-500 transition-colors hover:text-yellow-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
              onClick={() => {
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {copy.heroCta}
              <ArrowDown aria-hidden="true" size={16} />
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function PinSection({ copy, isFirefox }: { copy: Copy; isFirefox: boolean }) {
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
                <PinStepIcon name={step.icon} />
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

function PinStepIcon({ name }: { name: "puzzle" | "click" | "pin" | "settings" }) {
  switch (name) {
    case "puzzle":
      return <Puzzle aria-hidden="true" size={16} />;
    case "click":
      return <MousePointerClick aria-hidden="true" size={16} />;
    case "pin":
      return <Pin aria-hidden="true" size={16} />;
    case "settings":
      return <Settings2 aria-hidden="true" size={16} />;
  }
}

function CapabilitiesSection({ copy }: { copy: Copy }) {
  return (
    <motion.section
      id="how-it-works"
      className="rounded-md border border-stone-200 bg-white/95 p-5 shadow-sm dark:border-stone-800 dark:bg-stone-950/92"
      initial={{ y: 6, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.24, delay: 0.12 }}
    >
      <SectionHeading kicker={copy.capKicker} title={copy.capTitle} />
      {copy.capBody ? (
        <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600 dark:text-stone-300">{copy.capBody}</p>
      ) : null}
      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        <Capability
          icon={<PanelTopOpen aria-hidden="true" size={16} />}
          title={copy.capOneTitle}
          body={copy.capOneBody}
        />
        <Capability
          icon={<MousePointerClick aria-hidden="true" size={16} />}
          title={copy.capTwoTitle}
          body={copy.capTwoBody}
        />
        <Capability
          icon={<Menu aria-hidden="true" size={16} />}
          title={copy.capThreeTitle}
          body={copy.capThreeBody}
        />
        <Capability
          icon={<Link2 aria-hidden="true" size={16} />}
          title={copy.capFourTitle}
          body={copy.capFourBody}
        />
        <Capability
          icon={<Search aria-hidden="true" size={16} />}
          title={copy.capFiveTitle}
          body={copy.capFiveBody}
        />
        <Capability
          icon={<Layers aria-hidden="true" size={16} />}
          title={copy.capSixTitle}
          body={copy.capSixBody}
        />
      </ul>
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
  heroHeading: string;
  heroBody: string;
  heroCta: string;
  pinKicker: string;
  pinTitle: string;
  pinBody: string;
  pinHint: string;
  stepLabel: string;
  pinStepsChromium: PinStep[];
  pinStepsFirefox: PinStep[];
  capKicker: string;
  capTitle: string;
  capBody: string;
  capOneTitle: string;
  capOneBody: string;
  capTwoTitle: string;
  capTwoBody: string;
  capThreeTitle: string;
  capThreeBody: string;
  capFourTitle: string;
  capFourBody: string;
  capFiveTitle: string;
  capFiveBody: string;
  capSixTitle: string;
  capSixBody: string;
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
    description: "Recover missing pages, inspect changed ones, and keep archive search within reach.",
    heroHeading: "When a page is gone or changed, find what was there.",
    heroBody:
      "{{name}} can react when a page fails locally in your browser, or help you manually check archived earlier versions on any page from the toolbar icon or context menu. It searches across multiple archives in a URL-aware flow so you can keep chasing the source trail.",
    heroCta: "Learn how it works",
    pinKicker: "",
    pinTitle: "Pin the toolbar icon",
    pinBody:
      "Pinning keeps PastPage in the toolbar, so archive lookups stay one click away on any page.",
    pinHint: "Once the icon sits in the toolbar, archive lookup is always within reach.",
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
    capKicker: "",
    capTitle: "Six ways PastPage helps",
    capBody: "",
    capOneTitle: "Recovery bar",
    capOneBody:
      "When a page fails to load, a quiet bar appears automatically with one button to search for archived copies.",
    capTwoTitle: "Manual lookup",
    capTwoBody: "Click the toolbar icon on any page to search archives for the URL you are viewing.",
    capThreeTitle: "Pick an archive",
    capThreeBody: "Right-click on any page to jump straight into Wayback Machine, Archive.today, and other archive options.",
    capFourTitle: "Check where a link leads",
    capFourBody:
      "Right-click any link on a page and choose 'Look up in archives'. PastPage searches for archived versions of the page the link points to — not the one you are currently on.",
    capFiveTitle: "Look up any URL",
    capFiveBody:
      "Click the PastPage icon in the toolbar and switch to 'Custom URL' at the top. Type in any web address and PastPage will search the archives for it — even if you do not have that page open.",
    capSixTitle: "Open all archives at once",
    capSixBody:
      "In the popup or via right-click, choose 'Open all archives in tabs'. PastPage opens Wayback Machine, Archive.today, and every other enabled archive in its own tab so you can compare them side by side.",
    customizeKicker: "",
    customizeTitle: "Make it yours",
    customizeBody:
      "Choose how archive results open, how closely lookups match the current URL, how the recovery bar looks, and which domains PastPage should ignore.",
    openSettingsCta: "Open settings",
    footerNote: "Open source source-recovery tooling for reporters, researchers, and anyone tracking what changed.",
    rateOn: "Rate on {{browser}}",
    privacyLink: "Privacy"
  },
  de: {
    title: `Willkommen bei ${EXTENSION_NAME}`,
    description: "Fehlende Seiten wiederfinden, Änderungen prüfen und die Archivsuche direkt im Browser griffbereit haben.",
    heroHeading: "Wenn eine Seite weg ist oder verändert wurde, finde, was dort stand.",
    heroBody:
      "{{name}} reagiert auf Seitenfehler direkt im Browser oder lässt dich auf jeder Seite manuell nach früheren archivierten Versionen suchen, über das Toolbar-Symbol oder das Kontextmenü. Dabei wird über mehrere Archive in einer URL-bewussten Reihenfolge gesucht, damit die Quellenrecherche nicht abreißt.",
    heroCta: "So funktioniert es",
    pinKicker: "",
    pinTitle: "Symbol an die Toolbar pinnen",
    pinBody:
      "Angepinnt bleibt PastPage in der Symbolleiste, damit die Archivsuche auf jeder Seite nur einen Klick entfernt ist.",
    pinHint: "Sobald das Symbol in der Symbolleiste sitzt, ist die Archivsuche immer griffbereit.",
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
    capKicker: "",
    capTitle: "Sechs Wege, wie PastPage hilft",
    capBody: "",
    capOneTitle: "Rettungsleiste",
    capOneBody:
      "Wenn eine Seite nicht lädt, erscheint automatisch eine schmale Leiste am oberen Rand – einfach den Button drücken, um archivierte Versionen zu suchen.",
    capTwoTitle: "Aktuelle Seite nachschlagen",
    capTwoBody:
      "Klicke das PastPage-Symbol in der Toolbar an. Es öffnet sich das Popup mit den verfügbaren Archiven für die Seite, auf der du gerade bist.",
    capThreeTitle: "Direkt ins gewünschte Archiv",
    capThreeBody:
      "Rechtsklick auf eine Seite – dann ein bestimmtes Archiv auswählen, z. B. Wayback Machine oder Archive.today. PastPage öffnet die Seite dort sofort.",
    capFourTitle: "Link-Ziel nachschlagen",
    capFourBody:
      'Rechtsklicke auf einen beliebigen Link und wähle "In Archiv nachschlagen". PastPage sucht dann nach archivierten Versionen der Seite, auf die der Link zeigt – nicht der Seite, auf der du gerade bist.',
    capFiveTitle: "Eigene URL eingeben",
    capFiveBody:
      'Klicke das PastPage-Symbol an und wechsle oben zu "Eigene URL". Gib eine beliebige Webadresse ein – PastPage durchsucht die Archive dafür, auch wenn du die Seite gerade nicht geöffnet hast.',
    capSixTitle: "Alle Archive gleichzeitig öffnen",
    capSixBody:
      'Im Popup oder per Rechtsklick "Alle Archive in Tabs öffnen" wählen. PastPage öffnet dann Wayback Machine, Archive.today und alle weiteren aktivierten Archive auf einen Schlag in eigenen Tabs.',
    customizeKicker: "",
    customizeTitle: "Mach es dir passend",
    customizeBody:
      "Lege fest, wie Archivtreffer geöffnet werden, wie genau die Suche der aktuellen URL folgt, wie die Recovery-Leiste aussieht und welche Domains PastPage ignorieren soll.",
    openSettingsCta: "Settings öffnen",
    footerNote: "Open-Source-Tool für Quellenrettung bei Recherche, Dokumentation und dem Nachverfolgen von Änderungen.",
    rateOn: "Auf {{browser}} bewerten",
    privacyLink: "Datenschutz"
  },
  es: {
    title: `Bienvenido a ${EXTENSION_NAME}`,
    description: "Recupera páginas desaparecidas, revisa cambios y mantén la búsqueda en archivos al alcance.",
    heroHeading: "Cuando una página desaparece o cambia, encuentra qué había allí.",
    heroBody:
      "{{name}} puede reaccionar cuando una página falla en tu navegador o ayudarte a comprobar versiones archivadas anteriores desde el icono de la barra o el menú contextual. Busca en varios archivos con un flujo consciente de la URL para que puedas seguir la pista de la fuente.",
    heroCta: "Ver cómo funciona",
    pinKicker: "",
    pinTitle: "Fija el icono en la barra",
    pinBody:
      "Al fijarlo, PastPage queda en la barra de herramientas para que las búsquedas en archivos estén a un clic en cualquier página.",
    pinHint: "Cuando el icono quede en la barra de herramientas, la búsqueda en archivos siempre estará a mano.",
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
    capKicker: "",
    capTitle: "Seis formas en que ayuda PastPage",
    capBody: "",
    capOneTitle: "Barra de recuperación",
    capOneBody:
      "Cuando una página no carga, aparece automáticamente una barra discreta con un botón para buscar copias archivadas.",
    capTwoTitle: "Buscar la página actual",
    capTwoBody:
      "Haz clic en el icono de PastPage en la barra de herramientas. Se abrirá el panel con los archivos disponibles para la página que estás viendo.",
    capThreeTitle: "Ir directamente a un archivo",
    capThreeBody:
      "Haz clic derecho en cualquier página y elige un archivo concreto, como Wayback Machine o Archive.today. PastPage lo abre de inmediato.",
    capFourTitle: "Consultar el destino de un enlace",
    capFourBody:
      "Haz clic derecho sobre cualquier enlace y elige 'Buscar en archivos'. PastPage busca versiones archivadas de la página a la que apunta el enlace, no la que estás viendo ahora.",
    capFiveTitle: "Introducir cualquier URL",
    capFiveBody:
      "Haz clic en el icono de PastPage y cambia arriba a 'URL personalizada'. Escribe cualquier dirección web y PastPage buscará sus archivos, aunque no tengas esa página abierta.",
    capSixTitle: "Abrir todos los archivos a la vez",
    capSixBody:
      "En el panel o mediante clic derecho, elige 'Abrir todos los archivos en pestañas'. PastPage abre Wayback Machine, Archive.today y todos los archivos activados en pestañas separadas de una sola vez.",
    customizeKicker: "",
    customizeTitle: "Hazlo tuyo",
    customizeBody:
      "Elige cómo se abren los resultados archivados, lo cerca que la búsqueda sigue la URL actual, cómo se ve la barra de recuperación y qué dominios debe ignorar PastPage.",
    openSettingsCta: "Abrir ajustes",
    footerNote: "Herramienta de código abierto para recuperar fuentes y seguir qué cambió.",
    rateOn: "Valorar en {{browser}}",
    privacyLink: "Privacidad"
  },
  fr: {
    title: `Bienvenue sur ${EXTENSION_NAME}`,
    description: "Retrouvez des pages disparues, vérifiez les changements et gardez la recherche d'archives à portée de main.",
    heroHeading: "Quand une page disparaît ou change, retrouvez ce qui s'y trouvait.",
    heroBody:
      "{{name}} peut réagir lorsqu'une page échoue dans votre navigateur ou vous aider à vérifier d'anciennes versions archivées depuis l'icône de la barre d'outils ou le menu contextuel. Il interroge plusieurs archives avec un flux adapté à l'URL pour vous aider à poursuivre la piste de la source.",
    heroCta: "Voir le fonctionnement",
    pinKicker: "",
    pinTitle: "Épingler l'icône dans la barre",
    pinBody:
      "Une fois épinglé, PastPage reste dans la barre d'outils pour garder la recherche d'archives à un clic sur n'importe quelle page.",
    pinHint: "Quand l'icône est placée dans la barre d'outils, la recherche d'archives reste toujours accessible.",
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
    capKicker: "",
    capTitle: "Six façons dont PastPage aide",
    capBody: "",
    capOneTitle: "Barre de récupération",
    capOneBody:
      "Quand une page ne charge pas, une barre discrète apparaît automatiquement avec un bouton pour rechercher des copies archivées.",
    capTwoTitle: "Rechercher la page actuelle",
    capTwoBody:
      "Cliquez sur l'icône PastPage dans la barre d'outils. Le panneau s'ouvre avec les archives disponibles pour la page que vous consultez.",
    capThreeTitle: "Aller directement dans une archive",
    capThreeBody:
      "Faites un clic droit sur n'importe quelle page et choisissez une archive précise, comme Wayback Machine ou Archive.today. PastPage l'ouvre aussitôt.",
    capFourTitle: "Vérifier la destination d'un lien",
    capFourBody:
      "Faites un clic droit sur n'importe quel lien et choisissez « Rechercher dans les archives ». PastPage cherche des versions archivées de la page visée par le lien, pas celle que vous consultez.",
    capFiveTitle: "Saisir n'importe quelle URL",
    capFiveBody:
      "Cliquez sur l'icône PastPage et passez en haut sur « URL personnalisée ». Tapez n'importe quelle adresse web : PastPage cherchera ses archives, même si vous n'avez pas cette page ouverte.",
    capSixTitle: "Ouvrir toutes les archives d'un coup",
    capSixBody:
      "Dans le panneau ou via clic droit, choisissez « Ouvrir toutes les archives dans des onglets ». PastPage ouvre Wayback Machine, Archive.today et toutes les archives activées dans des onglets séparés en une seule action.",
    customizeKicker: "",
    customizeTitle: "Faites-en le vôtre",
    customizeBody:
      "Choisissez comment les résultats archivés s'ouvrent, à quel point la recherche suit l'URL actuelle, l'apparence de la barre de récupération et les domaines que PastPage doit ignorer.",
    openSettingsCta: "Ouvrir les réglages",
    footerNote: "Outil open source pour retrouver des sources et suivre ce qui a changé.",
    rateOn: "Évaluer sur {{browser}}",
    privacyLink: "Confidentialité"
  }
};
