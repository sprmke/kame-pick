# Candidate Scoring Rubric

Reference for `analyze-job-candidates` skill. Edit `config/job-criteria.yaml` for tech stack changes.

## Role fit

**Target:** AI-Assisted Web Developer — fresh grad, intern, or junior dev only.

**Employment:** contract/freelance, remote or hybrid (Pampanga), full-time (8 hrs/day).

## Filipino verification

**Include** when ≥2 signals:
- PH address on CV (city/province)
- +63 or 09xx phone
- PH university (HAU, DHVSU, UP, PUP, etc.)
- "Based in Philippines" / "Located in Pampanga" / Region III

**Exclude** when:
- Clearly based abroad with no PH tie
- No location info and name/education cannot confirm PH

Names alone are insufficient — always check CV/email content.

## Experience calculation

| Source | How to count |
|--------|--------------|
| "1 year experience" | 1 year |
| Internship 3–6 months | 0.25–0.5 years |
| Freelance with dates | count dated range |
| "Fresh graduate" / batch 2024–2025 | 0 years → Tier B |
| Unclear | assume worst case for tier, flag in report |

**Tier A:** >0 and ≤2 years (junior / intern)  
**Tier B:** 0 years (fresh grad)  
**Auto-pass:** >2 years professional dev (exclude from top 10)

## Tech stack match (`config/job-criteria.yaml`)

**Required (must have evidence):**
- Basic programming and web development knowledge
- Git fundamentals — repos, git mentions, branch workflow
- VS Code or Cursor familiarity
- AI coding tools — ChatGPT, Claude Code, Cursor, Copilot, or similar
- Good written English — clear, professional email and CV

**Preferred (each match adds points):**
- HTML, CSS, JavaScript, TypeScript
- React, Next.js, Supabase, Node.js
- REST APIs, basic APIs/databases knowledge
- Built web app projects (not just coursework snippets)

Score: `(required_met * 8) + (preferred_matches * 3)` capped at 25.

## Git / GitHub assessment

| Evidence | Score |
|----------|-------|
| Active GitHub, multiple repos, recent commits | 15 |
| GitHub exists but empty/sparse | 8 |
| No GitHub but CV mentions Git | 5 |
| No GitHub, no Git mention, no portfolio | 0 — likely exclude |

**Portfolio is expected.** Look for GitHub, live demos, or sample projects linked in email/CV.

Look for: README, commit messages, branches, PRs, deployed projects linked from repos.

## Academic honors

Keywords: cum laude, magna cum laude, summa cum laude, dean's list, dean lister, with honors, high honors.

Verify on CV — do not infer from university alone.

## Pampanga / Region III advantage

Cities: Angeles, San Fernando, Mabalacat, Clark, Bacolor, Mexico, Lubao, etc.  
+"Based in Pampanga" or Region III / Central Luzon address → location bonus.

## AI-assisted development

Look for in CV, email, or project READMEs:
- Cursor, Claude Code, ChatGPT, Claude, GitHub Copilot, Gemini, v0, Bolt, Lovable, Replit Agent
- Phrases: "AI-assisted", "vibe coding", "built with Cursor", "pair programming with AI"

Bonus if they shipped a **web app** (not just snippets) using these tools.

## Qualifications (qualitative assessment)

When scoring and writing "Why" notes, weigh:
- Full-time availability (8 hrs/day)
- Willingness to learn and adapt
- Independent remote work ability
- Problem-solving and debugging evidence
- Attention to detail in CV/email
- Basic UI/UX awareness in portfolio projects
- Time management and accountability signals

## Soft skills (tiebreaker only)

When scores are within 5 points, prefer:
1. Clear, professional English in email
2. Live deployed projects
3. Breadth of self-initiated projects
4. Evidence of finishing tasks (changelog, releases, demos)
5. Real-world API/integration experience

## Red flags

- Generic mass-applied email with no customization
- Resume/CV mismatch with GitHub (empty profile)
- Only tutorial clones, no original work
- >2 years experience (auto-pass per criteria)
- Poor written English or unclear communication
- No portfolio, GitHub, or sample projects
