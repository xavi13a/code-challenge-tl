import { randomUUID } from 'crypto';

export const newTraceId = (): string => randomUUID();
