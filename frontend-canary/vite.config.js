import vue from "@vitejs/plugin-vue";
import frameworkUI from "@framework/ui/vite";
import { defineConfig } from "vite";
import frappeui from "frappe-ui/vite";

export default defineConfig({
  plugins: [
    frameworkUI(),
    frappeui({
      frappeProxy: false,
      jinjaBootData: false,
      buildConfig: false,
      lucideIcons: true,
    }),
    vue(),
  ],
});
