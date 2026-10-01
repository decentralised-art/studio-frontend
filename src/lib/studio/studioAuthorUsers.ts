import type { ServicesUserRecord } from "$lib/auth/api";
import type { User } from "$lib/data/users";
import {
  getServicesUserChainSourceAddresses,
  getServicesUserNickname,
  normalizeAuthorAddress,
} from "$lib/social/authorLabels";

const emptyUserAuthoredCounts = () => ({
  performativeTransactions: 0,
  features: 0,
  transformations: 0,
  conditions: 0,
});

export const mapServicesUserToStudioAuthor = (user: ServicesUserRecord): User | null => {
  const address = getServicesUserChainSourceAddresses(user)[0] ?? "";
  const displayName = getServicesUserNickname(user);
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

export const buildStudioAuthorIndex = (users: ServicesUserRecord[]): Record<string, User> => {
  const authors: Record<string, User> = {};
  users.forEach((user) => {
    const author = mapServicesUserToStudioAuthor(user);
    if (!author) return;
    getServicesUserChainSourceAddresses(user).forEach((address) => {
      authors[address] = author;
    });
    if (user.id.trim()) authors[user.id.trim()] = author;
  });
  return authors;
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
