// // app/api/documents/list/route.ts
// import { NextResponse } from "next/server";
// import { containerClient } from "@/lib/azure";

// export async function GET() {
//   try {
//     const documents: any[] = [];

//     // 1️⃣ List top-level folders (client-1, client-2, etc.)
//     for await (const item of containerClient.listBlobsByHierarchy("/")) {
//       if (item.kind === "prefix" && item.name.startsWith("client-")) {
//         const clientFolder = item.name; // "client-1/"
//         const clientId = parseInt(clientFolder.replace("client-", "").replace("/", ""));

//         // 2️⃣ List PDF/ IMG/ folders under each client
//         for await (const docType of containerClient.listBlobsByHierarchy("/", { prefix: clientFolder })) {
//           if (docType.kind === "prefix") {
//             const typeFolder = docType.name.split("/")[1]; // "PDF" | "IMG"
//             const fullPrefix = `${clientFolder}${typeFolder}/`;

//             // 3️⃣ List actual files inside folder
//             for await (const file of containerClient.listBlobsFlat({ prefix: fullPrefix })) {
//               const fileName = file.name.split("/").pop(); // file only (not full path)

//               documents.push({
//                 clientId,
//                 name: fileName,
//                 type: typeFolder.toUpperCase(),
//                 status: "Uploaded",
//                 path: `${clientFolder}${typeFolder}/${fileName}` // IMPORTANT: for SAS preview
//               });
//             }

//           }
//         }
//       }
//     }

//     return NextResponse.json(documents);

//   } catch (error: any) {
//     console.error("DOCUMENT LIST ERROR:", error);
//     return NextResponse.json(
//       { success: false, error: error.message },
//       { status: 500 }
//     );
//   }
// }

import { NextResponse } from "next/server";
import { containerClient } from "@/lib/azure";

export const dynamic = "force-dynamic";

function cleanFolderPath(folderPath: string | null) {
  if (!folderPath) return "";
  let p = folderPath.trim();

  // remove leading slashes
  p = p.replace(/^\/+/, "");

  // remove trailing slashes
  p = p.replace(/\/+$/, "");

  return p;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // ✅ Accept both styles: ?clientId= or ?id=
    const clientIdParam = searchParams.get("clientId") || searchParams.get("id");

    // ✅ Accept both styles: ?folderPath= or ?folder=
    const folderParam =
      searchParams.get("folderPath") ||
      searchParams.get("folder") ||
      searchParams.get("path");

    // ✅ If old code hits /list without params → don't throw error, return empty
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

    // ✅ Prefix = "client-123/" or "client-123/Demo/"
    const prefix = folderPath
      ? `client-${clientId}/${folderPath}/`
      : `client-${clientId}/`;

    const items: any[] = [];
    const seenFiles = new Set<string>();

    // ✅ Return folders + files directly under prefix
    // Include metadata for visibility check
    for await (const entry of containerClient.listBlobsByHierarchy("/", {
      prefix
    })) {
      if (entry.kind === "prefix") {
        // Folder
        const raw = entry.name.slice(prefix.length); // e.g. "Demo 2/"
        const name = raw.replace(/\/$/, "");
        if (!name) continue;

        items.push({
          clientId,
          name,
          type: "folder",
          path: `${prefix}${name}/`,
        });
      } else {
        // File directly under prefix
        const fileName = entry.name.split("/").pop() || entry.name;
        if (!fileName) continue;

        // ✅ Hide .keep
        if (fileName === ".keep") continue;

        // ------------------------------------------------------------
        // ✅ VISIBILITY FILTER (MATCHING get-by-client logic)
        // ------------------------------------------------------------
        let meta = entry.metadata;
        if (!meta) {
          try {
            // Fallback if metadata missing from list
            const props = await containerClient.getBlobClient(entry.name).getProperties();
            meta = props.metadata;
          } catch (e) { }
        }

        const metaLower = meta ? Object.fromEntries(Object.entries(meta).map(([k, v]) => [k.toLowerCase(), v])) : {};
        const visibility = (metaLower.visibility || "shared").toLowerCase();

        // Default role is ADMIN if not specified
        const role = (searchParams.get("role") || "ADMIN").toUpperCase();

        if (role === "ADMIN" && visibility === "private") {
          continue; // HIDE PRIVATE FILES FROM ADMIN
        }
        // ------------------------------------------------------------

        const key = `${prefix}${fileName}`;
        if (seenFiles.has(key)) continue;
        seenFiles.add(key);

        items.push({
          clientId,
          name: fileName,
          type: "file",
          path: entry.name,
          size: entry.properties?.contentLength ?? 0,
          contentType: entry.properties?.contentType ?? null,
          lastModified: entry.properties?.lastModified ?? null,
          visibility: visibility, // ✅ Return visibility just in case
        });
      }
    }

    // ✅ IMPORTANT: return both `data` and `items` for compatibility
    return NextResponse.json({
      success: true,
      prefix,
      data: items,
      items,
    });
  } catch (error: any) {
    console.error("DOCUMENT LIST ERROR:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

