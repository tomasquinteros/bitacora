<script setup lang="ts">
import type { Item } from "../lib/db";
import { openNotes, toggleNotes } from "../lib/notes";
import Icon from "./Icon.vue";

defineProps<{ item: Item }>();
</script>

<template>
  <button
    class="note-toggle"
    :class="{ has: item.note_count, open: openNotes.has(item.id) }"
    :title="item.note_count ? `${item.note_count} notas` : 'Agregar nota'"
    @click.stop="toggleNotes(item.id)"
  >
    <Icon name="note" :size="13" />
    <span v-if="item.note_count">{{ item.note_count }}</span>
  </button>
</template>
