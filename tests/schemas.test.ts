import { describe, expect, it } from "vitest";

import { companySettingsSchema, customerSchema } from "@/lib/server/schemas";

describe("financial identity validation", () => {
  const customer = { name: "Buyer", billingAddress: "Industrial Area", city: "Coimbatore", state: "Tamil Nadu", stateCode: "33", pinCode: "638657", gstin: "33ABCDE1234F1Z5", pan: "ABCDE1234F", creditLimit: "0", creditPeriod: 0, openingBalance: "0" };

  it("accepts matching customer GSTIN and state code", () => {
    expect(customerSchema.parse(customer).gstin).toBe("33ABCDE1234F1Z5");
  });

  it("rejects a GSTIN whose state prefix does not match", () => {
    expect(() => customerSchema.parse({ ...customer, gstin: "29ABCDE1234F1Z5" })).toThrow(/state code/i);
  });

  it("rejects invalid company state codes and IFSC values", () => {
    const company = { name: "Velmayil Ventures", addressLine1: "Madathottam", city: "Govindapuram", state: "Tamil Nadu", stateCode: "33", pinCode: "638657", invoicePrefix: "VVEL", bankAccount: { bankName: "State Bank", accountHolder: "Velmayil Ventures", accountNumber: "1234567890", ifsc: "SBIN0020777" } };
    expect(companySettingsSchema.parse(company).stateCode).toBe("33");
    expect(() => companySettingsSchema.parse({ ...company, stateCode: "00" })).toThrow();
    expect(() => companySettingsSchema.parse({ ...company, bankAccount: { ...company.bankAccount, ifsc: "INVALID" } })).toThrow();
  });
});
