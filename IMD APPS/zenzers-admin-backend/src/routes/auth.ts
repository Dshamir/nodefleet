import {Router} from 'express';
import {body} from 'express-validator';

import {generateHexToken} from '../services/auth';
import {addOrUpdateUser, createForgotPassword, deleteForgotPassword, getForgotPassword} from '../services/database';
import {getOIDCToken, getUser, refreshAccessToken, setUserPassword} from '../services/keycloak';
import {sendForgotPassword, sendAdminForgotPassword, sendPasswordChanged} from '../services/mailer';
import {checkExpressValidation} from '../utils/middleware';

const {recordSession, touchSession, endSession} = require('../services/session-tracker');
const {logLoginEvent} = require('../services/login-audit');

const router = Router();

// Only set Secure flag on cookies when explicitly enabled via COOKIE_SECURE=true.
// Default false: local dev (localhost:8888) and Docker (NODE_ENV=production but HTTP) need Secure=false
// or browsers silently drop the cookie. Set COOKIE_SECURE=true only behind real HTTPS (e.g. ngrok).
const secureCookie = process.env.COOKIE_SECURE === 'true';

const getRememberMeMaxAge = (rememberMe: boolean) => {
  // rememberMe=true  → 7 days
  // rememberMe=false → 24 hours (session-length)
  return rememberMe ? 1000 * 60 * 60 * 24 * 7 : 1000 * 60 * 60 * 24;
};
/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Authenticate a user
 *     description: >
 *        Logs in a user by validating credentials and retrieving authentication tokens.
 *        On success, the endpoint also sets up two cookies.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 format: email
 *                 description: The user's email address.
 *               password:
 *                 type: string
 *                 description: The user's password.
 *               rememberMe:
 *                 type: boolean
 *                 description: Optional flag to indicate if the session should be remembered.
 *             required:
 *               - username
 *               - password
 *     responses:
 *       200:
 *         description: Login successful. Returns access token and expiration details, and sets up two cookies.
 *         headers:
 *           Set-Cookie:
 *             description: Two cookies are set - refresh_token, remember_me.
 *             schema:
 *               type: string
 *               example: >
 *                  "refresh_token=value; Max-Age=...; Path=/; Expires=...; HttpOnly; Secure; SameSite=Strict;
 *                  remember_me=true; Max-Age=...; Path=/; Expires=...; HttpOnly; Secure; SameSite=Strict"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                   description: The JWT access token.
 *                 expires_in:
 *                   type: number
 *                   description: The lifetime in seconds of the access token.
 *             example:
 *               access_token: "your_access_token_here"
 *               expires_in: 3600
 *       400:
 *         description: Bad request. This may occur when required fields are missing or the user does not exist.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message describing the failure.
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message describing the failure.
 */
