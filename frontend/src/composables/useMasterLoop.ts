import { onUnmounted, type Ref } from 'vue';

export function useMasterLoop(
    options: {
        isPlaying: Ref<boolean>;
        speed: Ref<number>;
        currentFrame: Ref<number>;
        maxValue: Ref<number>;
    },
    renderCallback: (time: number) => void
) {
    let rafId: number;
    let next_frame_time = 0;

    function tick(time: number) {
        if (options.isPlaying.value && options.maxValue.value + 1 > 0) {
            const ms_per_frame = 1000 / options.speed.value;
            if (next_frame_time === 0) next_frame_time = time;

            if (time >= next_frame_time) {
                options.currentFrame.value = (options.currentFrame.value + 1) % (options.maxValue.value + 1);
                next_frame_time += ms_per_frame;
            }
        } else {
            next_frame_time = 0;
        }

        renderCallback(time);
        rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    onUnmounted(() => { cancelAnimationFrame(rafId); });
}
