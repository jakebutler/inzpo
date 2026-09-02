const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

export function validateRelativePath(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  if (value.includes("\\")) return "/";
  if (value.includes("://")) return "/";
  if (CONTROL_CHARS.test(value)) return "/";
  return value;
}
