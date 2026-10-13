# reframe.spexalink.com

Mona Patel's cold funnel: the CEO video page and the Reframe Check (a three-minute diagnostic that doubles as the application). Static site on Netlify; every push to `main` goes live.

- `ceo/index.html`: the CEO page (video, proof, method, Mona, fit, FAQ)
- `assets/vsl.css`: colours and type at the top (navy + gold; Source Serif 4 + Source Sans 3)
- `assets/check.js`: questions, qualification rules and settings (video link, Calendly link) at the top
- `assets/img/`: Mona's photos (from her Drive, black and white)
- `netlify.toml`: noindex until launch, `/` redirects to `/ceo/`

Every step (email given, left early, completed, booked) adds a row to the "Reframe Leads" Google Sheet via Zapier. Completed checks also arrive in Netlify under Forms → `reframe-check`.
