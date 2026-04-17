type ResolveNetworkFeedEmptyMessageInput = {
  feedLoadError: string;
  hasVisibleEvents: boolean;
  hasFollowTargets: boolean;
  hasOwnEvents: boolean;
};

export const resolveNetworkFeedEmptyMessage = (
  input: ResolveNetworkFeedEmptyMessageInput,
): string => {
  if (input.feedLoadError) return input.feedLoadError;
  if (input.hasVisibleEvents) return "No events to display yet.";
  if (!input.hasFollowTargets && !input.hasOwnEvents) {
    return "No events to display yet because you are not following any accounts or formats. Use search above to follow an account, and your own events will always appear here.";
  }
  if (input.hasFollowTargets) {
    return "No events from followed users or followed formats yet.";
  }
  return "No events to display yet.";
};
