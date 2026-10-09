import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { COLOR_ROLES, rolesFromColors, type ColorRole } from "@inzpo/shared";
import { requireMobileOwner } from "@/lib/auth/bearer";
import { getItemDetail } from "@/lib/items";
import { normalizeHex } from "@/lib/colors";
import { replaceItemTokens } from "@/lib/item-tokens";
import { buildMobileKit } from "@/lib/mobile-kit";
import { mobileError, mobileServerError, readMobileJson, type MobileKitContext } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: MobileKitContext) {
  const auth = await requireMobileOwner(request);
  if (auth instanceof NextResponse) return auth;
  const body = await readMobileJson(request);
  const input = body?.roles;
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(body!).some((key) => key !== "roles")
    || Object.entries(input).some(([key, value]) =>
      !COLOR_ROLES.includes(key as ColorRole) || (value !== null && (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value))))) {
    return mobileError("Invalid role colors", 400);
  }
  const { id } = await params;
  try {
    const item = await getItemDetail(auth.ownerId, id);
    if (!item || (item.kind !== "photo" && item.kind !== "screenshot")) return mobileError("Not found", 404);
    const roles = rolesFromColors(item.colors);
    for (const [key, value] of Object.entries(input)) {
      roles[key as ColorRole] = value === null ? null : normalizeHex(value as string);
    }
    const pins: Partial<Record<ColorRole, { pinX: number; pinY: number }>> = {};
    const origins: Partial<Record<ColorRole, string>> = {};
    for (const role of COLOR_ROLES) {
      const color = item.colors.find((color) => color.role === role);
      if (!color || roles[role] !== normalizeHex(color.hex)) continue;
      if (color.pinX !== null && color.pinY !== null) pins[role] = { pinX: color.pinX, pinY: color.pinY };
      if (color.origin === "sampled") origins[role] = "sampled";
    }
    await replaceItemTokens(auth.ownerId, id, roles, pins, origins);
    revalidatePath(`/items/${id}`);
    revalidatePath("/");
    const fresh = await getItemDetail(auth.ownerId, id);
    if (!fresh) return mobileError("Not found", 404);
    return NextResponse.json(await buildMobileKit(auth.ownerId, fresh));
  } catch (error) {
    return mobileServerError(error);
  }
}
