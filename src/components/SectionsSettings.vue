<script setup lang="ts">
import { onMounted, ref } from "vue";
import { addSection, listSections, updateSection, type Section } from "../lib/db";
import Icon from "./Icon.vue";

const sections = ref<Section[]>([]);
const newName = ref("");
const newColor = ref("#34c759");
const newCheckable = ref(true);

async function load() {
  sections.value = await listSections(true);
}
onMounted(load);

async function save(s: Section) {
  if (!s.name.trim()) return load();
  // Arrastrar sin check no tiene sentido: nunca se cerraría.
  await updateSection({ ...s, name: s.name.trim(), carry: s.checkable ? s.carry : 0 });
  await load();
}

function toggle(s: Section, key: "checkable" | "carry" | "recap") {
  s[key] = s[key] ? 0 : 1;
  save(s);
}

async function swap(i: number, j: number) {
  const a = sections.value[i];
  const b = sections.value[j];
  if (!a || !b) return;
  await updateSection({ ...a, position: b.position });
  await updateSection({ ...b, position: a.position });
  await load();
}

async function add() {
  const name = newName.value.trim();
  if (!name) return;
  const c = newCheckable.value ? 1 : 0;
  await addSection({ name, color: newColor.value, checkable: c, carry: c, recap: 0 });
  newName.value = "";
  await load();
}
</script>

<template>
  <section class="card">
    <h2>Secciones</h2>
    <p class="muted">
      Las columnas de cada día. <b>Con check</b>: sus ítems se tildan como tareas.
      <b>Se arrastra</b>: lo que no tildaste pasa al día siguiente y aparece en "Todo".
      <b>Recordar</b>: si hoy está vacía, te muestra lo último que anotaste ahí.
      Archivar la oculta sin borrar lo que tenga.
    </p>
    <ul class="company-list section-list">
      <li v-for="(s, i) in sections" :key="s.id" :class="{ archived: s.archived }">
        <input v-model="s.color" type="color" @change="save(s)" />
        <input v-model="s.name" class="name" @change="save(s)" @keydown.enter="($event.target as HTMLInputElement).blur()" />
        <div class="flags">
          <button class="flag" :class="{ on: s.checkable }" title="Sus ítems se tildan" @click="toggle(s, 'checkable')">Con check</button>
          <button
            class="flag"
            :class="{ on: s.carry }"
            :disabled="!s.checkable"
            title="Lo abierto pasa al día siguiente"
            @click="toggle(s, 'carry')"
          >Se arrastra</button>
          <button class="flag" :class="{ on: s.recap }" title="Si hoy está vacía, muestra lo último" @click="toggle(s, 'recap')">Recordar</button>
        </div>
        <button class="icon" :disabled="i === 0" aria-label="Subir" @click="swap(i, i - 1)"><Icon name="up" :size="14" /></button>
        <button class="icon" :disabled="i === sections.length - 1" aria-label="Bajar" @click="swap(i, i + 1)"><Icon name="down" :size="14" /></button>
        <button class="secondary" @click="s.archived = s.archived ? 0 : 1; save(s)">{{ s.archived ? "Reactivar" : "Archivar" }}</button>
      </li>
    </ul>
    <form class="company-add" @submit.prevent="add">
      <input v-model="newColor" type="color" />
      <input v-model="newName" class="name" placeholder="Nueva sección… (ej: En revisión, Reuniones)" />
      <label class="row-switch inline small"><span>Con check</span><input v-model="newCheckable" type="checkbox" class="switch" /></label>
      <button class="primary" type="submit">Agregar</button>
    </form>
  </section>
</template>
