// /lib/azure.ts
import { BlobServiceClient } from "@azure/storage-blob";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

// Create BlobServiceClient
export const blobService = BlobServiceClient.fromConnectionString(connectionString);

// Get Container Client
export const containerClient = blobService.getContainerClient(containerName);
