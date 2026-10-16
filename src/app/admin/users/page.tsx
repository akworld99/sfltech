import { all } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { fmtDate } from "@/lib/format";
import { saveUser, setActive } from "./actions";

type U = { email: string; name: string | null; role: Role; region: string | null; active: number; last_login: string | null };

export default async function UsersPage() {
  const me = await requireUser((r) => r === "admin");
  const users = await all<U>("SELECT email, name, role, region, active, last_login FROM users ORDER BY active DESC, role, email");
  return (
    <>
      <h1>Users &amp; roles</h1>
      <p className="sub">Only people listed here can sign in, even with a valid Microsoft account.</p>

      <form action={saveUser} className="card form-grid" style={{ marginBottom: 24 }}>
        <div>
          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" required placeholder="name@sfltech.ai" />
        </div>
        <div>
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" />
        </div>
        <div>
          <label htmlFor="role">Role</label>
          <select id="role" name="role" defaultValue="sales_rep">
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="region">Region (optional)</label>
          <input id="region" name="region" type="text" placeholder="e.g. Europe" />
        </div>
        <div className="span-all">
          <button className="btn primary" type="submit">
            Add or update user
          </button>
          <span className="help"> Saving an existing email updates its role and re-activates it.</span>
        </div>
      </form>

      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Region</th>
            <th>Last sign-in</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.email}>
              <td>
                {u.name ?? "—"}
                <div className="muted">{u.email}</div>
              </td>
              <td>{ROLE_LABELS[u.role]}</td>
              <td>{u.region ?? ""}</td>
              <td>{fmtDate(u.last_login) || "never"}</td>
              <td>
                <span className={`badge ${u.active ? "published" : "closed"}`}>{u.active ? "Active" : "Inactive"}</span>
              </td>
              <td>
                {u.email !== me.email && (
                  <form action={setActive}>
                    <input type="hidden" name="email" value={u.email} />
                    <input type="hidden" name="active" value={u.active ? "0" : "1"} />
                    <button className={`btn sm ${u.active ? "danger" : ""}`} type="submit">
                      {u.active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
