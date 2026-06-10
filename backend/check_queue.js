const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis('redis://127.0.0.1:6379');
const metaSyncQueue = new Queue('metaSync', { connection });

async function check() {
    const failed = await metaSyncQueue.getFailed();
    console.log(`Failed jobs: ${failed.length}`);
    for (const job of failed) {
        console.log(`Job ${job.id} failed: ${job.failedReason}`);
    }

    const completed = await metaSyncQueue.getCompleted();
    console.log(`Completed jobs: ${completed.length}`);
    for (const job of completed) {
        console.log(`Job ${job.id} return value:`, job.returnvalue);
    }
    process.exit(0);
}
check();
