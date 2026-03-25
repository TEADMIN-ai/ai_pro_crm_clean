import { renderToStaticMarkup } from "react-dom/server";

import DocumentVerificationReviewPanel from "@/components/deals/DocumentVerificationReviewPanel";

describe("DocumentVerificationReviewPanel review queue filtering", () => {
  test("renders loading state for the internal fetch workflow", () => {
    const markup = renderToStaticMarkup(<DocumentVerificationReviewPanel dealId="deal-1" />);

    expect(markup).toContain("Loading verification data...");
  });
});
