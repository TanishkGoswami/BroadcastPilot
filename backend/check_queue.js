const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis('redis://127.0.0.1:6379');
const metaSyncQueue = new Queue('metaSync', { connection });

async function checkFailed() {
    const failed = await metaSyncQueue.getFailed();
    if (failed.length > 0) {
        console.log(`Found ${failed.length} failed jobs:`);
        failed.forEach(job => {
            console.log(`Job ${job.id} Data:`, job.data);
            console.log(`Job ${job.id} Failed Reason:`, job.failedReason);
        });
    } else {
        console.log('No failed jobs found in metaSync queue.');
    }
    
    const completed = await metaSyncQueue.getCompleted();
    if (completed.length > 0) {
        console.log(`Found ${completed.length} completed jobs.`);
        console.log(`Latest completed job:`, completed[completed.length-1].returnvalue);
    }
    process.exit(0);
}

checkFailed();
