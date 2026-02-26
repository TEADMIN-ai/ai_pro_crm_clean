"use client";

import { useState, useEffect } from "react";
import { authFetch } from "@/lib/client/authFetch";

export default function NewDealPage() {
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [contractors, setContractors] = useState<any[]>([]);
  const [contractorId, setContractorId] = useState("");

  useEffect(() => {
    async function loadContractors() {
      try {
        const result = await authFetch("/api/contractors");

        if (!result.ok) {
          throw new Error(result.message);
        }

        const response = result.response;
        const data = await response.json();
        setContractors(Array.isArray(data) ? data : []);
      } catch {
        setContractors([]);
      }
    }

    loadContractors();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch("/api/deals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title,
        value: Number(value),
        contractorId
      })
    });

    if (res.ok) {
      alert("Deal created successfully");
      window.location.href = "/dashboard/deals";
    } else {
      alert("Failed to create deal");
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>New Deal</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Deal Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Contractor</label>
          <select
            value={contractorId}
            onChange={e => setContractorId(e.target.value)}
            required
          >
            <option value="">Select contractor</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.companyName || contractor.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Value</label>
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            required
          />
        </div>

        <button type="submit">
          Submit
        </button>
      </form>
    </div>
  );
}
