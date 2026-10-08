import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { AIService } from '../services/aiService.js';
const router = Router();
// POST /api/ai/classify
router.post('/classify', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No image file uploaded for AI analysis.' });
            return;
        }
        const imagePath = req.file.path;
        const originalName = req.file.originalname;
        const analysis = await AIService.classifyImage(imagePath, originalName);
        // Return the image URL relative to root and AI suggestions
        const imageUrl = `/uploads/${req.file.filename}`;
        res.json({
            success: true,
            imageUrl,
            filename: req.file.filename,
            analysis
        });
    }
    catch (err) {
        console.error('AI classification error:', err);
        // If AI fails, still allow graceful fallback
        res.status(200).json({
            success: false,
            warning: 'AI analysis unavailable. You can manually select the category.',
            analysis: {
                detectedIssue: 'Campus Maintenance Issue',
                suggestedCategory: 'Other',
                suggestedPriority: 'medium',
                confidence: 70,
                summary: 'Manual verification recommended',
                provider: 'heuristic'
            }
        });
    }
});
export default router;
