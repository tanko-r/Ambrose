# Lessons Learned

Patterns and mistakes to avoid, captured from user corrections.

---

## 2026-02-04: Gemini Model Names

**Problem:** Code repeatedly used deprecated Gemini model names (`gemini-2.0-flash`, `gemini-1.5-flash`) instead of current models.

**Root Cause:** Hardcoded model strings in multiple service files. No single source of truth for model names.

**Rule:**
- ONLY use `gemini-3-flash-preview` (primary) and `gemini-3-pro-preview` (fallback)
- NEVER use `gemini-2.x`, `gemini-1.x`, or other deprecated model names
- Check CLAUDE.md "API Model Requirements" section before writing Gemini API code

**Files affected:**
- `app/services/gemini_service.py`
- `app/services/parallel_analyzer.py`
- `app/services/claude_service.py`
- `WSL_Files/WSL_gemini_service.py`
