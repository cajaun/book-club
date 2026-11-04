export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// fast start and soft landing so a tapped book reacts on the same frame
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3.2);
