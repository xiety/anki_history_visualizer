export function createFpsCalculator() {
    let last_fps_update_time = 0;
    let frames_since_last_update = 0;
    let last_calculated_fps = 0;

    function tick(current_time: number): number {
        if (last_fps_update_time === 0) {
            last_fps_update_time = current_time;
        }
        frames_since_last_update++;
        const delta_time = current_time - last_fps_update_time;
        if (delta_time >= 1000) {
            last_calculated_fps = Math.round((frames_since_last_update * 1000) / delta_time);
            frames_since_last_update = 0;
            last_fps_update_time = current_time;
        }
        return last_calculated_fps;
    }

    return tick;
}
