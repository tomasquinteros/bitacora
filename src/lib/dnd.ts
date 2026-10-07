import { ref } from "vue";
import { moveItem, type Item } from "./db";

// Estado del arrastre compartido entre listas de la misma ventana.
export const dragging = ref<Item | null>(null);
// index = posición de inserción dentro de la lista visible de esa sección (antes de sacar el arrastrado).
export const dropTarget = ref<{ sectionId: number; index: number } | null>(null);

export function endDrag() {
  dragging.value = null;
  dropTarget.value = null;
}

// Calcula la posición nueva entre los vecinos de donde se soltó y mueve la entrada.
export async function dropInto(sectionId: number, list: Item[]) {
  const item = dragging.value;
  const target = dropTarget.value;
  endDrag();
  if (!item || !target || target.sectionId !== sectionId) return;
  let before = list[target.index];
  if (before?.id === item.id) before = list[target.index + 1];
  const rest = list.filter((i) => i.id !== item.id);
  let position: number;
  if (before) {
    const prev = rest[rest.indexOf(before) - 1];
    position = prev ? (prev.position + before.position) / 2 : before.position - 1;
  } else {
    const last = rest[rest.length - 1];
    position = last ? last.position + 1 : item.position;
  }
  if (item.section_id === sectionId && position === item.position) return;
  await moveItem(item.id, sectionId, position);
}
