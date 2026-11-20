import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import githubRoutes from './github.routes.js';

const apiRouter: Router = Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/github', githubRoutes);

export default apiRouter;
