import { createApp } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import PopoverApp from "./PopoverApp.vue";
import MainApp from "./MainApp.vue";
import QuickApp from "./QuickApp.vue";
import { initTheme } from "./lib/theme";
import "./styles.css";

// Las ventanas cargan el mismo bundle; el label decide qué app montar.
const label = getCurrentWindow().label;
const apps = { popover: PopoverApp, quick: QuickApp, main: MainApp };
const root = document.documentElement.classList;
root.add(`is-${label}`);
// En macOS las ventanas son transparentes con vibrancy; en Windows, opacas.
root.add(navigator.userAgent.includes("Mac") ? "mac" : "win");
initTheme();
createApp(apps[label as keyof typeof apps] ?? MainApp).mount("#app");
