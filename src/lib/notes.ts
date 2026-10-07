import { reactive } from "vue";

// Qué tareas tienen el hilo de notas desplegado (compartido entre listas de la misma ventana).
export const openNotes = reactive(new Set<number>());

export function toggleNotes(id: number) {
  if (openNotes.has(id)) openNotes.delete(id);
  else openNotes.add(id);
}
