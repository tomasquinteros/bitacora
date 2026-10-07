import { onMounted, onUnmounted, ref } from "vue";
import { listCompanies, onChanged, type Company } from "./db";

export function useCompanies() {
  const companies = ref<Company[]>([]);
  const load = async () => {
    companies.value = await listCompanies();
  };
  let unlisten: (() => void) | undefined;
  onMounted(async () => {
    await load();
    unlisten = await onChanged(load);
  });
  onUnmounted(() => unlisten?.());
  return { companies, reload: load };
}
