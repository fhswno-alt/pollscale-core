import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import { ALLOW_DEV_AUTH, GOOGLE_CLIENT_ID, api } from "./api";
import type { Feed, SessionUser } from "./types";

WebBrowser.maybeCompleteAuthSession();

const DEVICE_KEY = "pollscale.device_id";
const GUEST_KEY = "pollscale.guest_votes";
const TOKEN_KEY = "pollscale.jwt";

async function memoryGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return AsyncStorage.getItem(key);
  }
}

async function memorySet(key: string, value: string | null): Promise<void> {
  try {
    if (value == null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    if (value == null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  }
}

function newId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type Session = {
  ready: boolean;
  deviceId: string;
  token: string | null;
  user: SessionUser | null;
  guestVotesUsed: number;
  wall: boolean;
  applyFeed: (feed: Feed) => void;
  signInApple: () => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  consumeGuestVote: () => Promise<number>;
  requireAccount: () => boolean;
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [guestVotesUsed, setGuestVotesUsed] = useState(0);

  const [, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID || "000000000000-dev.apps.googleusercontent.com",
    iosClientId: GOOGLE_CLIENT_ID || undefined,
    androidClientId: GOOGLE_CLIENT_ID || undefined,
  });

  useEffect(() => {
    (async () => {
      let id = await AsyncStorage.getItem(DEVICE_KEY);
      if (!id) {
        id = newId();
        await AsyncStorage.setItem(DEVICE_KEY, id);
      }
      const storedGuest = Number((await AsyncStorage.getItem(GUEST_KEY)) || "0");
      const storedToken = await memoryGet(TOKEN_KEY);
      setDeviceId(id);
      setGuestVotesUsed(Number.isFinite(storedGuest) ? storedGuest : 0);
      setToken(storedToken);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (googleResponse?.type === "success" && googleResponse.params.id_token && deviceId) {
      api.google(googleResponse.params.id_token, deviceId).then(async (res) => {
        await memorySet(TOKEN_KEY, res.access_token);
        setToken(res.access_token);
        setUser(res.user);
      });
    }
  }, [googleResponse, deviceId]);

  const applyFeed = (feed: Feed) => {
    if (!token) {
      setGuestVotesUsed(feed.guest_votes_used);
      AsyncStorage.setItem(GUEST_KEY, String(feed.guest_votes_used));
    }
  };

  const consumeGuestVote = async () => {
    if (token) return guestVotesUsed;
    const next = Math.min(3, guestVotesUsed + 1);
    setGuestVotesUsed(next);
    await AsyncStorage.setItem(GUEST_KEY, String(next));
    return next;
  };

  const finishDev = async (label: string) => {
    const res = await api.devAuth(label, deviceId);
    await memorySet(TOKEN_KEY, res.access_token);
    setToken(res.access_token);
    setUser(res.user);
  };

  const signInApple = async () => {
    if (ALLOW_DEV_AUTH && (Platform.OS !== "ios" || !AppleAuthentication.isAvailableAsync)) {
      await finishDev("Apple Tester");
      return;
    }
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        if (ALLOW_DEV_AUTH) await finishDev("Apple Tester");
        return;
      }
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error("no_apple_token");
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(" ");
      const res = await api.apple(credential.identityToken, fullName || null, deviceId);
      await memorySet(TOKEN_KEY, res.access_token);
      setToken(res.access_token);
      setUser(res.user);
    } catch (error) {
      if (ALLOW_DEV_AUTH) await finishDev("Apple Tester");
      else throw error;
    }
  };

  const signInGoogle = async () => {
    if (!GOOGLE_CLIENT_ID || ALLOW_DEV_AUTH) {
      if (GOOGLE_CLIENT_ID) {
        const result = await promptGoogle();
        if (result?.type === "success" && result.params.id_token) {
          const res = await api.google(result.params.id_token, deviceId);
          await memorySet(TOKEN_KEY, res.access_token);
          setToken(res.access_token);
          setUser(res.user);
          return;
        }
      }
      if (ALLOW_DEV_AUTH) await finishDev("Google Tester");
      return;
    }
    await promptGoogle();
  };

  const signOut = async () => {
    await memorySet(TOKEN_KEY, null);
    setToken(null);
    setUser(null);
  };

  const wall = !token && guestVotesUsed >= 3;

  const value = useMemo<Session>(
    () => ({
      ready,
      deviceId,
      token,
      user,
      guestVotesUsed,
      wall,
      applyFeed,
      signInApple,
      signInGoogle,
      signOut,
      consumeGuestVote,
      requireAccount: () => !token && guestVotesUsed >= 3,
    }),
    [ready, deviceId, token, user, guestVotesUsed, wall],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("SessionProvider missing");
  return ctx;
}
