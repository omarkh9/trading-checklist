import type { Metadata } from "next";
import { resolveSiteUrl } from "@/lib/supabase/public-config.mjs";

export const SITE_URL = resolveSiteUrl() || "https://edge-log-11.netlify.app";

export const SITE_NAME = "Edge Log by Omar";
export const SITE_SHORT_NAME = "Edge Log";
export const SITE_DESCRIPTION =
  "Edge Log by Omar is a trading journal for logging setups, running pre-trade checklists, and reviewing analytics.";

export const SITE_KEYWORDS = [
  "Edge Log by Omar",
  "Edge Log",
  "trading journal",
  "pre-trade checklist",
  "trade analytics",
  "forex journal",
];

const ogImage = {
  url: `${SITE_URL}/og.png`,
  width: 1200,
  height: 630,
  alt: SITE_NAME,
};

export function pageMetadata(options: {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
  index?: boolean;
}): Metadata {
  const url = `${SITE_URL}${options.path === "/" ? "" : options.path}`;
  const fullTitle = options.absoluteTitle
    ? options.title
    : `${options.title} | ${SITE_NAME}`;

  return {
    title: options.absoluteTitle ? { absolute: options.title } : options.title,
    description: options.description,
    alternates: { canonical: url },
    robots: options.index === false ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      title: fullTitle,
      description: options.description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: options.description,
      images: [ogImage.url],
    },
  };
}
