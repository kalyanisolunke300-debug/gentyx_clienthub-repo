// /api/documents/public-url/route.ts
// Replaced Azure SAS URL generation with Supabase Storage signed URL.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getClientRootFolder } from "@/lib/storage-utils";

export const dynamic = "force-dynamic";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "client_hub";

const CONTENT_TYPE_MAP: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    csv: "text/csv",
    txt: "text/plain",
    json: "application/json",
};

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const clientId = searchParams.get("clientId");
        const fullPathRaw = searchParams.get("fullPath");

        if (!clientId || !fullPathRaw) {
            return NextResponse.json(
                { success: false, error: "Missing clientId or fullPath" },
                { status: 400 }
            );
        }

        const fullPath = decodeURIComponent(fullPathRaw).replace(/^\/+/, "");
        const rootFolder = await getClientRootFolder(clientId);

        // Normalize the blob path — add root folder prefix only if missing
        let blobName = fullPath;
        const hasAnyPrefix =
            blobName.startsWith(`${rootFolder}/`) ||
            blobName.startsWith(`${clientId}/`) ||
            blobName.startsWith(`client-${clientId}/`);

        if (!hasAnyPrefix) {
            blobName = `${rootFolder}/${blobName}`;
        }

        console.log(`[PUBLIC-URL] clientId=${clientId}, rootFolder="${rootFolder}", blobName="${blobName}"`);

        // Generate a signed URL valid for 30 minutes (Supabase equivalent of the old SAS)
        const { data, error } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(blobName, 30 * 60, {
                download: false, // inline viewing
            });

        if (error || !data) {
            return NextResponse.json(
                { success: false, error: error?.message || "Failed to generate URL" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, url: data.signedUrl });
    } catch (e: any) {
        return NextResponse.json(
            { success: false, error: e?.message || "Failed to generate signed URL" },
            { status: 500 }
        );
    }
}
