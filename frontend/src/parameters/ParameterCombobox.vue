<template>
    <div class="parameter">
        <div class="parameter_name">{{ props.name }}:</div>
        <select v-model="model">
            <option v-for="option in props.options" :key="option.value" :value="option.value">
                {{ option.text }}
            </option>
        </select>
    </div>
</template>

<script setup lang="ts">
type ComboboxOption = {
    value: string | number;
    text: string;
};

const props = defineProps<{
    name: string,
    options: ComboboxOption[],
}>();

const model = defineModel<string | number>();
</script>

<style scoped>
.parameter {
    display: flex;
    align-items: center;
    gap: 0.5em;
}

.parameter_name {
    margin-bottom: 2px;
}
</style>
