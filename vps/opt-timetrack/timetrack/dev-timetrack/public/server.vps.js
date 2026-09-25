// VPS compatibility entrypoint. The canonical backend lives in server.js.
// Keeping a wrapper prevents the production service and local server from drifting.
process.env.TIMETRACK_API_ONLY = '1';
require('./server.js');
