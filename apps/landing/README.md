# Landing page

Public landing page for [sarvodayaconnect.com](https://sarvodayaconnect.com). It is a single static Next.js page that shares the dashboard's Screen Catalogue v3 design tokens.

```bash
npm install
npm run dev     # http://localhost:3100
npm run build   # static site in out/
```

All dashboard links, including the **Go to dashboard** buttons, use `NEXT_PUBLIC_DASHBOARD_URL` (see `.env.example`). It defaults to the AWS TEST dashboard at `https://dashboard.sarvodayaconnect.com`, a custom domain on the Amplify app (whose default address, `https://main.d2ejee92ehqzxv.amplifyapp.com`, also keeps working).

Set this variable in the landing site's hosting environment to use a different dashboard address, such as a permanent custom domain. The URL is included during the static build, so rebuild and redeploy the landing site after changing it.
