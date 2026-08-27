import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("admin live video controls", () => {
  it("keeps playback controls clear of the evidence overlay with visible text", () => {
    const player = readFileSync(join(process.cwd(), "components", "livekit-admin-player.tsx"), "utf8");
    const viewer = readFileSync(join(process.cwd(), "app", "live-video", "live-video-viewer.tsx"), "utf8");
    const primitives = readFileSync(join(process.cwd(), "components", "form-primitives.tsx"), "utf8");

    expect(player.includes("flex items-end justify-center")).toBe(true);
    expect(player.includes("bottom-4 right-4 z-20")).toBe(true);
    expect(player.includes('variant="inverse"')).toBe(true);
    expect(player.includes('variant="secondary" className="bg-white text-command')).toBe(false);
    expect(viewer.includes('data-testid="live-video-player"')).toBe(true);
    expect(viewer.includes('data-testid="live-evidence-panel"')).toBe(true);
    expect(viewer.includes("absolute left-4 right-4 top-4")).toBe(false);
    expect(viewer.indexOf('data-testid="live-evidence-panel"') > viewer.indexOf('data-testid="live-video-player"')).toBe(true);
    expect(primitives.includes('inverse: "border border-white/20 bg-white text-command')).toBe(true);
    expect(player.includes('"waiting"')).toBe(true);
    expect(player.includes('Connected, waiting for video')).toBe(true);
    expect(player.includes('setPlayerState(attached ? "connected" : "waiting")')).toBe(true);
    expect(viewer.includes("Location: {displayOverlay.location}")).toBe(true);
  });
});
