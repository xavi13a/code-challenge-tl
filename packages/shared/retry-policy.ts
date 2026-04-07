export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 250;

export const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
