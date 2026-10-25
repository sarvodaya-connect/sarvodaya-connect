# Landing page

Public landing page for [sarvodayaconnect.com](https://sarvodayaconnect.com). It is a single static Next.js page that shares the dashboard's Screen Catalogue v3 design tokens.

```bash
npm install
npm run dev     # http://localhost:3100
npm run build   # static site in out/
```

Set `NEXT_PUBLIC_DASHBOARD_URL` (see `.env.example`) to change where the **Go to dashboard** button points. It defaults to `https://dashboard.sarvodayaconnect.com`.
