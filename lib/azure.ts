// // // /lib/azure.ts
// // import { BlobServiceClient } from "@azure/storage-blob";

// // const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
// // const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

// // // Create BlobServiceClient
// // export const blobService = BlobServiceClient.fromConnectionString(connectionString);

// // // Get Container Client
// // export const containerClient = blobService.getContainerClient(containerName);


// // /lib/azure.ts
// import { BlobServiceClient } from "@azure/storage-blob";
// import { v4 as uuid } from "uuid";

// const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
// const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

// // Create BlobServiceClient
// export const blobService = BlobServiceClient.fromConnectionString(connectionString);

// // Get Container Client
// export const containerClient = blobService.getContainerClient(containerName);

// /**
//  * Upload a file buffer to Azure Blob Storage
//  */
// export async function uploadToAzure(buffer: Buffer, originalName: string) {
//   const extension = originalName.split(".").pop();
//   const blobName = `${uuid()}.${extension}`;

//   const blockBlobClient = containerClient.getBlockBlobClient(blobName);

//   await blockBlobClient.uploadData(buffer, {
//     blobHTTPHeaders: {
//       blobContentType: extension,
//     },
//   });

//   return {
//     blobName,
//     url: blockBlobClient.url,
//   };
// }


// /lib/azure.ts
import { BlobServiceClient } from "@azure/storage-blob";
import { v4 as uuid } from "uuid";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

// Create BlobServiceClient
export const blobService = BlobServiceClient.fromConnectionString(connectionString);

// Get Container Client
export const containerClient = blobService.getContainerClient(containerName);

/**
 * Upload a file buffer to Azure Blob Storage
 */
export async function uploadToAzure(buffer: Buffer, originalName: string) {
  const extension = originalName.split(".").pop();
  const blobName = `${uuid()}.${extension}`;

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: extension,
    },
  });

  return {
    blobName,
    url: blockBlobClient.url,
  };
}

/**
 * Delete a file from Azure Blob Storage
 * Given a path like: client-26/IMG/image.png
 */
export async function deleteBlob(blobPath: string) {
  const blobClient = containerClient.getBlockBlobClient(blobPath);
  await blobClient.deleteIfExists();
}


