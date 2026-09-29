"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { trackRecent } from "@/lib/recents";
import { Spinner } from "../ui";

const CustomerProfile = dynamic(() => import("@/modules/customers/CustomerProfile"), { loading: () => <Loading /> });
const QuoteDetail = dynamic(() => import("@/modules/quotes/QuoteDetail"), { loading: () => <Loading /> });
const OrderDetail = dynamic(() => import("@/modules/orders/OrderDetail"), { loading: () => <Loading /> });

function Loading() {
  return <div className="fixed inset-y-0 right-0 z-[55] w-full sm:w-[520px] glass grid place-items-center"><Spinner size={28} /></div>;
}

export function DetailHost({ state, onClose }: { state: { col: string; id: string }; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => trackRecent(state.col, state.id), 900);
    return () => clearTimeout(t);
  }, [state.col, state.id]);
  if (state.col === "customers") return <CustomerProfile id={state.id} onClose={onClose} />;
  if (state.col === "quotes") return <QuoteDetail id={state.id} onClose={onClose} />;
  if (state.col === "work_orders") return <OrderDetail id={state.id} onClose={onClose} />;
  return null;
}
