import { Router, Request, Response } from 'express';

export const authRouter = Router();

authRouter.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;
  // Single admin login
  if (!password || password.length === 0) {
    return res.status(400).json({ error: 'Password is required' });
  }

  // Admin access granted
  res.json({
    success: true,
    user: {
      username: 'admin',
      role: 'Store Administrator'
    }
  });
});

authRouter.get('/status', (req: Request, res: Response) => {
  res.json({
    authenticated: true,
    user: {
      username: 'admin',
      role: 'Store Administrator'
    }
  });
});
