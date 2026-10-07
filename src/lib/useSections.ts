import { onMounted, onUnmounted, ref } from "vue";
import { listSections, onChanged, type Section } from "./db";

export function useSections() {
  const sections = ref<Section[]>([]);
  const load = async () => {
    sections.value = await listSections();
  };
  let unlisten: (() => void) | undefined;
  onMounted(async () => {
    await load();
    unlisten = await onChanged(load);
  });
  onUnmounted(() => unlisten?.());
  return { sections };
}
