export const COLOR_ROLES = ["primary", "secondary", "accent", "background", "surface", "text"] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];
export type RoleColors = Record<ColorRole, string | null>;

export type BriefStatus = "pending" | "ready" | "failed";

export interface NamedColor {
  hex: string;
  label: string | null;
}

export interface BriefJob {
  status: BriefStatus;
  text: string | null;
  namedHexes: string[];
  namedColors: NamedColor[];
  stub: boolean;
  updatedAt: number;
}

export interface CollectionSummary {
  id: string;
  name: string;
  count: number;
}

export interface MobileCollection {
  id: string;
  name: string;
  kits: Array<Pick<MobileKit, "id" | "title" | "roles"> & { photo: { url: string } | null }>;
}

export interface PresignUploadRequest {
  contentType: string;
  bytes: number;
}

export interface PresignUploadResponse {
  url: string;
  key: string;
  contentType: string;
}

export interface CreateKitRequest {
  uploadKey: string;
  filename?: string;
}

export interface CreateKitResponse {
  itemId: string;
}

export interface MobileKit {
  id: string;
  /** Display name, including the untitled fallback. */
  title: string;
  photo: {
    /** Short-lived signed HTTPS URL; refresh by fetching the kit again. */
    url: string;
    width: number;
    height: number;
    placeholder: string | null;
  } | null;
  roles: RoleColors;
  colors: Array<{
    hex: string; role: ColorRole | null; name: string | null; origin: string;
    /** Normalized source-photo sample coordinates (0..1), absent on older kits. */
    pinX?: number | null;
    pinY?: number | null;
  }>;
  brief: BriefJob;
  collectionIds: string[];
}

export interface UpdateKitColorsRequest {
  roles: Partial<Record<ColorRole, string | null>>;
}

export interface SaveKitRequest {
  collectionId?: string;
  newName?: string;
}

export interface SaveKitResponse {
  collectionId: string;
}

export interface ApiError {
  error: string;
}
