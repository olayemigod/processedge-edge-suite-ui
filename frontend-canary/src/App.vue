<script setup>
import { Button, FormControl, FrappeUIProvider, toast } from "frappe-ui";
import { ref } from "vue";

const search = ref("");
const theme = ref(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function setTheme(nextTheme) {
  theme.value = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
}

function verifyAction() {
  toast.success("Action completed");
}
</script>

<template>
  <FrappeUIProvider>
    <main class="min-h-screen bg-surface-gray-1 p-6 text-ink-gray-9">
      <section class="mx-auto max-w-xl space-y-5 rounded-lg bg-surface-white p-6 shadow-sm">
        <div class="space-y-1">
          <h1 class="text-xl font-semibold">EdgeSuite UI compatibility check</h1>
          <p class="text-sm text-ink-gray-6">
            Frappe UI 1.0 is compiling in an isolated EdgeSuite surface.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <Button
            label="Light"
            :variant="theme === 'light' ? 'solid' : 'subtle'"
            @click="setTheme('light')"
          />
          <Button
            label="Dark"
            :variant="theme === 'dark' ? 'solid' : 'subtle'"
            @click="setTheme('dark')"
          />
        </div>

        <FormControl
          v-model="search"
          type="text"
          label="Search text"
          placeholder="Type to verify form controls"
        />

        <Button
          icon-left="lucide-plus"
          label="New"
          variant="solid"
          @click="verifyAction"
        />
      </section>
    </main>
  </FrappeUIProvider>
</template>
