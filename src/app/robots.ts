import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://minhtanphat.io.vn";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/og-image.png", "/opengraph-image", "/twitter-image"],
        disallow: ["/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
