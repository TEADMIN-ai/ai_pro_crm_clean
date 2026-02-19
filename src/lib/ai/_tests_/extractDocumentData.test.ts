/**
 * Tests for extractDocumentData.ts
 *
 * These tests validate:
 * - expiry extraction logic
 * - fallback safety when AI unavailable
 * - safe handling of empty input
 * - correct type output
 */

import {
  extractExpiryFromDocumentText,
  extractDocumentData,
  type ExtractedDocumentData,
} from "../extractDocumentData";

describe("extractExpiryFromDocumentText", () => {
  test("detects expiry date in standard format", async () => {
    const result = await extractExpiryFromDocumentText({
      text: "Tax Compliance Status valid until 2027-12-31",
    });

    expect(result).toBeTruthy();
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2027);
  });

  test("detects expiry date in alternative format", async () => {
    const result = await extractExpiryFromDocumentText({
      text: "Expiry Date: 31/12/2026",
    });

    expect(result).toBeTruthy();
    expect(result?.getFullYear()).toBe(2026);
  });

  test("returns null when no expiry exists", async () => {
    const result = await extractExpiryFromDocumentText({
      text: "This document has no expiry",
    });

    expect(result).toBeNull();
  });

  test("handles empty input safely", async () => {
    const result = await extractExpiryFromDocumentText({
      text: "",
    });

    expect(result).toBeNull();
  });
});

describe("extractDocumentData", () => {
  test("returns valid ExtractedDocumentData shape", async () => {
    const result: ExtractedDocumentData =
      await extractDocumentData({
        storagePath: "contractors/test/doc.pdf",
        filename: "doc.pdf",
      });

    expect(result).toHaveProperty("text");
    expect(result).toHaveProperty("expiresAt");
    expect(result).toHaveProperty("mimeType");

    expect(typeof result.text).toBe("string");
  });

  test("does not throw if file does not exist", async () => {
    await expect(
      extractDocumentData({
        storagePath: "invalid/path.pdf",
        filename: "bad.pdf",
      })
    ).resolves.toBeTruthy();
  });

  test("safe fallback when OPENAI_API_KEY missing", async () => {
    const original = process.env.OPENAI_API_KEY;

    delete process.env.OPENAI_API_KEY;

    const result = await extractDocumentData({
      storagePath: "contractors/test/doc.pdf",
      filename: "doc.pdf",
    });

    expect(result).toBeTruthy();
    expect(typeof result.text).toBe("string");

    process.env.OPENAI_API_KEY = original;
  });
});