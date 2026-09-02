import { logout } from "@/app/login/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button type="submit" className="text-sm text-neutral-400 hover:text-neutral-200">
        Sign out
      </button>
    </form>
  );
}
