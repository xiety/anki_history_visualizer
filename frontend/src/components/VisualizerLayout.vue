<script setup lang="ts">
import { inject } from 'vue';

const isDemo = inject('isDemo', false);
</script>

<template>
    <div class="component-wrapper">
        <div class="parameters" v-if="!isDemo">
            <slot name="controls"></slot>
        </div>
        <slot name="canvas"></slot>
    </div>
</template>

<style scoped>
.component-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.parameters {
    display: flex;
    align-items: center;
    gap: 1em;
    margin-bottom: 2px;
    flex-shrink: 0;
}
</style>