router.post(
  '/login',
  body('username').isEmail().withMessage('Username must be a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
  body('rememberMe').optional().isBoolean().withMessage('rememberMe must be a boolean'),
  checkExpressValidation,
  async (req, res) => {
    const {username, password, rememberMe} = req.body;

    try {
      const keycloakUser = await getUser(String(username));
      if (keycloakUser === null) {
        return res.status(400).json({error: 'User does not exist'});
      }

      const {access_token, refresh_token, expires_in} = await getOIDCToken(String(username), String(password));

      const maxAge = getRememberMeMaxAge(Boolean(rememberMe));

      res.cookie('refresh_token', refresh_token, {
        httpOnly: true,
        secure: secureCookie,
        sameSite: 'lax',
        maxAge,
      });

      res.cookie('remember_me', String(rememberMe), {
        httpOnly: true,
        secure: secureCookie,
        sameSite: 'lax',
        maxAge,
      });

      // set last login
      await addOrUpdateUser(keycloakUser.id, {});

      // Record login session
      try { await recordSession(keycloakUser.id, req); } catch (e) { /* non-blocking */ }

      // Audit: login success
      try { logLoginEvent({ userId: keycloakUser.id, email: String(username), name: keycloakUser.firstName ? `${keycloakUser.firstName} ${keycloakUser.lastName || ''}`.trim() : String(username), role: 'user', event: 'login', status: 'success', ipAddress: req.ip || req.connection?.remoteAddress, userAgent: req.headers?.['user-agent'] }); } catch (e) { /* non-blocking */ }

      return res.json({access_token, expires_in});
    } catch (err: any) {
      const keycloakError = err?.message || '';
      // Keycloak: "Account is not fully set up" — incomplete profile (missing firstName/lastName)
      if (keycloakError.includes('not fully set up')) {
        try { logLoginEvent({ email: String(username), event: 'login_failed', status: 'failure', ipAddress: req.ip || req.connection?.remoteAddress, userAgent: req.headers?.['user-agent'], details: 'Account not fully set up (incomplete KC profile)' }); } catch (e) { /* non-blocking */ }
        return res.status(401).json({error: 'Account setup incomplete. Please contact an administrator.'});
      }
      // Keycloak returns "invalid_grant" for wrong password — surface as 401
      if (keycloakError.includes('invalid_grant') || keycloakError.includes('Invalid user credentials')) {
        // Audit: login failed
        try { logLoginEvent({ email: String(username), event: 'login_failed', status: 'failure', ipAddress: req.ip || req.connection?.remoteAddress, userAgent: req.headers?.['user-agent'], details: 'Invalid credentials' }); } catch (e) { /* non-blocking */ }
        return res.status(401).json({error: 'Invalid credentials'});
      }
      // Connection-level failures → 502 (bad gateway)
      if (err?.code === 'ECONNRESET' || err?.code === 'ECONNREFUSED' || err?.type === 'aborted' || err?.name === 'AbortError') {
        console.error('[Auth] Keycloak connection failed:', err.code || err.name);
        return res.status(502).json({error: 'Authentication service temporarily unavailable'});
      }
      console.error(err);
      res.status(500).json({error: 'Internal server error'});
      return;
    }
  }
);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Refresh Access Token
 *     description: Refresh the access token using cookies. Expects a refresh_token and remember_me cookie.
 *     tags:
 *       - Authentication
 *     parameters:
 *       - in: cookie
 *         name: refresh_token
 *         schema:
 *           type: string
 *           default: DO NOT SET. Go to cookies instead
 *           readOnly: true
 *         description: The refresh token used to generate a new access token.
 *       - in: cookie
 *         name: remember_me
 *         schema:
 *           type: string
 *           default: DO NOT SET. Go to cookies instead
 *           readOnly: true
 *         description: Optional flag to indicate the "remember me" functionality. Defaults to "false" if missing.
 *     responses:
 *       200:
 *         description: Access token successfully refreshed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                   description: The newly issued access token.
 *                 expires_in:
 *                   type: integer
 *                   description: Time (in seconds) until the access token expires.
 *       401:
 *         description: Unauthorized. Authentication is required.
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */
router.post('/refresh', checkExpressValidation, async (req, res) => {
  try {
    const refreshToken = req.cookies['refresh_token'];
    const rememberMe = req.cookies['remember_me'] ?? 'false';

    if (refreshToken === undefined) {
      return res.status(401).json({message: 'No refresh token cookie found'});
    }

    const {access_token, refresh_token, expires_in} = await refreshAccessToken(String(refreshToken));

    // Touch session on refresh
    try {
      const payload = JSON.parse(Buffer.from(access_token.split('.')[1], 'base64').toString());
      if (payload.sub) {
        await touchSession(payload.sub);
        // Audit: token refresh
        try { logLoginEvent({ userId: payload.sub, email: payload.email, event: 'token_refresh', status: 'success', ipAddress: req.ip || req.connection?.remoteAddress, userAgent: req.headers?.['user-agent'] }); } catch (e) { /* non-blocking */ }
      }
    } catch (e) { /* non-blocking */ }

    const maxAge = getRememberMeMaxAge(Boolean(rememberMe));

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax',
      maxAge,
    });

    return res.json({access_token, expires_in});
  } catch (err: any) {
    // Connection-level failures → 502 (bad gateway)
    if (err?.code === 'ECONNRESET' || err?.code === 'ECONNREFUSED' || err?.type === 'aborted' || err?.name === 'AbortError') {
      console.error('[Auth] Keycloak connection failed on refresh:', err.code || err.name);
      return res.status(502).json({error: 'Authentication service temporarily unavailable'});
    }
    console.error(err);
    res.status(500).json({error: 'Internal server error'});
    return;
  }
});

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     description: |
 *       Initiates a forgot password request by sending a reset token to the user's email. If the email is not associated with any user, the endpoint will still respond with a success status to prevent information disclosure.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: The user's email address.
 *             required:
 *               - email
 *     responses:
 *       201:
 *         description: A password reset token has been created and sent to the user's email.
 *       200:
 *         description: Request processed successfully. (This status is returned if the email is not associated with any user to prevent information disclosure.)
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: A message describing the server error.
 */
