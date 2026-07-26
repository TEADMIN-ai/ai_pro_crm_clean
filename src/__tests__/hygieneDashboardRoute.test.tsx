import type { ReactElement } from "react";
import HygieneDashboardPage from "@/app/dashboard/hygiene/page";
import HygieneDivisionClient from "@/components/hygiene/HygieneDivisionClient";

jest.mock("@/components/hygiene/HygieneDivisionClient", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

describe("hygiene dashboard route", () => {
  it("uses the existing HygieneDivisionClient home view", () => {
    const element = HygieneDashboardPage() as ReactElement<{ view: string }>;

    expect(element.type).toBe(HygieneDivisionClient);
    expect(element.props.view).toBe("home");
  });
});
