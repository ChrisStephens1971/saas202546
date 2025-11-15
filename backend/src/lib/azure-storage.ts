import { BlobServiceClient, ContainerClient } from '@azure/storage-blob'
import { config } from '@config'
import logger from '@config/logger'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'

let blobServiceClient: BlobServiceClient | null = null

/**
 * Initialize Azure Blob Storage client
 */
export function initializeBlobStorage(): void {
  if (!config.azureStorage.connectionString) {
    logger.warn('Azure Storage connection string not configured')
    return
  }

  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(
      config.azureStorage.connectionString
    )
    logger.info('Azure Blob Storage initialized')
  } catch (error: any) {
    logger.error('Failed to initialize Azure Blob Storage', { error: error.message })
  }
}

/**
 * Get container client for a specific container
 */
async function getContainerClient(containerName: string): Promise<ContainerClient> {
  if (!blobServiceClient) {
    throw new Error('Blob storage not initialized')
  }

  const containerClient = blobServiceClient.getContainerClient(containerName)

  // Create container if it doesn't exist
  await containerClient.createIfNotExists({
    access: 'blob', // Public read access for blobs
  })

  return containerClient
}

/**
 * Upload a file to Azure Blob Storage
 */
export async function uploadFile(
  containerName: string,
  fileBuffer: Buffer,
  originalFilename: string,
  contentType: string,
  tenantId: string
): Promise<{ url: string; blobName: string }> {
  try {
    const containerClient = await getContainerClient(containerName)

    // Generate unique blob name with tenant prefix
    const fileExtension = path.extname(originalFilename)
    const blobName = `${tenantId}/${uuidv4()}${fileExtension}`

    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    // Upload file
    await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
    })

    logger.info('File uploaded to Azure Blob Storage', {
      tenantId,
      blobName,
      containerName,
      size: fileBuffer.length,
    })

    return {
      url: blockBlobClient.url,
      blobName,
    }
  } catch (error: any) {
    logger.error('File upload to Azure failed', {
      error: error.message,
      containerName,
      originalFilename,
    })
    throw new Error('Failed to upload file to Azure Blob Storage')
  }
}

/**
 * Delete a file from Azure Blob Storage
 */
export async function deleteFile(
  containerName: string,
  blobName: string
): Promise<void> {
  try {
    const containerClient = await getContainerClient(containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    await blockBlobClient.deleteIfExists()

    logger.info('File deleted from Azure Blob Storage', {
      blobName,
      containerName,
    })
  } catch (error: any) {
    logger.error('File deletion from Azure failed', {
      error: error.message,
      containerName,
      blobName,
    })
    throw new Error('Failed to delete file from Azure Blob Storage')
  }
}

/**
 * Generate a SAS URL for temporary access to a blob
 */
export async function generateSasUrl(
  containerName: string,
  blobName: string,
  _expiresInMinutes: number = 60
): Promise<string> {
  try {
    const containerClient = await getContainerClient(containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    // For production, implement proper SAS token generation with expiresInMinutes
    // For now, return the blob URL (works if container has public access)
    return blockBlobClient.url
  } catch (error: any) {
    logger.error('Failed to generate SAS URL', {
      error: error.message,
      containerName,
      blobName,
    })
    throw new Error('Failed to generate SAS URL')
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(
  containerName: string,
  blobName: string
): Promise<{ size: number; contentType: string; url: string }> {
  try {
    const containerClient = await getContainerClient(containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    const properties = await blockBlobClient.getProperties()

    return {
      size: properties.contentLength || 0,
      contentType: properties.contentType || 'application/octet-stream',
      url: blockBlobClient.url,
    }
  } catch (error: any) {
    logger.error('Failed to get file metadata', {
      error: error.message,
      containerName,
      blobName,
    })
    throw new Error('Failed to get file metadata')
  }
}

/**
 * Validate file type
 */
export function validateFileType(
  contentType: string,
  allowedTypes: string[]
): boolean {
  return allowedTypes.some((type) => contentType.startsWith(type))
}

/**
 * Validate file size
 */
export function validateFileSize(size: number, maxSizeMB: number): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024
  return size <= maxSizeBytes
}
