# reframe.spexalink.com

Mona Patel's cold funnel: the video page and the Reframe Check (a three-minute diagnostic that doubles as the application). Static site on Netlify; every push to `main` goes live.

- `ceo/index.html`: the CEO page (video, Reframe Check, written answers)
- `assets/check.js`: questions, qualification rules and settings (video link, Calendly link) at the top
- `assets/site.css`: design tokens (colours, type) at the top
- `netlify.toml`: noindex until launch, `/` redirects to `/ceo/`

Completed Reframe Checks arrive in Netlify under Forms → `reframe-check`.
