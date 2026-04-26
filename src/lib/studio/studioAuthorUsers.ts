import type { ServicesUserRecord } from "$lib/auth/api";
import type { User } from "$lib/data/users";
import { getServicesUserEthereumAddress, normalizeAuthorAddress } from "$lib/social/authorLabels";

const emptyUserAuthoredCounts = () => ({
  performativeTransactions: 0,
  features: 0,
  transformations: 0,
  conditions: 0,
});

export const mapServicesUserToStudioAuthor = (user: ServicesUserRecord): User | null => {
  const address = getServicesUserEthereumAddress(user);
  const displayName =
    typeof user.display_name === "string"
      ? user.display_name.trim()
      : typeof user.displayName === "string"
        ? user.displayName.trim()
        : "";
  if (!address) return null;
  if (!displayName) return null;
  return {
    id: address,
    kind: "human",
    address,
    nickname: displayName,
    avatarUrl: "",
    authored: emptyUserAuthoredCounts(),
    toolbox: [],
  };
};

export const buildStudioUsersById = ({
  baseUsersById,
  servicesAuthorUsersById,
}: {
  baseUsersById: Record<string, User>;
  servicesAuthorUsersById: Record<string, User>;
}): Record<string, User> => {
  const usersById: Record<string, User> = { ...baseUsersById };

  Object.entries(servicesAuthorUsersById).forEach(([key, user]) => {
    usersById[key] = user;
    const address = normalizeAuthorAddress(user.address);
    if (address) usersById[address] = user;
  });

  return usersById;
};
