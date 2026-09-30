"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import { PageHeader, Segmented, StatusBadge, useMediaQuery } from "@/components/ui";
import { useUI } from "@/components/shell/ui-context";
import { useActive } from "@/lib/data/store";
import { APPT_STATUS, APPT_TYPES } from "@/lib/constants";
import { useQueryParam } from "@/lib/hooks";
import { useSettings } from "@/lib/settings";
import type { Rec } from "@/lib/types";
import { addDays, cx, dateToISO, download, fmtDate, MONTHS, norm, parseDay, startOfMonth, todayISO, WEEKDAYS } from "@/lib/utils";

type View = "dia" | "semana" | "mes";

export default function AgendaPage() {
  const ui = useUI();
  const { items } = useActive("appointments");
  const { settings } = useSettings();
  const h0 = Math.max(0, Math.min(22, parseInt(String(settings.agendaStart || "08:00").slice(0, 2), 10) - 1));
  const h1 = Math.max(h0 + 2, Math.min(23, parseInt(String(settings.agendaEnd || "18:00").slice(0, 2), 10) + 1));
  const HOURS = Array.from({ length: h1 - h0 + 1 }, (_, i) => i + h0);
  const customers = useActive("customers");
  const mobile = useMediaQuery("(max-width: 767px)");
  const [view, setView] = useState<View>("semana");
  const [cur, setCur] = useState(todayISO());
  const [isNew, clear] = useQueryParam("new");
  useEffect(() => { if (isNew) { ui.openForm("appointments"); clear(); } }, [isNew]); // eslint-disable-line react-hooks/exhaustive-deps
  // Em telas pequenas, cai da visão "semana" para "dia" (ajuste durante a renderização, sem efeito).
  const [wasMobile, setWasMobile] = useState(mobile);
  if (mobile !== wasMobile) {
    setWasMobile(mobile);
    if (mobile && view === "semana") setView("dia");
  }

  const cname = (id: string) => customers.items.find((c) => c.id === id)?.name || "";
  const byDay = useMemo(() => {
    const m = new Map<string, Rec[]>();
    items.forEach((a) => a.date && m.set(a.date, [...(m.get(a.date) || []), a]));
    m.forEach((l) => l.sort((x, y) => (x.startTime || "").localeCompare(y.startTime || "")));
    return m;
  }, [items]);

  const d = parseDay(cur);
  const weekStart = addDays(cur, -d.getDay());
  const step = (n: number) => setCur(view === "mes" ? dateToISO(new Date(d.getFullYear(), d.getMonth() + n, 1)) : addDays(cur, n * (view === "semana" ? 7 : 1)));
  const title = view === "mes" ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : view === "semana" ? `${fmtDate(weekStart)} — ${fmtDate(addDays(weekStart, 6))}` : `${WEEKDAYS[d.getDay()]}, ${fmtDate(cur)}`;

  const Chip = ({ a, full }: { a: Rec; full?: boolean }) => {
    const color = APPT_TYPES[a.type]?.color || "#38a8ff";
    return (
      <button onClick={(e) => { e.stopPropagation(); a.workOrderId ? ui.openDetail("work_orders", a.workOrderId) : ui.openForm("appointments", a.id); }} title={`${a.title} ${cname(a.customerId)}`}
        className={cx("w-full text-left rounded-lg px-2 py-1 border-l-[3px] bg-solid2/80 hover:bg-solid3 transition text-[11.5px] leading-tight", a.status === "cancelado" && "opacity-50 line-through")} style={{ borderColor: color }}>
        <div className="font-semibold truncate">{a.startTime && <span className="tabular-nums mr-1 text-fg2">{a.startTime}</span>}{a.title}</div>
        {full && <div className="text-fg3 truncate">{cname(a.customerId) || a.address}</div>}
      </button>
    );
  };

  const exportIcs = () => {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const fmt = (date: string, time?: string) => date.replace(/-/g, "") + (time ? `T${time.replace(":", "")}00` : "");
    const esc = (s: string) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
    const ev = items.filter((a) => a.date && a.status !== "cancelado").map((a) => [
      "BEGIN:VEVENT", `UID:${a.id}@gbrgestao`, `DTSTAMP:${stamp}`,
      a.startTime ? `DTSTART:${fmt(a.date, a.startTime)}` : `DTSTART;VALUE=DATE:${fmt(a.date)}`,
      a.startTime ? `DTEND:${fmt(a.date, a.endTime || a.startTime)}` : `DTEND;VALUE=DATE:${fmt(addDays(a.date, 1))}`,
      `SUMMARY:${esc(`${a.title}${cname(a.customerId) ? " — " + cname(a.customerId) : ""}`)}`, a.address ? `LOCATION:${esc(a.address)}` : "", a.notes ? `DESCRIPTION:${esc(a.notes)}` : "", "END:VEVENT",
    ].filter(Boolean).join("\r\n"));
    download("agenda-gbr.ics", ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GBR Gestao//PT-BR", ...ev, "END:VCALENDAR"].join("\r\n"), "text/calendar;charset=utf-8");
  };

  return (
    <>
      <PageHeader title="Agenda" subtitle="Atendimentos, visitas, instalações e compromissos ligados a clientes e OS."
        actions={<><button className="btn" onClick={exportIcs} title="Exportar para Google/Apple/Outlook Calendar (.ics)"><Download size={15} /> Exportar .ics</button><button className="btn btn-primary" onClick={() => ui.openForm("appointments", null, { date: cur })}><Plus size={16} /> Novo</button></>} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1"><button className="btn btn-icon" aria-label="Anterior" onClick={() => step(-1)}><ChevronLeft size={17} /></button><button className="btn" onClick={() => setCur(todayISO())}>Hoje</button><button className="btn btn-icon" aria-label="Próximo" onClick={() => step(1)}><ChevronRight size={17} /></button></div>
        <h2 className="font-bold text-lg flex-1 min-w-[160px]">{title}</h2>
        <Segmented<View> value={view} onChange={setView} options={[{ id: "dia", label: "Dia" }, ...(mobile ? [] : [{ id: "semana" as View, label: "Semana" }]), { id: "mes", label: "Mês" }]} />
      </div>

      {view === "dia" && (
        <div className="card overflow-hidden">
          {(byDay.get(cur) || []).length === 0 && <div className="p-6 text-center text-sm text-fg3"><CalendarDays className="mx-auto mb-2" />Nenhum compromisso neste dia. <button className="text-accent font-semibold" onClick={() => ui.openForm("appointments", null, { date: cur })}>Agendar</button></div>}
          {HOURS.map((h) => {
            const hh = String(h).padStart(2, "0");
            const list = (byDay.get(cur) || []).filter((a) => (a.startTime || "").startsWith(hh));
            return (
              <div key={h} className="flex border-t border-line first:border-t-0 min-h-[52px] hover:bg-white/[.02] cursor-pointer" onClick={() => ui.openForm("appointments", null, { date: cur, startTime: `${hh}:00` })}>
                <div className="w-14 shrink-0 text-right pr-3 pt-2 text-xs text-fg3 tabular-nums">{hh}:00</div>
                <div className="flex-1 py-1.5 pr-2 space-y-1">{list.map((a) => <div key={a.id} className="flex items-center gap-2"><div className="flex-1"><Chip a={a} full /></div><StatusBadge def={APPT_STATUS[a.status]} /></div>)}</div>
              </div>
            );
          })}
          {(byDay.get(cur) || []).filter((a) => !a.startTime).length > 0 && <div className="border-t border-line p-3"><div className="text-[11px] font-bold uppercase text-fg3 mb-1">Dia inteiro / sem horário</div><div className="space-y-1">{(byDay.get(cur) || []).map((a) => <Chip key={a.id} a={a} full />)}</div></div>}
        </div>
      )}

      {view === "semana" && (
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day) => (
            <div key={day} className={cx("card p-2 min-h-[340px] cursor-pointer", day === todayISO() && "border-accent/50")} onClick={() => ui.openForm("appointments", null, { date: day })}>
              <button className="w-full text-left mb-2" onClick={(e) => { e.stopPropagation(); setCur(day); setView("dia"); }}><div className="text-[11px] text-fg3 uppercase font-bold">{WEEKDAYS[parseDay(day).getDay()]}</div><div className={cx("text-lg font-bold", day === todayISO() && "text-accent")}>{day.slice(8)}</div></button>
              <div className="space-y-1">{(byDay.get(day) || []).map((a) => <Chip key={a.id} a={a} />)}</div>
            </div>
          ))}
        </div>
      )}

      {view === "mes" && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 bg-black/10">{WEEKDAYS.map((w) => <div key={w} className="th text-center !px-1">{w}</div>)}</div>
          <div className="grid grid-cols-7">
            {(() => {
              const first = startOfMonth(cur);
              const start = addDays(first, -parseDay(first).getDay());
              return Array.from({ length: 42 }, (_, i) => addDays(start, i)).map((day) => {
                const inMonth = day.slice(0, 7) === cur.slice(0, 7);
                const list = byDay.get(day) || [];
                return (
                  <div key={day} className={cx("border-t border-l border-line min-h-[74px] sm:min-h-[104px] p-1 cursor-pointer hover:bg-white/[.03]", !inMonth && "opacity-40")} onClick={() => { setCur(day); setView("dia"); }}>
                    <div className={cx("text-xs font-semibold mb-1 size-6 grid place-items-center rounded-full", day === todayISO() && "bg-accent text-[var(--accent-fg)]")}>{Number(day.slice(8))}</div>
                    <div className="hidden sm:block space-y-0.5">{list.slice(0, 3).map((a) => <Chip key={a.id} a={a} />)}{list.length > 3 && <div className="text-[10.5px] text-fg3 px-1">+{list.length - 3} mais</div>}</div>
                    <div className="sm:hidden flex gap-0.5 flex-wrap px-0.5">{list.slice(0, 4).map((a) => <span key={a.id} className="size-1.5 rounded-full" style={{ background: APPT_TYPES[a.type]?.color }} />)}</div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3 mt-4 text-xs text-fg2">{Object.entries(APPT_TYPES).map(([k, v]) => <span key={k} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: v.color }} />{v.label}</span>)}</div>
      <p className="text-[11px] text-fg3 mt-3">Integrações futuras: Google Calendar, Apple Calendar e Outlook (hoje: exportação .ics).{norm("") }</p>
    </>
  );
}
