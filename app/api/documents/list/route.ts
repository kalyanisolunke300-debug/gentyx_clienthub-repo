
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getClientRootFolder } from "@/lib/storage-utils";

export const dynamic = "force-dynamic";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "client_hub";

function cleanFolderPath(folderPath: string | null) {
  if (!folderPath) return "";
  return folderPath.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const clientIdParam = searchParams.get("clientId") || searchParams.get("id");
    const folderParam =
      searchParams.get("folderPath") ||
      searchParams.get("folder") ||
      searchParams.get("path");

    if (!clientIdParam) {
      return NextResponse.json({ success: true, prefix: "", data: [], items: [] });
    }

    const clientId = Number(clientIdParam);
    if (!Number.isFinite(clientId)) {
      return NextResponse.json(
        { success: false, error: "clientId must be a number" },
        { status: 400 }
      );
    }

    const folderPath = cleanFolderPath(folderParam);
    const rootFolder = await getClientRootFolder(clientId);
    const prefix = folderPath ? `${rootFolder}/${folderPath}` : rootFolder;

    console.log(`[DOCS LIST] Client: ${clientId}, Root: "${rootFolder}", Prefix: "${prefix}"`);

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });

    if (error) throw new Error(error.message);

    const role = (searchParams.get("role") || "ADMIN").toUpperCase();
    const items: any[] = [];
    const seenFiles = new Set<string>();

    for (const entry of data ?? []) {
      if (!entry.name) continue;

      if (entry.id === null) {
        // Folder
        items.push({
          clientId,
          name: entry.name,
          type: "folder",
          path: `${prefix}/${entry.name}/`,
        });
      } else {
        // File
        if (entry.name === ".keep") continue;
        const key = `${prefix}/${entry.name}`;
        if (seenFiles.has(key)) continue;
        seenFiles.add(key);

        // Supabase Storage doesn't carry per-object metadata natively in list response;
        // default visibility to "shared" (same as the upload route)
        const visibility = "shared";

        items.push({
          clientId,
          name: entry.name,
          type: "file",
          path: key,
          size: entry.metadata?.size ?? 0,
          contentType: entry.metadata?.mimetype ?? null,
          lastModified: entry.updated_at ?? null,
          visibility,
          uploadedBy: "unknown",
        });
      }
    }

    console.log(`[DOCS LIST] Found ${items.length} items`);
    return NextResponse.json({ success: true, prefix, data: items, items });
  } catch (error: any) {
    console.error("DOCUMENT LIST ERROR:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
