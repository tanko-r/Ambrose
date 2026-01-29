# Add Note to Project

Add a note to the project's NOTES.md file.

## Usage
`/note <your note here>`

## Instructions

When the user runs this command:

1. Read the current NOTES.md file from the project root
2. Based on the note content, determine the appropriate section:
   - If it starts with "issue:" or "bug:" or "fix:" -> add to "Issues to Fix"
   - If it starts with "feature:" or "add:" or "want:" -> add to "Features to Add"
   - If it starts with "idea:" or "maybe:" or "future:" -> add to "Ideas / Future Enhancements"
   - If no prefix is provided, use AskUserQuestion to ask the user which category:
     - Options: "Issue/Bug", "Feature Request", "Idea/Future", "Session Note"
3. Add the note as a bullet point (with checkbox for issues/features)
4. Save the file
5. Confirm to the user what was added and where

## Arguments
$ARGUMENTS - The note text to add. Can optionally be prefixed with a category like "issue:", "feature:", or "idea:"

## Example
- `/note issue: Track changes not rendering correctly in sidebar`
- `/note feature: Add export to PDF option`
- `/note The deposit clause analysis seems accurate`
