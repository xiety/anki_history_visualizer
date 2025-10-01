export function createFpsCalculator() {
    let last_update_time = 0;
    let frames_since_update = 0;
    let fps = 0;

    function tick(current_time: number): number {
        if (last_update_time === 0) {
            last_update_time = current_time;
        }
        frames_since_update++;
        const delta_time = current_time - last_update_time;
        if (delta_time >= 1000) {
            fps = Math.round((frames_since_update * 1000) / delta_time);
            frames_since_update = 0;
            last_update_time = current_time;
        }
        return fps;
    }

    return tick;
}
