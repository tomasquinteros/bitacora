import { onMounted, onUnmounted, reactive, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { deleteItems, restoreItems, type Deleted } from "./db";

export const selection = reactive(new Set<number>());
let anchor: { ids: number[]; id: number } | null = null;

export function clearSelection() {
  selection.clear();
  anchor = null;
}

// Click: selecciona solo ése; ⌘/Ctrl+click: suma o saca; ⇧+click: rango dentro de la misma lista.
export function clickSelect(e: MouseEvent, id: number, listIds: number[]) {
  if (e.metaKey || e.ctrlKey) {
    if (selection.has(id)) selection.delete(id);
    else selection.add(id);
    anchor = { ids: listIds, id };
    return;
  }
  if (e.shiftKey && anchor && anchor.ids.includes(id)) {
    const [a, b] = [anchor.ids.indexOf(anchor.id), anchor.ids.indexOf(id)].sort((x, y) => x - y);
    selection.clear();
    anchor.ids.slice(a, b + 1).forEach((x) => selection.add(x));
    return;
  }
  selection.clear();
  selection.add(id);
  anchor = { ids: listIds, id };
}

export const undoToast = ref<{ message: string; deleted: Deleted } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export async function deleteSelected() {
  const deleted = await deleteItems([...selection]);
  clearSelection();
  const n = deleted.items.length;
  if (!n) return;
  undoToast.value = { message: n === 1 ? "Tarea borrada" : `${n} tareas borradas`, deleted };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (undoToast.value = null), 7000);
}

export async function undoDelete() {
  const t = undoToast.value;
  if (!t) return;
  undoToast.value = null;
  await restoreItems(t.deleted);
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

// Atajos globales de la ventana. onEscape corre sólo si no había selección para limpiar.
export function useSelectionKeys(onEscape?: () => void) {
  function onKey(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    // El popover no tiene menú de app, así que ⌘Q lo resolvemos acá.
    if (mod && e.key.toLowerCase() === "q") {
      e.preventDefault();
      invoke("quit_app");
      return;
    }
    if (isTyping(e.target)) return;
    if ((mod && e.key === "Backspace") || e.key === "Delete") {
      if (selection.size) {
        e.preventDefault();
        deleteSelected();
      }
    } else if (mod && e.key.toLowerCase() === "z" && !e.shiftKey && undoToast.value) {
      e.preventDefault();
      undoDelete();
    } else if (e.key === "Escape") {
      if (selection.size) clearSelection();
      else onEscape?.();
    }
  }
  function onDown(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (!t.closest("[data-item], .menu, .toast")) clearSelection();
  }
  onMounted(() => {
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
  });
  onUnmounted(() => {
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("mousedown", onDown);
  });
}
