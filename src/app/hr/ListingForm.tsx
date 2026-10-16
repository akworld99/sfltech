"use client";

import { useActionState } from "react";
import { saveListingAction, type FormState } from "./actions";

type Def = { name: string; label: string; type: "text" | "option" | "date"; required?: boolean; placeholder?: string; help?: string };

type Props = {
  kind: "vacancy" | "partner";
  id?: number;
  status?: "draft" | "published" | "closed";
  defs: Def[];
  options: Record<string, string[]>;
  refLabel: string;
  refHelp: string;
  initial: Record<string, string>;
};

export default function ListingForm({ kind, id, status, defs, options, refLabel, refHelp, initial }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveListingAction, { error: null, values: {} });
  const v = (name: string) => state.values[name] ?? initial[name] ?? "";

  return (
    <form action={action} className="card">
      <input type="hidden" name="kind" value={kind} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {state.error && <div className="notice error">{state.error}</div>}

      <div className="form-grid">
        <div>
          <label htmlFor="ref_code">{refLabel}</label>
          <input id="ref_code" name="ref_code" type="text" required defaultValue={v("ref_code")} key={`ref-${v("ref_code")}`} placeholder="SL-001" />
          <div className="help">{refHelp}</div>
        </div>
        <div className="span-all">
          <label htmlFor="title">Title</label>
          <input id="title" name="title" type="text" required defaultValue={v("title")} key={`title-${v("title")}`} />
        </div>

        {defs.map((d) => {
          const opts = options[d.name];
          return (
            <div key={d.name}>
              <label htmlFor={d.name}>
                {d.label}
                {d.required ? " *" : ""}
              </label>
              {d.type === "option" && opts && opts.length ? (
                <select id={d.name} name={d.name} defaultValue={v(d.name)} key={`${d.name}-${v(d.name)}`} required={d.required}>
                  <option value="">Select…</option>
                  {opts.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input id={d.name} name={d.name} type="text" defaultValue={v(d.name)} key={`${d.name}-${v(d.name)}`} placeholder={d.placeholder} required={d.required} />
              )}
              {d.help && <div className="help">{d.help}</div>}
            </div>
          );
        })}

        <div className="span-all">
          <label htmlFor="clickup_link">ClickUp form link</label>
          <input
            id="clickup_link"
            name="clickup_link"
            type="url"
            required
            defaultValue={v("clickup_link")}
            key={`cu-${v("clickup_link")}`}
            placeholder="https://forms.clickup.com/…"
          />
          <div className="help">Applicants are sent here from the Apply button on sfltech.ai. Only forms.clickup.com links are accepted.</div>
        </div>

        <div className="span-all">
          <label htmlFor="description_text">Description</label>
          <textarea id="description_text" name="description_text" defaultValue={v("description_text")} key={`d-${v("description_text").length}`} />
          <div className="help">
            Plain text. Use <code>## Heading</code>, lines starting with <code>- </code> for bullets, <code>**bold**</code>, and a blank line between paragraphs.
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn primary" type="submit" name="intent" value="publish" disabled={pending}>
          {status === "published" ? "Save & update live" : "Publish to sfltech.ai"}
        </button>
        <button className="btn" type="submit" name="intent" value="save" disabled={pending}>
          Save draft
        </button>
        {pending && <span className="muted">Working…</span>}
      </div>
    </form>
  );
}
