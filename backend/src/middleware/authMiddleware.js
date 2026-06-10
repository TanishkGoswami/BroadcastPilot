const supabase = require('../supabaseClient');

const authMiddleware = async (req, res, next) => {
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
            console.error(`Auth Middleware getUser Error for token [${token.substring(0, 15)}...]:`, error?.message || 'User not found');
            return res.status(401).json({ error: 'Unauthorized: ' + (error?.message || 'User not found') });
        }

        req.user = user;
        
        // Let's also fetch their role from b_organization_members
        const { data: memberData, error: memberError } = await supabase
            .from('b_organization_members')
            .select('organization_id, role')
            .eq('user_id', user.id)
            .limit(1)
            .single();
            
        if (!memberError && memberData) {
            req.user.organization_id = memberData.organization_id;
            req.user.role = memberData.role;
        } else {
            // Fallback to user_metadata for Google SSO Owners who don't have a row in b_organization_members
            req.user.organization_id = user.user_metadata?.organization_id || null;
            req.user.role = user.user_metadata?.role || null;
        }

        next();
    } catch (error) {
        console.error('Auth Middleware Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = authMiddleware;
