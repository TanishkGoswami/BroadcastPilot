const path = require('path');
const dotenv = require('dotenv');

function loadBackendEnv() {
    dotenv.config({
        path: path.resolve(__dirname, '..', '..', '.env'),
        quiet: true,
    });
}

module.exports = {
    loadBackendEnv,
};
