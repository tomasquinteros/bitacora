import { ref } from "vue";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type ThemePref = "system" | "light" | "dark";

const KEY = "theme";
const EVENT = "bitacora:theme";

function read(): ThemePref {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
}

export const themePref = ref<ThemePref>(read());

function apply(p: ThemePref) {
  const root = document.documentElement;
  if (p === "system") delete root.dataset.theme;
  else root.dataset.theme = p;
  // También la ventana nativa: si no, la vibrancy de macOS queda en el tema del sistema.
  getCurrentWindow().setTheme(p === "system" ? null : p);
}

export function initTheme() {
  apply(themePref.value);
  listen<ThemePref>(EVENT, (e) => {
    themePref.value = e.payload;
    apply(e.payload);
  });
}

export async function setThemePref(p: ThemePref) {
  localStorage.setItem(KEY, p);
  themePref.value = p;
  apply(p);
  await emit(EVENT, p);
}

const ORDER: ThemePref[] = ["system", "light", "dark"];
export function cycleTheme() {
  return setThemePref(ORDER[(ORDER.indexOf(themePref.value) + 1) % ORDER.length]);
}

export const THEME_LABEL: Record<ThemePref, string> = { system: "Sistema", light: "Claro", dark: "Oscuro" };
