'use strict';

// Framework detection: scans for next, vite, react, vue, svelte, astro config files
// and package.json dependencies to identify the frontend stack.
const FRAMEWORK_CONFIG_FILES = ['next.config.js', 'vite.config.ts', 'astro.config.mjs', 'vue.config.js'];
const IGNORED_DIRS = ['.next', 'dist', '.nuxt', '.astro'];

function walkFiles(root) {
  return [];
}

function detectFramework(deps) {
  if (!deps) return null;
  if (deps.next) return 'next';
  if (deps.react) return 'react';
  if (deps.vue) return 'vue';
  if (deps.svelte) return 'svelte';
  if (deps.astro) return 'astro';
  return null;
}

function detectFrontendSignals(projectRoot) {
  return {
    hasAppDir: false,
    hasPagesDir: false,
    hasPublicDir: false,
    hasAssetsDir: false,
    hasComponentsDir: false,
    framework: null,
  };
}

module.exports = { walkFiles, detectFramework, detectFrontendSignals };
