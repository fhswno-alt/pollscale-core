# For You ranking

The feed is one live poll at a time. There is no Following tab. Follows only change this score.

## Candidates

Unseen (no vote, no skip), not blocked, not `pending_review`, `status=live`, public. A **Not interested** tap also hides that poll. Guests and signed-in users who have not finished onboarding get recency only.

## Score (signed-in, onboarded)

| Signal | Effect |
| --- | --- |
| Vote on that topic / subtopic, and on that creator | Strongest positive |
| Dwell time on screen | Positive, capped |
| Follow a person or topic | Boost |
| Skip on that topic | Negative |
| Relevant | Boost that topic (can surface a topic they never picked) |
| Not interested | Hard-suppress that topic / subtopic for 14 days |
| Report | Moderation only. Not a ranking signal. |
| Optional city | Boost only if the poll has a matching `city_tag`. Not a filter. |

Followed people get a boost but do not always beat a better interest match.

Topics the user never selected (for example Politics) almost never appear, unless they later tap **Relevant** or the ~15% exploration roll picks one.

At most two polls from the same parent topic in a row, unless nothing else is left.

Exploration is about 15% so the feed does not trap them on one cluster.
