import type { Metadata } from "next";
import "./globals.css";
import { getUser } from "@/lib/session";
import { signOut, BASE_PATH } from "@/auth";
import { ROLE_LABELS, canSeeAllLeads, canUseHr, canUseSales } from "@/lib/roles";

export const metadata: Metadata = {
  title: "SFL Tech Team Portal",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <span className="brand">SFL Tech · Team Portal</span>
          {user && (
            <>
              <nav>
                <a href={`${BASE_PATH}/`}>Home</a>
                {canUseHr(user.role) && <a href={`${BASE_PATH}/hr`}>HR &amp; Partners</a>}
                {canUseSales(user.role) && (
                  <a href={`${BASE_PATH}/sales`}>{canSeeAllLeads(user.role) ? "Sales · All leads" : "Sales · My leads"}</a>
                )}
                {user.role === "admin" && <a href={`${BASE_PATH}/admin/users`}>Users</a>}
              </nav>
              <div className="who">
                <span>
                  {user.name ?? user.email} · {ROLE_LABELS[user.role]}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: `${BASE_PATH}/login` });
                  }}
                >
                  <button className="btn sm" type="submit">
                    Sign out
                  </button>
                </form>
              </div>
            </>
          )}
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
