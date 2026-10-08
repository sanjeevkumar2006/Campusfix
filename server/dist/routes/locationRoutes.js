import { Router } from 'express';
import { db } from '../db/database.js';
const router = Router();
// GET /api/locations
router.get('/', (_req, res) => {
    try {
        const locations = db.prepare('SELECT * FROM campus_locations ORDER BY name ASC').all();
        res.json({ locations });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch campus locations.' });
    }
});
export default router;
