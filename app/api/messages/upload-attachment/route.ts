// /app/api/messages/upload-attachment/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "client_hub";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();

        const clientId = formData.get("clientId") as string;
        const file = formData.get("file") as File;

        if (!clientId || !file) {
            return NextResponse.json(
                { success: false, error: "Client ID and file are required" },
                { status: 400 }
            );
        }

        if (file.name === ".keep") {
            return NextResponse.json(
                { success: false, error: "Invalid file name" },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${Date.now()}-${file.name}`; // Unique filename
        const blobPath = `client-${clientId}/messages/${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabaseAdmin.storage
            .from(BUCKET)
            .upload(blobPath, buffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) throw new Error(uploadError.message);

        // Generate a signed URL valid for 1 year
        const { data, error: signedError } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(blobPath, 60 * 60 * 24 * 365);

        if (signedError || !data) throw new Error(signedError?.message || "Signed URL failed");

        return NextResponse.json({
            success: true,
            attachmentUrl: data.signedUrl,
            attachmentName: file.name,
        });
    } catch (err: any) {
        console.error("MESSAGE ATTACHMENT UPLOAD ERROR:", err);
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}
