import { describe, expect, test } from "bun:test";
import {
  currentNotifications,
  dismiss,
  dismissAll,
  markRead,
  notify,
} from "./notifications";

describe("notifications", () => {
  test("the newest first, one per id, unread until the panel opens", () => {
    dismissAll();
    notify({ id: "a", title: "notifications.title" });
    notify({ id: "b", title: "notifications.title" });
    notify({ id: "a", title: "notifications.empty" });
    let state = currentNotifications();
    expect(state.list.map((n) => n.id)).toEqual(["a", "b"]);
    expect(state.list[0].title).toBe("notifications.empty");
    expect(state.unread).toBe(true);

    markRead();
    expect(currentNotifications().unread).toBe(false);

    dismiss("a");
    state = currentNotifications();
    expect(state.list.map((n) => n.id)).toEqual(["b"]);
    expect(state.unread).toBe(false);
  });
});
