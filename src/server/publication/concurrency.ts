import type { Payload, PayloadRequest } from 'payload'

// Wraps an operation in a SERIALIZABLE Postgres transaction so a concurrent
// write to the same row is detected instead of silently lost (Postgres
// aborts one of two conflicting serializable transactions at commit time).
//
// Payload's commitTransaction() (payload@3.86, via @payloadcms/drizzle)
// swallows commit-time failures internally — it catches the rejection and
// just rolls back without rethrowing (see
// node_modules/@payloadcms/drizzle/dist/transactions/commitTransaction.js).
// A caller CANNOT rely on this function throwing to detect a lost race.
// Callers MUST re-read the document after calling this and compare its
// revision against what the operation wrote; a mismatch means another
// writer won and the "successful" commit here was actually rolled back.
export async function withSerializableTransaction<T>(
  payload: Payload,
  user: PayloadRequest['user'],
  operation: (req: PayloadRequest) => Promise<T>,
): Promise<T> {
  const transactionID = await payload.db.beginTransaction({ isolationLevel: 'serializable' })
  if (transactionID === null || transactionID === undefined) {
    throw new Error('O banco não iniciou a transação de concorrência.')
  }
  const req = { payload, user: user || undefined, transactionID, context: {} } as unknown as PayloadRequest

  try {
    const result = await operation(req)
    await payload.db.commitTransaction(transactionID)
    return result
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    throw error
  }
}
