/**
 * Transcript Buffer Manager
 * Redis-based temporary storage for call transcripts
 * Buffers transcripts before writing to permanent storage
 */

import Redis from 'ioredis';

export interface TranscriptSegment {
    timestamp: number;
    speaker: 'user' | 'agent';
    text: string;
    confidence: number;
    isFinal: boolean;
}

export class TranscriptBufferManager {
    private redis: Redis;
    private bufferPrefix: string = 'transcript:buffer:';
    private bufferTTL: number = 3600; // 1 hour

    constructor(redisUrl?: string) {
        this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');

        this.redis.on('connect', () => {
            console.log('✅ Transcript Buffer Manager connected');
        });

        this.redis.on('error', (error) => {
            console.error('❌ Transcript Buffer Manager error:', error);
        });
    }

    /**
     * Add transcript segment to buffer
     */
    public async addSegment(callId: string, segment: TranscriptSegment): Promise<void> {
        const key = this.bufferPrefix + callId;

        // Add to list
        await this.redis.rpush(key, JSON.stringify(segment));

        // Set TTL
        await this.redis.expire(key, this.bufferTTL);
    }

    /**
     * Get all segments for a call
     */
    public async getSegments(callId: string): Promise<TranscriptSegment[]> {
        const key = this.bufferPrefix + callId;
        const data = await this.redis.lrange(key, 0, -1);

        return data.map(item => JSON.parse(item));
    }

    /**
     * Get full transcript as text
     */
    public async getFullTranscript(callId: string): Promise<string> {
        const segments = await this.getSegments(callId);
        return segments
            .filter(s => s.isFinal)
            .map(s => `[${s.speaker}]: ${s.text}`)
            .join('\n');
    }

    /**
     * Clear buffer for a call
     */
    public async clearBuffer(callId: string): Promise<void> {
        const key = this.bufferPrefix + callId;
        await this.redis.del(key);
        console.log(`🗑️ Transcript buffer cleared: ${callId}`);
    }

    /**
     * Get buffer size
     */
    public async getBufferSize(callId: string): Promise<number> {
        const key = this.bufferPrefix + callId;
        return await this.redis.llen(key);
    }

    /**
     * Flush buffer to permanent storage
     * Returns all segments and clears buffer
     */
    public async flushBuffer(callId: string): Promise<TranscriptSegment[]> {
        const segments = await this.getSegments(callId);
        await this.clearBuffer(callId);
        console.log(`💾 Transcript buffer flushed: ${callId} (${segments.length} segments)`);
        return segments;
    }

    /**
     * Close Redis connection
     */
    public async close(): Promise<void> {
        await this.redis.quit();
    }
}
