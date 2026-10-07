<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { addItem, allOpenForDay, isDone, moveItem, onChanged, setDone, type Company, type Item } from "../lib/db";
import { dragging, dropTarget, endDrag } from "../lib/dnd";
import { collapsed, toggleCollapsed } from "../lib/collapse";
import { useSections } from "../lib/useSections";
import { ageLabel, daysBetween } from "../lib/dates";
import { vAutogrow } from "../lib/autogrow";
import Icon from "./Icon.vue";
import { clickSelect, selection } from "../lib/selection";
import { openNotes } from "../lib/notes";
import ItemNotes from "./ItemNotes.vue";
import NotePreview from "./NotePreview.vue";
import NoteToggle from "./NoteToggle.vue";

const props = defineProps<{ companies: Company[]; day: string }>();

const items = ref<Item[]>([]);
const draft = ref("");
const draftCompany = ref<number | null>(Number(localStorage.getItem("all.company")) || null);
const draftSectionId = ref<number | null>(null);

const { sections } = useSections();
// "Todo" muestra las secciones que se arrastran: son las que representan trabajo abierto.
const carrySections = computed(() => sections.value.filter((s) => s.carry));
const draftSection = computed(
  () => carrySections.value.find((s) => s.id === draftSectionId.value) ?? carrySections.value[0],
);

async function load() {
  items.value = await allOpenForDay(props.day);
}
watch(() => props.day, load, { immediate: true });

let unlisten: (() => void) | undefined;
onMounted(async () => {
  unlisten = await onChanged(load);
});
onUnmounted(() => unlisten?.());

const companyById = computed(() => Object.fromEntries(props.companies.map((c) => [c.id, c])));
const targetCompany = computed(() => companyById.value[draftCompany.value ?? -1] ?? props.companies[0]);
watch(draftCompany, (id) => id && localStorage.setItem("all.company", String(id)));

// Lo cerrado hoy queda abajo tachado, para que no desaparezca al tildarlo.
const groups = computed(() =>
  carrySections.value.map((s) => {
    const list = items.value.filter((i) => i.section_id === s.id && companyById.value[i.company_id]);
    return {
      key: s.id,
      title: s.name,
      color: s.color,
      open: list.filter((i) => !isDone(i, props.day)),
      done: list.filter((i) => isDone(i, props.day)),
    };
  }),
);

function toggle(item: Item) {
  setDone(item.id, isDone(item, props.day) ? null : props.day);
}

async function submit(e: KeyboardEvent) {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
  e.preventDefault();
  const text = draft.value.trim();
  if (!text || !targetCompany.value || !draftSection.value) return;
  draft.value = "";
  await addItem(targetCompany.value.id, props.day, draftSection.value.id, text);
}

const stale = (i: Item) => daysBetween(i.day, props.day) >= 7;

function onDragStart(e: DragEvent, item: Item) {
  dragging.value = item;
  e.dataTransfer?.setData("text/plain", item.text);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
}

function onGroupOver(e: DragEvent, sectionId: number) {
  if (!dragging.value) return;
  e.preventDefault();
  dropTarget.value = { sectionId, index: 0 };
}

// Acá el orden es por antigüedad, así que soltar solo cambia la sección.
async function onGroupDrop(sectionId: number) {
  const item = dragging.value;
  endDrag();
  if (item && item.section_id !== sectionId) await moveItem(item.id, sectionId);
}
</script>

<template>
  <div class="all-open">
    <div class="quick-add section">
      <textarea
        v-model="draft"
        v-autogrow
        class="draft"
        :placeholder="targetCompany ? `Nueva tarea para ${targetCompany.name}…` : 'Agregá una empresa en Ajustes'"
        @keydown="submit"
      />
      <div class="quick-add-opts">
        <button
          v-for="c in companies"
          :key="c.id"
          class="chip"
          :class="{ active: targetCompany?.id === c.id }"
          :style="{ '--c': c.color }"
          :title="c.name"
          @click="draftCompany = c.id"
        >
          <span class="dot" :style="{ background: c.color }" />{{ c.name }}
        </button>
        <div v-if="carrySections.length > 1" class="segmented compact quick-add-sections">
          <button
            v-for="s in carrySections"
            :key="s.id"
            class="segment"
            :class="{ active: draftSection?.id === s.id }"
            @click="draftSectionId = s.id"
          >{{ s.name.split(" /")[0] }}</button>
        </div>
      </div>
    </div>

    <section
      v-for="g in groups"
      :key="g.key"
      class="section"
      :class="{
        collapsed: collapsed.has(`all:${g.key}`),
        'drop-here': dragging && dragging.section_id !== g.key && dropTarget?.sectionId === g.key,
      }"
      :style="{ '--section': g.color }"
      @dragover="onGroupOver($event, g.key)"
      @drop.prevent="onGroupDrop(g.key)"
    >
      <h3 class="section-head" @click="toggleCollapsed(`all:${g.key}`)">
        <Icon name="chevron" :size="11" class="chevron" />
        <span class="section-dot" />{{ g.title }} <span v-if="g.open.length" class="count">{{ g.open.length }}</span>
      </h3>
      <template v-if="!collapsed.has(`all:${g.key}`)">
      <ul>
        <li
          v-for="item in [...g.open, ...g.done]"
          :key="item.id"
          data-item
          :draggable="!openNotes.has(item.id)"
          :class="{ done: isDone(item, day), selected: selection.has(item.id), dragging: dragging?.id === item.id }"
          @dragstart="onDragStart($event, item)"
          @dragend="endDrag"
          @click="clickSelect($event, item.id, [...g.open, ...g.done].map((i) => i.id))"
          :style="{ '--c': companyById[item.company_id].color }"
        >
          <button class="check" :aria-label="isDone(item, day) ? 'Marcar como abierta' : 'Marcar como hecha'" @click.stop="toggle(item)">
            <Icon v-if="isDone(item, day)" name="check" :size="11" />
          </button>
          <div class="text">
            <span class="item-text">{{ item.text }}</span>
            <div class="meta">
              <span class="company-tag"><span class="dot" />{{ companyById[item.company_id].name }}</span>
              <span :class="{ stale: stale(item) && !isDone(item, day) }">{{ ageLabel(item.day, day) }}</span>
            </div>
            <NotePreview :item="item" />
          </div>
          <NoteToggle :item="item" />
          <ItemNotes v-if="openNotes.has(item.id)" :entry-id="item.id" />
        </li>
      </ul>
      <p v-if="!g.open.length && !g.done.length" class="nothing">Nada por acá 🎉</p>
      </template>
    </section>
  </div>
</template>
