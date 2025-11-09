"use client";

import React from "react";

export function SortableHeader<
  K extends string
>({
  label,
  columnKey,
  activeKey,
  dir,
  setKey,
  setDir,
  alignRight = false,
}: {
  label: string;
  columnKey: K;
  activeKey: K;
  dir: "asc" | "desc";
  setKey: (k: K) => void;
  setDir: (d: "asc" | "desc") => void;
  alignRight?: boolean;
}) {
  const active = activeKey === columnKey;
  const arrow = active ? (dir === "asc" ? "↑" : "↓") : "";
  return (
    <button
      type="button"
      className={`flex items-center gap-1 ${alignRight ? "justify-end w-full" : ""}`}
      onClick={() => {
        if (active) setDir(dir === "asc" ? "desc" : "asc");
        else {
          setKey(columnKey);
          setDir(columnKey === ("asset" as K) ? "asc" : "desc");
        }
      }}
      title={active ? `Sorting ${dir}` : "Click to sort"}
    >
      <span>{label}</span>
      <span className="text-xs text-zinc-500">{arrow}</span>
    </button>
  );
}
