import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@vercel/postgres";

const BaseRowSchema = z.object({
  date: z.string(), // dd/MM/yyyy format
  amount: z.number(),
  description: z.string(),
  memo: z.string(),
  category: z.string(),
  account: z.string(),
  hash: z.string(),
  comment: z.string(),
  "scraped at": z.string(),
  "scraped by": z.string(),
  identifier: z.string(),
  chargedCurrency: z.string(),
});

const BaseRowArraySchema = z.array(BaseRowSchema);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check for upsert query parameter
    const { searchParams } = new URL(request.url);
    const upsertScraperCredentials = searchParams.get('upsertScraperCredentials') === 'true';

    const validationResult = BaseRowArraySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid transaction data",
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const transactions = validationResult.data;
    const results = [];

    for (const transaction of transactions) {
      try {
        // Look up scraper credential ID by friendly name (account)
        let credentialResult = await sql.query(
          'SELECT id FROM scraper_credentials WHERE friendly_name = $1',
          [transaction.account]
        );

        if (!credentialResult.rows.length) {
          if (upsertScraperCredentials) {
            // Auto-create scraper credential with blank credentials
            const insertResult = await sql.query(
              'INSERT INTO scraper_credentials (friendly_name, company_id, credentials) VALUES ($1, $2, $3) RETURNING id',
              [transaction.account, 'unknown', '{}']
            );
            credentialResult = insertResult;
          } else {
            results.push({
              success: false,
              identifier: transaction.identifier,
              error: `Scraper credential not found for account: ${transaction.account}`
            });
            continue;
          }
        }

        const scraperCredentialId = credentialResult.rows[0].id;

        // Convert dd/MM/yyyy back to ISO format for storage
        const [day, month, year] = transaction.date.split('/');
        const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

        await sql.query(`
          INSERT INTO transactions (
            scraper_credential_id, identifier, type, status, date,
            processed_date, original_amount, original_currency, charged_amount,
            charged_currency, description, memo, category
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
          )
          ON CONFLICT (scraper_credential_id, identifier) DO NOTHING
        `, [
          scraperCredentialId,
          transaction.identifier,
          'normal', // default type
          'completed', // default status
          isoDate,
          isoDate, // use same date for processed_date
          transaction.amount,
          transaction.chargedCurrency,
          transaction.amount,
          transaction.chargedCurrency,
          transaction.description,
          transaction.memo || null,
          transaction.category || null
        ]);

        results.push({ 
          success: true, 
          identifier: transaction.identifier 
        });
      } catch (error) {
        console.error(`Error saving transaction ${transaction.identifier}:`, error);
        results.push({ 
          success: false, 
          identifier: transaction.identifier,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      success: failureCount === 0,
      totalProcessed: results.length,
      successCount,
      failureCount,
      results
    });

  } catch (error) {
    console.error("Error in POST /api/transactions:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}