import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";

export const usePushSubscription = () => {
  const { customer } = useCustomerAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    setIsSupported("serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
  }, []);

  useEffect(() => {
    if (!customer?.id || !isSupported || initialized.current) return;
    initialized.current = true;

    checkExistingSubscription();
  }, [customer?.id, isSupported]);

  const checkExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw-push.js") as any;
      const subscription = await registration.pushManager?.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      // SW not registered yet
    }
  };

  const subscribe = async () => {
    if (!customer?.id || !isSupported) return false;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return false;

      // Get VAPID public key from edge function
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/push-notification?action=vapid-key`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const { publicKey } = await resp.json();

      if (!publicKey) {
        console.error("No VAPID public key");
        return false;
      }

      // Convert base64url to Uint8Array
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
      };

      const registration = await navigator.serviceWorker.register("/sw-push.js") as any;
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const subJson = subscription.toJSON();

      // Save to backend
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/push-notification?action=subscribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            customer_id: customer.id,
            subscription: {
              endpoint: subJson.endpoint,
              keys: subJson.keys,
            },
          }),
        }
      );

      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error("Push subscription failed:", error);
      return false;
    }
  };

  return { isSupported, isSubscribed, subscribe };
};
