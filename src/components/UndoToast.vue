<script setup lang="ts">
import { undoDelete, undoToast } from "../lib/selection";

const undoKey = navigator.userAgent.includes("Mac") ? "⌘Z" : "Ctrl+Z";
</script>

<template>
  <Transition name="toast">
    <div v-if="undoToast" class="toast">
      <span>{{ undoToast.message }}</span>
      <button class="link" @click="undoDelete">Deshacer <kbd>{{ undoKey }}</kbd></button>
    </div>
  </Transition>
</template>
