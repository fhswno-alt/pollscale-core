import { Platform } from "react-native";

import type { Feed, Person, Poll, SessionUser, Topic } from "./types";

const FALLBACK =
  Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || FALLBACK).replace(/\/$/, "");
export const ALLOW_DEV_AUTH = process.env.EXPO_PUBLIC_ALLOW_DEV_AUTH === "true";
export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";

type Opts = {
  token?: string | null;
  deviceId: string;
  method?: string;
  body?: unknown;
  form?: FormData;
};

async function request<T>(path: string, opts: Opts): Promise<T> {
  const headers: Record<string, string> = {
    "X-Device-Id": opts.deviceId,
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const response = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body,
  });
  if (!response.ok) {
    let detail = `http_${response.status}`;
    try {
      const payload = await response.json();
      detail = payload.detail || detail;
    } catch {
      // keep status
    }
    const error = new Error(detail);
    (error as Error & { status: number }).status = response.status;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  health: () => fetch(`${API_URL}/health`).then((r) => r.json()),
  me: (deviceId: string, token: string) => request<SessionUser>("/me", { deviceId, token }),
  feed: (deviceId: string, token?: string | null) =>
    request<Feed>("/feed/next", { deviceId, token }),
  poll: (id: string, deviceId: string, token?: string | null) =>
    request<Poll>(`/polls/${id}`, { deviceId, token }),
  vote: (pollId: string, optionId: string, deviceId: string, token?: string | null) =>
    request<Feed>(`/polls/${pollId}/vote`, {
      deviceId,
      token,
      method: "POST",
      body: { option_id: optionId },
    }),
  skip: (pollId: string, deviceId: string, token?: string | null) =>
    request<Feed>(`/polls/${pollId}/skip`, { deviceId, token, method: "POST" }),
  report: (pollId: string, reason: string, deviceId: string, token?: string | null, detail?: string) =>
    request<{ id: string }>(`/polls/${pollId}/report`, {
      deviceId,
      token,
      method: "POST",
      body: { reason, detail },
    }),
  deletePoll: (pollId: string, deviceId: string, token: string) =>
    request<void>(`/polls/${pollId}`, { deviceId, token, method: "DELETE" }),
  myPolls: (deviceId: string, token: string) => request<Poll[]>("/me/polls", { deviceId, token }),
  deleteAccount: (deviceId: string, token: string) =>
    request<void>("/me", { deviceId, token, method: "DELETE" }),
  setHandle: (handle: string, deviceId: string, token: string) =>
    request<SessionUser>("/me", { deviceId, token, method: "PATCH", body: { handle } }),
  notifications: (deviceId: string, token: string) =>
    request<{ id: string; type: string; title: string; body: string }[]>("/me/notifications", {
      deviceId,
      token,
    }),
  registerPush: (token: string, expoToken: string, deviceId: string, platform: string) =>
    request<{ status: string }>("/me/push-token", {
      deviceId,
      token,
      method: "POST",
      body: { token: expoToken, platform },
    }),
  blockPerson: (id: string, deviceId: string, token: string) =>
    request<Person>(`/users/${id}/block`, { deviceId, token, method: "POST" }),
  createPoll: (
    body: {
      question: string;
      topic_id: string;
      question_image_url?: string | null;
      options: { label: string; image_url?: string | null }[];
    },
    deviceId: string,
    token: string,
  ) => request<Poll>("/polls", { deviceId, token, method: "POST", body }),
  topics: (deviceId: string, token?: string | null) =>
    request<Topic[]>("/topics", { deviceId, token }),
  followTopic: (id: string, deviceId: string, token: string, on: boolean) =>
    request<Topic>(`/topics/${id}/follow`, {
      deviceId,
      token,
      method: on ? "POST" : "DELETE",
    }),
  people: (deviceId: string, token?: string | null) =>
    request<Person[]>("/users", { deviceId, token }),
  person: (id: string, deviceId: string, token?: string | null) =>
    request<Person>(`/users/${id}`, { deviceId, token }),
  followPerson: (id: string, deviceId: string, token: string, on: boolean) =>
    request<Person>(`/users/${id}/follow`, {
      deviceId,
      token,
      method: on ? "POST" : "DELETE",
    }),
  apple: (identityToken: string, fullName: string | null, deviceId: string, handle?: string) =>
    request<{ access_token: string; user: SessionUser }>("/auth/apple", {
      deviceId,
      method: "POST",
      body: { identity_token: identityToken, full_name: fullName, handle },
    }),
  google: (idToken: string, deviceId: string, handle?: string) =>
    request<{ access_token: string; user: SessionUser }>("/auth/google", {
      deviceId,
      method: "POST",
      body: { id_token: idToken, handle },
    }),
  devAuth: (displayName: string, deviceId: string, handle?: string, email?: string) =>
    request<{ access_token: string; user: SessionUser }>("/auth/dev", {
      deviceId,
      method: "POST",
      body: { display_name: displayName, handle, email },
    }),
  upload: async (uri: string, deviceId: string, token: string) => {
    const form = new FormData();
    const name = uri.split("/").pop() || "photo.jpg";
    const type = name.endsWith(".png") ? "image/png" : "image/jpeg";
    if (Platform.OS === "web") {
      const blob = await fetch(uri).then((r) => r.blob());
      form.append("file", blob, name);
    } else {
      form.append("file", { uri, name, type } as unknown as Blob);
    }
    return request<{ url: string }>("/uploads", {
      deviceId,
      token,
      method: "POST",
      form,
    });
  },
};
