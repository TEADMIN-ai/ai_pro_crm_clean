import fs from "node:fs";
import path from "node:path";

import {
  blankQuoteRequest,
  buildQuoteClipboardText,
  buildQuoteMailto,
  getFirstQuoteErrorField,
  validateQuoteRequest,
} from "@/components/corporate/QuoteRequestForm";
import { getCorporateEmail } from "@/lib/corporate/companyProfile";

const root = process.cwd();
const source = () => fs.readFileSync(path.join(root, "src/components/corporate/QuoteRequestForm.tsx"), "utf8");

describe("quote request feedback", () => {
  const validInput = {
    ...blankQuoteRequest,
    fullName: "Sarah-Lee Client",
    companyName: "Client Co",
    email: "sarah@example.com",
    phone: "069 502 4909",
    service: "Procurement and tender support",
    location: "Cape Town",
    message: "Please prepare a quote.",
    consent: true,
  };

  test("invalid submission stays on page and does not activate mailto", () => {
    const errors = validateQuoteRequest(blankQuoteRequest);
    expect(getFirstQuoteErrorField(errors)).toBe("fullName");
    const formSource = source();
    expect(formSource).toContain("event.preventDefault()");
    expect(formSource).toContain("setStatus('validation_error')");
    expect(formSource).toContain("window.requestAnimationFrame");
    expect(formSource.indexOf("if (hasQuoteErrors(nextErrors))")).toBeLessThan(formSource.indexOf("window.location.href = href"));
  });

  test("valid submission prepares request feedback without clearing entered values", () => {
    expect(validateQuoteRequest(validInput)).toEqual({});
    expect(buildQuoteMailto(validInput)).toMatch(/^mailto:/);
    const formSource = source();
    expect(formSource).toContain("Your quote request has been prepared.");
    expect(formSource).toContain("The request has not been sent automatically.");
    expect(formSource).toContain("setStatus('request_prepared')");
    expect(formSource).not.toContain("setValues(blankQuoteRequest)");
  });

  test("fallback uses canonical email and prepared request copy text", () => {
    const canonicalEmail = getCorporateEmail("info");
    const copied = buildQuoteClipboardText(validInput);
    expect(copied).toContain("To: " + canonicalEmail);
    expect(copied).toContain("Subject: Quote request - Procurement and tender support");
    const formSource = source();
    expect(formSource).toContain("getCorporateEmail('info')");
    expect(formSource).toContain("Copy prepared request details");
    expect(formSource).toContain("Open email application again");
  });

  test("copy success and failure states are explicit and accessible", () => {
    const formSource = source();
    expect(formSource).toContain("await navigator.clipboard.writeText(preparedText)");
    expect(formSource).toContain("setStatus('copy_success')");
    expect(formSource).toContain("setStatus('copy_failed')");
    expect(formSource).toContain("role={status === 'copy_failed' ? 'alert' : 'status'}");
  });

  test("quote feedback does not claim delivery or receipt", () => {
    const formSource = source();
    expect(formSource).not.toMatch(/submitted successfully|email sent|request received|quote logged|delivery confirmed/i);
    expect(formSource).not.toContain("authFetch");
    expect(formSource).not.toMatch(/firebase|dashboard/i);
  });
});

test("quote feedback uses live regions for status and alert states", () => {
  const formSource = source();
  expect(formSource).toContain("role='alert'");
  expect(formSource).toContain("aria-live='polite'");
});
