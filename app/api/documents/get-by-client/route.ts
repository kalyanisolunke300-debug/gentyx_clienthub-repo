// app/api/documents/get-by-client/route.ts
import { NextResponse } from "next/server";
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  generateBlobSASQueryParameters
} from "@azure/storage-blob";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("id");

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "Client ID is required" },
        { status: 400 }
      );
    }

    const account = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
    const key = process.env.AZURE_STORAGE_ACCOUNT_KEY!;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

    const sharedKeyCredential = new StorageSharedKeyCredential(account, key);
    const blobServiceClient = new BlobServiceClient(
      `https://${account}.blob.core.windows.net`,
      sharedKeyCredential
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);

    const docs: any[] = [];

    for await (const blob of containerClient.listBlobsFlat({ prefix: `client-${clientId}/` })) {
      const fileName = blob.name.split("/").pop()!;
      const type = fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "IMG";

      // Generate SAS URL
      const sasToken = generateBlobSASQueryParameters(
        {
          containerName,
          blobName: blob.name,
          permissions: BlobSASPermissions.parse("r"),
          expiresOn: new Date(Date.now() + 10 * 60 * 1000), // 10m
        },
        sharedKeyCredential
      ).toString();

      const sasUrl = `https://${account}.blob.core.windows.net/${containerName}/${blob.name}?${sasToken}`;

      docs.push({
        name: fileName,
        path: blob.name,
        size: blob.properties.contentLength,
        type,
        url: sasUrl,
      });
    }

    return NextResponse.json({ success: true, data: docs });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
