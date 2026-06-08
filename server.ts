import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import nodemailer from "nodemailer";
import rateLimit from "express-rate-limit";

// Load environment variables
dotenv.config();

// Firebase config — sourced from env vars (must be read AFTER dotenv.config()).
// The server only needs the project + database identifiers.
const firebaseConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  firestoreDatabaseId: process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID,
};

import { GoogleGenAI, Type } from "@google/genai";

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}
const dbAdmin = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(firebaseConfig.firestoreDatabaseId)
  : getFirestore();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Escape user-controlled values before interpolating into HTML (prevents HTML/
// markup injection into the operator's feedback email).
const escapeHtml = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Conservative email-shape check — used to reject malformed contact addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Allowed feedback categories (mirrors metadata.json Feedback.type enum).
const FEEDBACK_TYPES = ["SUGGESTION", "ISSUE", "OTHER"];

// Max system-prompt length accepted by /api/audit (guards Gemini cost/abuse).
const MAX_AUDIT_INPUT = 100_000;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure multer for file uploads (storing in memory for this demo)
  const upload = multer({ storage: multer.memoryStorage() });

  app.use(express.json());

  // Trust the first proxy hop (Cloud Run / AI Studio terminate TLS upstream) so
  // express-rate-limit keys on the real client IP from X-Forwarded-For.
  app.set("trust proxy", 1);

  // Per-IP rate limit for the expensive/abusable endpoints: /api/audit burns
  // Gemini quota, /api/feedback can drive the operator's SMTP relay.
  const abuseLimiter = rateLimit({
    windowMs: 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please slow down and try again shortly." },
  });

  // Feedback Uplink and Mail Transmission Engine
  app.post("/api/feedback", abuseLimiter, async (req, res) => {
    try {
      const { type, content, email, userId } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Feedback content is required." });
      }

      // Whitelist the category and validate the contact email so neither can
      // carry markup or malformed data downstream.
      const safeType = FEEDBACK_TYPES.includes(type) ? type : "SUGGESTION";
      const safeEmail = email && EMAIL_RE.test(String(email).trim())
        ? String(email).trim()
        : "anonymous";

      let feedbackDocId = "simulated-" + Math.random().toString(36).substring(2, 11);
      let firestoreSaved = false;
      let firestoreError = null;

      // 1. Try to Persist in Firestore (Graceful fallback if permission is denied)
      try {
        const feedbackDoc = await dbAdmin.collection('feedback').add({
          type: safeType,
          content,
          email: safeEmail,
          userId: userId || null,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        feedbackDocId = feedbackDoc.id;
        firestoreSaved = true;
      } catch (fErr: any) {
        console.warn("[Firestore] Unable to persist feedback doc (Permission Denied / Offline). Proceeding with Email Engine. Error:", fErr?.message || fErr);
        firestoreError = fErr?.message || String(fErr);
      }

      // 2. Prepare Email Notification
      const host = process.env.SMTP_HOST || "smtp.gmail.com";
      const port = Number(process.env.SMTP_PORT) || 587;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      const receiver = process.env.FEEDBACK_RECEIVER_EMAIL || "KNyamidie@gmail.com";

      const htmlBody = `
        <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0c0c0c; border: 1px solid #222; border-radius: 12px; overflow: hidden; color: #f1f5f9; padding: 0;">
          <div style="background-color: #111; padding: 24px; border-bottom: 1px solid #1e1e1e; text-align: left;">
            <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #f59e0b; font-weight: bold; display: block; margin-bottom: 4px;">CENTAUR SYSTEM UPLINK</span>
            <h1 style="font-family: serif; font-style: italic; font-size: 20px; color: #ffffff; margin: 0; font-weight: normal;">New Scorecard Engagement</h1>
          </div>
          <div style="padding: 32px 24px;">
            <div style="margin-bottom: 24px;">
              <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; font-weight: 700; display: block; margin-bottom: 6px;">Transmission Channel</span>
              <span style="display: inline-block; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 4px; border: 1px solid ${
                safeType === 'ISSUE' ? '#ef4444' : safeType === 'OTHER' ? '#f59e0b' : '#3b82f6'
              }; background-color: ${
                safeType === 'ISSUE' ? 'rgba(239, 68, 68, 0.1)' : safeType === 'OTHER' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)'
              }; color: ${
                safeType === 'ISSUE' ? '#ef4444' : safeType === 'OTHER' ? '#f59e0b' : '#3b82f6'
              };">${safeType}</span>
            </div>
            
            <div style="margin-bottom: 24px;">
              <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; font-weight: 700; display: block; margin-bottom: 6px;">Contact Origin</span>
              <p style="font-size: 13px; color: #cbd5e1; margin: 0; font-family: monospace;">${escapeHtml(safeEmail)}</p>
            </div>

            <div style="margin-bottom: 24px;">
              <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; font-weight: 700; display: block; margin-bottom: 6px;">Transmission Payload</span>
              <div style="background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 16px; font-size: 13px; line-height: 1.6; color: #e2e8f0; white-space: pre-wrap;">${escapeHtml(content)}</div>
            </div>

            <div style="font-size: 11px; color: #475569; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px;">
              Centaur Governance Document Reference Unique ID: <span style="font-family: monospace;">${feedbackDocId}</span>
              ${firestoreSaved ? "" : "<br/><span style='color: #ef4444; font-size: 10px;'>[Warning: System Database link offline, cached in-transit]</span>"}
            </div>
          </div>
        </div>
      `;

      let emailStatus = "SIMULATED_PENDING";
      let realDelivery = false;

      if (user && pass) {
        try {
          const transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: {
              user,
              pass,
            },
          });

          await transporter.sendMail({
            from: `"Centaur Governance System" <${user}>`,
            to: receiver,
            subject: `[Centaur Governance] ${safeType} submitted by ${safeEmail}`,
            text: `Type: ${safeType}\nFrom: ${safeEmail}\n\nContent:\n${content}\n\nDocument ID: ${feedbackDocId}`,
            html: htmlBody,
          });

          emailStatus = "DELIVERED";
          realDelivery = true;
          console.log(`[Email Engine] Real email successfully delivered via ${host} to ${receiver}`);
        } catch (mailErr: any) {
          console.error("[Email Engine] Live transmission failed, falling back to simulated queue:", mailErr);
          emailStatus = "FAILED_FALLBACK_SIMULATED";
        }
      } else {
        console.log("==========================================================================");
        console.log(`[EMAIL ENGINE SIMULATION] NEW ${safeType} INTAKE DETECTED`);
        console.log(`To: ${receiver}`);
        console.log(`From (Author Contact): ${safeEmail}`);
        console.log(`Payload: ${content}`);
        console.log(`Status: Transmitted successfully to localized console outbox.`);
        console.log("[INSTRUCTIONS] Add SMTP_USER and SMTP_PASS variables to start live email transmissions.");
        console.log("==========================================================================");
        emailStatus = "SIMULATED_LOGGED";
      }

      res.json({
        success: true,
        documentId: feedbackDocId,
        emailStatus,
        realDelivery,
        receiver,
        firestoreSaved,
        firestoreError,
        message: realDelivery 
          ? `Feedback registered. Email dispatched to ${receiver}.` 
          : `Feedback registered. Simulated mail stored in localized terminal outbox (Recipient: ${receiver}).`
      });

    } catch (err: any) {
      console.error("Feedback route error:", err);
      res.status(500).json({ error: "Failed to process feedback transmission.", details: err?.message });
    }
  });

  // SDK Telemetry Intake
  app.post("/api/v1/telemetry", async (req, res) => {
    try {
      const { projectId, latency, error, model, inputTokens, outputTokens } = req.body;

      // No baked-in default: if the key isn't provisioned, refuse intake rather
      // than silently accepting a known hardcoded value.
      const expectedApiKey = process.env.CENTAUR_API_KEY;
      if (!expectedApiKey) {
        return res.status(503).json({ error: "Telemetry intake is not configured." });
      }

      const apiKey = req.headers['x-api-key'] || req.body.apiKey;
      if (apiKey !== expectedApiKey) {
        return res.status(401).json({ error: "Invalid Project API Key" });
      }

      let telemetryCaptured = false;
      try {
        await dbAdmin.collection('telemetry').add({
          projectId: projectId || "anonymous",
          latency: Number(latency) || 0,
          error: Boolean(error),
          model: model || "unknown",
          inputTokens: Number(inputTokens) || 0,
          outputTokens: Number(outputTokens) || 0,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        telemetryCaptured = true;
      } catch (fErr: any) {
        console.warn("[Firestore] Unable to log telemetry to cloud database (Permission Denied / Offline). Logging locally:", fErr?.message || fErr);
        console.log(`[Telemetry Fallback] ProjectID: ${projectId}, Model: ${model}, Latency: ${latency}ms, Error: ${error}`);
      }

      res.json({ 
        success: true, 
        status: telemetryCaptured ? "METRIC_CAPTURED" : "METRIC_LOGGED_LOCAL_FALLBACK" 
      });
    } catch (err) {
      console.error("Telemetry Error:", err);
      res.status(500).json({ error: "Telemetry link failure" });
    }
  });

  // Get SDK Config for the Integration Guide.
  // NOTE: this is a public demo identifier shown in the copy-paste integration
  // snippet — it is NOT a real authentication secret. Telemetry is gated on the
  // provisioned CENTAUR_API_KEY (or refused entirely when unset).
  app.get("/api/v1/sdk-config", (req, res) => {
    res.json({
      endpoint: process.env.APP_URL || `http://localhost:${PORT}`,
      projectId: "EKJN-13B-729",
      apiKey: process.env.CENTAUR_API_KEY ?? null
    });
  });

  // API Route for performing the audit
  app.post("/api/audit", abuseLimiter, async (req, res) => {
    const { content, model } = req.body;

    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "System prompt content is required" });
    }

    if (content.length > MAX_AUDIT_INPUT) {
      return res.status(413).json({
        error: `System prompt exceeds the ${MAX_AUDIT_INPUT.toLocaleString()}-character limit.`,
      });
    }

    let selectedModel = model || "gemini-3.5-flash";
    
    // Clean up model string (strip models/ prefix if present)
    if (selectedModel.startsWith("models/")) {
      selectedModel = selectedModel.replace("models/", "");
    }

    // Map deprecated, preview, or restricted models to a stable target
    // The user's quota issue on gemini-3.1-pro suggests we should route to gemini-3.5-flash or gemini-1.5-flash
    if (selectedModel.includes("gemini-1.5") || 
        selectedModel.includes("gemini-3.1") ||
        selectedModel.includes("gemini-flash-preview") ||
        selectedModel === "gemini-flash-latest" ||
        selectedModel === "gemini-3-flash-preview") {
      selectedModel = "gemini-3.5-flash";
    }

    // Fetch system prompt configuration (Graceful fallback for permission issues)
    let systemPromptSet = "You are a Centaur Governance Auditor."; 
    try {
        const settingsDoc = await dbAdmin.collection('settings').doc('global').get();
        if (settingsDoc.exists && settingsDoc.data()?.systemPrompt) {
            systemPromptSet = settingsDoc.data()?.systemPrompt;
        }
    } catch (e: any) {
        // If permission denied, use default and don't spam logs with critical level error
        if (e.code === 7 || e.message?.includes('PERMISSION_DENIED')) {
            console.warn("System config fetch: Permission denied. Using default auditor prompt.");
        } else {
            console.error("Failed to fetch system config", e);
        }
    }

    try {
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: `${systemPromptSet}
        
        DEFENSIVE INSTRUCTIONS:
        - You are a security expert. When auditing prompts, check for susceptibility to prompt injection.
        - Explicitly verify if the prompt implements input sanitization.
        - Explicitly check if the prompt enforces structural context separation (e.g., using delimiters or clear boundaries for user input).
        - If these are missing, flag them as significant security risks in your audit.
        
        Audit the following system prompt for an AI application. 
        Evaluate it based on:
        1. Security (Prompt injection risk, data leakage prep, safety alignment)
        2. Governance (Compliance, transparency, bias mitigation, accountability)
        3. Sustainability (Computational efficiency, long-term impact, ethical resource use)
        
        System Prompt to Audit:
        """
        ${content}
        """`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              security: { type: Type.NUMBER, description: "Score from 0 to 100" },
              governance: { type: Type.NUMBER, description: "Score from 0 to 100" },
              sustainability: { type: Type.NUMBER, description: "Score from 0 to 100" },
              summary: { type: Type.STRING, description: "Short summary of findings" },
              biasScore: { type: Type.NUMBER, description: "Score from 0 to 100 evaluating runtime bias risks where 100 means highly equitable" },
              toxicityFilterRisk: { type: Type.NUMBER, description: "Score from 0 to 100 evaluating susceptibility to generating toxic outputs where lower is better" },
              hallucinationRisk: { type: Type.NUMBER, description: "Score from 0 to 100 evaluating hallucination or contradiction risk where lower is better" },
              socialImpactEquity: { type: Type.NUMBER, description: "Score from 0 to 100 evaluating accessibility, fairness, and overall social impact" },
              mitigationLog: { type: Type.STRING, description: "A tailored in-processing de-biasing mitigation log message suggestion" }
            },
            required: ["security", "governance", "sustainability", "summary", "biasScore", "toxicityFilterRisk", "hallucinationRisk", "socialImpactEquity", "mitigationLog"]
          }
        }
      });

      const auditResult = JSON.parse(response.text || "{}");
      
      // Implement conditional override for risk scoring
      // If (Security < 50% OR Governance < 50%), then Overall Risk = "HIGH"
      let riskLevel = "MINIMAL";
      let aggregateStatus = "VALID";

      if ((auditResult.security < 50) || (auditResult.governance < 50)) {
        riskLevel = "HIGH";
        aggregateStatus = "FAIL";
      } else if ((auditResult.security < 75) || (auditResult.governance < 75)) {
        riskLevel = "MODERATE";
        aggregateStatus = "CAUTION";
      }

      auditResult.riskLevel = riskLevel;
      auditResult.aggregateStatus = aggregateStatus;
      
      // Add raw metadata for the frontend to store
      auditResult.rawOutput = {
        model: selectedModel,
        usage: response.usageMetadata,
        rawText: response.text
      };

      res.json(auditResult);
    } catch (error: any) {
      const isQuotaError = error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED");
      
      console.error("Gemini Audit Error:", {
        message: error?.message,
        isQuotaError,
        model: selectedModel,
        hasKey: !!process.env.GEMINI_API_KEY
      });
      
      if (isQuotaError) {
        return res.status(429).json({
           error: "Resource quota exhausted. Please try again in 60 seconds or switch to a lighter model.",
           code: "AI_429",
           details: error?.message
        });
      }
      
      const errorMessage = error?.message || "Internal server error during neural evaluation.";
      res.status(500).json({ 
        error: "Failed to perform neural audit. Please check system logs.",
        details: errorMessage,
        code: "AI_500"
      });
    }
  });

  // API Route for file upload preview
  app.post("/api/upload-prompt", upload.single("promptFile"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const content = req.file.buffer.toString("utf-8");
    res.json({ 
      filename: req.file.originalname,
      content: content,
      size: req.file.size
    });
  });

  // API Route for "Audit Logs" or similar (demo purpose)
  app.get("/api/audits", (req, res) => {
    res.json([
      { id: 1, name: "Initial Prompt", score: 85, date: new Date().toISOString() }
    ]);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
