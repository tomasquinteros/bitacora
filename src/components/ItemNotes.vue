<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { addNote, deleteNote, listNotes, onChanged, type Note } from "../lib/db";
import { noteStamp } from "../lib/dates";
import { vAutogrow } from "../lib/autogrow";
import { openNotes } from "../lib/notes";

const props = defineProps<{ entryId: number }>();

const notes = ref<Note[]>([]);
const draft = ref("");
const input = ref<HTMLTextAreaElement>();

async function load() {
  notes.value = await listNotes(props.entryId);
}

let unlisten: (() => void) | undefined;
onMounted(async () => {
  await load();
  unlisten = await onChanged(load);
  await nextTick();
  input.value?.focus();
});
onUnmounted(() => unlisten?.());

async function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.stopPropagation();
    openNotes.delete(props.entryId);
  } else if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    const text = draft.value.trim();
    if (!text) return;
    draft.value = "";
    await addNote(props.entryId, text);
  }
}
</script>

<template>
  <div class="notes-panel" @click.stop>
    <ol v-if="notes.length" class="notes">
      <li v-for="n in notes" :key="n.id">
        <div class="note-text">{{ n.text }}</div>
        <div class="note-meta">
          {{ noteStamp(n.created_at) }}
          <button class="note-del" aria-label="Borrar nota" @click="deleteNote(n.id)">Borrar</button>
        </div>
      </li>
    </ol>
    <textarea
      ref="input"
      v-model="draft"
      v-autogrow
      class="note-input"
      placeholder="Agregar nota… (ej: esperando respuesta de…)"
      @keydown="onKey"
    />
  </div>
</template>
