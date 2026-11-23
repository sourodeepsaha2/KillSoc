import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import githubRoutes from './github.routes.js';
import intelligenceRoutes from './intelligence.routes.js';
import skillRoutes from './skill.routes.js';
import matchingRoutes from './matching.routes.js';
import discoveryRoutes from './discovery.routes.js';
import aiRoutes from './ai-recommendation.routes.js';
import jobRoutes from './job.routes.js';

const apiRouter: Router = Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/github', githubRoutes);
apiRouter.use('/intelligence', intelligenceRoutes);
apiRouter.use('/skills', skillRoutes);
apiRouter.use('/matching', matchingRoutes);
apiRouter.use('/discovery', discoveryRoutes);
apiRouter.use('/ai', aiRoutes);
apiRouter.use('/jobs', jobRoutes);

export default apiRouter;
