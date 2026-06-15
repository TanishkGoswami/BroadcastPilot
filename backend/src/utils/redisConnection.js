const IORedis = require('ioredis');

const DEFAULT_REDIS_URL = 'redis://127.0.0.1:6380';

function createRedisConnection(options = {}) {
    return new IORedis(process.env.REDIS_URL || DEFAULT_REDIS_URL, {
        maxRetriesPerRequest: null,
        ...options,
    });
}

module.exports = {
    createRedisConnection,
};
