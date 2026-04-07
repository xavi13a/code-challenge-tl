import { Prisma, PrismaClient } from '@prisma/client';

export const withTransaction = async <T>(
  prisma: PrismaClient,
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> => prisma.$transaction((tx) => callback(tx));
