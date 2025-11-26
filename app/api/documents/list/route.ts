// app/api/documents/list/route.ts
import { NextResponse } from "next/server";
import { BlobServiceClient, BlobSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } from "@azure/storage-blob";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId is required" },
        { status: 400 }
      );
    }

    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY!;
    const containerName = "clienthub";

    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );

    const containerClient = blobServiceClient.getContainerClient(containerName);

    const prefix = `client-${clientId}/`;

    const result: any[] = [];

    for await (const item of containerClient.listBlobsFlat({ prefix })) {
      const blobClient = containerClient.getBlobClient(item.name);

      // Generate SAS token valid for 1 hour
      const sas = generateBlobSASQueryParameters(
        {
          containerName,
          blobName: item.name,
          permissions: BlobSASPermissions.from({ read: true }), // Read only
          startsOn: new Date(new Date().valueOf() - 1000 * 60),
          expiresOn: new Date(new Date().valueOf() + 1000 * 60 * 60), // 1 hour
        },
        sharedKeyCredential
      ).toString();

      const sasUrl = `${blobClient.url}?${sas}`;

      result.push({
        name: item.name.split("/").pop(),
        path: item.name,
        type: item.properties.contentType || "Unknown",
        size: item.properties.contentLength || 0,
        url: sasUrl,
      });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
