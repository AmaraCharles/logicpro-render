const bcrypt = require("bcryptjs");
const salt = bcrypt.genSaltSync(10);
const axios = require("axios");
const speakeasy = require("speakeasy");
const { Resend } = require("resend"); // ✅ Correct import
const secret = speakeasy.generateSecret({ length: 4 });

const resend = new Resend(process.env.RESEND_API_KEY); // ✅ Must initialize with your API key

// Hash password
const hashPassword = (password) => bcrypt.hashSync(password, salt);

// Compare hashed password
const compareHashedPassword = (hashedPassword, password) =>
  bcrypt.compareSync(password, hashedPassword);

/* =====================================================================
   Shared email layout — every email uses the welcome-email styling
   ===================================================================== */
const SITE_URL = process.env.SITE_URL || "https://vantagestonk.com";
const SUPPORT_EMAIL = "support@vantagestonk.com";

const EMAIL_STYLES = `
  body {
    background-color: #f4f6f8;
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #333;
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: 600px;
    background: #ffffff;
    margin: 40px auto;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    overflow: hidden;
  }
  .header {
    background: linear-gradient(135deg, #18e09b, #0e8e61);
    color: #ffffff;
    text-align: center;
    padding: 30px 20px;
  }
  .header img {
    width: 50px;
    height: 50px;
    margin-bottom: 10px;
  }
  .header h1 {
    font-size: 22px;
    margin: 0;
  }
  .content {
    padding: 30px 25px;
    text-align: left;
  }
  .content h2 {
    color: #18e09b;
    font-size: 18px;
    margin-bottom: 10px;
  }
  .content p {
    line-height: 1.7;
    font-size: 15px;
    margin: 10px 0;
  }
  .otp-box {
    background: #f0f4ff;
    color: #18e09b;
    font-size: 28px;
    letter-spacing: 6px;
    font-weight: bold;
    text-align: center;
    padding: 18px;
    border-radius: 8px;
    margin: 25px 0;
    border: 1px solid #d4e0ff;
  }
  .details {
    width: 100%;
    background: #f9fafb;
    border: 1px solid #e6e6e6;
    border-radius: 8px;
    margin: 20px 0;
    border-collapse: separate;
    padding: 8px 12px;
  }
  .details td {
    padding: 8px 4px;
    font-size: 15px;
    vertical-align: top;
  }
  .detail-label {
    color: #18e09b;
    font-weight: bold;
    width: 140px;
  }
  .detail-value {
    color: #333;
    word-break: break-all;
  }
  .highlight {
    color: #18e09b;
    font-weight: bold;
  }
  .note {
    background: #f9fafb;
    padding: 12px;
    border-left: 4px solid #18e09b;
    font-size: 14px;
    color: #555;
    margin-top: 10px;
  }
  .note-warning { border-left-color: #ff9800; background: #fff8ee; }
  .note-danger { border-left-color: #f44336; background: #fff3f2; }
  .button {
    display: inline-block;
    background: #18e09b;
    color: #ffffff !important;
    text-decoration: none;
    font-weight: bold;
    padding: 12px 28px;
    border-radius: 8px;
    margin: 15px 0;
  }
  .footer {
    background-color: #f8f9fa;
    text-align: center;
    padding: 20px;
    font-size: 13px;
    color: #888;
    border-top: 1px solid #e6e6e6;
  }
  .footer a {
    color: #18e09b;
    text-decoration: none;
  }
`;

const emailLayout = ({ title, body }) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>${EMAIL_STYLES}</style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <img src="https://vantagestonk.com/logo.png" alt="vantagestonk Logo" />
        <h1>${title}</h1>
      </div>
      <div class="content">
        ${body}
      </div>
      <div class="footer">
        <p>Need help? Contact our <a href="mailto:${SUPPORT_EMAIL}">support team</a>.</p>
        <p>&copy; ${new Date().getFullYear()} vantagestonk. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
`;

const detailsTable = (rows) => `
  <table class="details" cellpadding="0" cellspacing="0">
    ${rows
      .map(([label, value]) => `<tr><td class="detail-label">${label}</td><td class="detail-value">${value}</td></tr>`)
      .join("")}
  </table>
