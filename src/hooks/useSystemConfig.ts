import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useSystemConfig = () => {
  const { data: config } = useQuery({
    queryKey: ["system-configs-global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_configs")
        .select("site_title, favicon_url")
        .eq("active", true)
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!config) return;

    if (config.site_title) {
      document.title = config.site_title;
    }

    if (config.favicon_url) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = config.favicon_url;
      } else {
        link = document.createElement("link");
        link.rel = "icon";
        link.href = config.favicon_url;
        document.head.appendChild(link);
      }
    }
  }, [config]);
};
