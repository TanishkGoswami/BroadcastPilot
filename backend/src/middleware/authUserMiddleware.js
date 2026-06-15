const supabase = require('../supabaseClient');

const authUserMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }

        const token = authHeader.split(' ')[1];

        if (!token || token === 'undefined' || token === 'null') {
            return res.status(401).json({ error: 'Token is undefined or null' });
        }

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            console.error(`Auth getUser Error for token [${token.substring(0, 15)}...]:`, error?.message || 'User not found');
            return res.status(401).json({ error: 'Unauthorized: ' + (error?.message || 'User not found') });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth User Middleware Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = authUserMiddleware;
