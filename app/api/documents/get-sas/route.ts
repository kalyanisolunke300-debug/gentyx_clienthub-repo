// app/api/documents/get-sas/route.ts
// Renamed concept: Azure SAS → Supabase signed URL (same purpose: short-lived read URL)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "client_hub";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get("path"); // e.g. client-14/PDF/file.pdf

    if (!filePath) {
      return NextResponse.json({ error: "Missing file path" }, { status: 400 });
    }

    // Generate a signed URL valid for 5 minutes (same duration as old SAS)
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 5 * 60);

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Failed to generate URL" }, { status: 500 });
    }

    return NextResponse.json({ sasUrl: data.signedUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
