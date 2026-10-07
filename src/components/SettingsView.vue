<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { acceleratorFromEvent, prettyAccelerator } from "../lib/shortcut";
import { appConfigDir } from "@tauri-apps/api/path";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { addCompany, listCompanies, updateCompany, type Company } from "../lib/db";
import Icon from "./Icon.vue";
import SectionsSettings from "./SectionsSettings.vue";
import { THEME_LABEL, setThemePref, themePref, type ThemePref } from "../lib/theme";

const companies = ref<Company[]>([]);
const newName = ref("");
const newColor = ref("#8b5cf6");
const autostart = ref(false);
const dataDir = ref("");
const quickShortcut = ref("");
const recording = ref(false);
const shortcutError = ref("");

function onRecordKey(e: KeyboardEvent) {
  if (!recording.value) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === "Escape") {
    recording.value = false;
    return;
  }
  const acc = acceleratorFromEvent(e);
  if (!acc) return;
  recording.value = false;
  invoke("set_quick_shortcut", { accelerator: acc })
    .then(() => {
      quickShortcut.value = acc;
      shortcutError.value = "";
    })
    .catch((err) => (shortcutError.value = `No se pudo usar ${prettyAccelerator(acc)}: ${err}`));
}
onUnmounted(() => window.removeEventListener("keydown", onRecordKey, true));

async function load() {
  companies.value = await listCompanies(true);
}

onMounted(async () => {
  await load();
  autostart.value = await isEnabled();
  dataDir.value = await appConfigDir();
  quickShortcut.value = await invoke<string>("get_quick_shortcut");
  window.addEventListener("keydown", onRecordKey, true);
});

async function save(c: Company) {
  if (!c.name.trim()) return load();
  await updateCompany({ ...c, name: c.name.trim() });
}

async function swap(i: number, j: number) {
  const a = companies.value[i];
  const b = companies.value[j];
  if (!a || !b) return;
  await updateCompany({ ...a, position: b.position });
  await updateCompany({ ...b, position: a.position });
  await load();
}

async function toggleArchive(c: Company) {
  await updateCompany({ ...c, archived: c.archived ? 0 : 1 });
  await load();
}

async function add() {
  const name = newName.value.trim();
  if (!name) return;
  await addCompany(name, newColor.value);
  newName.value = "";
  await load();
}

async function toggleAutostart() {
  if (autostart.value) await disable();
  else await enable();
  autostart.value = await isEnabled();
}
</script>

<template>
  <div class="settings">
    <header class="content-head" data-tauri-drag-region><h1>Ajustes</h1></header>

    <section class="card">
      <h2>Empresas</h2>
      <p class="muted">El orden y el color se usan en las pestañas y en la vista semanal. Archivar oculta la empresa sin borrar su historial.</p>
      <ul class="company-list">
        <li v-for="(c, i) in companies" :key="c.id" :class="{ archived: c.archived }">
          <input v-model="c.color" type="color" @change="save(c)" />
          <input v-model="c.name" class="name" @change="save(c)" @keydown.enter="($event.target as HTMLInputElement).blur()" />
          <button class="icon" :disabled="i === 0" aria-label="Subir" @click="swap(i, i - 1)"><Icon name="up" :size="14" /></button>
          <button class="icon" :disabled="i === companies.length - 1" aria-label="Bajar" @click="swap(i, i + 1)"><Icon name="down" :size="14" /></button>
          <button class="secondary" @click="toggleArchive(c)">{{ c.archived ? "Reactivar" : "Archivar" }}</button>
        </li>
      </ul>
      <form class="company-add" @submit.prevent="add">
        <input v-model="newColor" type="color" />
        <input v-model="newName" class="name" placeholder="Nueva empresa…" />
        <button class="primary" type="submit">Agregar</button>
      </form>
    </section>

    <SectionsSettings />

    <section class="card">
      <h2>Apariencia</h2>
      <div class="row-switch">
        <span>Tema</span>
        <div class="segmented compact">
          <button
            v-for="t in (['system', 'light', 'dark'] as ThemePref[])"
            :key="t"
            class="segment"
            :class="{ active: themePref === t }"
            @click="setThemePref(t)"
          >{{ THEME_LABEL[t] }}</button>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Captura rápida</h2>
      <div class="row-switch">
        <span>Atajo global para crear una tarea desde cualquier app</span>
        <button class="shortcut" :class="{ recording }" @click="recording = !recording; shortcutError = ''">
          {{ recording ? "Tocá la combinación…" : prettyAccelerator(quickShortcut) }}
        </button>
      </div>
      <p v-if="shortcutError" class="error small">{{ shortcutError }}</p>
    </section>

    <section class="card">
      <h2>Sistema</h2>
      <label class="row-switch">
        <span>Abrir Bitácora al iniciar sesión</span>
        <input type="checkbox" class="switch" :checked="autostart" @change="toggleAutostart" />
      </label>
      <p class="muted small">
        Tus datos se guardan en <code>{{ dataDir }}/bitacora.db</code>. Para hacer backup, copiá ese archivo.
      </p>
    </section>
  </div>
</template>