`;

const otpBox = (otp) => `<div class="otp-box">${otp}</div>`;

const note = (text, variant) => `<div class="note${variant ? ` note-${variant}` : ""}">${text}</div>`;

const button = (href, label) => `<p style="text-align:center;"><a href="${href}" class="button">${label}</a></p>`;

/* =====================================================================
   Emails
   ===================================================================== */

// Send withdrawal notification email
const sendWithdrawalRequestEmail = async ({ from, amount, method, address }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER || "no-reply@vantagestonk.com",
      to: SUPPORT_EMAIL,
      subject: "Transaction Notification",
      html: emailLayout({
        title: "Withdrawal Request",
        body: `
          <h2>New Withdrawal Request</h2>
          <p>Hello Chief,</p>
          <p>A new withdrawal request has been submitted by <span class="highlight">${from}</span>:</p>
          ${detailsTable([
            ["Amount", `<span class="highlight">$${amount}</span>`],
            ["Payment Method", method],
            ["Wallet Address", address],
          ])}
          ${note("<strong>Action Required:</strong> Please review and process this withdrawal request at your earliest convenience.", "warning")}
        `,
      }),
    });

    console.log("✅ Withdrawal request email sent successfully");
  } catch (error) {
    console.error("❌ Error sending withdrawal request email:", error);
    throw error;
  }
};


const userRegisteration = async ({ firstName, email }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: SUPPORT_EMAIL,
      subject: "Transaction Notification",
      html: emailLayout({
        title: "New User Registration",
        body: `
          <h2>A New User Has Joined</h2>
          <p>Hello Chief,</p>
          <p>A new user has registered on the platform:</p>
          ${detailsTable([
            ["Name", firstName],
            ["Email", email],
          ])}
          <p>Please visit your dashboard to review and confirm this registration.</p>
        `,
      }),
    });
    console.log('Registration notification email sent successfully');
  } catch (error) {
    console.error('Error sending registration notification email:', error);
    throw error;
  }
};

const sendWithdrawalEmail = async ({ to, address, amount, method, timestamp, from }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: to,
      subject: "Transaction Notification",
      html: emailLayout({
        title: "Withdrawal Request Received",
        body: `
          <h2>We've Received Your Request</h2>
          <p>Hello ${from},</p>
          <p>We have received your withdrawal request. Here are the details for your reference:</p>
          ${detailsTable([
            ["Amount", `<span class="highlight">$${amount}</span>`],
            ["Wallet Address", address],
            ["Payment Method", method],
          ])}
          <p>Our team will process your request as soon as possible. You will receive another email once the withdrawal has been processed.</p>
          ${note("If you didn't make this request, please contact our support team immediately.")}
        `,
      }),
    });
    console.log('Withdrawal notification email sent successfully');
  } catch (error) {
    console.error('Error sending withdrawal notification email:', error);
    throw error;
  }
};

const sendDepositEmail = async ({ from, amount, method, timestamp }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: SUPPORT_EMAIL,
      subject: "Transaction Notification",
      html: emailLayout({
        title: "New Deposit",
        body: `
          <h2>Deposit Initiated</h2>
          <p>Hello Chief,</p>
          <p>A new deposit has been initiated:</p>
          ${detailsTable([
            ["User", `<span class="highlight">${from}</span>`],
            ["Amount", `<span class="highlight">$${amount}</span>`],
            ["Payment Method", method],
            ["Time", timestamp],
          ])}
          ${note("<strong>Action Required:</strong> Please verify this transaction and update the user's balance from your admin dashboard.", "warning")}
        `,
      }),
    });
    console.log('Deposit notification email sent successfully');
  } catch (error) {
    console.error('Error sending deposit notification email:', error);
    throw error;
  }
};

const sendBankDepositRequestEmail = async ({ from, amount, method, timestamp }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: SUPPORT_EMAIL,
      subject: "Transaction Notification",
      html: emailLayout({
        title: "Bank Transfer Request",
        body: `
          <h2>New Bank Transfer Request</h2>
          <p>Hello Chief,</p>
          <p>A new bank transfer request has been received from <span class="highlight">${from}</span>:</p>
          ${detailsTable([
            ["Amount", `<span class="highlight">$${amount}</span>`],
            ["Time", timestamp],
          ])}
          ${note("<strong>Action Required:</strong> Please provide the necessary account details to process this request.", "warning")}
        `,
      }),
    });
    console.log('Bank deposit request email sent successfully');
  } catch (error) {
    console.error('Error sending bank deposit request email:', error);
    throw error;
  }
};

const sendDepositApproval = async ({ from, amount, method, timestamp, to }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: to,
      subject: "Transaction Notification",
      html: emailLayout({
        title: "Deposit Approved",
        body: `
          <h2>Your Deposit Has Been Approved</h2>
          <p>Hello ${from},</p>
          <p>Good news! Your deposit has been <strong>approved</strong> and credited to your account.</p>
          ${detailsTable([
            ["Amount", `<span class="highlight">$${amount}</span>`],
            ["Payment Method", method],
            ["Date", timestamp],
          ])}
          <p>Kindly visit your dashboard for more information.</p>
          ${button(`${SITE_URL}/login.html`, "Go to Dashboard")}
        `,
      }),
    });
    console.log('Deposit approval email sent successfully');
  } catch (error) {
    console.error('Error sending deposit approval email:', error);
    throw error;
  }
};

const sendWithdrawalApproval = async ({ from, amount, method, timestamp, to }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: to,
      subject: "Withdrawal Approved",
      html: emailLayout({
        title: "Withdrawal Approved",
        body: `
          <h2>Your Withdrawal Has Been Approved</h2>
          <p>Hello ${from},</p>
          <p>We are pleased to inform you that your withdrawal request has been <strong>approved</strong>. Please find the details below:</p>
          ${detailsTable([
            ["Amount", `<span class="highlight">$${amount}</span>`],
            ["Payment Method", method],
            ["Date", timestamp],
          ])}
          <p>The funds should now reflect in your account. Kindly verify your updated balance.</p>
        `,
      }),
    });
    console.log('Withdrawal approval email sent successfully');
  } catch (error) {
    console.error('Error sending withdrawal approval email:', error);
    throw error;
  }
};


const sendPlanEmail = async ({ from, subamount, subname, timestamp }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: SUPPORT_EMAIL,
      subject: "Transaction Notification",
      html: emailLayout({
        title: "New Plan Subscription",
        body: `
          <h2>Plan Subscription Initiated</h2>
          <p>Hello Chief,</p>
          <p>A new plan subscription has been initiated by <span class="highlight">${from}</span>:</p>
          ${detailsTable([
            ["Plan", `<span class="highlight">${subname}</span>`],
            ["Amount", `<span class="highlight">$${subamount}</span>`],
            ["Time", timestamp],
          ])}
          ${note("<strong>Action Required:</strong> Please verify this subscription and update the user's account accordingly.", "warning")}
        `,
      }),
    });
    console.log('Plan subscription notification email sent successfully');
  } catch (error) {
    console.error('Error sending plan subscription notification email:', error);
    throw error;
  }
};

const sendVerificationEmail = async ({ from, url }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: SUPPORT_EMAIL,
      subject: "Account Verification Notification",
      html: emailLayout({
        title: "Identity Verification Update",
        body: `
          <h2>Documents Submitted</h2>
          <p>Hello Chief,</p>
          <p>User <span class="highlight">${from}</span> has completed their identity verification process.</p>
          <p>Please review the submitted verification documents by clicking the button below:</p>
          ${button(url, "View Documents")}
          <p>Please review and verify the submitted documents at your earliest convenience.</p>
        `,
      }),
    });
    console.log('Verification notification email sent successfully');
  } catch (error) {
    console.error('Error sending verification notification email:', error);
    throw error;
  }
};

const sendWelcomeEmail = async ({ to, otp }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: to,
      subject: "Verify Your vantagestonk Account",
      html: emailLayout({
        title: "Welcome to vantagestonk",
        body: `
          <h2>Verify Your Email</h2>
          <p>Hello,</p>
          <p>Thank you for creating an account with <strong>vantagestonk</strong>. To protect your account, please use the verification code below to complete your registration:</p>
          ${otpBox(otp)}
          <p>This code will expire in <strong>5 minutes</strong>. For your security, never share this code with anyone—even a vantagestonk representative.</p>
          ${note("If you didn’t sign up for a vantagestonk account, please ignore this email or contact our support team immediately.")}
        `,
      }),
    });
    console.log("✅ Welcome email sent successfully");
  } catch (error) {
    console.error("❌ Error sending welcome email:", error);
    throw error;
  }
};


const resendWelcomeEmail = async ({ to, token }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: to,
      subject: 'Account Verification',
      html: emailLayout({
        title: "Welcome to vantagestonk",
        body: `
          <h2>Confirm Your Email</h2>
          <p>Hello,</p>
          <p>Let us know if this is really your email address, to help us keep your account secure. Confirm your email and let's get started!</p>
          ${otpBox(speakeasy.totp({ secret: secret.base32, encoding: 'base32' }))}
          ${note("If you didn’t sign up for a vantagestonk account, please ignore this email or contact our support team immediately.")}
        `,
      }),
    });
    console.log('Welcome email sent successfully');
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};

const resetEmail = async ({ to, token }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: to,
      subject: 'Change Password',
      html: emailLayout({
        title: "Change Your Password",
        body: `
          <h2>Password Change Request</h2>
          <p>Hello,</p>
          <p>You have requested to change your password. Please use the following code to reset your password:</p>
          ${otpBox(speakeasy.totp({ secret: secret.base32, encoding: 'base32' }))}
          <p>For your security, never share this code with anyone—even a vantagestonk representative.</p>
          ${note("If you did not request this password reset, please contact our support team immediately.", "warning")}
        `,
      }),
    });
    console.log('Password change email sent successfully');
  } catch (error) {
    console.error('Error sending password change email:', error);
    throw error;
  }
};

const sendUserPlanEmail = async ({ from, subamount, to, subname, timestamp }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: to,
      subject: 'Transaction Notification',
      html: emailLayout({
        title: "Subscription Confirmed",
        body: `
          <h2>You're Subscribed</h2>
          <p>Hello ${from},</p>
          <p>You have successfully subscribed to a new plan. Here are the details:</p>
          ${detailsTable([
            ["Plan", `<span class="highlight">${subname}</span>`],
            ["Amount", `<span class="highlight">$${subamount}</span>`],
            ["Date", timestamp],
          ])}
          ${button(`${SITE_URL}/login.html`, "Go to Dashboard")}
        `,
      }),
    });
    console.log('Plan subscription email sent successfully');
  } catch (error) {
    console.error('Error sending plan subscription email:', error);
    throw error;
  }
};

const sendUserDetails = async ({ to, password, firstName, token }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: to,
      subject: 'User Details',
      html: emailLayout({
        title: "Your Account Details",
        body: `
          <h2>Hello ${firstName},</h2>
          <p>Thank you for registering with <strong>vantagestonk</strong>. Here is your login information:</p>
          ${detailsTable([
            ["Email", to],
            ["Password", password],
          ])}
          ${button(`${SITE_URL}/login.html`, "Log In")}
          ${note("If you did not authorize this registration, please contact our support team immediately.", "warning")}
        `,
      }),
    });
    console.log('User details email sent successfully');
  } catch (error) {
    console.error('Error sending user details email:', error);
    throw error;
  }
};

const sendPasswordOtp = async ({ to }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: to,
      subject: 'Password Reset',
      html: emailLayout({
        title: "Password Reset",
        body: `
          <h2>Your Reset Code</h2>
          <p>Hello,</p>
          <p>Use the code below to reset your password:</p>
          ${otpBox(speakeasy.totp({ secret: secret.base32, encoding: 'base32' }))}
          <p>This code is valid for a short period of time. For your security, never share it with anyone.</p>
          ${note("If you did not request this code, please ignore this email.")}
        `,
      }),
    });
    console.log('Password reset OTP email sent successfully');
  } catch (error) {
    console.error('Error sending password reset OTP email:', error);
    throw error;
  }
};

const sendUserDepositEmail = async ({ from, amount, to, method, timestamp }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: to,
      subject: 'Transaction Notification',
      html: emailLayout({
        title: "Deposit Order Confirmation",
        body: `
          <h2>Deposit Order Submitted</h2>
          <p>Hello ${from},</p>
          <p>Your deposit order has been successfully submitted. Please review the details below:</p>
          ${detailsTable([
            ["From", from],
            ["Amount", `<span class="highlight">$${amount}</span>`],
            ["Method", method],
            ["Timestamp", timestamp],
          ])}
          ${note("<strong>Important:</strong> All payments should be sent to your personal wallet address.", "warning")}
        `,
      }),
    });
    console.log('User deposit email sent successfully');
  } catch (error) {
    console.error('Error sending user deposit email:', error);
    throw error;
  }
};

const sendKycAlert = async ({ owner }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: SUPPORT_EMAIL,
      subject: 'User Details',
      html: emailLayout({
        title: "New KYC Submission",
        body: `
          <h2>KYC Details Submitted</h2>
          <p>Hello Chief,</p>
          <p><span class="highlight">${owner}</span> just submitted their KYC details.</p>
          ${note("<strong>Action Required:</strong> Kindly check your dashboard to review the details.", "warning")}
        `,
      }),
    });
    console.log('KYC alert email sent successfully');
  } catch (error) {
    console.error('Error sending KYC alert email:', error);
    throw error;
  }
};

async function sendKYCApprovalEmail({ email, firstName }) {
  await resend.emails.send({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "✅ Your KYC Verification Has Been Approved",
    html: emailLayout({
      title: "KYC Verification Approved",
      body: `
        <h2>You're Verified ✅</h2>
        <p>Hi <strong>${firstName || "User"}</strong>,</p>
        <p>Congratulations! 🎉 Your KYC verification has been successfully approved.</p>
        <p>You can now enjoy full access to all features on our platform, including deposits, withdrawals, and exclusive benefits.</p>
        ${button(`${SITE_URL}/login.html`, "Go to Dashboard")}
        ${note("If you didn’t request this verification, please contact our support team immediately.")}
      `,
    }),
  });
}

async function sendKYCRejectionEmail({ email, firstName, reason }) {
  await resend.emails.send({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "❌ Your KYC Verification Has Been Rejected",
    html: emailLayout({
      title: "KYC Verification Update",
      body: `
        <h2>Verification Not Approved</h2>
        <p>Hi <strong>${firstName || "User"}</strong>,</p>
        <p>Unfortunately, your KYC verification could not be approved at this time.</p>
        ${note(`<strong>Reason:</strong> ${reason || "Incomplete or invalid identification details."}`, "danger")}
        <p>Please review your information and resubmit your KYC documents for re-evaluation.</p>
        ${button(`${SITE_URL}/login.html`, "Re-submit KYC")}
        <p>Our support team is available if you need clarification or assistance.</p>
      `,
    }),
  });
}

const sendForgotPasswordEmail = async ({ to }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: to,
      subject: 'Password Reset',
      html: emailLayout({
        title: "Password Reset",
        body: `
          <h2>Forgot Your Password?</h2>
          <p>Dear esteemed user,</p>
          <p>We received a request to reset the password for your account. To reset your password, click the button below:</p>
          ${button(`${SITE_URL}/reset-password`, "Reset Password")}
          ${note("If you did not make this request, please ignore this email.")}
        `,
      }),
    });
    console.log('Forgot password email sent successfully');
  } catch (error) {
    console.error('Error sending forgot password email:', error);
    throw error;
  }
};


const sendAdminWithdrawalNotification = async ({ userName, userEmail, amount, method, timestamp }) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_USER,
      to: SUPPORT_EMAIL,
      subject: "User Withdrawal Approved",
      html: emailLayout({
        title: "Withdrawal Approved",
        body: `
          <h2>User Withdrawal Approved</h2>
          <p>Hello Admin,</p>
          <p>The user <span class="highlight">${userName}</span> (${userEmail}) has successfully had their withdrawal request approved.</p>
          ${detailsTable([
            ["Amount", `<span class="highlight">${amount}</span>`],
            ["Method", method],
            ["Timestamp", timestamp],
          ])}
          <p>Check the admin dashboard for more details.</p>
        `,
      }),
    });
    console.log('Admin withdrawal notification sent successfully');
  } catch (error) {
    console.error('Error sending admin withdrawal notification:', error);
    throw error;
  }
};


// Security alert: sent on every change to the crypto deposit wallets so an
// unexpected change is noticed even if the admin account was compromised.
const sendWalletChangeAlert = async ({ adminEmail, ip, timestamp, before, after }) => {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const list = (wallets) =>
    wallets.length
      ? wallets.map((w) => `${esc(w.label)} [${esc(w.network)}]${w.enabled ? "" : " (disabled)"}: <code>${esc(w.address)}</code>`).join("<br>")
      : "<em>none</em>";

  await resend.emails.send({
    from: process.env.EMAIL_USER || "no-reply@vantagestonk.com",
    to: SUPPORT_EMAIL,
    subject: "SECURITY: Deposit wallet addresses changed",
    html: emailLayout({
      title: "Deposit Wallets Changed",
      body: `
        <h2>Deposit wallet addresses were changed</h2>
        ${detailsTable([
          ["Changed by", esc(adminEmail)],
          ["IP address", esc(ip)],
          ["Timestamp", esc(timestamp)],
        ])}
        <p><strong>Before:</strong><br>${list(before)}</p>
        <p><strong>After:</strong><br>${list(after)}</p>
        ${note("<strong>If you did not expect this change</strong>, disable the admin account above, change its password and restore the correct addresses immediately.", "warning")}
      `,
    }),
  });
};

module.exports = {
  sendWalletChangeAlert,
  hashPassword,
  userRegisteration,
  sendUserDepositEmail,
  compareHashedPassword,
  sendAdminWithdrawalNotification,
  sendDepositEmail,
  sendPlanEmail,
  sendUserPlanEmail,
  sendDepositApproval,
  sendWithdrawalApproval,
  sendPasswordOtp,
  sendForgotPasswordEmail,
  sendVerificationEmail,
  sendBankDepositRequestEmail,
  sendWithdrawalEmail,
  sendWithdrawalRequestEmail,
  sendWelcomeEmail,
  resendWelcomeEmail,
  resetEmail,
  sendKYCApprovalEmail,
  sendKYCRejectionEmail,
  sendKycAlert,
  sendUserDetails
};
