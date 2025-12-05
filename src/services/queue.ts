import { Queue, Worker } from 'bullmq';
import { TelnyxService } from './telnyx';

export class QueueService {
    private callQueue: Queue;
    private telnyxService: TelnyxService;

    constructor(telnyxService: TelnyxService) {
        this.telnyxService = telnyxService;
        const redisConnection = {
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
            retryStrategy: (times: number) => {
                if (times > 5) {
                    console.warn('Queue Redis connection failed. Retrying in 10s...');
                    return 10000;
                }
                return Math.min(times * 100, 3000);
            }
        };

        this.callQueue = new Queue('outbound-calls', { connection: redisConnection });

        // Worker to process jobs
        new Worker('outbound-calls', async (job) => {
            console.log(`Processing job ${job.id}: Calling ${job.data.to}`);
            try {
                // Pass clientState (agentConfig) to makeCall
                await this.telnyxService.makeCall(job.data.to, job.data.from, job.data.clientState);
            } catch (error) {
                console.error(`Job ${job.id} failed:`, error);
                throw error;
            }
        }, { connection: redisConnection });
    }

    public async addCallJob(to: string, from: string, clientState: any = {}, delay: number = 0) {
        await this.callQueue.add('make-call', { to, from, clientState }, { delay });
        console.log(`Added call job for ${to} with delay ${delay}ms`);
    }

    public async addCampaign(numbers: string[], from: string, agentConfig: any = {}) {
        for (const number of numbers) {
            // Stagger calls by 5 seconds to avoid rate limits
            const delay = Math.random() * 10000;

            await this.addCallJob(number, from, {
                type: 'campaign_call',
                agentConfig
            }, delay);
        }
    }
}
