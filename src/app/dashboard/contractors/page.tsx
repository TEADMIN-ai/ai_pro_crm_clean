"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getContractors } from "@/lib/contractors/getContractors";
import type { Contractor } from "@/types/contractor";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";

function normalizeStatus(status: string | null | undefined): string {
  if (!status) return "active";
  return status.toLowerCase();
}

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await getContractors();
        setContractors(result);
      } catch (err: any) {
        console.error("Failed to fetch contractors:", err);
        setError(err.message || "Failed to load contractors");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <div className="enterprise-page">Loading contractors...</div>;
  }

  if (error) {
    return <div className="enterprise-page">{error}</div>;
  }

  const activeCount = contractors.filter((c) => normalizeStatus(c.status) === "active").length;
  const otherCount = contractors.length - activeCount;

  return (
    <div className="enterprise-page enterprise-grid">
      <Card>
        <IdentityCardHeader title="Contractors" subtitle="Enterprise supplier and compliance view">
          <Badge tone="info">Total {contractors.length}</Badge>
          <Badge tone={otherCount > 0 ? "warning" : "success"}>Risk Flags {otherCount}</Badge>
        </IdentityCardHeader>
      </Card>

      <Card>
        <h2>Compliance Score Summary</h2>
        <div className="compliance-summary">
          <div className="compliance-summary-item">
            <p className="enterprise-metric-label">Active</p>
            <p className="enterprise-metric-value">{activeCount}</p>
          </div>
          <div className="compliance-summary-item">
            <p className="enterprise-metric-label">Risk Indicators</p>
            <p className="enterprise-metric-value">{otherCount}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h2>Premium Contractors Table</h2>
        {contractors.length === 0 ? (
          <div>No contractors found.</div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Contractor</th>
                <th>Email</th>
                <th>Status</th>
                <th>Risk Indicator</th>
              </tr>
            </thead>
            <tbody>
              {contractors.map((contractor) => {
                const status = normalizeStatus(contractor.status);
                return (
                  <tr key={contractor.id}>
                    <td>
                      <Link href={`/dashboard/contractors/${contractor.id}`}>
                        {contractor.companyName || contractor.contactPerson || contractor.name || "Contractor"}
                      </Link>
                    </td>
                    <td>{contractor.email || "-"}</td>
                    <td><Badge tone={status === "active" ? "success" : "warning"}>{status}</Badge></td>
                    <td><Badge tone={status === "active" ? "success" : "danger"}>{status === "active" ? "Low" : "Medium"}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
