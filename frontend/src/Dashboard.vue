<script setup lang="ts">
import { ref, onMounted, inject, shallowRef, watch, nextTick } from 'vue';
import Split from 'split.js';
import type { ApiInterface, Card } from '@/services/api';
import { dayToDate, daysBetween } from '@/utils';
import Visualizer from '@/Visualizer.vue';

const api = inject<ApiInterface>('api')!;

const filterString = ref("");
const isLoadingData = ref(false);
const visualizerKey = ref(0);

const cards = shallowRef<Card[]>([]);
const minDate = shallowRef<Date>(new Date());
const frameCount = ref(0);

const selectedCardId = ref<number | null>(null);
const previewQuestion = ref("");
const previewAnswer = ref("");

async function loadData() {
    if (isLoadingData.value) return;
    isLoadingData.value = true;

    await nextTick();

    try {
        const response = await api.get_cards(filterString.value);

        const min = dayToDate(response.min_day);
        const count = daysBetween(min, new Date()) + 1;

        minDate.value = min;
        frameCount.value = count;
        cards.value = response.cards;

        selectedCardId.value = null;

        visualizerKey.value++;
    } catch (e) {
        console.error(e);
    } finally {
        isLoadingData.value = false;
    }
}

watch(selectedCardId, async (newId) => {
    if (newId) {
        const info = await api.card_info(newId);
        previewQuestion.value = info.question;
        previewAnswer.value = info.answer;
    } else {
        previewQuestion.value = "";
        previewAnswer.value = "";
    }
});

onMounted(async () => {
    const init = await api.get_init_data();
    filterString.value = `"deck:${init.deckName}"`;

    await loadData();

    nextTick(() => {
        Split(['.top-pane', '.bottom-pane'], {
            direction: 'vertical',
            sizes: [90, 10],
            gutterSize: 6,
            snapOffset: 0,
            minSize: 0,
        });
    });
});
</script>

<template>
    <div class="split-container">
        <div class="top-pane">
            <div class="top-bar">
                <div class="filter-group">
                    <input type="text" v-model="filterString" @keyup.enter="loadData" class="filter-input"
                        placeholder="Filter..." />
                    <button @click="loadData" :disabled="isLoadingData">
                        {{ isLoadingData ? 'Loading...' : 'Filter' }}
                    </button>
                </div>
            </div>

            <div class="visualizer-area">
                <Visualizer v-if="cards.length > 0" :key="visualizerKey" :cards="cards" :min-date="minDate"
                    :frame-count="frameCount" :selected-card-id="selectedCardId" @clicked="id => selectedCardId = id" />
                <div v-else class="empty-state">No cards found.</div>
            </div>
        </div>

        <div class="bottom-pane">
            <div class="card_preview">
                <div class="card_side" v-html="previewQuestion"></div>
                <div class="card_side" v-html="previewAnswer"></div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.split-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
}

:deep(.gutter) {
    cursor: row-resize;
    background-image: repeating-linear-gradient(45deg,
            #ccc,
            #ccc 10px,
            #fff 10px,
            #fff 20px);
    background-repeat: no-repeat;
    background-position: 50% 50%;
}

.top-pane {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.bottom-pane {
    overflow: hidden;
}

.top-bar {
    display: flex;
    flex-shrink: 0;
}

.filter-group {
    display: flex;
    width: 100%;
}

.filter-input {
    flex: 1;
}

.visualizer-area {
    flex: 1;
    min-height: 0;
    position: relative;
    display: flex;
    flex-direction: column;
}

.empty-state {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    color: #888;
}

.card_preview {
    display: flex;
    width: 100%;
    height: 100%;
}

.card_side {
    flex: 1;
    border: 1px solid gray;
    padding: 2px;
    overflow-y: auto;
}
</style>
