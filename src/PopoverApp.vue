<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { onChanged, openCountsForDay } from "./lib/db";
import { today } from "./lib/dates";
import { useCompanies } from "./lib/useCompanies";
import CompanyDay from "./components/CompanyDay.vue";
import AllOpen from "./components/AllOpen.vue";
import UndoToast from "./components/UndoToast.vue";
import { useSelectionKeys } from "./lib/selection";
import { THEME_LABEL, cycleTheme, themePref } from "./lib/theme";
import DayNav from "./components/DayNav.vue";
import Icon from "./components/Icon.vue";

const { companies } = useCompanies();
const day = ref(today());
const counts = ref<Record<number, number>>({});
// 0 = solapa "Todo" (la default).
const selectedId = ref<number>(Number(localStorage.getItem("popover.company")) || 0);

const selected = computed(() => companies.value.find((c) => c.id === selectedId.value) ?? null);
const totalOpen = computed(() => Object.values(counts.value).reduce((a, b) => a + b, 0));

watch(selectedId, (id) => localStorage.setItem("popover.company", String(id)));

async function loadCounts() {
  counts.value = await openCountsForDay(day.value);
}
watch(day, loadCounts, { immediate: true });

// Si quedó abierto de un día para el otro, al volver a mostrarlo salta a la fecha nueva.
let lastToday = today();
const unlisteners: (() => void)[] = [];
onMounted(async () => {
  unlisteners.push(await onChanged(loadCounts));
  unlisteners.push(
    await getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (!focused) return;
      const t = today();
      if (day.value === lastToday && t !== lastToday) day.value = t;
      lastToday = t;
    }),
  );
});
onUnmounted(() => unlisteners.forEach((u) => u()));

useSelectionKeys(() => invoke("hide_popover"));
</script>

<template>
  <div class="popover">
    <header class="pop-head">
      <DayNav v-model="day" />
      <nav class="segmented">
        <button class="segment all" :class="{ active: !selected }" style="--c: var(--accent)" @click="selectedId = 0">
          Todo
          <span v-if="totalOpen" class="badge">{{ totalOpen }}</span>
        </button>
        <button
          v-for="c in companies"
          :key="c.id"
          class="segment"
          :class="{ active: selected?.id === c.id }"
          :style="{ '--c': c.color }"
          :title="c.name"
          @click="selectedId = c.id"
        >
          <span class="dot" :style="{ background: c.color }" />
          <span class="segment-name">{{ c.name }}</span>
          <span v-if="counts[c.id]" class="badge">{{ counts[c.id] }}</span>
        </button>
      </nav>
    </header>
    <main class="pop-body">
      <CompanyDay v-if="selected" :company="selected" :day="day" />
      <AllOpen v-else :companies="companies" :day="day" />
    </main>
    <footer class="pop-foot">
      <button
        class="icon"
        :title="`Tema: ${THEME_LABEL[themePref]} (click para cambiar)`"
        @click="cycleTheme"
      >
        <Icon :name="themePref === 'light' ? 'sun' : themePref === 'dark' ? 'moon' : 'halfmoon'" />
      </button>
      <button class="icon" title="Salir de Bitácora (⌘Q)" @click="invoke('quit_app')"><Icon name="power" /></button>
      <span class="spacer" />
      <button class="link" @click="invoke('open_main')">Abrir bitácora <Icon name="expand" :size="13" /></button>
    </footer>
    <UndoToast />
  </div>
</template>
