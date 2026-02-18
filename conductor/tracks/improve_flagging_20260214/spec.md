# Specification - Improve Flagging System

## Overview
This track focuses on enhancing the existing contract flagging system to support multiple flags per paragraph, introduce auto-save capabilities, and improve the visual user experience with refined connectors and a more intuitive UI.

## Functional Requirements
- **Multi-Flag Support:** Allow users to create and view multiple independent flags for a single document paragraph.
- **Auto-Save:** Flag notes and category selections should automatically save to the backend as the user types, with a visual indicator of save status.
- **Improved Visual Connectors:** Replace straight dashed lines with curved, "org-chart" style paths that draw around text rather than through it.
- **Enhanced Bubble UI:** 
    - Remove unnecessary decorative elements (e.g., the diamond shape).
    - Add a "trash" icon for immediate flag deletion.
    - Provide clear visual distinction between different flag entry experiences.
- **UI/UX Refinement:** Address color-coding confusion in the document pane by showing risk categories only when a paragraph/clause is focused.

## Non-Functional Requirements
- **Performance:** SVG connector paths should recalculate efficiently on scroll and resize without causing lag.
- **Stability:** Auto-save logic should handle network interruptions gracefully.

## Acceptance Criteria
- [ ] Users can add a second flag to a paragraph that already has one.
- [ ] The "Flag Detail" bubble shows all flags for a paragraph or a specific focused flag.
- [ ] Changes to flag notes are saved without clicking a "Save" button.
- [ ] A "trash" icon correctly removes a flag and its associated highlight.
- [ ] Connector lines curve gracefully around document text.
- [ ] Risk categories/colors only appear on a paragraph when it is selected/focused.

## Out of Scope
- Redesigning the underlying risk detection algorithm.
- Implementing a full "Comment Thread" system (replying to flags).
