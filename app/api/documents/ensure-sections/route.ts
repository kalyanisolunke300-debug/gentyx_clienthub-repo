import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getClientRootFolder } from "@/lib/storage-utils";

export const dynamic = "force-dynamic";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "client_hub";

// The 3 physical section folders that live under each client root
export const SECTION_FOLDERS = ["Admin Restricted", "Legacy Uploaded", "Client Uploaded"] as const;

export async function POST(req: Request) {
    try {
        const { clientId } = await req.json();

        if (!clientId) {
            return NextResponse.json(
                { success: false, error: "clientId is required" },
                { status: 400 }
            );
        }

        const rootFolder = await getClientRootFolder(Number(clientId));
        const created: string[] = [];

        for (const section of SECTION_FOLDERS) {
            const keepPath = `${rootFolder}/${section}/.keep`;

            // Check if the .keep file already exists
            const folder = `${rootFolder}/${section}`;
            const { data } = await supabaseAdmin.storage
                .from(BUCKET)
                .list(folder, { search: ".keep", limit: 1 });

            const exists = (data ?? []).some((f: { name: string }) => f.name === ".keep");

            if (!exists) {
                await supabaseAdmin.storage
                    .from(BUCKET)
                    .upload(keepPath, new Uint8Array(0), {
                        contentType: "application/octet-stream",
                        upsert: false,
                    });
                created.push(section);
            }
        }

        console.log(
            `[ENSURE-SECTIONS] Client ${clientId}: Root="${rootFolder}", Created=[${created.join(", ")}]`
        );

        return NextResponse.json({
            success: true,
            rootFolder,
            sections: SECTION_FOLDERS,
            created,
        });
    } catch (error: any) {
        console.error("ENSURE SECTIONS ERROR:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
