export type ProjectBranding = {
  banner: string;
  bannerPosition: string;
  logo: string;
};

const PROJECT_BRANDING: Record<string, ProjectBranding> = {
  "police-n-thief": {
    banner: "/project-branding/police-n-thief-banner.webp",
    bannerPosition: "center",
    logo: "/project-branding/police-n-thief-logo.webp",
  },
  tgc: {
    banner: "/project-branding/tgc-banner.webp",
    bannerPosition: "center 75%",
    logo: "/project-branding/tgc-logo.webp",
  },
  "project-3-33-hd": {
    banner: "/project-branding/project-3-33-hd-banner.webp",
    bannerPosition: "center top",
    logo: "/project-branding/project-3-33-hd-logo.webp",
  },
  mastra: {
    banner: "/project-branding/mastra-banner.webp",
    bannerPosition: "center",
    logo: "/project-branding/mastra-logo.webp",
  },
};

export function getProjectBranding(slug: string): ProjectBranding | null {
  return PROJECT_BRANDING[slug] ?? null;
}
