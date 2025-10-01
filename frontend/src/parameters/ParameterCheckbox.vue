<template>
    <label class="checkbox-label">
        <input type="checkbox" v-model="model" />
        {{ props.label }}
    </label>
</template>

<script setup lang="ts">
const props = defineProps<{
    label: string,
}>();
const model = defineModel<boolean>();
</script>

<style scoped>
.checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.3em;
    user-select: none;
    font-weight: normal;
}
</style>
