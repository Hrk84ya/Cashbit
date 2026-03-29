import { format, CsvFormatterStream } from '@fast-csv/format';
import { Response } from 'express';

/**
 * Creates a fast-csv format stream piped to an HTTP response.
 * Sets Content-Type and Content-Disposition headers automatically.
 */
export function createCsvStream(headers: string[], res: Response): CsvFormatterStream<any, any> {
  const dateStr = new Date().toISOString().split('T')[0];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="transactions-${dateStr}.csv"`);

  const csvStream = format({ headers });
  csvStream.pipe(res);

  return csvStream;
}

/**
 * Writes a single row to the CSV stream, handling backpressure.
 * If the internal buffer is full (write returns false), waits for drain before resolving.
 * Returns true if the write succeeded.
 */
export async function writeCsvRow(
  csvStream: CsvFormatterStream<any, any>,
  row: Record<string, string>,
): Promise<boolean> {
  const canContinue = csvStream.write(row);
  if (!canContinue) {
    await new Promise<void>((resolve) => csvStream.once('drain', resolve));
  }
  return true;
}
