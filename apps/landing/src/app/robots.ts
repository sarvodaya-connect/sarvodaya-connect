import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const siteUrl = "https://sarvodayaconnect.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The dashboard route is currently only a placeholder, not public content.
      disallow: "/dashboard",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
