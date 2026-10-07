import type { Directive } from "vue";

function fit(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export const vAutogrow: Directive<HTMLTextAreaElement> = {
  mounted(el) {
    el.rows = 1;
    fit(el);
    el.addEventListener("input", () => fit(el));
  },
  updated: fit,
};
