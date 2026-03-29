/**
 * Self-hosted email service using Nodemailer.
 * No external dependencies — uses SMTP (Mailhog in dev, any SMTP provider in prod).
 */

import nodemailer from 'nodemailer'
import { createLogger } from './logger'

const logger = createLogger('email')

const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'

const transporter = isBuildTime
  ? null
  : nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025'),
      secure: process.env.SMTP_SECURE === 'true',
      ...(process.env.SMTP_USER
        ? {
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS || '',
            },
          }
        : {}),
    })

const FROM = process.env.SMTP_FROM || 'noreply@nodefleet.dev'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  if (!transporter) {
    logger.warn('Email transport not available (build time)')
    return false
  }

  try {
    const info = await transporter.sendMail({
      from: FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
    })
    logger.info('Email sent', { to: options.to, subject: options.subject, messageId: info.messageId })
    return true
  } catch (error) {
    logger.error('Failed to send email', { to: options.to, error: String(error) })
    return false
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

// ── Email Templates ──────────────────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 32px; border: 1px solid #334155; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { color: #0ea5e9; font-size: 24px; margin: 0; }
    .content { line-height: 1.6; }
    .btn { display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
    .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0ea5e9; text-align: center; padding: 16px; background: #0f172a; border-radius: 8px; margin: 16px 0; }
    .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>NodeFleet</h1></div>
    <div class="content">${content}</div>
    <div class="footer">NodeFleet IoT Fleet Management Platform</div>
  </div>
</body>
</html>`
}

export function renderWelcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Welcome to NodeFleet',
    html: baseTemplate(`
      <h2>Welcome, ${name}!</h2>
      <p>Your NodeFleet account is ready. You can now manage your IoT device fleet, monitor telemetry, and more.</p>
      <p>Get started by adding your first device from the dashboard.</p>
    `),
  }
}

export function renderOtpEmail(code: string): { subject: string; html: string } {
  return {
    subject: 'Your NodeFleet Verification Code',
    html: baseTemplate(`
      <h2>Verification Code</h2>
      <p>Use this code to verify your identity:</p>
      <div class="code">${code}</div>
      <p>This code expires in 5 minutes. If you didn't request this, please ignore this email.</p>
    `),
  }
}

export function renderPasswordResetEmail(resetUrl: string): { subject: string; html: string } {
  return {
    subject: 'Reset Your NodeFleet Password',
    html: baseTemplate(`
      <h2>Password Reset</h2>
      <p>Click the button below to reset your password:</p>
      <p style="text-align:center"><a href="${resetUrl}" class="btn">Reset Password</a></p>
      <p>This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
    `),
  }
}

export function renderOrderConfirmationEmail(
  orderNumber: string,
  items: Array<{ name: string; quantity: number; price: string }>,
  total: string
): { subject: string; html: string } {
  const itemsHtml = items
    .map((i) => `<tr><td style="padding:8px;border-bottom:1px solid #334155">${i.name}</td><td style="padding:8px;border-bottom:1px solid #334155;text-align:center">${i.quantity}</td><td style="padding:8px;border-bottom:1px solid #334155;text-align:right">${i.price}</td></tr>`)
    .join('')

  return {
    subject: `Order Confirmation #${orderNumber}`,
    html: baseTemplate(`
      <h2>Order Confirmed</h2>
      <p>Thank you for your order <strong>#${orderNumber}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead><tr><th style="text-align:left;padding:8px;border-bottom:2px solid #475569">Item</th><th style="padding:8px;border-bottom:2px solid #475569">Qty</th><th style="text-align:right;padding:8px;border-bottom:2px solid #475569">Price</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot><tr><td colspan="2" style="padding:8px;font-weight:bold">Total</td><td style="padding:8px;text-align:right;font-weight:bold;color:#0ea5e9">${total}</td></tr></tfoot>
      </table>
    `),
  }
}

export function renderInvoiceEmail(
  invoiceNumber: string,
  amount: string,
  dueDate: string
): { subject: string; html: string } {
  return {
    subject: `Invoice #${invoiceNumber}`,
    html: baseTemplate(`
      <h2>Invoice #${invoiceNumber}</h2>
      <p>Amount due: <strong style="color:#0ea5e9">${amount}</strong></p>
      <p>Due date: <strong>${dueDate}</strong></p>
      <p>Please ensure payment is made by the due date.</p>
    `),
  }
}

export function renderCampaignEmail(content: string): { subject: string; html: string } {
  return {
    subject: 'NodeFleet Update',
    html: baseTemplate(content),
  }
}
