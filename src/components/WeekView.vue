<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { itemsInRange, onChanged, openItemsAsOf, type Company, type Item } from "../lib/db";
import { useSections } from "../lib/useSections";
import { addDays, formatRange, formatShort, startOfWeek, today } from "../lib/dates";
import Icon from "./Icon.vue";

const props = defineProps<{ companies: Company[] }>();
const emit = defineEmits<{ "open-day": [day: string] }>();

const weekStart = ref(startOfWeek(today()));
const showWeekend = ref(localStorage.getItem("week.weekend") === "1");
const items = ref<Item[]>([]);
const openAtEnd = ref<Item[]>([]);
const copied = ref(false);
const { sections } = useSections();
const sectionById = computed(() => Object.fromEntries(sections.value.map((s) => [s.id, s])));

const days = computed(() =>
  Array.from({ length: showWeekend.value ? 7 : 5 }, (_, i) => addDays(weekStart.value, i)),
);
const weekEnd = computed(() => addDays(weekStart.value, 6));
// Para la semana en curso, "abiertas" es al día de hoy; para semanas pasadas, al domingo.
const cutoff = computed(() => (weekEnd.value < today() ? weekEnd.value : today()));

watch(showWeekend, (v) => localStorage.setItem("week.weekend", v ? "1" : "0"));

async function load() {
  [items.value, openAtEnd.value] = await Promise.all([
    itemsInRange(weekStart.value, weekEnd.value),
    openItemsAsOf(cutoff.value),
  ]);
}
watch(weekStart, load, { immediate: true });

let unlisten: (() => void) | undefined;
onMounted(async () => {
  unlisten = await onChanged(load);
});
onUnmounted(() => unlisten?.());

const isCheckable = (i: Item) => !!sectionById.value[i.section_id]?.checkable;
const sectionColor = (i: Item) => sectionById.value[i.section_id]?.color;

function cell(companyId: number, day: string) {
  const mine = items.value.filter((i) => i.company_id === companyId && sectionById.value[i.section_id]);
  return {
    done: mine.filter((i) => isCheckable(i) && i.done_on === day),
    added: mine.filter((i) => isCheckable(i) && i.day === day && i.done_on !== day),
    notes: mine.filter((i) => !isCheckable(i) && i.day === day),
  };
}

function openFor(companyId: number) {
  return openAtEnd.value.filter((i) => i.company_id === companyId);
}

function summary(): string {
  const lines = [`# Semana ${formatRange(weekStart.value, weekEnd.value)}`];
  for (const c of props.companies) {
    const mine = items.value.filter((i) => i.company_id === c.id);
    const done = mine.filter((i) => isCheckable(i) && i.done_on && i.done_on <= weekEnd.value);
    const logs = sections.value
      .filter((s) => !s.checkable)
      .map((s) => ({ s, list: mine.filter((i) => i.section_id === s.id) }))
      .filter((g) => g.list.length);
    const open = openFor(c.id).filter((i) => sectionById.value[i.section_id]);
    if (!done.length && !logs.length && !open.length) continue;
    lines.push("", `## ${c.name}`);
    if (done.length) lines.push("", "**Hecho**", ...done.map((i) => `- ${i.text} (${formatShort(i.done_on!)})`));
    for (const g of logs) lines.push("", `**${g.s.name}**`, ...g.list.map((i) => `- ${i.text} (${formatShort(i.day)})`));
    if (open.length) {
      const title = (i: Item) => sectionById.value[i.section_id].name.toLowerCase();
      const note = (i: Item) => (i.last_note ? ` — ${i.last_note}` : "");
      lines.push("", "**Queda pendiente**", ...open.map((i) => `- ${i.text} (${title(i)}, desde ${formatShort(i.day)})${note(i)}`));
    }
  }
  return lines.join("\n");
}

async function copySummary() {
  await navigator.clipboard.writeText(summary());
  copied.value = true;
  setTimeout(() => (copied.value = false), 1600);
}
</script>

<template>
  <div class="week">
    <header class="content-head" data-tauri-drag-region>
      <div class="day-nav">
        <div class="day-label"><strong>{{ formatRange(weekStart, weekEnd) }}</strong></div>
        <div class="stepper">
          <button class="icon" aria-label="Semana anterior" @click="weekStart = addDays(weekStart, -7)"><Icon name="left" /></button>
          <button class="today-btn" :disabled="weekStart === startOfWeek(today())" @click="weekStart = startOfWeek(today())">Esta semana</button>
          <button class="icon" aria-label="Semana siguiente" @click="weekStart = addDays(weekStart, 7)"><Icon name="right" /></button>
        </div>
      </div>
      <div class="head-actions">
        <label class="row-switch inline"><span>Fin de semana</span><input v-model="showWeekend" type="checkbox" class="switch" /></label>
        <button class="primary" @click="copySummary"><Icon :name="copied ? 'check' : 'copy'" :size="14" />{{ copied ? "Copiado" : "Copiar resumen" }}</button>
      </div>
    </header>

    <div class="week-scroll">
      <div class="week-grid" :style="{ gridTemplateColumns: `150px repeat(${days.length}, minmax(150px, 1fr)) minmax(170px, 1fr)` }">
        <div />
        <button
          v-for="d in days"
          :key="d"
          class="week-day-head"
          :class="{ today: d === today() }"
          @click="emit('open-day', d)"
        >{{ formatShort(d) }}</button>
        <div class="week-day-head open-head">Abiertas</div>

        <template v-for="c in companies" :key="c.id">
          <div class="week-company"><span class="dot" :style="{ background: c.color }" />{{ c.name }}</div>
          <div
            v-for="d in days"
            :key="d"
            class="week-cell"
            :class="{ today: d === today() }"
            :style="{ '--company': c.color }"
            @dblclick="emit('open-day', d)"
          >
            <template v-for="(list, kind) in cell(c.id, d)" :key="kind">
              <div
                v-for="i in list"
                :key="i.id"
                class="week-entry"
                :class="kind"
                :style="kind === 'notes' ? { borderColor: sectionColor(i) } : undefined"
                :title="sectionById[i.section_id]?.name"
              >{{ i.text }}</div>
            </template>
          </div>
          <div class="week-cell open-cell" :style="{ '--company': c.color }">
            <div v-for="i in openFor(c.id)" :key="i.id" class="week-entry open">
              {{ i.text }} <span class="carried">{{ formatShort(i.day) }}</span>
              <div v-if="i.last_note" class="week-note">{{ i.last_note }}</div>
            </div>
            <div v-if="!openFor(c.id).length" class="muted">Nada abierto 🎉</div>
          </div>
        </template>
      </div>
    </div>
    <p class="legend muted">
      <span class="week-entry done">hecho</span>
      <span class="week-entry added">nuevo</span>
      <span
        v-for="s in sections.filter((s) => !s.checkable)"
        :key="s.id"
        class="week-entry"
        :style="{ borderColor: s.color }"
      >{{ s.name.toLowerCase() }}</span>
      · Doble click en un día para abrirlo
    </p>
  </div>
</template>
