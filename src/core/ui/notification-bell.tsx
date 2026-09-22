"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { createBrowserSupabaseClient } from "@/core/db/client";
import { formatRelativeFr } from "@/core/time";

import { Button } from "./button";
import { cn } from "./utils";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

/**
 * The notification bell.
 *
 * Reads straight from the browser client: Row Level Security already limits the
 * rows to the signed-in user, so a server round-trip would add latency without
 * adding safety. Realtime tells the cache when to refetch, which is what makes a
 * leave approval appear on a phone without anyone reloading.
 */
export function NotificationBell({ userId }: { userId: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const queryKey = useMemo(() => ["notifications", userId], [userId]);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, title, body, href, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, queryClient, queryKey]);

  const unread = notifications.filter((item) => item.read_at === null);

  const openNotification = async (item: NotificationRow) => {
    setOpen(false);
    if (item.read_at === null) {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", item.id);
      void queryClient.invalidateQueries({ queryKey });
    }
    if (item.href) router.push(item.href as Route);
  };

  const markAllRead = async () => {
    await supabase.rpc("mark_all_notifications_read");
    void queryClient.invalidateQueries({ queryKey });
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((current) => !current)}
        aria-label={
          unread.length > 0 ? `Notifications, ${unread.length} non lues` : "Notifications"
        }
        aria-expanded={open}
      >
        <span className="relative flex items-center">
          <Bell className="size-5" aria-hidden />
          {unread.length > 0 ? (
            <span
              className="bg-primary text-primary-foreground absolute -top-1.5 -right-2 min-w-5 rounded-full px-1 text-center text-[11px] leading-5 font-semibold"
              aria-hidden
            >
              {unread.length > 99 ? "99+" : unread.length}
            </span>
          ) : null}
        </span>
      </Button>

      {open ? (
        <>
          {/* Tapping anywhere else closes the panel, which is how a phone expects it. */}
          <button
            type="button"
            className="fixed inset-0 z-20 cursor-default"
            aria-label="Fermer les notifications"
            onClick={() => setOpen(false)}
          />

          <div className="bg-popover text-popover-foreground absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border shadow-lg">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <span className="font-medium">Notifications</span>
              {unread.length > 0 ? (
                <Button variant="ghost" size="sm" onClick={markAllRead}>
                  <CheckCheck className="size-4" aria-hidden /> Tout lire
                </Button>
              ) : null}
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {isLoading ? (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm">Chargement…</p>
              ) : notifications.length === 0 ? (
                <p className="text-muted-foreground px-4 py-8 text-center text-sm">
                  Aucune notification pour le moment.
                </p>
              ) : (
                <ul>
                  {notifications.map((item) => (
                    <li key={item.id} className="border-b last:border-b-0">
                      <button
                        type="button"
                        onClick={() => void openNotification(item)}
                        className={cn(
                          "hover:bg-secondary/60 flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors",
                          item.read_at === null && "bg-secondary/40",
                        )}
                      >
                        <span className="flex items-start gap-2">
                          {item.read_at === null ? (
                            <span
                              className="bg-primary mt-1.5 size-2 shrink-0 rounded-full"
                              aria-hidden
                            />
                          ) : (
                            <span className="mt-1.5 size-2 shrink-0" aria-hidden />
                          )}
                          <span className="font-medium">{item.title}</span>
                        </span>
                        <span className="text-muted-foreground pl-4 text-sm">{item.body}</span>
                        <span className="text-muted-foreground pl-4 text-xs">
                          {formatRelativeFr(item.created_at)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
