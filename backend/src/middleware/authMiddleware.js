const authUserMiddleware = require('./authUserMiddleware');
const { getBroadcastWorkspace } = require('../services/broadcastWorkspace');

const requireWorkspace = async (req, res, next) => {
    try {
        const workspace = await getBroadcastWorkspace(req.user);

        if (!workspace) {
            return res.status(403).json({
                code: 'NO_BROADCAST_WORKSPACE',
                error: 'This account does not have BroadcastPilot access. Ask an owner for an invite or open BroadcastPilot from the hub.',
            });
        }

        req.user = {
            ...req.user,
            organization_id: workspace.organization_id,
            role: workspace.role,
        };

        next();
    } catch (error) {
        console.error('Workspace Middleware Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const authMiddleware = [authUserMiddleware, requireWorkspace];

authMiddleware.authUserMiddleware = authUserMiddleware;
authMiddleware.requireWorkspace = requireWorkspace;

module.exports = authMiddleware;
