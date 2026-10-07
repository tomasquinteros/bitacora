<script setup lang="ts">
defineProps<{ name: keyof typeof PATHS; size?: number }>();
</script>

<script lang="ts">
// Trazos simples al estilo SF Symbols (stroke 1.6 sobre grilla de 20).
const PATHS = {
  list: "M7.5 5.5h9M7.5 10h9M7.5 14.5h9M3.8 5.5h.01M3.8 10h.01M3.8 14.5h.01",
  moon: "M15.8 12.6A6.5 6.5 0 0 1 7.4 4.2a6.5 6.5 0 1 0 8.4 8.4Z",
  halfmoon: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM10 3v14",
  power: "M10 3v6.5M6 5.6a6 6 0 1 0 8 0",
  note: "M4.5 4h11A1.5 1.5 0 0 1 17 5.5v7a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3h-1A1.5 1.5 0 0 1 3 12.5v-7A1.5 1.5 0 0 1 4.5 4ZM6.5 7.5h7M6.5 10.5h4.5",
  chevron: "M7.5 5 12.5 10l-5 5",
  sun: "M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM10 2v1.6M10 16.4V18M2 10h1.6M16.4 10H18M4.3 4.3l1.2 1.2M14.5 14.5l1.2 1.2M4.3 15.7l1.2-1.2M14.5 5.5l1.2-1.2",
  week: "M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 16 16.5H4A1.5 1.5 0 0 1 2.5 15V6A1.5 1.5 0 0 1 4 4.5ZM2.5 8.5h15M6.5 2.5v3M13.5 2.5v3M7.2 8.5v8M12.8 8.5v8",
  search: "M8.8 3.5a5.3 5.3 0 1 0 0 10.6 5.3 5.3 0 0 0 0-10.6ZM12.7 12.7l4.3 4.3",
  gear: "M10 7.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2ZM8.6 2.5h2.8l.4 2 1.6.9 1.9-.7 1.4 2.4-1.5 1.3v1.8l1.5 1.3-1.4 2.4-1.9-.7-1.6.9-.4 2H8.6l-.4-2-1.6-.9-1.9.7-1.4-2.4 1.5-1.3V9.4L3.3 8.1l1.4-2.4 1.9.7 1.6-.9.4-2Z",
  left: "M12.5 4.5 7 10l5.5 5.5",
  right: "M7.5 4.5 13 10l-5.5 5.5",
  more: "M5 10h.01M10 10h.01M15 10h.01",
  expand: "M11.5 3.5h5v5M16.5 3.5 10.5 9.5M8.5 16.5h-5v-5M3.5 16.5l6-6",
  up: "M10 15.5v-11M5.5 9 10 4.5 14.5 9",
  down: "M10 4.5v11M5.5 11l4.5 4.5 4.5-4.5",
  copy: "M7 7V4.5A1.5 1.5 0 0 1 8.5 3h7A1.5 1.5 0 0 1 17 4.5v7a1.5 1.5 0 0 1-1.5 1.5H13M4.5 7h7A1.5 1.5 0 0 1 13 8.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 15.5v-7A1.5 1.5 0 0 1 4.5 7Z",
  check: "M4.5 10.5l3.5 3.5 7.5-8",
} as const;
</script>

<template>
  <svg
    class="i"
    :width="size ?? 16"
    :height="size ?? 16"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    :stroke-width="name === 'more' ? 2.8 : 1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="PATHS[name]" />
  </svg>
</template>
