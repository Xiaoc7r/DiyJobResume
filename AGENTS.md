# Project guidance

- This product serves ordinary job seekers. Start with a usable template and clear user actions; keep implementation vocabulary out of the interface.
- Preserve user content when changing templates. Geometry and presentation are independent from title, body, and other content fields.
- The current product is local-only. Never upload resume data, photos, or analytics without a deliberate product change and clear user-facing disclosure.
- All published demo data must be fictitious. Never copy private resume content or credentials into source, fixtures, or screenshots.
- Verify `npm test` and `npm run build` before publication. For UI changes, also exercise the affected browser flow and check responsive behavior.
- Keep print CSS and screen rendering aligned. Do not substitute a full-page bitmap for textual PDF output.
- Keep changes scoped to a minimal useful output. Existing user history and Git remote must be preserved; never force push.
