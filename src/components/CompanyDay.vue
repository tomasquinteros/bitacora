<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { isDone, itemsForDay, lastInSectionBefore, onChanged, type Company, type Item } from "../lib/db";
import { formatShort } from "../lib/dates";
import { useSections } from "../lib/useSections";
import SectionList from "./SectionList.vue";

const props = defineProps<{ company: Company; day: string; showHeader?: boolean }>();

const { sections } = useSections();
const items = ref<Item[]>([]);
// Por sección con "recordar lo último": la última entrada de días anteriores.
const recaps = ref<Record<number, Item | null>>({});

async function load() {
  const recapSections = sections.value.filter((s) => s.recap);
  const [list, ...lasts] = await Promise.all([
    itemsForDay(props.company.id, props.day),
    ...recapSections.map((s) => lastInSectionBefore(props.company.id, s.id, props.day)),
  ]);
  items.value = list;
  recaps.value = Object.fromEntries(recapSections.map((s, i) => [s.id, lasts[i]]));
}

const bySection = computed(() =>
  Object.fromEntries(
    sections.value.map((s) => {
      const list = items.value.filter((i) => i.section_id === s.id);
      // Las hechas al final, para que lo abierto quede arriba.
      if (s.checkable) list.sort((a, b) => Number(isDone(a, props.day)) - Number(isDone(b, props.day)));
      return [s.id, list];
    }),
  ),
);

const openCount = computed(() => {
  const carry = new Set(sections.value.filter((s) => s.carry).map((s) => s.id));
  return items.value.filter((i) => carry.has(i.section_id) && !isDone(i, props.day)).length;
});

let unlisten: (() => void) | undefined;
onMounted(async () => {
  unlisten = await onChanged(load);
});
onUnmounted(() => unlisten?.());
watch(() => [props.company.id, props.day, sections.value], load, { immediate: true });
</script>

<template>
  <div class="company-day" :style="{ '--company': company.color }">
    <header v-if="showHeader" class="company-head">
      <span class="dot" :style="{ background: company.color }" />
      <h2>{{ company.name }}</h2>
      <span class="muted">{{ openCount ? `${openCount} abiertas` : "al día" }}</span>
    </header>
    <SectionList
      v-for="s in sections"
      :key="s.id"
      :company-id="company.id"
      :day="day"
      :section="s"
      :sections="sections"
      :items="bySection[s.id] ?? []"
      :color="company.color"
    >
      <p v-if="s.recap && !bySection[s.id]?.length && recaps[s.id]" class="last-progress">
        <span>La última vez ({{ formatShort(recaps[s.id]!.day) }}):</span>
        {{ recaps[s.id]!.text }}
      </p>
    </SectionList>
  </div>
</template>
