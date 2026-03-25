import { renderToStaticMarkup } from "react-dom/server";
import DocumentVerificationReviewPanel from "@/components/deals/DocumentVerificationReviewPanel";

describe("DocumentVerificationReviewPanel", () => {
  test("renders loading state while verification data is being fetched", () => {
    const markup = renderToStaticMarkup(<DocumentVerificationReviewPanel dealId="deal-1" />);

    expect(markup).toContain("Loading verification data...");
  });
});
