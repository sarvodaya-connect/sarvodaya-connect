import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const siteUrl = "https://sarvodayaconnect.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
    },
  ];
}
