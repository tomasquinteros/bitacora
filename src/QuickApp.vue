<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { addItem } from "./lib/db";
import { useSections } from "./lib/useSections";
import { today } from "./lib/dates";
import { useCompanies } from "./lib/useCompanies";
import { vAutogrow } from "./lib/autogrow";
import Icon from "./components/Icon.vue";

const { companies } = useCompanies();
const text = ref("");
const companyId = ref(Number(localStorage.getItem("quick.company")) || 0);
const { sections } = useSections();
const sectionId = ref<number | null>(null);
const section = computed(() => sections.value.find((s) => s.id === sectionId.value) ?? sections.value[0]);
const saved = ref<string | null>(null);
const input = ref<HTMLTextAreaElement>();
const root = ref<HTMLElement>();

// La ventana toma el alto del contenido: depende de cuántas empresas y secciones tengas.
const resizer = new ResizeObserver(() => {
  const h = Math.ceil(root.value?.getBoundingClientRect().height ?? 0);
  if (h) getCurrentWindow().setSize(new LogicalSize(640, h));
});
const isMac = navigator.userAgent.includes("Mac");
const keepOpen = ref(localStorage.getItem("quick.keepOpen") === "1");
const createdCount = ref(0);
let savedTimer: ReturnType<typeof setTimeout> | undefined;

watch(keepOpen, (v) => localStorage.setItem("quick.keepOpen", v ? "1" : "0"));

const company = computed(() => companies.value.find((c) => c.id === companyId.value) ?? companies.value[0]);
watch(companyId, (id) => localStorage.setItem("quick.company", String(id)));

async function focusInput() {
  await nextTick();
  input.value?.focus();
}

function cycleCompany(dir: 1 | -1) {
  const list = companies.value;
  if (!list.length) return;
  const i = list.findIndex((c) => c.id === company.value?.id);
  companyId.value = list[(i + dir + list.length) % list.length].id;
}

// ⌘Enter invierte el switch "Seguir creando" para esa tarea puntual.
async function save(invert = false) {
  const t = text.value.trim();
  if (!t || !company.value || !section.value) return;
  await addItem(company.value.id, today(), section.value.id, t);
  text.value = "";
  createdCount.value++;
  saved.value = createdCount.value > 1
    ? `${createdCount.value} tareas guardadas · última en ${company.value.name}`
    : `Guardado en ${company.value.name}`;
  clearTimeout(savedTimer);
  if (keepOpen.value !== invert) {
    savedTimer = setTimeout(() => (saved.value = null), 1800);
    focusInput();
  } else {
    savedTimer = setTimeout(() => invoke("hide_quick"), 650);
  }
}

function reset() {
  clearTimeout(savedTimer);
  saved.value = null;
  createdCount.value = 0;
  focusInput();
}

function onKey(e: KeyboardEvent) {
  const mod = e.metaKey || e.ctrlKey;
  if (e.key === "Escape") {
    e.preventDefault();
    invoke("hide_quick");
  } else if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    save(mod);
  } else if (e.key === "Tab") {
    e.preventDefault();
    cycleCompany(e.shiftKey ? -1 : 1);
  } else if (mod && /^[1-9]$/.test(e.key) && sections.value[Number(e.key) - 1]) {
    e.preventDefault();
    sectionId.value = sections.value[Number(e.key) - 1].id;
  }
}

const unlisteners: (() => void)[] = [];
onMounted(async () => {
  if (root.value) resizer.observe(root.value);
  window.addEventListener("keydown", onKey);
  unlisteners.push(await listen("bitacora:quick-open", reset));
  reset();
});
onUnmounted(() => {
  resizer.disconnect();
  window.removeEventListener("keydown", onKey);
  unlisteners.forEach((u) => u());
});
</script>

<template>
  <div ref="root" class="quick" :style="{ '--c': company?.color ?? 'var(--accent)' }">
    <div class="quick-input">
      <span class="quick-dot" />
      <textarea
        ref="input"
        v-model="text"
        v-autogrow
        :placeholder="company ? `Nueva tarea para ${company.name}…` : 'Agregá una empresa en Ajustes'"
      />
    </div>
    <div class="quick-opts">
      <span class="quick-label">Empresa</span>
      <div class="quick-pills">
        <button
          v-for="c in companies"
          :key="c.id"
          class="chip"
          :class="{ active: company?.id === c.id }"
          :style="{ '--c': c.color }"
          :title="c.name"
          @click="companyId = c.id; focusInput()"
        >
          <span class="dot" :style="{ background: c.color }" />{{ c.name }}
        </button>
      </div>
      <span class="quick-label">Sección</span>
      <div class="quick-pills">
        <button
          v-for="(s, i) in sections"
          :key="s.id"
          class="chip"
          :class="{ active: section?.id === s.id }"
          :style="{ '--c': s.color }"
          :title="`${isMac ? '⌘' : 'Ctrl+'}${i + 1}`"
          @click="sectionId = s.id; focusInput()"
        >
          <span class="dot" :style="{ background: s.color }" />{{ s.name }}
          <span v-if="i < 9" class="pill-key">{{ i + 1 }}</span>
        </button>
      </div>
    </div>
    <footer class="quick-foot">
      <Transition name="fade" mode="out-in">
        <span v-if="saved" key="ok" class="quick-saved"><Icon name="check" :size="13" /> {{ saved }}</span>
        <span v-else key="hints" class="muted">
          <kbd>↵</kbd> {{ keepOpen ? "guardar y seguir" : "guardar" }} ·
          <kbd>{{ isMac ? "⌘↵" : "Ctrl+↵" }}</kbd> {{ keepOpen ? "guardar y cerrar" : "guardar y seguir" }} ·
          <kbd>⇥</kbd> empresa · <kbd>{{ isMac ? "⌘" : "Ctrl+" }}1–{{ Math.min(sections.length, 9) }}</kbd> sección
        </span>
      </Transition>
      <label class="row-switch inline small" title="Después de guardar, la barra queda abierta para cargar otra">
        <span>Seguir creando</span>
        <input v-model="keepOpen" type="checkbox" class="switch" @change="focusInput" />
      </label>
    </footer>
  </div>
</template>
