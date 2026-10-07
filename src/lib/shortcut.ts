const isMac = navigator.userAgent.includes("Mac");

// Arma el string de acelerador que entiende tauri-plugin-global-shortcut desde un keydown.
export function acceleratorFromEvent(e: KeyboardEvent): string | null {
  if (["Meta", "Control", "Alt", "Shift"].includes(e.key)) return null;
  const mods: string[] = [];
  if (isMac ? e.metaKey : e.ctrlKey) mods.push("CommandOrControl");
  if (isMac && e.ctrlKey) mods.push("Control");
  if (!isMac && e.metaKey) mods.push("Super");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  // Sin modificador sería robarle una tecla común a todo el sistema.
  if (!mods.length) return null;
  return [...mods, e.code].join("+");
}

const MAC_SYMBOLS: Record<string, string> = {
  CommandOrControl: "⌘", Control: "⌃", Alt: "⌥", Shift: "⇧", Super: "⌘",
};
const WIN_NAMES: Record<string, string> = { CommandOrControl: "Ctrl", Alt: "Alt", Shift: "Shift", Super: "Win", Control: "Ctrl" };

export function prettyAccelerator(acc: string): string {
  const parts = acc.split("+").map((p) => {
    if (isMac && MAC_SYMBOLS[p]) return MAC_SYMBOLS[p];
    if (!isMac && WIN_NAMES[p]) return WIN_NAMES[p];
    return p.replace(/^Key/, "").replace(/^Digit/, "");
  });
  return isMac ? parts.join("") : parts.join("+");
}
