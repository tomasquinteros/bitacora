<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { searchItems, type Company, type Item } from "../lib/db";
import { useSections } from "../lib/useSections";
import { formatLong } from "../lib/dates";

const props = defineProps<{ companies: Company[] }>();
const emit = defineEmits<{ "open-day": [day: string] }>();

const q = ref("");
const results = ref<Item[]>([]);
const input = ref<HTMLInputElement>();

let timer: ReturnType<typeof setTimeout> | undefined;
watch(q, (v) => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    results.value = v.trim().length >= 2 ? await searchItems(v.trim()) : [];
  }, 200);
});

onMounted(() => input.value?.focus());

const company = (id: number) => props.companies.find((c) => c.id === id);
const { sections } = useSections();
const sectionTitle = (id: number) => sections.value.find((x) => x.id === id)?.name ?? "Sección archivada";
</script>

<template>
  <div class="search">
    <header class="content-head" data-tauri-drag-region>
      <input ref="input" v-model="q" class="search-input" placeholder="Buscar en toda la bitácora…" />
    </header>
    <ul class="results">
      <li v-for="i in results" :key="i.id" @click="emit('open-day', i.day)">
        <span class="dot" :style="{ background: company(i.company_id)?.color ?? '#999' }" />
        <div>
          <div class="result-text">{{ i.text }}</div>
          <div v-if="i.last_note" class="note-preview"><span class="note-preview-text">{{ i.last_note }}</span></div>
          <div class="muted small">
            {{ company(i.company_id)?.name ?? "Empresa archivada" }} · {{ sectionTitle(i.section_id) }} · {{ formatLong(i.day) }}
          </div>
        </div>
      </li>
    </ul>
    <p v-if="q.trim().length >= 2 && !results.length" class="empty">Sin resultados.</p>
  </div>
</template>
