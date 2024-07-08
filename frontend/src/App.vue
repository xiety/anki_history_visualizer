<template>
    <div v-if="loading">Loading...</div>
    <Visualizer v-else />
</template>

<script setup lang="ts">
import Visualizer from './Visualizer.vue';
import { ref, onMounted, onUnmounted, provide } from 'vue';
import { Api } from './api';

const loading = ref(true);

declare global { interface Window { pycmd: any } }

let interval: number;

onMounted(() => {
    interval = setInterval(() => {
        if (window.pycmd !== undefined) {
            clearInterval(interval);
            loading.value = false;
        }
    }, 100);
});

onUnmounted(() => {
    clearInterval(interval);
});

provide('api', new Api());
</script>
<style>
/* style of the body from Anki */
.isWin {
    margin: 0px;
    overflow-y: scroll;
}
</style>
