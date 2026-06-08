# Developer & Agent Guide: Centaur Governance Scorecard

## Project Overview
This application is a **Centaur Governance Scorecard**—a high-precision audit dashboard for evaluating system prompts for LLMs. It uses the Gemini 3 Flash model to perform neural audits across three primary dimensions: **Security**, **Governance**, and **Sustainability**.

## Technical Architecture
- **Frontend:** React 18, Vite, Tailwind CSS, Lucide icons, Motion (for animations), Recharts (for radar visualization).
- **Backend:** Express server (`server.ts`) acting as a proxy for the Gemini API to protect keys.
- **Database:** Firebase Firestore for history persistence.
- **Authentication:** Firebase Auth (Google Provider).

## Core Logic: The "Cyborg" Safety Gate
The application implements a deterministic safety override:
- If **Security** or **Governance** scores fall below **50%**, the `riskLevel` is forced to `HIGH` and `aggregateStatus` to `FAIL`, regardless of high scores in other areas.

## Deployment & Sharing
- **Live Preview:** Access via the "Shared App URL" in metadata.
- **Static Assets:** Documentation like `GOVERNANCE_SPEC.md` is located in the `/public` directory to ensure availability in both development and production.
- **Collaborative Editing:** To share this project with another developer for editing, use the **"Share"** button in the AI Studio top navigation bar.
- **Code Export:** Use the "Export to GitHub" or "Download ZIP" options in the AI Studio settings menu.

## Known Constraints
- The Gemini API requires a server-side secret key (`GEMINI_API_KEY`).
- Firebase configuration is managed through `firebase-applet-config.json`.
