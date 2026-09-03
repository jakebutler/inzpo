import { logout } from "@/app/login/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button type="submit" className="min-h-[36px] px-1 text-sm text-muted-foreground hover:text-foreground">
        Sign out
      </button>
    </form>
  );
}
