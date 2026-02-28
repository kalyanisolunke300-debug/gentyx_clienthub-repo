// app/api/documents/get-url/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "client_hub";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const folder = searchParams.get("folder");
    const fileName = searchParams.get("fileName");

    if (!clientId || !folder || !fileName) {
      return NextResponse.json({ url: null });
    }

    const blobPath = `client-${clientId}/${folder}/${fileName}`;

    // Generate a signed URL valid for 15 minutes
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(blobPath, 15 * 60);

    if (error || !data) {
      console.error("Signed URL error:", error?.message);
      return NextResponse.json({ url: null, error: error?.message });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (err: any) {
    return NextResponse.json({ url: null, error: err.message });
  }
}
