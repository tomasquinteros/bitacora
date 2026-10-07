import { reactive, watch } from "vue";

const KEY = "collapsed.sections";

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

// Claves "s:<id>" para secciones del día y "all:<id>" para los grupos de "Todo".
export const collapsed = reactive(new Set<string>(read()));
watch(collapsed, () => localStorage.setItem(KEY, JSON.stringify([...collapsed])));

export function toggleCollapsed(key: string) {
  if (collapsed.has(key)) collapsed.delete(key);
  else collapsed.add(key);
}
