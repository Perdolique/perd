## Commit Message Instructions

When writing commit messages, follow these guidelines:

- Commit message should be in English.
- Understand the purpose and impact of the edits to summarize them effectively.
- Use conventional commit format.
- Begin the commit message with a single short (no more than 50 characters) line summarizing the change, followed by a blank line and then a more thorough description in list format with fun emoji per each item that represents the change.
- The summary should be high-level, highlighting the key changes without detailing every single line modification.
- Put emoji on the beginning of the text following the format: `-{one space}{emoji}{one space}{text}`.
- In case packages were updated, show it in the following format: `- 📦 {package name}: {from version} -> {to version}`.
- Use backticks (`) to wrap package names, file names, or code snippets for better readability.
- For monorepo, when detailing changes in the commit body, include a bullet point in the following format:
  - {package name}: {short description of the change}
