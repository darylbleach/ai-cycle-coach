export function getCronApiKey(): string | undefined {
  const key = process.env.CRON_API_KEY?.trim();
  return key || undefined;
}

export function requestMatchesCronApiKey(provided: string | null): boolean {
  const expected = getCronApiKey();
  if (!expected || !provided) {
    return false;
  }

  return provided === expected;
}
