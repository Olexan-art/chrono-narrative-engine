import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, differenceInDays, isPast, isToday, parseISO } from "date-fns";
import { CalendarDays, Flag, ExternalLink, Plus, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminStore } from "@/stores/adminStore";
import { adminAction } from "@/lib/api";
import { toast } from "sonner";

interface Holiday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  global: boolean;
  counties: string[] | null;
  types: string[];
}

interface WikiEntity {
  id: string;
  name: string;
  name_en: string | null;
  slug: string | null;
}

const HOLIDAY_EMOJIS: Record<string, string> = {
  "New Year's Day": "🎆",
  "Martin Luther King, Jr. Day": "✊",
  "Washington's Birthday": "🎩",
  "Presidents Day": "🎩",
  "Memorial Day": "🎖️",
  "Juneteenth National Independence Day": "✊",
  "Independence Day": "🇺🇸",
  "Labour Day": "⚒️",
  "Labor Day": "⚒️",
  "Columbus Day": "⚓",
  "Veterans Day": "🎖️",
  "Thanksgiving Day": "🦃",
  "Christmas Day": "🎄",
  "Good Friday": "✝️",
  "Easter Sunday": "🐣",
};

export function HolidayTimeline() {
  const { language } = useLanguage();
  const { isAuthenticated: isAdmin, password } = useAdminStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  const year = new Date().getFullYear();
  const today = new Date();

  // Fetch US holidays from date.nager.at
  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ["us-holidays", year],
    queryFn: async () => {
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/US`);
      if (!res.ok) throw new Error("Failed to fetch holidays");
      const all: Holiday[] = await res.json();
      // Only global public holidays
      return all.filter((h) => h.global && h.types.includes("Public"));
    },
    staleTime: 1000 * 60 * 60 * 24, // 24h
  });

  // Fetch wiki entities for holiday names
  const { data: entityMap = {}, refetch: refetchEntities } = useQuery<Record<string, WikiEntity>>({
    queryKey: ["holiday-entities", holidays.map((h) => h.name).join(",")],
    queryFn: async () => {
      if (!holidays.length) return {};
      const names = holidays.map((h) => h.name);
      const { data } = await supabase
        .from("wiki_entities")
        .select("id, name, name_en, slug")
        .in("name_en", names);
      const map: Record<string, WikiEntity> = {};
      (data || []).forEach((e) => {
        if (e.name_en) map[e.name_en] = e;
      });
      return map;
    },
    enabled: holidays.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  // Scroll timeline so today is centered on mount
  useEffect(() => {
    if (todayRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const todayEl = todayRef.current;
      const offset = todayEl.offsetLeft - container.clientWidth / 2 + todayEl.clientWidth / 2;
      container.scrollTo({ left: offset, behavior: "smooth" });
    }
  }, [holidays]);

  const createHolidayEntity = async (holiday: Holiday) => {
    if (!password) return;
    setCreatingFor(holiday.name);
    try {
      const result = await adminAction("createHolidayEntity", password, {
        name: holiday.name,
        date: holiday.date,
      });
      if (result.success) {
        toast.success(language === "uk" ? `Сутність "${holiday.name}" створена` : `Entity "${holiday.name}" created`);
        refetchEntities();
      } else {
        throw new Error(result.error || "Failed");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingFor(null);
    }
  };

  if (!holidays.length) return null;

  // Build augmented list: show holidays with days between them
  const sortedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  const todayStr = format(today, "yyyy-MM-dd");

  // Find index of "today" position (between which holidays)
  const todayIndex = sortedHolidays.findIndex((h) => h.date >= todayStr);
  const pivotIndex = todayIndex === -1 ? sortedHolidays.length - 1 : todayIndex;

  // Show a window: 3 past, today marker, up to 7 future
  const windowStart = Math.max(0, pivotIndex - 3);
  const windowEnd = Math.min(sortedHolidays.length, pivotIndex + 8);
  const visibleHolidays = sortedHolidays.slice(windowStart, windowEnd);

  const showTodayBefore = todayIndex > 0 && todayIndex <= windowEnd;

  return (
    <section className="py-4 px-4 bg-gradient-to-r from-black via-gray-950 to-black border-y border-cyan-900/30 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Flag className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono uppercase tracking-widest text-cyan-500">
            {language === "uk" ? "Свята США" : "US Federal Holidays"} {year}
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-cyan-900/60 to-transparent" />
          <Sparkles className="w-3 h-3 text-cyan-600 animate-pulse" />
        </div>

        {/* Scrollable timeline */}
        <div
          ref={scrollRef}
          className="flex items-stretch gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-cyan-900"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {visibleHolidays.map((holiday, idx) => {
            const holidayDate = parseISO(holiday.date);
            const isPastHoliday = isPast(holidayDate) && !isToday(holidayDate);
            const isTodayHoliday = isToday(holidayDate);
            const daysAway = differenceInDays(holidayDate, today);
            const entity = entityMap[holiday.name];
            const emoji = HOLIDAY_EMOJIS[holiday.name] || "🇺🇸";

            // Show today marker before this holiday if it falls between previous and this
            const prevDate = idx > 0 ? visibleHolidays[idx - 1].date : null;
            const showTodayHere =
              !isTodayHoliday &&
              ((!prevDate && holiday.date > todayStr) ||
                (prevDate && prevDate < todayStr && holiday.date > todayStr));

            return (
              <div key={holiday.date + holiday.name} className="flex items-center gap-2 flex-shrink-0" style={{ scrollSnapAlign: "start" }}>
                {/* Today marker */}
                {showTodayHere && (
                  <div ref={todayRef} className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className="w-px h-10 bg-gradient-to-b from-transparent via-green-400 to-transparent" />
                    <div className="px-2 py-1 rounded border border-green-500/60 bg-green-950/40 shadow-[0_0_12px_rgba(34,197,94,0.4)]">
                      <span className="text-[10px] font-mono text-green-400 uppercase tracking-widest">
                        {language === "uk" ? "Сьогодні" : "Today"}
                      </span>
                      <div className="text-[9px] text-green-600 font-mono">{format(today, "dd.MM")}</div>
                    </div>
                    <div className="w-px h-6 bg-gradient-to-b from-green-400 to-transparent" />
                    {/* connector */}
                    <div className="w-6 h-px bg-cyan-900/40" />
                  </div>
                )}

                {isTodayHoliday && <div ref={todayRef} />}

                {/* Holiday card */}
                <div
                  className={`relative flex-shrink-0 group ${
                    isTodayHoliday
                      ? "ring-2 ring-green-500/60 shadow-[0_0_16px_rgba(34,197,94,0.35)]"
                      : isPastHoliday
                      ? "opacity-50"
                      : ""
                  }`}
                >
                  {entity?.slug ? (
                    <Link to={`/wiki/${entity.slug}`} className="block">
                      <HolidayCard
                        holiday={holiday}
                        emoji={emoji}
                        daysAway={daysAway}
                        isPast={isPastHoliday}
                        isToday={isTodayHoliday}
                        linkedEntity={entity}
                        language={language}
                      />
                    </Link>
                  ) : (
                    <div className="relative">
                      <HolidayCard
                        holiday={holiday}
                        emoji={emoji}
                        daysAway={daysAway}
                        isPast={isPastHoliday}
                        isToday={isTodayHoliday}
                        linkedEntity={null}
                        language={language}
                      />
                      {isAdmin && !entity && (
                        <button
                          onClick={() => createHolidayEntity(holiday)}
                          disabled={creatingFor === holiday.name}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-sm border border-cyan-500/50 bg-cyan-950/80 text-cyan-400 hover:bg-cyan-500/20 hover:shadow-[0_0_6px_rgba(0,255,255,0.4)] flex items-center justify-center transition-all"
                          title="Create wiki entity"
                        >
                          {creatingFor === holiday.name ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Plus className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Connector line */}
                {idx < visibleHolidays.length - 1 && (
                  <div className="flex-shrink-0 flex items-center">
                    <div className="w-4 h-px bg-gradient-to-r from-cyan-900/60 to-cyan-900/30" />
                    <div className="w-1 h-1 rounded-full bg-cyan-800/60" />
                    <div className="w-4 h-px bg-gradient-to-r from-cyan-900/30 to-cyan-900/60" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HolidayCard({
  holiday,
  emoji,
  daysAway,
  isPast,
  isToday: isTodayHoliday,
  linkedEntity,
  language,
}: {
  holiday: Holiday;
  emoji: string;
  daysAway: number;
  isPast: boolean;
  isToday: boolean;
  linkedEntity: WikiEntity | null;
  language: string;
}) {
  const daysLabel =
    isTodayHoliday
      ? language === "uk" ? "Сьогодні" : "Today"
      : isPast
      ? language === "uk" ? `${Math.abs(daysAway)}д тому` : `${Math.abs(daysAway)}d ago`
      : daysAway === 1
      ? language === "uk" ? "Завтра" : "Tomorrow"
      : language === "uk" ? `за ${daysAway}д` : `in ${daysAway}d`;

  const borderColor = isTodayHoliday
    ? "border-green-500/60 shadow-[0_0_10px_rgba(34,197,94,0.25)]"
    : isPast
    ? "border-gray-700/40"
    : "border-cyan-700/40 hover:border-cyan-500/70 hover:shadow-[0_0_10px_rgba(0,255,255,0.2)]";

  return (
    <div
      className={`w-28 rounded border bg-gradient-to-b from-gray-900 to-black p-2 transition-all duration-200 cursor-pointer ${borderColor}`}
    >
      <div className="text-center mb-1">
        <span className="text-lg leading-none">{emoji}</span>
      </div>
      <div className="text-[10px] font-mono text-cyan-600 mb-0.5">{format(parseISO(holiday.date), "MMM dd")}</div>
      <div className="text-[10px] font-semibold text-gray-200 leading-tight line-clamp-2 mb-1">
        {holiday.name}
      </div>
      <div
        className={`text-[9px] font-mono uppercase tracking-wide ${
          isTodayHoliday ? "text-green-400" : isPast ? "text-gray-600" : "text-cyan-500"
        }`}
      >
        {daysLabel}
      </div>
      {linkedEntity && (
        <div className="mt-1 flex items-center gap-1">
          <ExternalLink className="w-2.5 h-2.5 text-cyan-600" />
          <span className="text-[8px] text-cyan-600 font-mono">wiki</span>
        </div>
      )}
    </div>
  );
}
