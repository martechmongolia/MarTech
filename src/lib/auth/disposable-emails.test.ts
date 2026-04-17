import { describe, it, expect } from "vitest";
import { getDisposableDomain, isDisposableEmail } from "./disposable-emails";

describe("disposable email detection", () => {
  it("flags known disposable domains", () => {
    expect(isDisposableEmail("foo@mailinator.com")).toBe(true);
    expect(isDisposableEmail("Foo.Bar@10minutemail.com")).toBe(true);
    expect(isDisposableEmail("abc@guerrillamail.net")).toBe(true);
    expect(isDisposableEmail("x@yopmail.com")).toBe(true);
    expect(isDisposableEmail("USER@TEMP-MAIL.ORG")).toBe(true);
  });

  it("passes legitimate providers", () => {
    expect(isDisposableEmail("user@gmail.com")).toBe(false);
    expect(isDisposableEmail("team@martech.mn")).toBe(false);
    expect(isDisposableEmail("founder@company.io")).toBe(false);
    expect(isDisposableEmail("me@fastmail.com")).toBe(false);
    expect(isDisposableEmail("a@proton.me")).toBe(false);
  });

  it("handles malformed input", () => {
    expect(isDisposableEmail("not-an-email")).toBe(false);
    expect(isDisposableEmail("")).toBe(false);
    expect(isDisposableEmail("@mailinator.com")).toBe(false);
  });

  it("getDisposableDomain returns the blocked domain or null", () => {
    expect(getDisposableDomain("foo@mailinator.com")).toBe("mailinator.com");
    expect(getDisposableDomain("foo@gmail.com")).toBeNull();
    expect(getDisposableDomain("bad-input")).toBeNull();
  });
});
