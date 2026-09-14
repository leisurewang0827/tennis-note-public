(function attachTicketPolicyHistory(global) {
  "use strict";

  const own = (value, key) => Boolean(value && Object.prototype.hasOwnProperty.call(value, key));

  function normalizedWeeklyFrequency(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 7 ? number : null;
  }

  function resolveWeeklyFrequency(ticket = {}, currentProduct = {}) {
    const policy = ticket.policySnapshot && typeof ticket.policySnapshot === "object"
      ? ticket.policySnapshot
      : ticket.policy_snapshot && typeof ticket.policy_snapshot === "object"
        ? ticket.policy_snapshot
        : {};
    const productSnapshot = policy.product && typeof policy.product === "object"
      ? policy.product
      : {};
    const candidates = [
      [productSnapshot, "frequencyPerWeek", "snapshot.product.frequencyPerWeek"],
      [productSnapshot, "frequency_per_week", "snapshot.product.frequency_per_week"],
      [policy, "weeklyFrequency", "snapshot.weeklyFrequency"],
      [policy, "frequencyPerWeek", "snapshot.frequencyPerWeek"],
      [policy, "frequency_per_week", "snapshot.frequency_per_week"],
    ];
    const observed = candidates
      .filter(([source, key]) => own(source, key))
      .map(([source, key, label]) => ({ label, raw: source[key], value: normalizedWeeklyFrequency(source[key]) }));
    if (observed.some((entry) => entry.value === null)) {
      return { value: null, status: "snapshot_invalid", sources: observed.map((entry) => entry.label) };
    }
    const distinct = [...new Set(observed.map((entry) => entry.value))];
    if (distinct.length > 1) {
      return { value: null, status: "snapshot_conflict", sources: observed.map((entry) => entry.label) };
    }
    if (distinct.length === 1) {
      return { value: distinct[0], status: "snapshot_exact", sources: observed.map((entry) => entry.label) };
    }

    const ticketColumnPresent = own(ticket, "frequency_per_week") || own(ticket, "frequencyPerWeek");
    const ticketColumnValue = normalizedWeeklyFrequency(ticket.frequency_per_week ?? ticket.frequencyPerWeek);
    if (ticketColumnPresent && ticketColumnValue !== null) {
      return { value: ticketColumnValue, status: "ticket_exact", sources: ["ticket.frequency_per_week"] };
    }
    if (ticketColumnPresent) {
      return { value: null, status: "ticket_invalid", sources: ["ticket.frequency_per_week"] };
    }
    return {
      value: null,
      status: "snapshot_missing",
      sources: [],
      currentProductFrequency: normalizedWeeklyFrequency(
        currentProduct.frequency_per_week ?? currentProduct.frequencyPerWeek,
      ),
    };
  }

  function isUsable(result = {}) {
    return ["snapshot_exact", "ticket_exact"].includes(String(result.status || ""))
      && normalizedWeeklyFrequency(result.value) !== null;
  }

  global.TennisNoteTicketPolicyHistory = Object.freeze({
    normalizedWeeklyFrequency,
    resolveWeeklyFrequency,
    isUsable,
  });
})(typeof window !== "undefined" ? window : globalThis);
