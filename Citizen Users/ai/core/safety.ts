const FLOOD_KEYWORDS = [
  "flood", "water", "rain", "precipitation", "weather", "temp", "temp_c",
  "evacuation", "shelter", "contact", "emergency", "helpline", "sos",
  "safe", "safety", "hazard", "danger", "alert", "warning", "rescue",
  "first-aid", "first aid", "drown", "boat", "dam", "river", "overflow",
  "altitude", "grid", "sensor", "telemetry", "gps", "coordinates", "medical"
];

export function isOutOfDomain(question: string): boolean {
  const normalized = question.toLowerCase().trim();
  if (normalized.length === 0) return true;
  
  // Check if the inquiry is related to flood, rescue, or safety domains
  const hasKeyword = FLOOD_KEYWORDS.some(kw => normalized.includes(kw));
  return !hasKeyword;
}

export function getOutOfDomainResponse(): string {
  return "I am FloodGuard Assistant, a specialized Flood Monitoring, prediction, and safety responder. I can only assist with topics related to flood monitoring, safety warnings, safe routes, emergency contacts, shelter coordinates, first-aid, or rescue operations. Please ask a flood-related question.";
}

export function getModelOfflineResponse(details?: string): string {
  return `FloodGuard local Qwen3 4B GGUF AI engine is currently operating in safe offline mode. Reason: ${details || "inference engine not initialized"}. Please prioritize the following emergency helplines: Disaster Helpline: 108, NDRF: 011-23438084. Seek high ground immediately if you are in a low-lying zone.`;
}
