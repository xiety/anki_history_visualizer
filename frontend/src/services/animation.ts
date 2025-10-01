import type { Shape } from "@/types/visualizers";

export function animateShapes(shapes: Shape[], isAnimated: boolean, animationSpeed: number) {
    if (!isAnimated) return;
    for (const shape of shapes) {
        if (!shape.isActive) continue;
        const dx = shape.targetX - shape.x;
        const dy = shape.targetY - shape.y;
        const dist = Math.hypot(dx, dy);
        if (dist < animationSpeed) {
            shape.x = shape.targetX;
            shape.y = shape.targetY;
        } else {
            shape.x += (dx / dist) * animationSpeed;
            shape.y += (dy / dist) * animationSpeed;
        }
    }
}

export function jumpShapesToTarget(shapes: Shape[], jump: boolean) {
    if (!jump) return;
    for (const shape of shapes) {
        shape.x = shape.targetX;
        shape.y = shape.targetY;
    }
}
