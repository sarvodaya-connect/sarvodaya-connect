# Sarvodaya Connect public website

This is the Next.js app foundation for the public landing page at `sarvodayaconnect.com`.
It is intentionally a starter shell; the visual design and page content are for the team to build.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3100`. Use `npm run lint` and `npm run build` before opening a pull request.

## Structure

- `src/app/page.tsx` — landing-page route and future page composition
- `src/app/layout.tsx` — shared document metadata and root layout
- `src/app/globals.css` — global styles and Tailwind entry point
- `public/` — approved logos and other static assets

Set `NEXT_PUBLIC_DASHBOARD_URL` only after the dashboard sign-in URL is confirmed.
