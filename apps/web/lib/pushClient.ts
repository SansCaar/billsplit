"use client";
/** Browser side of notifications: permission, the service worker, and this device's push subscription. */
import { api } from "./client";

/** on/off: this device's switch. ios-install: iPhone Safari, needs Add to Home Screen first. */
export type PushState = "unsupported" | "ios-install" | "denied" | "off" | "on";

export const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

let synced = false;
export async function pushState(): Promise<PushState> {
  if (!supported()) return isIos() && !isStandalone() ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const sub = Notification.permission === "granted" ? await currentSubscription() : null;
  if (!sub) return "off";
  // Re-send once per page load: keeps the server right if it dropped the device or someone else signed in here.
  if (!synced) { synced = true; void api("/api/push/devices", "POST", sub.toJSON()).catch(() => { synced = false; }); }
  return "on";
}

/** Call straight from a tap: Safari only shows the permission prompt for a user gesture. */
export async function enablePush(): Promise<PushState> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new Error("Notifications aren't set up on this server yet.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(key) }));
  await api("/api/push/devices", "POST", sub.toJSON());
  synced = true;
  return "on";
}

/** Send this device's subscription to the server again (it may have been dropped). Returns false if there is none. */
export async function resyncPush(): Promise<boolean> {
  const sub = Notification.permission === "granted" ? await currentSubscription() : null;
  if (!sub) return false;
  await api("/api/push/devices", "POST", sub.toJSON());
  return true;
}

export async function disablePush(): Promise<PushState> {
  const sub = await currentSubscription();
  if (sub) {
    await api("/api/push/devices", "DELETE", { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  }
  return "off";
}

function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = (s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
