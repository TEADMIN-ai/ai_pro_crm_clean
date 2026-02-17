"use client";

import { useState } from "react";

type Props = {
  currentStage: string;
  allowedStages: string[];
};

export default function DealStatusUpdater({
  currentStage,
  allowedStages,
}: Props) {
  const [stage, setStage] = useState(currentStage);

  return (
    <div style={{ marginTop: 10 }}>
      <label style={{ fontWeight: 600 }}>Update Stage:</label>

      <select
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        style={{ marginLeft: 10 }}
      >
        {allowedStages.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}

