// app/api/documents/delete/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit, AuditActions } from "@/lib/audit";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "client_hub";

export async function POST(req: Request) {
  try {
    const { clientId, fullPath } = await req.json();

    if (!clientId || !fullPath) {
      return NextResponse.json(
        { success: false, error: "Missing clientId or fullPath" },
        { status: 400 }
      );
    }

    // fullPath is the complete path inside the bucket, e.g.:
    //   client-2/image.png
    //   ClientName-2/IMG/pic.jpg

    const { error } = await supabaseAdmin.storage.from(BUCKET).remove([fullPath]);

    if (error) {
      console.error("Supabase delete error:", error.message);
      return NextResponse.json(
        { success: false, error: error.message || "Blob not found or already deleted" },
        { status: 404 }
      );
    }

    // Audit log
    const fileName = fullPath.split("/").pop() || fullPath;
    logAudit({
      clientId: Number(clientId),
      action: AuditActions.DOCUMENT_DELETED,
      actorRole: "ADMIN",
      details: fileName,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete File Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
