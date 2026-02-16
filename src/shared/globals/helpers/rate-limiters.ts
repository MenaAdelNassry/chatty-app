import rateLimit from "express-rate-limit";

// factory function
export const createRateLimiter = (minutes: number, maxRequests: number, message: string) => {
  return rateLimit({
    windowMs: minutes * 60 * 1000,
    max: maxRequests,
    message,
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Usage
export const authLimiter = createRateLimiter(15, 10, 'Too many login attempts');
export const chatLimiter = createRateLimiter(1, 60, 'Slow down! Too many messages');
