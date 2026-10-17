<script setup lang="ts">
useHead({ title: "Solstice Rail" });
</script>

<template>
  <div class="site">
    <header class="site-header">
      <NuxtLink to="/" class="brand">Solstice Rail</NuxtLink>
      <span class="tagline">Night trains across Europe</span>
    </header>
    <main>
      <NuxtPage />
    </main>
  </div>
</template>

<style>
:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
  line-height: 1.5;
}
body {
  margin: 0;
}
.site {
  max-width: 56rem;
  margin: 0 auto;
  padding: 1rem 1rem 3rem;
}
.site-header {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  padding: 1rem 0 2rem;
}
.brand {
  font-size: 1.5rem;
  font-weight: 700;
  text-decoration: none;
  color: inherit;
}
.tagline {
  opacity: 0.7;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  text-align: left;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent);
}
.status {
  font-size: 0.85em;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.8;
}
form {
  display: grid;
  gap: 0.75rem;
  max-width: 24rem;
  margin-top: 1.5rem;
}
label {
  display: grid;
  gap: 0.25rem;
}
input {
  font: inherit;
  padding: 0.5rem;
}
button {
  font: inherit;
  padding: 0.5rem 1rem;
  cursor: pointer;
}
.error {
  color: #c0392b;
}
</style>
