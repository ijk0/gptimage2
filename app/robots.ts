import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  const privatePaths = ["/api/", "/admin", "/admin/", "/login"];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: privatePaths },

      { userAgent: "GPTBot", allow: "/", disallow: privatePaths },
      { userAgent: "OAI-SearchBot", allow: "/", disallow: privatePaths },
      { userAgent: "ChatGPT-User", allow: "/", disallow: privatePaths },
      { userAgent: "ClaudeBot", allow: "/", disallow: privatePaths },
      { userAgent: "Claude-Web", allow: "/", disallow: privatePaths },
      { userAgent: "Claude-SearchBot", allow: "/", disallow: privatePaths },
      { userAgent: "PerplexityBot", allow: "/", disallow: privatePaths },
      { userAgent: "Perplexity-User", allow: "/", disallow: privatePaths },
      { userAgent: "Google-Extended", allow: "/", disallow: privatePaths },
      { userAgent: "Googlebot", allow: "/", disallow: privatePaths },
      { userAgent: "Applebot-Extended", allow: "/", disallow: privatePaths },
      { userAgent: "Bingbot", allow: "/", disallow: privatePaths },
      { userAgent: "DuckDuckBot", allow: "/", disallow: privatePaths },
      { userAgent: "YandexBot", allow: "/", disallow: privatePaths },
      { userAgent: "Baiduspider", allow: "/", disallow: privatePaths },
      { userAgent: "Bytespider", allow: "/", disallow: privatePaths },
      { userAgent: "YouBot", allow: "/", disallow: privatePaths },
      { userAgent: "Meta-ExternalAgent", allow: "/", disallow: privatePaths },
      { userAgent: "cohere-ai", allow: "/", disallow: privatePaths },
      { userAgent: "Amazonbot", allow: "/", disallow: privatePaths },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
