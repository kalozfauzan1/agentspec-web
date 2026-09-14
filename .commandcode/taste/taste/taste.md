# Taste
- Writes in Bahasa Indonesia and expects replies, UI copy, and AI dialogue to be in Indonesian. Confidence: 0.6
- Wants generated deliverable documents (specs, PRD, and other artifacts) written in English even when the request is in Indonesian. Confidence: 0.5
- When AI-generated code is unsatisfactory, prefers a clean rebuild from scratch over incrementally patching the existing code. Confidence: 0.65
- Expects a rebuild to still conform to the existing PRD and UI reference docs rather than re-deciding the product. Confidence: 0.6
- Wants agents to actually run the app and walk through the full flow like a real user (not just typecheck/build) before declaring work done. Confidence: 0.7
- Wants the real end-to-end path exercised with live configured credentials, then a critical review of the produced output rather than only a pass/fail smoke test. Confidence: 0.6
- Delegates git version control to the agent: a short "commit dan push" is enough — commit directly to main and push, without asking for confirmation steps or a PR. Confidence: 0.45
