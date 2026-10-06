import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "SUCCESS" | "SYSTEM";
  message: string;
  hash?: string;
}

export function TerminalExecutionLog({
  logs,
  height = "h-48",
}: {
  logs: LogEntry[];
  height?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const getColor = (level: string) => {
    switch (level) {
      case "INFO": return "text-[#25D366]";
      case "WARN": return "text-amber-500";
      case "ERROR": return "text-red-500";
      case "SUCCESS": return "text-emerald-500";
      case "SYSTEM": return "text-purple-500";
      default: return "text-black/60";
    }
  };

  return (
    <div className={`w-full bg-[#f8f9fa] border border-black/10 rounded-lg p-4 font-mono text-[10px] overflow-hidden flex flex-col shadow-inner ${height}`}>
      <div className="flex items-center justify-between border-b border-black/5 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <span className="font-bold text-black/40 uppercase tracking-widest text-[9px] ml-2">
            Execution Log
          </span>
        </div>
        <span className="font-black text-black/30 text-[9px]">
          [STRICT MODE]
        </span>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-black/10">
        {logs.map((log) => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-1.5 font-mono flex items-start gap-3"
          >
            <span className="text-black/30 shrink-0 select-none">
              {log.timestamp}
            </span>
            <span className={`font-bold shrink-0 w-[50px] ${getColor(log.level)}`}>
              [{log.level}]
            </span>
            <div className="flex-1 flex flex-col">
              <span className="text-black/80">{log.message}</span>
              {log.hash && (
                <span className="text-[8.5px] text-black/40 break-all mt-0.5">
                  └─ {log.hash}
                </span>
              )}
            </div>
          </motion.div>
        ))}
        {logs.length === 0 && (
          <div className="text-black/30 italic">Awaiting kernel boot...</div>
        )}
      </div>
    </div>
  );
}

