// app/api/documents/get/route.ts
import { NextResponse } from "next/server";
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { getDbPool } from "@/lib/db";

export async function GET() {
  try {
    const account = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
    const key = process.env.AZURE_STORAGE_ACCOUNT_KEY!;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

    const sharedKeyCredential = new StorageSharedKeyCredential(account, key);
    const blobServiceClient = new BlobServiceClient(
      `https://${account}.blob.core.windows.net`,
      sharedKeyCredential
    );

    const containerClient =
      blobServiceClient.getContainerClient(containerName);

    const pool = await getDbPool();

    const docs: any[] = [];

    // Loop through all blobs
    for await (const blob of containerClient.listBlobsFlat()) {
      const path = blob.name; // e.g. "client-14/IMG/image.png"

      // Extract clientId using folder name
      const match = path.match(/client-(\d+)\//);
      const clientId = match ? Number(match[1]) : null;

      let client_name = "Unknown";

      // If we got a valid clientId, fetch client_name
      if (clientId) {
        const result = await pool
          .request()
          .input("clientId", clientId)
          .query(
            `SELECT client_name FROM clients WHERE client_id = @clientId`
          );

        if (result.recordset.length > 0) {
          client_name = result.recordset[0].client_name;
        }
      }

      // Determine file type
      const fileName = blob.name.split("/").pop()!;
      const type = fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "IMG";

      // Push into final array
      docs.push({
        clientId,
        client_name,
        path,
        name: fileName,
        type,
        status: "Uploaded",
      });
    }

    return NextResponse.json(docs);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
