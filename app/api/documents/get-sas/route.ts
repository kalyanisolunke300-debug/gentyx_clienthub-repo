// app/api/documents/get-sas/route.ts
import { NextResponse } from "next/server";
import {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
  StorageSharedKeyCredential
} from "@azure/storage-blob";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path"); // full blob path
    if (!path) {
      return NextResponse.json(
        { success: false, error: "Missing path" },
        { status: 400 }
      );
    }

    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY!;
    const containerName = "clienthub";

    const sharedKey = new StorageSharedKeyCredential(accountName, accountKey);

    const sas = generateBlobSASQueryParameters(
      {
        containerName,
        blobName: path,
        permissions: BlobSASPermissions.parse("r"), // read only
        protocol: SASProtocol.Https,
        expiresOn: new Date(Date.now() + 15 * 60 * 1000) // 15 min
      },
      sharedKey
    ).toString();

    const sasUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${path}?${sas}`;

    return NextResponse.json({
      success: true,
      sasUrl
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
