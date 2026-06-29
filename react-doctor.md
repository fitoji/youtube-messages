Fix the top 3 React Doctor issues in youtubeviewer on this pass — leave the rest for a follow-up.

1. WARN Maintainability: React 19 API migration can break callers (×164)
   useContext is replaced by `use()` in React 19, which reads context inside ifs & loops too, so switch to `import { use } from 'react'`.
   Curl with no cache & follow the canonical fix and false positive check recipe before fixing: https://react.doctor/docs/rules/react-doctor/no-react19-deprecated-apis
   - .agents/skills/tailwind-v4-shadcn/templates/theme-provider.tsx:1
   - src/components/ui/accordion.tsx:9
   - src/components/ui/alert-dialog.tsx:13
   - +37 more files
   Migration-scale (40 files): fix a representative sample, confirm the recipe holds, and get the code owner's sign-off before changing the rest in one pass.
2. WARN Bugs: Event logic handled in an effect (×4)
   Faking an event handler with a prop plus a useEffect costs an extra render & runs late.
   Curl with no cache & follow the canonical fix and false positive check recipe before fixing: https://react.doctor/docs/rules/react-doctor/no-event-handler
   - .agents/skills/tailwind-v4-shadcn/templates/theme-provider.tsx:32
   - src/components/ui/calendar.tsx:149
3. WARN Maintainability: deslop/unused-dependency (×4)
   Unused dependency: `@hookform/resolvers`
   - package.json

Full results for all 297 issues (diagnostics.json + a .txt per rule): /var/folders/yw/6bjyc44d1rgg5163wpzd1cr80000gn/T/react-doctor-0bd3bcbd-fb0d-4846-a266-958f2b555917

Read each file and fix the root cause — don't suppress or silence the rule.

Findings that share a `fixGroupId` (in diagnostics.json) are one root cause — a single fix clears all of them, so treat each `fixGroupId` as ONE task, not one per site.

Verify against the real thing, don't assume: confirm each change matches the canonical fix recipe you fetched for that rule, then re-run `npx react-doctor@latest --verbose` and check the issue is actually gone against the real tool before moving on.

Teach me as you go: for every issue you touch, explain it in plain language (no jargon) — what the problem is, why it's a problem, and how serious it is in human terms. Describe the real-world impact and severity concretely (e.g. "this crashes the page for users on Safari" vs. "this is a minor cleanup with no user impact") so I understand why it matters, not just what changed.

Some of the rest are migration-scale (span dozens of files): deslop/unused-file (47 files). For each, fix a representative sample, confirm the recipe holds, and get the code owner's sign-off before changing the rest in one pass.

Then work through the rest from the full results above.
