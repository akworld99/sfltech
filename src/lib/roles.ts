export type Role = "admin" | "hr_editor" | "sales_manager" | "sales_rep";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  hr_editor: "HR Editor",
  sales_manager: "Sales Manager",
  sales_rep: "Sales Rep",
};

export const canUseHr = (r: Role) => r === "admin" || r === "hr_editor";
export const canUseSales = (r: Role) => r === "admin" || r === "sales_manager" || r === "sales_rep";
export const canSeeAllLeads = (r: Role) => r === "admin" || r === "sales_manager";
export const canAssign = (r: Role) => r === "admin" || r === "sales_manager";

export const LEAD_STATUSES = ["new", "assigned", "contacted", "qualified", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const SOURCE_LABELS: Record<string, string> = {
  assessment_cvp: "CVP Cost Exposure",
  assessment_ai: "AI Readiness",
  partner: "Partner enquiry",
  contact: "Contact enquiry",
};
