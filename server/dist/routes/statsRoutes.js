import { Router } from 'express';
import { db } from '../db/database.js';
const router = Router();
// GET /api/stats
router.get('/', (req, res) => {
    try {
        const { range, startDate, endDate } = req.query;
        let dateFilterSql = '';
        const params = [];
        if (range === 'today') {
            dateFilterSql = " AND created_at >= date('now', 'start of day')";
        }
        else if (range === '7d') {
            dateFilterSql = " AND created_at >= date('now', '-7 days')";
        }
        else if (range === '30d') {
            dateFilterSql = " AND created_at >= date('now', '-30 days')";
        }
        else if (range === '90d') {
            dateFilterSql = " AND created_at >= date('now', '-90 days')";
        }
        else if (range === 'custom' && startDate && endDate) {
            dateFilterSql = " AND date(created_at) >= date(?) AND date(created_at) <= date(?)";
            params.push(startDate, endDate);
        }
        // 1. Overall counts for selected date filter
        const totalRow = db.prepare(`SELECT COUNT(*) as count FROM issues WHERE 1=1 ${dateFilterSql}`).get(...params);
        const totalIssues = totalRow?.count || 0;
        const pendingRow = db.prepare(`SELECT COUNT(*) as count FROM issues WHERE status = 'pending' ${dateFilterSql}`).get(...params);
        const acknowledgedRow = db.prepare(`SELECT COUNT(*) as count FROM issues WHERE status = 'acknowledged' ${dateFilterSql}`).get(...params);
        const inProgressRow = db.prepare(`SELECT COUNT(*) as count FROM issues WHERE status = 'in_progress' ${dateFilterSql}`).get(...params);
        const resolvedRow = db.prepare(`SELECT COUNT(*) as count FROM issues WHERE status IN ('resolved', 'closed') ${dateFilterSql}`).get(...params);
        const criticalRow = db.prepare(`SELECT COUNT(*) as count FROM issues WHERE priority = 'critical' AND status NOT IN ('resolved', 'closed') ${dateFilterSql}`).get(...params);
        // 2. Resolution rate
        const resolutionRate = totalIssues > 0
            ? Math.round(((resolvedRow?.count || 0) / totalIssues) * 1000) / 10
            : 0;
        // 3. Average resolution time calculation (in days)
        const avgTimeRows = db.prepare(`
      SELECT julianday(updated_at) - julianday(created_at) as diff_days 
      FROM issues 
      WHERE status IN ('resolved', 'closed') AND updated_at IS NOT NULL ${dateFilterSql}
    `).all(...params);
        let avgResolutionDays = 0;
        if (avgTimeRows.length > 0) {
            const sumDays = avgTimeRows.reduce((acc, cur) => acc + (cur.diff_days || 0), 0);
            avgResolutionDays = Math.max(0.1, Math.round((sumDays / avgTimeRows.length) * 10) / 10);
        }
        // 4. Chart 1: Issues by Category
        const categoryRows = db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM issues 
      WHERE 1=1 ${dateFilterSql}
      GROUP BY category 
      ORDER BY count DESC
    `).all(...params);
        // 5. Chart 2: Issues by Status
        const statusRows = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM issues 
      WHERE 1=1 ${dateFilterSql}
      GROUP BY status
      ORDER BY count DESC
    `).all(...params);
        // 6. Chart 3: Issues by Priority
        const priorityRows = db.prepare(`
      SELECT priority, COUNT(*) as count 
      FROM issues 
      WHERE 1=1 ${dateFilterSql}
      GROUP BY priority
      ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
          ELSE 5 END
    `).all(...params);
        // 7. Chart 4: Issues Over Time
        const timelineRows = db.prepare(`
      SELECT date(created_at) as date, COUNT(*) as count 
      FROM issues 
      WHERE 1=1 ${dateFilterSql}
      GROUP BY date(created_at) 
      ORDER BY date ASC
    `).all(...params);
        // 8. Chart 5: Issues by Campus Location
        const locationRows = db.prepare(`
      SELECT location_name as location, COUNT(*) as count 
      FROM issues 
      WHERE 1=1 ${dateFilterSql}
      GROUP BY location_name 
      ORDER BY count DESC
      LIMIT 10
    `).all(...params);
        // 9. Chart 6: Resolution Time Trend (daily average resolution time over time)
        const resolutionTrendRows = db.prepare(`
      SELECT date(updated_at) as date, AVG(julianday(updated_at) - julianday(created_at)) as avgDays
      FROM issues 
      WHERE status IN ('resolved', 'closed') AND updated_at IS NOT NULL ${dateFilterSql}
      GROUP BY date(updated_at)
      ORDER BY date ASC
    `).all(...params);
        const formattedTrend = resolutionTrendRows.map(r => ({
            date: r.date,
            avgDays: Math.max(0.1, Math.round((r.avgDays || 0) * 10) / 10)
        }));
        const mostReported = categoryRows.length > 0 ? categoryRows[0].category : 'No data available yet';
        res.json({
            summary: {
                totalIssues,
                pending: pendingRow?.count || 0,
                acknowledged: acknowledgedRow?.count || 0,
                inProgress: inProgressRow?.count || 0,
                resolved: resolvedRow?.count || 0,
                critical: criticalRow?.count || 0,
                resolutionRate,
                avgResolutionDays,
                mostReported
            },
            byCategory: categoryRows,
            byStatus: statusRows,
            byPriority: priorityRows,
            byLocation: locationRows,
            timeline: timelineRows,
            resolutionTrend: formattedTrend
        });
    }
    catch (err) {
        console.error('Stats fetch error:', err);
        res.status(500).json({ error: 'Failed to compute campus analytics.' });
    }
});
export default router;
