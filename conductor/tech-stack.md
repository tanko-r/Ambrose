# Technology Stack - Ambrose

## Frontend
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **UI Components:** shadcn/ui (Radix UI primitives)
- **State Management:** Zustand
- **Key Libraries:** 
    - `vitest` & `@testing-library/react` (unit and component testing)
    - `lucide-react` (icons)
    - `diff-match-patch` (visualizing changes)

## Backend
- **Framework:** Flask (Python 3.10+)
- **API Architecture:** RESTful
- **Session Management:** File-based sessions stored in `app/data/sessions/`
- **Document Handling:** `python-docx` for parsing and `redlines` for Word track-changes generation.
- **Key Libraries:**
    - `flask-cors` (CORS support)
    - `scikit-learn` (TF-IDF for clause matching)
    - `google-genai` & `anthropic` (LLM clients)

## AI & Data
- **Primary Analysis:** Claude Opus (Anthropic) - Used for deep document understanding and risk detection.
- **Revision Generation:** Gemini 3 Flash (Google) - Optimized for high-speed, surgical text generation.
- **Data Storage:** Local filesystem for document uploads and session JSON data.

## Infrastructure & Tooling
- **Orchestration:** Concurrently (via root `package.json`) to manage both frontend and backend dev servers.
- **Environment:** Node.js 20+ and Python 3.10+
- **Version Control:** Git
