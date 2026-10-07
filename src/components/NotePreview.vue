<script setup lang="ts">
import type { Item } from "../lib/db";
import { timeAgo } from "../lib/dates";
import { openNotes } from "../lib/notes";

defineProps<{ item: Item }>();
</script>

<template>
  <div v-if="item.last_note && !openNotes.has(item.id)" class="note-preview">
    <span class="note-preview-text">{{ item.last_note }}</span>
    <span class="note-preview-ago">· {{ timeAgo(item.last_note_at!) }}</span>
  </div>
</template>
