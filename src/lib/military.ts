const MILITARY_MODEL_PATTERNS: RegExp[] = [
  /^C17A?$/i,
  /^C130[A-Z]{0,2}$/i,
  /^C5[ABM]?$/i,
  /^KC10A?$/i,
  /^KC135[RT]?$/i,
  /^A400M$/i,
  /^E3[A-Z]?$/i,
  /^E8[A-Z]?$/i,
  /^F15[A-Z]{0,2}$/i,
  /^F16[A-Z]{0,2}$/i,
  /^F18[A-Z]{0,2}$/i,
  /^F22[A-Z]{0,2}$/i,
  /^F35[A-Z]{0,2}$/i,
  /^B1B$/i,
  /^B2A?$/i,
  /^B52[A-Z]?$/i,
  /^P8A?$/i,
  /^RQ4[A-Z]?$/i,
  /^MQ9[A-Z]?$/i,
  /^T38[A-Z]?$/i,
  /^U2[A-Z]?$/i,
  /^C27J$/i,
  /^C12[A-Z]?$/i,
  /^A10[A-Z]?$/i,
];

export function isMilitaryAircraftModel(model?: string): boolean {
  if (!model) {
    return false;
  }

  const normalized = model.trim().toUpperCase();

  return MILITARY_MODEL_PATTERNS.some((pattern) => pattern.test(normalized));
}
