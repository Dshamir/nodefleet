import { Request, Response, NextFunction } from 'express';

/**
 * Security headers middleware for admin routes.
 * Adds standard security headers recommended by OWASP.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Enable HSTS (1 year, include subdomains)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy — restrictive defaults for API responses
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'",
  );

  // Disable browser features not needed for API
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );

  // Prevent stale API responses from browser cache
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  next();
}

module.exports = { securityHeaders };