router.post(
  '/forgot-password',
  body('email').notEmpty().isEmail().withMessage('Email must be a valid email'),
  checkExpressValidation,
  async (req, res) => {
    const {email} = req.body;

    try {
      const keycloakUser = await getUser(String(email));
      if (keycloakUser === null) {
        return res.status(200).send();
      }

      const token = generateHexToken();

      await Promise.all([createForgotPassword(email, token), sendForgotPassword(email, token)]);

      // Audit: password reset request
      try { logLoginEvent({ email: String(email), event: 'password_reset_request', status: 'success', ipAddress: req.ip || req.connection?.remoteAddress, userAgent: req.headers?.['user-agent'] }); } catch (e) { /* non-blocking */ }

      return res.status(201).send();
    } catch (err) {
      console.error(err);
      return res.status(500).json({error: err instanceof Error ? err.message : 'Internal server error'});
    }
  }
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     summary: Reset user password
 *     description: |
 *       Resets the user's password using a valid token. The password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character. It must not have any leading or trailing spaces. The confirmPassword field must match the password.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: |
 *                   The new password. It must:
 *                   - Be at least 8 characters long
 *                   - Contain at least one uppercase letter
 *                   - Contain at least one lowercase letter
 *                   - Contain at least one number
 *                   - Contain at least one special character
 *                   - Not have leading or trailing spaces
 *               confirmPassword:
 *                 type: string
 *                 description: Must match the password.
 *               token:
 *                 type: string
 *                 description: A valid reset token.
 *             required:
 *               - password
 *               - confirmPassword
 *               - token
 *     responses:
 *       200:
 *         description: Password reset successfully.
 *       400:
 *         description: Bad request. This may occur if the token is invalid, the user is not found, or the passwords do not meet the requirements.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: A message detailing why the request failed.
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: A message describing the server error.
 */
router.post(
  '/reset-password',
  body('password')
    .isLength({min: 8})
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must contain at least one special character')
    .custom(value => value === value.trim())
    .withMessage('Password must not have leading or trailing spaces'),
  body('confirmPassword').custom((value, {req}) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
  body('token').notEmpty().isString().withMessage('Token must be a valid string'),
  checkExpressValidation,
  async (req, res) => {
    const {token, password} = req.body;

    try {
      const forgotPassword = await getForgotPassword(String(token));
      if (forgotPassword === null) {
        return res.status(400).json({error: 'Unknown token'});
      }
      const {email} = forgotPassword;

      const keycloakUser = await getUser(String(email));
      if (keycloakUser === null) {
        return res.status(400).json({error: 'Unknown user email'});
      }

      const {id} = keycloakUser!;
      await Promise.all([
        setUserPassword(id, String(password)),
        sendPasswordChanged(String(email)),
        deleteForgotPassword(String(token)),
      ]);

      return res.status(200).send();
    } catch (err) {
      console.error(err);
      return res.status(500).json({error: err instanceof Error ? err.message : 'Internal server error'});
    }
  }
);

/**
 * @openapi
 * /auth/admin/forgot-password:
 *   post:
 *     summary: Request admin password reset
 *     description: |
 *       Initiates a forgot password request for admin console operators.
 *       Sends a reset link pointing to /admin/reset-password.
 *       Returns 200 even if email is not found (prevents information disclosure).
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *             required:
 *               - email
 *     responses:
 *       201:
 *         description: Reset token created and email sent.
 *       200:
 *         description: Request processed (email may not exist).
 *       500:
 *         description: Internal server error.
 */
router.post(
  '/admin/forgot-password',
  body('email').notEmpty().isEmail().withMessage('Email must be a valid email'),
  checkExpressValidation,
  async (req, res) => {
    const {email} = req.body;

    try {
      const keycloakUser = await getUser(String(email));
      if (keycloakUser === null) {
        return res.status(200).send();
      }

      const token = generateHexToken();

      await Promise.all([createForgotPassword(email, token), sendAdminForgotPassword(email, token)]);

      return res.status(201).send();
    } catch (err) {
      console.error(err);
      return res.status(500).json({error: err instanceof Error ? err.message : 'Internal server error'});
    }
  }
);

/**
 * @openapi
 * /auth/admin/reset-password:
 *   post:
 *     summary: Reset admin password
 *     description: |
 *       Resets an admin operator's password using a valid token.
 *       Same validation rules as the user reset-password endpoint.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 minLength: 8
 *               confirmPassword:
 *                 type: string
 *               token:
 *                 type: string
 *             required:
 *               - password
 *               - confirmPassword
 *               - token
 *     responses:
 *       200:
 *         description: Password reset successfully.
 *       400:
 *         description: Invalid token or validation error.
 *       500:
 *         description: Internal server error.
 */
router.post(
  '/admin/reset-password',
  body('password')
    .isLength({min: 8})
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must contain at least one special character')
    .custom(value => value === value.trim())
    .withMessage('Password must not have leading or trailing spaces'),
  body('confirmPassword').custom((value, {req}) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
  body('token').notEmpty().isString().withMessage('Token must be a valid string'),
  checkExpressValidation,
  async (req, res) => {
    const {token, password} = req.body;

    try {
      const forgotPassword = await getForgotPassword(String(token));
      if (forgotPassword === null) {
        return res.status(400).json({error: 'Unknown token'});
      }
      const {email} = forgotPassword;

      const keycloakUser = await getUser(String(email));
      if (keycloakUser === null) {
        return res.status(400).json({error: 'Unknown user email'});
      }

      const {id} = keycloakUser!;
      await Promise.all([
        setUserPassword(id, String(password)),
        sendPasswordChanged(String(email)),
        deleteForgotPassword(String(token)),
      ]);

      return res.status(200).send();
    } catch (err) {
      console.error(err);
      return res.status(500).json({error: err instanceof Error ? err.message : 'Internal server error'});
    }
  }
);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     summary: Change authenticated user's password
 *     description: >
 *       Allows an authenticated user to change their password by providing
 *       the current password and a new password that meets complexity requirements.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *               confirmPassword:
 *                 type: string
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmPassword
 *     responses:
 *       200:
 *         description: Password changed successfully.
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Current password is incorrect or not authenticated.
 *       500:
 *         description: Internal server error.
 */
router.post(
  '/change-password',
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({min: 8})
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must contain at least one special character')
    .custom(value => value === value.trim())
    .withMessage('Password must not have leading or trailing spaces'),
  body('confirmPassword').custom((value, {req}) => {
    if (value !== req.body.newPassword) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
  checkExpressValidation,
  async (req, res) => {
    const user = (req as any).user;
    if (!user?.sub) {
      return res.status(401).json({error: 'Authentication required'});
    }

    const {currentPassword, newPassword} = req.body;
    const email = user.email || user.preferred_username;

    if (!email) {
      return res.status(400).json({error: 'Unable to determine user email'});
    }

    try {
      // Verify current password by attempting an OIDC token exchange
      try {
        await getOIDCToken(String(email), String(currentPassword));
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('invalid_grant') || msg.includes('Invalid user credentials')) {
          try { logLoginEvent({ userId: user.sub, email: String(email), event: 'password_change_failed', status: 'failure', ipAddress: req.ip || req.connection?.remoteAddress, userAgent: req.headers?.['user-agent'], details: 'Incorrect current password' }); } catch (e) { /* non-blocking */ }
          return res.status(401).json({error: 'Current password is incorrect'});
        }
        throw err;
      }

      // Look up Keycloak user to get their KC ID
      const keycloakUser = await getUser(String(email));
      if (!keycloakUser) {
        return res.status(400).json({error: 'User not found in identity provider'});
      }

      // Set new password in Keycloak
      await setUserPassword(keycloakUser.id, String(newPassword));

      // Send notification email (non-blocking)
      try { await sendPasswordChanged(String(email)); } catch (e) { /* non-blocking */ }

      // Audit log (non-blocking)
      try { logLoginEvent({ userId: user.sub, email: String(email), name: keycloakUser.firstName ? `${keycloakUser.firstName} ${keycloakUser.lastName || ''}`.trim() : String(email), role: 'user', event: 'password_changed', status: 'success', ipAddress: req.ip || req.connection?.remoteAddress, userAgent: req.headers?.['user-agent'] }); } catch (e) { /* non-blocking */ }

      return res.status(200).json({message: 'Password changed successfully'});
    } catch (err) {
      console.error('[Auth] Change password error:', err);
      return res.status(500).json({error: 'Internal server error'});
    }
  }
);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Log out the current user
 *     description: Clears the refresh_token and remember_me cookies, ending the session.
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: Logged out successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logged out
 */
router.post('/logout', async (_req, res) => {
  // End session before clearing cookies
  try {
    const rt = _req.cookies['refresh_token'];
    if (rt) {
      const payload = JSON.parse(Buffer.from(rt.split('.')[1], 'base64').toString());
      if (payload.sub) {
        await endSession(payload.sub);
        // Audit: logout
        try { logLoginEvent({ userId: payload.sub, email: payload.email, event: 'logout', status: 'success', ipAddress: _req.ip || _req.connection?.remoteAddress, userAgent: _req.headers?.['user-agent'], details: 'Session ended' }); } catch (e) { /* non-blocking */ }
      }
    }
  } catch (e) { /* non-blocking */ }

  res.clearCookie('refresh_token', {httpOnly: true, secure: secureCookie, sameSite: 'lax'});
  res.clearCookie('remember_me', {httpOnly: true, secure: secureCookie, sameSite: 'lax'});
  res.status(200).json({message: 'Logged out'});
});

export default router;
