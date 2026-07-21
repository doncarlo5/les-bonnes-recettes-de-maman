"use client";

import { useSyncExternalStore } from "react";

const participantStorageKey = "recipe-comment-participant-v1";
let participantKeySnapshot: string | null = null;

export function usePublicParticipantKey() {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export const useRecipeCommentParticipantKey = usePublicParticipantKey;

function subscribe(onStoreChange: () => void) {
  participantKeySnapshot = readOrCreateParticipantKey();
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== participantStorageKey) return;
    participantKeySnapshot = readOrCreateParticipantKey();
    onStoreChange();
  };
  window.addEventListener("storage", handleStorage);
  queueMicrotask(onStoreChange);
  return () => window.removeEventListener("storage", handleStorage);
}

function getSnapshot() {
  return participantKeySnapshot;
}

function readOrCreateParticipantKey() {
  try {
    const storedKey = window.localStorage.getItem(participantStorageKey);
    if (storedKey && /^[a-f0-9]{48}$/.test(storedKey)) return storedKey;
    const key = createParticipantKey();
    window.localStorage.setItem(participantStorageKey, key);
    return key;
  } catch {
    return participantKeySnapshot ?? createParticipantKey();
  }
}

function createParticipantKey() {
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
