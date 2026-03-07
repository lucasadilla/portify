/**
 * All supported social / link keys for portfolio bio.
 * Used for edit form and display so we have one source of truth.
 */
export const SOCIAL_LINK_KEYS = [
  { key: "email", label: "Email", placeholder: "you@example.com" },
  { key: "website", label: "Website", placeholder: "https://yoursite.com" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/username" },
  { key: "github", label: "GitHub", placeholder: "https://github.com/username" },
  { key: "twitter", label: "X (Twitter)", placeholder: "https://x.com/username" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/username" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@channel" },
  { key: "discord", label: "Discord", placeholder: "https://discord.gg/invite or username" },
  { key: "stackoverflow", label: "Stack Overflow", placeholder: "https://stackoverflow.com/users/..." },
  { key: "devto", label: "Dev.to", placeholder: "https://dev.to/username" },
  { key: "medium", label: "Medium", placeholder: "https://medium.com/@username" },
  { key: "twitch", label: "Twitch", placeholder: "https://twitch.tv/username" },
] as const;

export type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number]["key"];
