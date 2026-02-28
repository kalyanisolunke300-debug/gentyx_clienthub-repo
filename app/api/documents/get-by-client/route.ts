
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getClientRootFolder } from "@/lib/storage-utils";

export const dynamic = "force-dynamic";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "client_hub";

// These are the admin-managed section folders — clients should never see them directly
const SECTION_FOLDERS = [
  "Admin Only", "Client Only", "Shared",
  "Admin Restricted", "Client Uploaded", "Legacy Uploaded",
];

/** Generate a signed URL (1 hour) for a given blob path */
async function getSignedUrl(blobPath: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(blobPath, 60 * 60);
  if (error || !data) throw new Error(`Signed URL error: ${error?.message}`);
  return data.signedUrl;
}

/** Recursively list all files/folders under a prefix */
async function listItems(prefix: string) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw new Error(`List error: ${error.message}`);
  return data ?? [];
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("id");
    const folder = url.searchParams.get("folder");
    const rawRole = url.searchParams.get("role");
    const role = (rawRole || "ADMIN").toUpperCase();

    console.log(`[DOCS] Fetching for Client: ${clientId}, Role: ${role}`);

    if (!clientId) {
      return NextResponse.json({ success: false, error: "Missing clientId" });
    }

    const rootFolder = await getClientRootFolder(clientId);

    // ─── CLIENT ROLE ───
    if (role === "CLIENT") {
      return await handleClientView(rootFolder, folder);
    }

    // ─── ADMIN ROLE: Normal listing ───
    const prefix = folder ? `${rootFolder}/${folder}` : rootFolder;
    const raw = await listItems(prefix);

    const items: any[] = [];
    const expiresIn = 60 * 60; // 1 hour

    for (const item of raw) {
      if (item.id === null) {
        // It's a folder (virtual directory)
        if (item.name && item.name !== ".keep") {
          items.push({ type: "folder", name: item.name });
        }
        continue;
      }

      if (!item.name || item.name === ".keep") continue;

      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      const { data: signedData } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(fullPath, expiresIn);

      items.push({
        type: "file",
        name: item.name,
        url: signedData?.signedUrl || null,
        size: item.metadata?.size ?? 0,
        fullPath,
        visibility: "shared", // Supabase Storage doesn't have per-object metadata; default shared
        uploadedBy: "unknown",
      });
    }

    return NextResponse.json({ success: true, data: items });
  } catch (err: any) {
    console.error("LIST ERROR:", err);
    return NextResponse.json({ success: false, error: err.message });
  }
}

/* ═══════════════════════════════════════════════════════════════ */
/*                    CLIENT VIEW HELPER                          */
/* ═══════════════════════════════════════════════════════════════ */
async function handleClientView(rootFolder: string, folder: string | null) {
  const items: any[] = [];
  const expiresIn = 60 * 60;

  const clientVisibleSections = [
    "Legacy Uploaded", "Client Uploaded", "Shared", "Client Only",
  ];

  if (!folder) {
    // ROOT VIEW: merge contents of visible sections
    for (const section of clientVisibleSections) {
      const sectionPrefix = `${rootFolder}/${section}`;
      const raw = await listItems(sectionPrefix);

      for (const item of raw) {
        if (item.name === ".keep") continue;

        if (item.id === null) {
          // folder
          const exists = items.find((i) => i.type === "folder" && i.name === item.name);
          if (!exists && item.name) {
            items.push({ type: "folder", name: item.name, _section: section });
          }
          continue;
        }

        const fullPath = `${sectionPrefix}/${item.name}`;
        const { data: signedData } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(fullPath, expiresIn);

        items.push({
          type: "file",
          name: item.name,
          url: signedData?.signedUrl || null,
          size: item.metadata?.size ?? 0,
          fullPath,
          visibility: "shared",
          uploadedBy: "unknown",
          _section: section,
        });
      }
    }

    // Also list legacy items at root (not inside section folders)
    const rootRaw = await listItems(rootFolder);
    for (const item of rootRaw) {
      if (!item.name || item.name === ".keep") continue;
      if (SECTION_FOLDERS.includes(item.name)) continue;

      if (item.id === null) {
        const exists = items.find((i) => i.type === "folder" && i.name === item.name);
        if (!exists) items.push({ type: "folder", name: item.name, _section: "legacy" });
        continue;
      }

      const exists = items.find((i) => i.type === "file" && i.name === item.name);
      if (exists) continue;

      const fullPath = `${rootFolder}/${item.name}`;
      const { data: signedData } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(fullPath, expiresIn);

      items.push({
        type: "file",
        name: item.name,
        url: signedData?.signedUrl || null,
        size: item.metadata?.size ?? 0,
        fullPath,
        visibility: "shared",
        uploadedBy: "unknown",
        _section: "legacy",
      });
    }
  } else {
    // SUBFOLDER VIEW: search across sections
    const searchPrefixes = [
      `${rootFolder}/Client Uploaded/${folder}`,
      `${rootFolder}/Legacy Uploaded/${folder}`,
      `${rootFolder}/Client Only/${folder}`,
      `${rootFolder}/Shared/${folder}`,
      `${rootFolder}/${folder}`,
    ];

    for (const tryPrefix of searchPrefixes) {
      const raw = await listItems(tryPrefix);
      if (!raw.length) continue;

      for (const item of raw) {
        if (!item.name || item.name === ".keep") continue;

        if (item.id === null) {
          const exists = items.find((i) => i.type === "folder" && i.name === item.name);
          if (!exists) items.push({ type: "folder", name: item.name });
          continue;
        }

        const exists = items.find((i) => i.type === "file" && i.name === item.name);
        if (exists) continue;

        const fullPath = `${tryPrefix}/${item.name}`;
        const { data: signedData } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(fullPath, expiresIn);

        items.push({
          type: "file",
          name: item.name,
          url: signedData?.signedUrl || null,
          size: item.metadata?.size ?? 0,
          fullPath,
          visibility: "shared",
          uploadedBy: "unknown",
        });
      }

      break; // Stop at first prefix that had items
    }
  }

  console.log(`[DOCS CLIENT] Returning ${items.length} items for client view`);
  return NextResponse.json({ success: true, data: items });
}
