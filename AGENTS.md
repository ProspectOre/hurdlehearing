# AGENTS

scope: /Users/alec/Dev/web/hurdlehearing
inherits: /Users/alec/Dev/AGENTS.md (read it first; the xcode-tools MCP rule there applies to any Apple work, none here)
wiki: /Users/alec/Dev/wiki/projects/hurdle-hearing.md (project card, design system, standards, owner-confirm list)

commands:
- npm run check      # tokens → build → gate; must pass before any push
- npm run serve      # local preview of dist/

rules:
- facts live in src/data.json; copy lives in src/pages; colors live in design/tokens.json; never hand-type a hex or an hour.
- keep the information-first register: few words, plain lists, one solid button per screen, no badges, pills, card grids, or promo panels.
- every section keeps its data-budget; trim copy, do not raise budgets without a reason in the commit.
- anything unverified about the practice gets an `(owner-confirm)` marker, never a guess.
- no analytics, pixels, or third-party requests; fonts are self-hosted.
- ship via branch → PR → green workflow → merge; never push to main directly.
