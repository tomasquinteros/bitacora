<script setup lang="ts">
import { computed } from "vue";
import { addDays, formatLong, relativeLabel, today } from "../lib/dates";
import Icon from "./Icon.vue";

const day = defineModel<string>({ required: true });
const rel = computed(() => relativeLabel(day.value));
</script>

<template>
  <div class="day-nav">
    <div class="day-label">
      <strong>{{ rel ?? formatLong(day) }}</strong>
      <span v-if="rel" class="muted">{{ formatLong(day) }}</span>
    </div>
    <div class="stepper">
      <button class="icon" aria-label="Día anterior" @click="day = addDays(day, -1)"><Icon name="left" /></button>
      <button class="today-btn" :disabled="day === today()" @click="day = today()">Hoy</button>
      <button class="icon" aria-label="Día siguiente" @click="day = addDays(day, 1)"><Icon name="right" /></button>
    </div>
  </div>
</template>
