import { renderToStaticMarkup } from "react-dom/server";

import { PartnerPublishedMessage } from "@/components/vehicle-finance/SupplyChainPartnerPortal";

describe("SupplyChainPartnerPortal", () => {
  test("renders only the approved server-projected partner message", () => {
    const markup = renderToStaticMarkup(
      <PartnerPublishedMessage message="Your quotation is currently under review." />,
    );

    expect(markup).toContain("Your quotation is currently under review.");
  });
});
