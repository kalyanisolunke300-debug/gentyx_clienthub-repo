import { NextResponse } from "next/server";
import { BlobServiceClient } from "@azure/storage-blob";
import { logAudit, AuditActions } from "@/lib/audit";
import { queueFolderCreatedNotification } from "@/lib/notification-batcher";
import { getDbPool } from "@/lib/db";
import sql from "mssql";
import { getClientRootFolder } from "@/lib/storage-utils";

export async function POST(req: Request) {
  try {
    const { clientId, folderName, parentFolder, role = "ADMIN" } = await req.json();

    if (!clientId || !folderName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING!;
    const blobServiceClient = BlobServiceClient.fromConnectionString(conn);
    const containerClient = blobServiceClient.getContainerClient(
      process.env.AZURE_STORAGE_CONTAINER_NAME!
    );
    await containerClient.createIfNotExists();

    const rootFolder = await getClientRootFolder(clientId);

    // ✅ SUPPORT SUB-FOLDERS
    const finalFolderPath = parentFolder
      ? `${rootFolder}/${parentFolder}/${folderName}/`
      : `${rootFolder}/${folderName}/`;

    // ✅ CASE-INSENSITIVE DUPLICATE PROTECTION
    // List all folders at the parent level and check for case-insensitive matches
    const parentPath = parentFolder
      ? `${rootFolder}/${parentFolder}/`
      : `${rootFolder}/`;

    // If client folder doesn't exist yet, this list call returns empty, which is fine
    // But we need to ensure listBlobsByHierarchy treats "/" as delimiter correctly
    const existingFolders = containerClient.listBlobsByHierarchy("/", {
      prefix: parentPath,
    });

    const normalizedNewName = folderName.toLowerCase().trim();

    for await (const item of existingFolders) {
      // Check if this is a folder (virtual directory)
      if (item.kind === "prefix") {
        // Extract folder name from the prefix (remove parent path and trailing slash)
        const existingName = item.name
          .replace(parentPath, "")
          .replace(/\/$/, "");

        if (existingName.toLowerCase() === normalizedNewName) {
          return NextResponse.json(
            { success: false, error: `A folder named "${existingName}" already exists (case-insensitive match)` },
            { status: 409 }
          );
        }
      }
    }


    // ✅ REAL FOLDER CREATION
    // Create a .keep file to simulate a directory
    const blockBlobClient = containerClient.getBlockBlobClient(
      `${finalFolderPath}.keep`
    );

    // Upload empty file
    await blockBlobClient.upload("", 0);

    // Audit log
    logAudit({
      clientId: Number(clientId),
      action: AuditActions.FOLDER_CREATED,
      actorRole: role,
      details: folderName,
    });

    // Queue email notification to admin (batched - will wait 30s for more folder creations)
    (async () => {
      try {
        // Get client name
        const pool = await getDbPool();
        const clientResult = await pool.request()
          .input("clientId", sql.Int, Number(clientId))
          .query(`SELECT client_name FROM dbo.Clients WHERE client_id = @clientId`);

        const clientName = clientResult.recordset[0]?.client_name || `Client ${clientId}`;

        // Queue the notification (will batch multiple folder creations together)
        queueFolderCreatedNotification({
          clientId: Number(clientId),
          clientName: clientName,
          creatorName: role === 'ADMIN' ? 'Admin' : clientName,
          creatorRole: role as any,
          folderName: folderName,
          parentPath: parentFolder || undefined,
        });
      } catch (emailErr) {
        console.error("Failed to queue admin notification:", emailErr);
      }
    })();

    return NextResponse.json({
      success: true,
      message: "Folder created successfully",
      path: finalFolderPath,
    });
  } catch (err: any) {
    console.error("CREATE FOLDER ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
