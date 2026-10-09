<script setup>
import { Button, FormControl, FrappeUIProvider } from "frappe-ui";
import { ref } from "vue";

const search = ref("");
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

        <FormControl
          v-model="search"
          type="text"
          label="Search text"
          placeholder="Type to verify form controls"
        />

        <Button icon-left="lucide-plus" label="New" variant="solid" />
      </section>
    </main>
  </FrappeUIProvider>
</template>
