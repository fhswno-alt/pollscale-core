# Notifications

Registry: `apps/api/app/notifications.py` → `TYPES`.

v2 ships:

| type | when |
| --- | --- |
| `poll_approved` | Admin approves a flagged poll |
| `poll_rejected` | Admin rejects / takes down |
| `poll_voted` | Someone votes on your live poll |
| `user_followed` | Someone follows you |

Adding a fourth (example: poll taken down by a later report):

```python
# apps/api/app/notifications.py
TYPES["poll_milestone"] = NotificationType(
    type="poll_milestone",
    title="Your poll is moving",
    body=lambda p: p.get("body") or f"{p.get('votes', 0)} people have voted.",
)

# then, wherever it happens:
notify(db, poll.author_id, "poll_milestone", {"poll_id": poll.id, "votes": 100})
```

That is the whole change: one registry entry, one `notify(...)` call. The row is stored, and Expo push is sent if the user registered a token (`POST /me/push-token`).

The mobile app does not request notification permission at login. The user has to tap **Turn on notifications** on You or Notifications after reading the copy. `getExpoPushTokenAsync` is called with `projectId` from Expo config when `npx eas init` has been run. Android notifications go through channel `pollscale-default`.
