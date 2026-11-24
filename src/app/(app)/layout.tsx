import Link from "next/link";
import { logoutAction } from "@/app/actions/account";
import { LogOutIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/Nav";
import { getColours, requireUser } from "@/lib/auth";
import { coloursStyle } from "@/lib/colours";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-10">
          <Link href="/" aria-label="ODO+ home">
            <Logo />
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden max-w-40 truncate text-sm font-medium text-muted sm:inline">{user.name}</span>
            <form action={logoutAction}>
              <button type="submit" title="Sign out" aria-label="Sign out" className="flex size-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg">
                <LogOutIcon size={18} />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main style={coloursStyle(getColours(user.id))}>{children}</main>
    </>
  );
}
