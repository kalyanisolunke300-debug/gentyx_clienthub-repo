// /app/api/documents/get-by-client/route.ts
import { NextResponse } from "next/server";
import { BlobServiceClient } from "@azure/storage-blob";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("id");
    const folder = url.searchParams.get("folder"); // optional

    if (!clientId) {
      return NextResponse.json({ success: false, error: "Missing clientId" });
    }

    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING!;
    const blobServiceClient = BlobServiceClient.fromConnectionString(conn);
    const containerClient = blobServiceClient.getContainerClient(
      process.env.AZURE_STORAGE_CONTAINER_NAME!
    );

    // ROOT OR SUBFOLDER PREFIX
    const prefix = folder
      ? `client-${clientId}/${folder}/`
      : `client-${clientId}/`;

    const items: any[] = [];

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

      items.push({
        type: "file",
        name: fileName,
        url: containerClient.getBlobClient(blob.name).url,
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
