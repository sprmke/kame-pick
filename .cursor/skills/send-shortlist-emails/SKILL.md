---
name: send-shortlist-emails
description: >-
  Drafts and sends shortlist outreach emails to ranked candidates using the
  project template. Use when the user wants to email shortlisted applicants,
  batch outreach, or follow-up screening questions.
---

# Send Shortlist Emails

## Template

Base template: `config/shortlist-email-template.txt`

Placeholders: `{{first_name}}`, `{{role}}`, `{{team_name}}`

Job role name comes from `config/job-criteria.yaml` (`role` field).

## Workflow

1. Confirm the shortlist — from a ranking report (`data/reports/`) or the Rankings UI
2. For each candidate, read `data/candidates/{slug}/metadata.json` for email + name
3. Personalize `{{first_name}}` from metadata (fallback: "there")
4. Preview drafts with the user before sending
5. Send via:
   - **Web UI:** Rankings page → email batch component
   - **API:** `server/services/email_outreach.py` (if wired)
   - **Manual:** user copies draft into Gmail

## Privacy

- Do not paste full candidate details in chat — reference by slug
- Do not commit sent-email content with PII to git
- Confirm recipient list with user before bulk send

## Output format (preview)

For each candidate show:

```markdown
### [Name] — [email]
**Subject:** Next steps — [role] application
**Body:** (personalized template preview, truncated if long)
```

Ask user to approve all drafts before triggering send.
