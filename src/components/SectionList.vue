<script setup lang="ts">
import { nextTick, ref } from "vue";
import {
  addItem, deleteItem, isDone, moveItem, sectionHint, setDone, updateItemText,
  type Item, type Section,
} from "../lib/db";
import { formatShort } from "../lib/dates";
import { vAutogrow } from "../lib/autogrow";
import Icon from "./Icon.vue";
import { clickSelect, selection } from "../lib/selection";
import { openNotes } from "../lib/notes";
import ItemNotes from "./ItemNotes.vue";
import NotePreview from "./NotePreview.vue";
import NoteToggle from "./NoteToggle.vue";
import { dragging, dropInto, dropTarget, endDrag } from "../lib/dnd";
import { collapsed, toggleCollapsed } from "../lib/collapse";

const props = defineProps<{
  companyId: number;
  day: string;
  section: Section;
  sections: Section[];
  items: Item[];
  color: string;
}>();

const draft = ref("");
const editingId = ref<number | null>(null);
const editText = ref("");
const menuId = ref<number | null>(null);
const editor = ref<HTMLTextAreaElement[]>([]);

function enter(e: KeyboardEvent, fn: () => void) {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    fn();
  }
}

async function submit() {
  const text = draft.value.trim();
  if (!text) return;
  draft.value = "";
  await addItem(props.companyId, props.day, props.section.id, text);
}

function toggle(item: Item) {
  setDone(item.id, isDone(item, props.day) ? null : props.day);
}

async function startEdit(item: Item) {
  editingId.value = item.id;
  editText.value = item.text;
  await nextTick();
  editor.value[0]?.focus();
}

async function saveEdit(item: Item) {
  if (editingId.value !== item.id) return;
  editingId.value = null;
  const text = editText.value.trim();
  if (!text) await deleteItem(item.id);
  else if (text !== item.text) await updateItemText(item.id, text);
}

function move(item: Item, to: Section) {
  menuId.value = null;
  moveItem(item.id, to.id);
}

const collapseKey = () => `s:${props.section.id}`;

function onDragStart(e: DragEvent, item: Item) {
  dragging.value = item;
  menuId.value = null;
  e.dataTransfer?.setData("text/plain", item.text);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
}

function onItemOver(e: DragEvent, index: number) {
  if (!dragging.value) return;
  e.preventDefault();
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const after = e.clientY > r.top + r.height / 2;
  dropTarget.value = { sectionId: props.section.id, index: after ? index + 1 : index };
}

// Sobre el encabezado, el campo de carga o una sección plegada: va al final.
function onSectionOver(e: DragEvent) {
  if (!dragging.value) return;
  e.preventDefault();
  if (dropTarget.value?.sectionId !== props.section.id) {
    dropTarget.value = { sectionId: props.section.id, index: props.items.length };
  }
}

function isDropAt(index: number) {
  return dragging.value && dropTarget.value?.sectionId === props.section.id && dropTarget.value.index === index;
}

function remove(item: Item) {
  menuId.value = null;
  deleteItem(item.id);
}
</script>

<template>
  <section
    class="section"
    :class="{ collapsed: collapsed.has(collapseKey()), 'drop-here': dragging && dropTarget?.sectionId === section.id }"
    :style="{ '--section': section.color }"
    @dragover="onSectionOver"
    @drop.prevent="dropInto(section.id, items)"
  >
    <h3 class="section-head" @click="toggleCollapsed(collapseKey())">
      <Icon name="chevron" :size="11" class="chevron" />
      <span class="section-dot" />{{ section.name }}
      <span v-if="items.length" class="count">{{ items.length }}</span>
    </h3>
    <template v-if="!collapsed.has(collapseKey())">
    <slot />
    <ul :class="{ 'drop-end': isDropAt(items.length) }">
      <li
        v-for="(item, index) in items"
        :key="item.id"
        data-item
        :draggable="editingId !== item.id && !openNotes.has(item.id)"
        :class="{
          done: section.checkable && isDone(item, day),
          selected: selection.has(item.id),
          dragging: dragging?.id === item.id,
          'drop-before': isDropAt(index),
        }"
        @dragstart="onDragStart($event, item)"
        @dragend="endDrag"
        @dragover="onItemOver($event, index)"
        @click="clickSelect($event, item.id, items.map((i) => i.id))"
        @mouseleave="menuId === item.id && (menuId = null)"
      >
        <button
          v-if="section.checkable"
          class="check"
          :style="{ '--c': color }"
          :aria-label="isDone(item, day) ? 'Marcar como abierta' : 'Marcar como hecha'"
          @click.stop="toggle(item)"
        >
          <Icon v-if="isDone(item, day)" name="check" :size="11" />
        </button>
        <span v-else class="bullet" :style="{ background: color }" />

        <textarea
          v-if="editingId === item.id"
          ref="editor"
          v-model="editText"
          v-autogrow
          class="edit"
          @keydown="enter($event, () => saveEdit(item))"
          @keydown.esc.stop="editingId = null"
          @blur="saveEdit(item)"
          @click.stop
        />
        <div v-else class="text" title="Doble click para editar" @dblclick="startEdit(item)">
          <span class="item-text">{{ item.text }}</span>
          <span v-if="item.day !== day" class="carried">desde {{ formatShort(item.day) }}</span>
          <NotePreview :item="item" />
        </div>

        <NoteToggle :item="item" />

        <div class="actions" @click.stop>
          <button class="icon" aria-label="Más opciones" @click="menuId = menuId === item.id ? null : item.id"><Icon name="more" /></button>
          <div v-if="menuId === item.id" class="menu">
            <button @click="startEdit(item); menuId = null">Editar</button>
            <button @click="openNotes.add(item.id); menuId = null">Notas</button>
            <div class="menu-sep" />
            <div class="menu-label">Mover a</div>
            <button
              v-for="s in sections.filter((s) => s.id !== section.id)"
              :key="s.id"
              @click="move(item, s)"
            ><span class="dot" :style="{ background: s.color }" />{{ s.name }}</button>
            <div class="menu-sep" />
            <button class="danger" @click="remove(item)">Borrar</button>
          </div>
        </div>

        <ItemNotes v-if="openNotes.has(item.id)" :entry-id="item.id" />
      </li>
    </ul>
    <textarea
      v-model="draft"
      v-autogrow
      class="draft"
      :placeholder="sectionHint(section)"
      @keydown="enter($event, submit)"
    />
    </template>
  </section>
</template>
