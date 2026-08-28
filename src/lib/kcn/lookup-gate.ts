export const LOOKUP_MAX_IMAGE_CHARS = 900_000;

export type LookupGate = {
  image: string;
  error?: string;
};

/** Photos never leave the device without explicit consent. */
export function gateLookupImage(imageDataUrl: string, offDeviceConsent: boolean): LookupGate {
  const img = (imageDataUrl || "").trim();
  if (!img) return { image: "" };
  if (!offDeviceConsent) {
    return { image: "", error: "Photo transfer blocked: operator did not consent to off-device lookup." };
  }
  if (!img.startsWith("data:image/")) {
    return { image: "", error: "Rejected: capture is not a recognized image." };
  }
  if (img.length > LOOKUP_MAX_IMAGE_CHARS) {
    return { image: "", error: "Rejected: image exceeds the off-device size cap." };
  }
  return { image: img };
}

export function probeLookupGate(): { ok: boolean; evidence: string } {
  const blocked = gateLookupImage("data:image/jpeg;base64,abc", false);
  const allowed = gateLookupImage("data:image/jpeg;base64,abc", true);
  const oversized = gateLookupImage("data:image/jpeg;base64," + "A".repeat(LOOKUP_MAX_IMAGE_CHARS), true);
  const junk = gateLookupImage("https://example.invalid/x.jpg", true);
  const ok =
    !blocked.image &&
    !!blocked.error &&
    allowed.image.startsWith("data:image/") &&
    !oversized.image &&
    !!oversized.error &&
    !junk.image;
  return {
    ok,
    evidence: ok
      ? `Lookup gate live: no-consent blocked, consent allowed, size cap ${LOOKUP_MAX_IMAGE_CHARS} chars, non-image rejected.`
      : "Lookup gate failed a live policy probe.",
  };
}
