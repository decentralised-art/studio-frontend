export const getUserAvatarInitials = (name: string): string => {
  const tokens = name
    .trim()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);

  if (tokens.length >= 2) {
    return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
  }

  const compact = tokens[0] ?? name.trim();
  return compact.slice(0, 2).toUpperCase() || "?";
};
