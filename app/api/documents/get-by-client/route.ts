
import { NextResponse } from "next/server";
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from "@azure/storage-blob";
import { getClientRootFolder } from "@/lib/storage-utils";

export const dynamic = "force-dynamic";

// These are the admin-managed section folders — clients should never see them directly
const SECTION_FOLDERS = [
  "Admin Only", "Client Only", "Shared",
  "Admin Restricted", "Client Uploaded", "Legacy Uploaded"
];

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("id");
    const folder = url.searchParams.get("folder"); // optional
    const rawRole = url.searchParams.get("role");
    const role = (rawRole || "ADMIN").toUpperCase(); // Normalize to ADMIN

    console.log(`[DOCS] Fetching for Client: ${clientId}, Role: ${role} (Raw: ${rawRole})`);

    if (!clientId) {
      return NextResponse.json({ success: false, error: "Missing clientId" });
    }

    const account = process.env.AZURE_STORAGE_ACCOUNT_NAME!;;
    const key = process.env.AZURE_STORAGE_ACCOUNT_KEY!;;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;;

    // Create clients with shared key credential for SAS generation
    const sharedKeyCredential = new StorageSharedKeyCredential(account, key);
    const blobServiceClient = new BlobServiceClient(
      `https://${account}.blob.core.windows.net`,
      sharedKeyCredential
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // ROOT OR SUBFOLDER PREFIX
    const rootFolder = await getClientRootFolder(clientId);

    // ─── CLIENT ROLE: TRANSPARENT SECTION HANDLING ───
    // Clients should NOT see the section folders.
    // When at root: merge contents of "Shared/" and "Client Only/" sections
    // When navigating: auto-prefix with the section folder
    if (role === "CLIENT") {
      return await handleClientView(
        containerClient,
        sharedKeyCredential,
        containerName,
        rootFolder,
        folder
      );
    }

    // ─── ADMIN ROLE: Normal listing ───
    const prefix = folder
      ? `${rootFolder}/${folder}/`
      : `${rootFolder}/`;

    const items: any[] = [];

    // SAS expiry = 1 hour (for preview)
    const expiresOn = new Date(Date.now() + 60 * 60 * 1000);

    // HIERARCHY LISTING → RETURNS FOLDERS + FILES
    // ✅ Include metadata in the listing itself to avoid N+1 calls
    for await (const blob of containerClient.listBlobsByHierarchy("/", {
      prefix,
      includeMetadata: true
    })) {

      // -------------- FOLDER --------------
      if (blob.kind === "prefix") {
        const folderName = blob.name
          .replace(prefix, "")
          .replace("/", "");

        if (folderName.length > 0) {
          items.push({
            type: "folder",
            name: folderName,
          });
        }

        continue;
      }

      // -------------- FILE --------------
      const fileName = blob.name.replace(prefix, "");

      if (!fileName || fileName === ".keep") continue;

      // Get visibility from metadata directly
      let meta = blob.metadata;
      if (!meta) {
        try {
          const props = await containerClient.getBlobClient(blob.name).getProperties();
          meta = props.metadata;
        } catch (e) {
          // ignore error
        }
      }

      // Normalize metadata keys to lowercase for safe lookup
      const metaLower = meta ? Object.fromEntries(Object.entries(meta).map(([k, v]) => [k.toLowerCase(), v])) : {};
      const visibility = (metaLower.visibility || "shared").toLowerCase();

      // DEBUG LOG
      console.log(`[DOCS] File: ${fileName}, Vis: ${visibility}, Role: ${role}`);

      // Filter based on role:
      // - ADMIN sees ALL (shared + private)
      // - CLIENT sees ONLY shared
      if (role !== "ADMIN" && visibility === "private") {
        console.log(`[DOCS] SKIPPING Private file for CLIENT: ${fileName}`);
        continue; // Hide private documents from clients
      }

      // Generate SAS URL for the file
      const blobClient = containerClient.getBlobClient(blob.name);

      const sas = generateBlobSASQueryParameters(
        {
          containerName,
          blobName: blob.name,
          permissions: BlobSASPermissions.parse("r"),
          expiresOn,
        },
        sharedKeyCredential
      ).toString();

      const sasUrl = `${blobClient.url}?${sas}`;

      items.push({
        type: "file",
        name: fileName,
        url: sasUrl, // ✅ SAS URL instead of direct URL
        size: blob.properties.contentLength ?? 0,
        fullPath: blob.name, // ✅ REQUIRED FOR DELETE API
        visibility: visibility, // ✅ Include visibility in response
        uploadedBy: metaLower.uploadedby || "unknown",
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
/*  Merges "Shared/" + "Client Only/" contents into a flat view   */
/*  Clients NEVER see "Admin Only" or the section folders         */
/* ═══════════════════════════════════════════════════════════════ */
async function handleClientView(
  containerClient: ReturnType<BlobServiceClient["getContainerClient"]>,
  sharedKeyCredential: StorageSharedKeyCredential,
  containerName: string,
  rootFolder: string,
  folder: string | null
) {
  const expiresOn = new Date(Date.now() + 60 * 60 * 1000);
  const items: any[] = [];

  // Sections a client can see (Old + New)
  const clientVisibleSections = [
    "Legacy Uploaded", "Client Uploaded",
    "Shared", "Client Only"
  ];

  if (!folder) {
    // ─── ROOT VIEW: Merge top-level contents of Shared + Client Only ───
    for (const section of clientVisibleSections) {
      const sectionPrefix = `${rootFolder}/${section}/`;

      for await (const blob of containerClient.listBlobsByHierarchy("/", {
        prefix: sectionPrefix,
        includeMetadata: true,
      })) {
        // FOLDER
        if (blob.kind === "prefix") {
          const folderName = blob.name.replace(sectionPrefix, "").replace("/", "");
          if (folderName.length > 0 && folderName !== ".keep") {
            // Deduplicate if same folder name exists in both sections
            const exists = items.find((i) => i.type === "folder" && i.name === folderName);
            if (!exists) {
              items.push({
                type: "folder",
                name: folderName,
                // Track which section this folder came from for navigation
                _section: section,
              });
            }
          }
          continue;
        }

        // FILE
        const fileName = blob.name.replace(sectionPrefix, "");
        if (!fileName || fileName === ".keep") continue;

        let meta = blob.metadata;
        if (!meta) {
          try {
            const props = await containerClient.getBlobClient(blob.name).getProperties();
            meta = props.metadata;
          } catch (e) { /* ignore */ }
        }

        const metaLower = meta
          ? Object.fromEntries(Object.entries(meta).map(([k, v]) => [k.toLowerCase(), v]))
          : {};
        const visibility = (metaLower.visibility || "shared").toLowerCase();

        // Skip private files
        if (visibility === "private") continue;

        const blobClient = containerClient.getBlobClient(blob.name);
        const sas = generateBlobSASQueryParameters(
          {
            containerName,
            blobName: blob.name,
            permissions: BlobSASPermissions.parse("r"),
            expiresOn,
          },
          sharedKeyCredential
        ).toString();

        items.push({
          type: "file",
          name: fileName,
          url: `${blobClient.url}?${sas}`,
          size: blob.properties.contentLength ?? 0,
          fullPath: blob.name,
          visibility,
          uploadedBy: metaLower.uploadedby || "unknown",
          _section: section,
        });
      }
    }

    // Also list any legacy items at root (not inside section folders) for backward compatibility
    const rootPrefix = `${rootFolder}/`;
    for await (const blob of containerClient.listBlobsByHierarchy("/", {
      prefix: rootPrefix,
      includeMetadata: true,
    })) {
      if (blob.kind === "prefix") {
        const folderName = blob.name.replace(rootPrefix, "").replace("/", "");
        // Skip section folders and empty names
        if (!folderName || SECTION_FOLDERS.includes(folderName)) continue;
        const exists = items.find((i) => i.type === "folder" && i.name === folderName);
        if (!exists) {
          items.push({ type: "folder", name: folderName, _section: "legacy" });
        }
        continue;
      }

      const fileName = blob.name.replace(rootPrefix, "");
      if (!fileName || fileName === ".keep") continue;

      let meta = blob.metadata;
      if (!meta) {
        try {
          const props = await containerClient.getBlobClient(blob.name).getProperties();
          meta = props.metadata;
        } catch (e) { /* ignore */ }
      }

      const metaLower = meta
        ? Object.fromEntries(Object.entries(meta).map(([k, v]) => [k.toLowerCase(), v]))
        : {};
      const visibility = (metaLower.visibility || "shared").toLowerCase();
      if (visibility === "private") continue;

      // Deduplicate
      const exists = items.find((i) => i.type === "file" && i.name === fileName);
      if (exists) continue;

      const blobClient = containerClient.getBlobClient(blob.name);
      const sas = generateBlobSASQueryParameters(
        {
          containerName,
          blobName: blob.name,
          permissions: BlobSASPermissions.parse("r"),
          expiresOn,
        },
        sharedKeyCredential
      ).toString();

      items.push({
        type: "file",
        name: fileName,
        url: `${blobClient.url}?${sas}`,
        size: blob.properties.contentLength ?? 0,
        fullPath: blob.name,
        visibility,
        uploadedBy: metaLower.uploadedby || "unknown",
        _section: "legacy",
      });
    }

  } else {
    // ─── SUBFOLDER VIEW: Try to resolve folder inside Shared or Client Only ───
    // First try "Client Uploaded/{folder}", then "Legacy Uploaded/{folder}", then others
    const searchPrefixes = [
      `${rootFolder}/Client Uploaded/${folder}/`,
      `${rootFolder}/Legacy Uploaded/${folder}/`,
      `${rootFolder}/Client Only/${folder}/`, // Support old
      `${rootFolder}/Shared/${folder}/`,      // Support old
      `${rootFolder}/${folder}/`,             // Legacy fallback
    ];

    let foundInPrefix: string | null = null;

    for (const tryPrefix of searchPrefixes) {
      let hasItems = false;

      for await (const blob of containerClient.listBlobsByHierarchy("/", {
        prefix: tryPrefix,
        includeMetadata: true,
      })) {
        hasItems = true;

        if (blob.kind === "prefix") {
          const folderName = blob.name.replace(tryPrefix, "").replace("/", "");
          if (folderName.length > 0 && folderName !== ".keep") {
            const exists = items.find((i) => i.type === "folder" && i.name === folderName);
            if (!exists) {
              items.push({ type: "folder", name: folderName });
            }
          }
          continue;
        }

        const fileName = blob.name.replace(tryPrefix, "");
        if (!fileName || fileName === ".keep") continue;

        let meta = blob.metadata;
        if (!meta) {
          try {
            const props = await containerClient.getBlobClient(blob.name).getProperties();
            meta = props.metadata;
          } catch (e) { /* ignore */ }
        }

        const metaLower = meta
          ? Object.fromEntries(Object.entries(meta).map(([k, v]) => [k.toLowerCase(), v]))
          : {};
        const visibility = (metaLower.visibility || "shared").toLowerCase();
        if (visibility === "private") continue;

        const blobClient = containerClient.getBlobClient(blob.name);
        const sas = generateBlobSASQueryParameters(
          {
            containerName,
            blobName: blob.name,
            permissions: BlobSASPermissions.parse("r"),
            expiresOn,
          },
          sharedKeyCredential
        ).toString();

        const exists = items.find((i) => i.type === "file" && i.name === fileName);
        if (!exists) {
          items.push({
            type: "file",
            name: fileName,
            url: `${blobClient.url}?${sas}`,
            size: blob.properties.contentLength ?? 0,
            fullPath: blob.name,
            visibility,
            uploadedBy: metaLower.uploadedby || "unknown",
          });
        }
      }

      if (hasItems && !foundInPrefix) {
        foundInPrefix = tryPrefix;
      }
    }
  }

  console.log(`[DOCS CLIENT] Returning ${items.length} items for client view`);
  // Return items including _section
  return NextResponse.json({ success: true, data: items });
}
