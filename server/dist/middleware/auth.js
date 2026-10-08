import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'campusfix-super-secret-jwt-key-2026';
export function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
}
export function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required. No token provided.' });
        return;
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
        res.status(401).json({ error: 'Invalid or expired session token. Please log in again.' });
        return;
    }
    req.user = decoded;
    next();
}
export function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required.' });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ error: `Forbidden: Access restricted to ${allowedRoles.join(' or ')}.` });
            return;
        }
        next();
    };
}
export const requireAdmin = requireRole(['admin']);
export const requireStudent = requireRole(['student']);
