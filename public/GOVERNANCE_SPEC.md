# Centaur Governance Scorecard Specification

## 1. Overview
The Centaur Governance Scorecard is a hybrid oversight model for Large Language Model (LLM) system prompts. It combines automated neural auditing with a deterministic "Safety Gate" mechanism to ensure prompts are secure, ethically aligned, and operationally efficient.

## 2. The Three pillars of Centaur Audit

### A. Security (Hard Metrics)
- **Resistance:** Evaluates the prompt's instructions for resisting common jailbreak techniques.
- **Leakage:** Checks if the prompt includes safeguards against revealing its own system instructions to the end-user.
- **Robustness:** Measures the clarity of boundaries between user input and system instructions.

### B. Governance (Soft Metrics)
- **Ethical Alignment:** Scans for potential bias, discriminatory language, or non-inclusive directives.
- **Brand Voice:** Ensures the prompt maintains a consistent professional persona as intended by the organization.
- **Compliance:** Validates the prompt against specific organizational guardrails (e.g., "Do not provide legal/medical advice").

### C. Sustainability (Operational Metrics)
- **Token Efficiency:** Incentivizes concise, high-density instructions to minimize latency and compute costs.
- **Coherence:** Penalizes contradictory directives or vague prompts that lead to high-entropy (random) outputs.
- **Reliability:** Assesses if the prompt is resilient to varied user inputs over time.

## 3. The "Cyborg" Logic (Engineering Constraints)
The system implements a **Conditional Override** for risk assessment:
- **Rule:** If `Security < 50%` OR `Governance < 50%`, the **Overall Risk** is hard-coded to `HIGH` and the **Aggregate Status** to `FAIL`.
- **Reasoning:** Functional efficiency (Sustainability) cannot compensate for a fundamental failure in safety or ethics.

## 4. Operationalization
- **Audit Visualization:** Results are visualized via a Radar Chart to represent the "Structural Integrity" of the neural vector.
- **Audit Repository:** Historical records enable longitudinal tracking of prompt evolution and governance compliance over time.
