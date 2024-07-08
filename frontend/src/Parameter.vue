<template>
    <div class="parameter">
        <div class="parameter_name">{{ props.name }}: </div>
        <input type="range" v-model.number="model" :step="props.step" :min="props.min" :max="props.max" />
        <input class="parameter_number" type="number" v-model.number="model" :step="props.step" :min="props.min"
            :max="props.max" />
    </div>
</template>

<script setup lang="ts">
const props = defineProps({
    name: { type: String },
    step: { type: Number },
    min: { type: Number },
    max: { type: Number },
});

const model = defineModel();
</script>

<style scoped>
.parameter {
    display: flex;
    align-items: center;
}

.parameter_name {
    margin-right: 0.5em;
    margin-bottom: 3px;
}

.parameter_number {
    width: 5em;
}
</style>
