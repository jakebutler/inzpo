import type { ReactElement } from "react";
import type { MascotKit, MascotPose } from "@/lib/mascot";

export type MascotRiveProps = {
  pose: MascotPose;
  kit: MascotKit;
  size: number;
};

export type MascotRiveRuntime = {
  render: (props: MascotRiveProps) => ReactElement;
};

/**
 * Lazy Rive loader. Call only after the Snap button can be tapped.
 * Returns null until `@rive-app/react-canvas` is added; the SVG placeholder
 * is the first frame in the meantime. Do not import Rive at the module top.
 */
export async function loadMascotRive(): Promise<MascotRiveRuntime | null> {
  return null;
}
