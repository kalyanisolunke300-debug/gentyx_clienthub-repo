// app/api/documents/get/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "client_hub";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const mode = searchParams.get("mode");     // "folders"
    const folder = searchParams.get("folder"); // e.g. "IMG"

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId is required" },
        { status: 400 }
      );
    }

    const prefix = `client-${clientId}`;

    // ---------------------------------------------------------
    // MODE 1 → Return only folders
    // ---------------------------------------------------------
    if (mode === "folders") {
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .list(prefix, { limit: 1000 });

      if (error) throw new Error(error.message);

      const folders = (data ?? [])
        .filter((item: { id: string | null; name: string }) => item.id === null && item.name !== ".keep")
        .map((item: { name: string }) => item.name);

      return NextResponse.json({ success: true, folders });
    }

    // ---------------------------------------------------------
    // MODE 2 → Return files inside a specific folder
    // ---------------------------------------------------------
    if (folder) {
      const filePrefix = `${prefix}/${folder}`;
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .list(filePrefix, { limit: 1000 });

      if (error) throw new Error(error.message);

      const files: any[] = [];
      for (const item of (data ?? []) as Array<{ id: string | null; name: string; metadata?: any }>) {
        if (!item.name || item.name === ".keep" || item.id === null) continue;

        const fullPath = `${filePrefix}/${item.name}`;
        const { data: signedData } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(fullPath, 60 * 60);

        files.push({
          name: item.name,
          url: signedData?.signedUrl || null,
          size: item.metadata?.size,
          type: item.name.split(".").pop(),
          path: fullPath,
        });
      }

      return NextResponse.json({ success: true, files });
    }

    return NextResponse.json(
      { success: false, error: "Missing mode=folders or folder parameter." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
