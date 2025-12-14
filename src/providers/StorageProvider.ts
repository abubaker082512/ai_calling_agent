/**
 * Storage Provider Interface
 * Abstract interface for object storage (S3-compatible)
 * Supports AWS S3, Supabase Storage, MinIO, etc.
 */

export interface StorageConfig {
    bucket: string;
    region?: string;
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
}

export interface UploadOptions {
    contentType?: string;
    metadata?: Record<string, string>;
    cacheControl?: string;
    acl?: 'private' | 'public-read';
}

export interface DownloadOptions {
    range?: string;
}

export interface StorageObject {
    key: string;
    size: number;
    lastModified: Date;
    contentType?: string;
    metadata?: Record<string, string>;
}

/**
 * Abstract Storage Provider
 */
export abstract class StorageProvider {
    protected config: StorageConfig;

    constructor(config: StorageConfig) {
        this.config = config;
    }

    /**
     * Upload file
     */
    abstract upload(key: string, data: Buffer, options?: UploadOptions): Promise<string>;

    /**
     * Download file
     */
    abstract download(key: string, options?: DownloadOptions): Promise<Buffer>;

    /**
     * Delete file
     */
    abstract delete(key: string): Promise<void>;

    /**
     * Check if file exists
     */
    abstract exists(key: string): Promise<boolean>;

    /**
     * Get signed URL for temporary access
     */
    abstract getSignedUrl(key: string, expiresIn?: number): Promise<string>;

    /**
     * List files with prefix
     */
    abstract list(prefix?: string, maxKeys?: number): Promise<StorageObject[]>;

    /**
     * Get file metadata
     */
    abstract getMetadata(key: string): Promise<StorageObject>;

    /**
     * Get provider name
     */
    abstract getProviderName(): string;

    /**
     * Health check
     */
    abstract healthCheck(): Promise<boolean>;
}
