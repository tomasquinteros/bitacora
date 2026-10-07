<script setup lang="ts">
import { ref } from "vue";
import { today } from "./lib/dates";
import { useCompanies } from "./lib/useCompanies";
import CompanyDay from "./components/CompanyDay.vue";
import AllOpen from "./components/AllOpen.vue";
import DayNav from "./components/DayNav.vue";
import WeekView from "./components/WeekView.vue";
import SearchView from "./components/SearchView.vue";
import SettingsView from "./components/SettingsView.vue";
import Icon from "./components/Icon.vue";
import UndoToast from "./components/UndoToast.vue";
import { useSelectionKeys } from "./lib/selection";

type View = "all" | "day" | "week" | "search" | "settings";

const { companies } = useCompanies();
useSelectionKeys();
const view = ref<View>("all");
const day = ref(today());

const NAV = [
  { key: "all", label: "Todo lo abierto", icon: "list" },
  { key: "day", label: "Día", icon: "sun" },
  { key: "week", label: "Semana", icon: "week" },
  { key: "search", label: "Buscar", icon: "search" },
  { key: "settings", label: "Ajustes", icon: "gear" },
] as const;

function goToDay(d: string) {
  day.value = d;
  view.value = "day";
}
</script>

<template>
  <div class="main-layout">
    <aside class="sidebar">
      <div class="sidebar-top" data-tauri-drag-region />
      <div class="sidebar-label">Bitácora</div>
      <button
        v-for="n in NAV"
        :key="n.key"
        class="nav-item"
        :class="{ active: view === n.key }"
        @click="view = n.key"
      >
        <Icon :name="n.icon" class="nav-icon" />{{ n.label }}
      </button>
    </aside>

    <main class="content">
      <template v-if="view === 'all'">
        <header class="content-head" data-tauri-drag-region><DayNav v-model="day" /></header>
        <div class="all-scroll"><AllOpen :companies="companies" :day="day" /></div>
      </template>
      <template v-else-if="view === 'day'">
        <header class="content-head" data-tauri-drag-region><DayNav v-model="day" /></header>
        <div class="columns">
          <CompanyDay v-for="c in companies" :key="c.id" :company="c" :day="day" show-header />
        </div>
      </template>
      <WeekView v-else-if="view === 'week'" :companies="companies" @open-day="goToDay" />
      <SearchView v-else-if="view === 'search'" :companies="companies" @open-day="goToDay" />
      <SettingsView v-else />
    </main>
    <UndoToast />
  </div>
</template>
