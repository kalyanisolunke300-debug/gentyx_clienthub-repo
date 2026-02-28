// app/api/documents/exists/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "client_hub";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);

        const clientId = searchParams.get("clientId");
        const fullPath = searchParams.get("fullPath");

        if (!clientId || !fullPath) {
            return NextResponse.json(
                { success: false, error: "clientId and fullPath are required" },
                { status: 400 }
            );
        }

        // Normalize the path
        const normalized = fullPath.replace(/^\/+/, "");
        const blobPath = normalized.startsWith(`client-${clientId}/`)
            ? normalized
            : `client-${clientId}/${normalized}`;

        // Check existence via list() with the file name as the search term
        const folder = blobPath.includes("/")
            ? blobPath.slice(0, blobPath.lastIndexOf("/"))
            : "";
        const fileName = blobPath.split("/").pop() || blobPath;

        const { data, error } = await supabaseAdmin.storage
            .from(BUCKET)
            .list(folder, { search: fileName, limit: 1 });

        if (error) throw new Error(error.message);


        const exists = (data ?? []).some(
            (item: { name: string; id: string | null }) => item.name === fileName && item.id !== null
        );


        return NextResponse.json({ success: true, exists, blobPath });
    } catch (err: any) {
        console.error("EXISTS ERROR:", err);
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}
