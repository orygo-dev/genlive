"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, LoaderCircle } from "lucide-react";
import { roleLabel, type OrgRoleLabel } from "@/lib/organization-labels";

type OrgOption = {
  id: string;
  name: string;
  role: OrgRoleLabel;
};

export function OrgSwitcher({
  memberships,
  activeOrganizationId,
}: {
  memberships: OrgOption[];
  activeOrganizationId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState("");

  const active =
    memberships.find((item) => item.id === activeOrganizationId) ??
    memberships[0];

  if (!active) {
    return null;
  }

  async function switchOrganization(organizationId: string) {
    if (organizationId === activeOrganizationId || isSwitching) {
      setOpen(false);
      return;
    }

    setError("");
    setIsSwitching(true);

    try {
      const response = await fetch("/api/organizations/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Workspace belum dapat diganti.");
      }

      setOpen(false);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Workspace belum dapat diganti.",
      );
    } finally {
      setIsSwitching(false);
    }
  }

  return (
    <div className="org-switcher">
      <button
        type="button"
        className="org-switcher-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
        disabled={isSwitching}
      >
        <span className="org-switcher-icon"><Building2 size={16} /></span>
        <span>
          <strong>{active.name}</strong>
          <small>{roleLabel(active.role)}</small>
        </span>
        {isSwitching ? (
          <LoaderCircle className="spin" size={15} />
        ) : (
          <ChevronDown size={15} />
        )}
      </button>

      {open ? (
        <div className="org-switcher-menu" role="listbox">
          {memberships.map((membership) => {
            const selected = membership.id === activeOrganizationId;
            return (
              <button
                key={membership.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => void switchOrganization(membership.id)}
              >
                <span>
                  <strong>{membership.name}</strong>
                  <small>{roleLabel(membership.role)}</small>
                </span>
                {selected ? <Check size={15} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? <p className="form-error org-switcher-error">{error}</p> : null}
    </div>
  );
}
