import { signIn, BASE_PATH } from "@/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="login card">
      <h1>SFL Tech Team Portal</h1>
      <p className="sub">Sign in with your SFL Microsoft 365 account.</p>
      {error && (
        <div className="notice error">
          {error === "AccessDenied"
            ? "Your account is not set up for the portal. Ask an admin to add you."
            : "Sign-in failed. Try again, or contact an admin."}
        </div>
      )}
      <form
        action={async () => {
          "use server";
          await signIn("microsoft-entra-id", { redirectTo: `${BASE_PATH}/` });
        }}
      >
        <button className="btn primary" type="submit">
          Sign in with Microsoft
        </button>
      </form>
    </div>
  );
}
