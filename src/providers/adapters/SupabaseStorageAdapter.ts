/**
 * Supabase Storage Adapter
 * Implementation of StorageProvider for Supabase Storage (S3-compatible)
 */

import { StorageProvider, StorageConfig, UploadOptions, DownloadOptions, StorageObject } from '../StorageProvider';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseStorageAdapter extends StorageProvider {
    private supabase: SupabaseClient;

    constructor(config: StorageConfig) {
        super(config);

        const supabaseUrl = process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_KEY || '';

        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    async upload(key: string, data: Buffer, options?: UploadOptions): Promise<string> {
        try {
            const { data: uploadData, error } = await this.supabase.storage
                .from(this.config.bucket)
                .upload(key, data, {
                    contentType: options?.contentType || 'application/octet-stream',
                    cacheControl: options?.cacheControl || '3600',
                    upsert: true
                });

            if (error) {
                throw error;
            }

            // Get public URL
            const { data: { publicUrl } } = this.supabase.storage
                .from(this.config.bucket)
                .getPublicUrl(key);

            return publicUrl;
        } catch (error: any) {
            console.error('Supabase upload error:', error);
            throw new Error(`Upload failed: ${error.message}`);
        }
    }

    async download(key: string, options?: DownloadOptions): Promise<Buffer> {
        try {
            const { data, error } = await this.supabase.storage
                .from(this.config.bucket)
                .download(key);

            if (error) {
                throw error;
            }

            if (!data) {
                throw new Error('No data returned');
            }

            return Buffer.from(await data.arrayBuffer());
        } catch (error: any) {
            console.error('Supabase download error:', error);
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    async delete(key: string): Promise<void> {
        try {
            const { error } = await this.supabase.storage
                .from(this.config.bucket)
                .remove([key]);

            if (error) {
                throw error;
            }
        } catch (error: any) {
            console.error('Supabase delete error:', error);
            throw new Error(`Delete failed: ${error.message}`);
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            const { data, error } = await this.supabase.storage
                .from(this.config.bucket)
                .list(key.split('/').slice(0, -1).join('/'), {
                    search: key.split('/').pop()
                });

            if (error) {
                return false;
            }

            return data && data.length > 0;
        } catch (error) {
            return false;
        }
    }

    async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
        try {
            const { data, error } = await this.supabase.storage
                .from(this.config.bucket)
                .createSignedUrl(key, expiresIn);

            if (error) {
                throw error;
            }

            return data.signedUrl;
        } catch (error: any) {
            console.error('Supabase signed URL error:', error);
            throw new Error(`Signed URL failed: ${error.message}`);
        }
    }

    async list(prefix?: string, maxKeys: number = 1000): Promise<StorageObject[]> {
        try {
            const { data, error } = await this.supabase.storage
                .from(this.config.bucket)
                .list(prefix, {
                    limit: maxKeys,
                    sortBy: { column: 'created_at', order: 'desc' }
                });

            if (error) {
                throw error;
            }

            return data.map(item => ({
                key: prefix ? `${prefix}/${item.name}` : item.name,
                size: item.metadata?.size || 0,
                lastModified: new Date(item.created_at),
                contentType: item.metadata?.mimetype
            }));
        } catch (error: any) {
            console.error('Supabase list error:', error);
            throw new Error(`List failed: ${error.message}`);
        }
    }

    async getMetadata(key: string): Promise<StorageObject> {
        try {
            // Supabase doesn't have a direct metadata endpoint
            // We'll use list with search
            const parts = key.split('/');
            const fileName = parts.pop();
            const prefix = parts.join('/');

            const { data, error } = await this.supabase.storage
                .from(this.config.bucket)
                .list(prefix, {
                    search: fileName
                });

            if (error || !data || data.length === 0) {
                throw new Error('File not found');
            }

            const file = data[0];
            return {
                key,
                size: file.metadata?.size || 0,
                lastModified: new Date(file.created_at),
                contentType: file.metadata?.mimetype
            };
        } catch (error: any) {
            console.error('Supabase metadata error:', error);
            throw new Error(`Get metadata failed: ${error.message}`);
        }
    }

    getProviderName(): string {
        return 'Supabase Storage';
    }

    async healthCheck(): Promise<boolean> {
        try {
            const { data, error } = await this.supabase.storage.listBuckets();
            return !error && !!data;
        } catch (error) {
            return false;
        }
    }
}
