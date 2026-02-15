# Product Guidelines - Ambrose

## Prose Style & Tone
- **Concise and Authoritative:** Use direct, professional language that mirrors the precision of legal practice. Avoid unnecessary filler or overly conversational phrasing.
- **Precision First:** Documentation and UI copy should prioritize clarity and legal accuracy over approachability.
- **Active Voice:** Use active voice to describe system actions and user requirements.

## AI Interaction Model: The "Copilot"
- **Attorney in Control:** The UI must consistently reinforce that AI-generated redlines are suggestions requiring professional verification. Use terms like "Suggestions," "Draft," or "Review" rather than "Final" or "Applied."
- **Surgical Revisions:** Emphasize the AI's ability to make precise, targeted changes rather than wholesale rewrites of legal provisions.
- **Negotiation Empowerment:** Frame AI insights as strategic leverage. The goal is to provide the attorney with the data and phrasing needed to "win" the point during negotiations with opposing counsel.

## Visual Identity & Design Principles
- **Clean Aesthetic:** Adhere to a "Vercel-like" design system—utilizing white space, high-quality typography, and subtle borders to convey trust and precision.
- **Layered Information Density:** 
    - The primary document view must remain uncluttered.
    - Use side panels, popovers, and tooltips to provide deep-dive data (risk details, related clauses, definitions) only when requested.
    - Transition animations should be fast (150-200ms) to maintain a responsive, high-performance feel.

## Risk & Feedback Indicators
- **Severity Signaling:** Use a consistent color palette for risk severity (Critical, High, Medium, Low) using badges or margin indicators.
- **Non-Destructive Highlighting:** Use subtle text decorations (e.g., dotted underlines) for unfocused risks to preserve document readability, switching to solid highlights only when a specific risk is focused.
- **Connector Logic:** Use visual connectors (like SVG dashed lines) to bridge the gap between document text and side-panel details, maintaining clear context during multi-pane reviews.

## Brand Messaging
- **Supercharged Analysis:** Position Ambrose as an advanced sensor array that catches strategic risks and subtle language traps that might otherwise be missed during manual review.
- **Negotiation Effectiveness:** Focus on providing the tools—precedents, rationales, and optimized language—that give attorneys a competitive edge when facing opposing counsel.
- **Reliability:** All interactions should reinforce the tool's stability and the faithfulness of its document representation.
