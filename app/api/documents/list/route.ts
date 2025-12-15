// app/api/documents/list/route.ts
import { NextResponse } from "next/server";
import { containerClient } from "@/lib/azure";

export async function GET() {
  try {
    const documents: any[] = [];

    // 1️⃣ List top-level folders (client-1, client-2, etc.)
    for await (const item of containerClient.listBlobsByHierarchy("/")) {
      if (item.kind === "prefix" && item.name.startsWith("client-")) {
        const clientFolder = item.name; // "client-1/"
        const clientId = parseInt(clientFolder.replace("client-", "").replace("/", ""));

        // 2️⃣ List PDF/ IMG/ folders under each client
        for await (const docType of containerClient.listBlobsByHierarchy("/", { prefix: clientFolder })) {
          if (docType.kind === "prefix") {
            const typeFolder = docType.name.split("/")[1]; // "PDF" | "IMG"
            const fullPrefix = `${clientFolder}${typeFolder}/`;

            // 3️⃣ List actual files inside folder
            for await (const file of containerClient.listBlobsFlat({ prefix: fullPrefix })) {
              const fileName = file.name.split("/").pop(); // file only (not full path)

              documents.push({
                clientId,
                name: fileName,
                type: typeFolder.toUpperCase(),
                status: "Uploaded",
                path: `${clientFolder}${typeFolder}/${fileName}` // IMPORTANT: for SAS preview
              });
            }

          }
        }
      }
    }

    return NextResponse.json(documents);

  } catch (error: any) {
    console.error("DOCUMENT LIST ERROR:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
