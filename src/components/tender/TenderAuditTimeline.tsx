"use client";

import { TenderAuditEvent } from "@/types/tenderAudit";

type Props = {
  events: TenderAuditEvent[];
};

export default function TenderAuditTimeline({ events }: Props) {
  if (!events.length) {
    return (
      <div className="text-sm text-gray-500 mt-4">
        No audit activity recorded yet.
      </div>
    );
  }

  return (
    <div className="mt-4 border-t pt-4">
      <h4 className="text-sm font-semibold mb-3">Audit Timeline</h4>

      <ul className="space-y-3">
        {events.map(event => (
          <li
            key={event.id}
            className="flex flex-col text-sm bg-white/60 rounded-md p-3"
          >
            <span className="font-medium">{event.message}</span>

            <span className="text-xs text-gray-500">
              {event.createdAt.toLocaleString()} • User: {event.userId}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}