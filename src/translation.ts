// deno-lint-ignore-file no-explicit-any
import ar from "./locales/ar.json" with { type: "json" };
import en from "./locales/en.json" with { type: "json" };
import jp from "./locales/jp.json" with { type: "json" };

type LocaleMap = Record<string, any>;
const resources: Record<string, LocaleMap> = { en, jp, ar };

let currentLanguage = "en";
const listeners: Array<() => void> = [];

export function availableLocales(): string[] {
  return Object.keys(resources);
}

function getNested(obj: any, path: string) {
  return path.split(".").reduce(
    (o, k) => (o && o[k] !== undefined ? o[k] : undefined),
    obj,
  );
}

export function translate(
  path: string,
  vars?: Record<string, string | number>,
) {
  let val = getNested(resources[currentLanguage], path);
  if (val === undefined) val = getNested(resources["en"], path) ?? path;
  if (typeof val !== "string") return String(val);
  if (!vars) return val;
  return Object.keys(vars).reduce(
    (s, k) => s.replaceAll(`{{${k}}}`, String(vars[k])),
    val,
  );
}

export function setLocale(locale: string) {
  if (!resources[locale]) {
    console.warn(`Locale not found: ${locale}, falling back to 'en'`);
    currentLanguage = "en";
  } else {
    currentLanguage = locale;
  }
  listeners.forEach((cb) => cb());
}

export function getLocale() {
  return currentLanguage;
}

export function onLocaleChange(cb: () => void) {
  listeners.push(cb);
  return () => {
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  };
}
