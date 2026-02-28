// app/api/test-sas/route.ts
// ⚠️ This was an Azure Blob Storage debug endpoint (SAS token test).
// It has been disabled as part of the migration to Supabase Storage.
// Azure SAS tokens are not needed — Supabase uses signed URLs instead.

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    disabled: true,
    message:
      "This endpoint was an Azure Blob SAS token debug tool and is no longer available. " +
      "Supabase Storage uses signed URLs generated via supabaseAdmin.storage.createSignedUrl().",
  });
}
