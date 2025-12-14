<template>
    <div v-if="loading">Loading...</div>
    <Dashboard v-else />
</template>
<script setup lang="ts">
import { ref, onMounted, provide } from 'vue';
import { Api } from './services/api';
import Dashboard from './Dashboard.vue';

const loading = ref(true);

declare global { interface Window { pycmd: any; } }

const api = new Api();

provide('api', api);
provide('isDemo', false);

onMounted(() => {
    const interval = setInterval(() => {
        if (window.pycmd) {
            clearInterval(interval);
            loading.value = false;
        }
    }, 50);
});
</script>

<style>
.isWin {
    margin: 0px;
    overflow-y: scroll;
}
</style>
