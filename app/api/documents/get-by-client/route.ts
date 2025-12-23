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
    for await (const blob of containerClient.listBlobsByHierarchy("/", { prefix })) {

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
      });

    }

    return NextResponse.json({ success: true, data: items });
  } catch (err: any) {
    console.error("LIST ERROR:", err);
    return NextResponse.json({ success: false, error: err.message });
  }
}

