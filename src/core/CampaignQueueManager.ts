/**
 * Campaign Queue Manager
 * Redis-based queue for managing outbound calling campaigns
 * Supports priority queuing, retry logic, and concurrency control
 */

import Redis from 'ioredis';

export interface CampaignContact {
    id: string;
    campaignId: string;
    phone: string;
    name?: string;
    metadata?: Record<string, any>;
    attempts: number;
    maxAttempts: number;
    lastAttemptAt?: Date;
    status: 'pending' | 'calling' | 'completed' | 'failed';
}

export interface CampaignConfig {
    id: string;
    name: string;
    agentId: string;
    fromNumber: string;
    maxConcurrent: number;
    retryDelay: number; // seconds
    maxRetries: number;
}

export class CampaignQueueManager {
    private redis: Redis;
    private queuePrefix: string = 'campaign:queue:';
    private configPrefix: string = 'campaign:config:';
    private activePrefix: string = 'campaign:active:';

    constructor(redisUrl?: string) {
        this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');

        this.redis.on('connect', () => {
            console.log('✅ Campaign Queue Manager connected');
        });

        this.redis.on('error', (error) => {
            console.error('❌ Campaign Queue Manager error:', error);
        });
    }

    /**
     * Create a new campaign
     */
    public async createCampaign(config: CampaignConfig): Promise<void> {
        const configKey = this.configPrefix + config.id;
        await this.redis.set(configKey, JSON.stringify(config));
        console.log(`📋 Campaign created: ${config.id}`);
    }

    /**
     * Add contacts to campaign queue
     */
    public async addContacts(campaignId: string, contacts: CampaignContact[]): Promise<void> {
        const queueKey = this.queuePrefix + campaignId;

        for (const contact of contacts) {
            // Use priority score (timestamp for FIFO, can be customized)
            const score = Date.now();
            await this.redis.zadd(queueKey, score, JSON.stringify(contact));
        }

        console.log(`📞 Added ${contacts.length} contacts to campaign ${campaignId}`);
    }

    /**
     * Get next contact from queue
     */
    public async getNextContact(campaignId: string): Promise<CampaignContact | null> {
        const queueKey = this.queuePrefix + campaignId;
        const configKey = this.configPrefix + campaignId;

        // Get campaign config
        const configData = await this.redis.get(configKey);
        if (!configData) {
            return null;
        }

        const config: CampaignConfig = JSON.parse(configData);

        // Check concurrent limit
        const activeCount = await this.getActiveCount(campaignId);
        if (activeCount >= config.maxConcurrent) {
            return null;
        }

        // Get next contact from sorted set
        const results = await this.redis.zpopmin(queueKey, 1);
        if (!results || results.length === 0) {
            return null;
        }

        const contact: CampaignContact = JSON.parse(results[0]);

        // Mark as active
        await this.markActive(campaignId, contact);

        return contact;
    }

    /**
     * Mark contact as active (being called)
     */
    private async markActive(campaignId: string, contact: CampaignContact): Promise<void> {
        const activeKey = this.activePrefix + campaignId;
        await this.redis.hset(activeKey, contact.id, JSON.stringify(contact));
    }

    /**
     * Complete contact (success or failure)
     */
    public async completeContact(
        campaignId: string,
        contactId: string,
        success: boolean
    ): Promise<void> {
        const activeKey = this.activePrefix + campaignId;
        const contactData = await this.redis.hget(activeKey, contactId);

        if (!contactData) {
            return;
        }

        const contact: CampaignContact = JSON.parse(contactData);

        if (success) {
            // Remove from active
            await this.redis.hdel(activeKey, contactId);
            console.log(`✅ Contact completed: ${contactId}`);
        } else {
            // Retry logic
            contact.attempts++;
            contact.lastAttemptAt = new Date();

            if (contact.attempts < contact.maxAttempts) {
                // Re-queue with delay
                const configKey = this.configPrefix + campaignId;
                const configData = await this.redis.get(configKey);
                if (configData) {
                    const config: CampaignConfig = JSON.parse(configData);
                    const retryScore = Date.now() + (config.retryDelay * 1000);

                    const queueKey = this.queuePrefix + campaignId;
                    await this.redis.zadd(queueKey, retryScore, JSON.stringify(contact));

                    console.log(`🔄 Contact re-queued for retry: ${contactId}`);
                }
            } else {
                console.log(`❌ Contact max retries reached: ${contactId}`);
            }

            // Remove from active
            await this.redis.hdel(activeKey, contactId);
        }
    }

    /**
     * Get active call count for campaign
     */
    public async getActiveCount(campaignId: string): Promise<number> {
        const activeKey = this.activePrefix + campaignId;
        return await this.redis.hlen(activeKey);
    }

    /**
     * Get queue size
     */
    public async getQueueSize(campaignId: string): Promise<number> {
        const queueKey = this.queuePrefix + campaignId;
        return await this.redis.zcard(queueKey);
    }

    /**
     * Get campaign stats
     */
    public async getCampaignStats(campaignId: string): Promise<{
        queued: number;
        active: number;
    }> {
        return {
            queued: await this.getQueueSize(campaignId),
            active: await this.getActiveCount(campaignId)
        };
    }

    /**
     * Pause campaign
     */
    public async pauseCampaign(campaignId: string): Promise<void> {
        const configKey = this.configPrefix + campaignId;
        const configData = await this.redis.get(configKey);

        if (configData) {
            const config: CampaignConfig = JSON.parse(configData);
            config.maxConcurrent = 0; // Prevent new calls
            await this.redis.set(configKey, JSON.stringify(config));
            console.log(`⏸️ Campaign paused: ${campaignId}`);
        }
    }

    /**
     * Resume campaign
     */
    public async resumeCampaign(campaignId: string, maxConcurrent: number): Promise<void> {
        const configKey = this.configPrefix + campaignId;
        const configData = await this.redis.get(configKey);

        if (configData) {
            const config: CampaignConfig = JSON.parse(configData);
            config.maxConcurrent = maxConcurrent;
            await this.redis.set(configKey, JSON.stringify(config));
            console.log(`▶️ Campaign resumed: ${campaignId}`);
        }
    }

    /**
     * Close Redis connection
     */
    public async close(): Promise<void> {
        await this.redis.quit();
    }
}
