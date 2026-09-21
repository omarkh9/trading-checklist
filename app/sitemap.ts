import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const routes = [
  "/",
  "/login",
  "/signup",
  "/trade-journal",
  "/trade-history",
  "/calendar",
  "/pre-trade-checklist",
  "/analytics",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "/" ? 1 : 0.7,
  }));
}
