// /app/api/documents/get-by-client/route.ts
import { NextResponse } from "next/server";
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from "@azure/storage-blob";

export const dynamic = "force-dynamic";

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

    const account = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
    const key = process.env.AZURE_STORAGE_ACCOUNT_KEY!;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

    // Create clients with shared key credential for SAS generation
    const sharedKeyCredential = new StorageSharedKeyCredential(account, key);
    const blobServiceClient = new BlobServiceClient(
      `https://${account}.blob.core.windows.net`,
      sharedKeyCredential
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // ROOT OR SUBFOLDER PREFIX
    const prefix = folder
      ? `client-${clientId}/${folder}/`
      : `client-${clientId}/`;

    const items: any[] = [];

    // SAS expiry = 1 hour (for preview)
    const expiresOn = new Date(Date.now() + 60 * 60 * 1000);

    // HIERARCHY LISTING → RETURNS FOLDERS + FILES
    // ✅ Include metadata in the listing itself to avoid N+1 calls
    for await (const blob of containerClient.listBlobsByHierarchy("/", {
      prefix,
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
      // Robustly handle metadata: list inclusion might fail or use different casing
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
      // - ADMIN can only see "shared" documents
      // - CLIENT can see all documents (both "shared" and "private")
      if (role === "ADMIN" && visibility === "private") {
        console.log(`[DOCS] SKIPPING Private file for ADMIN: ${fileName}`);
        continue; // Skip private documents for admin
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

