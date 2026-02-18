"use client";

import { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";
import type { Terminal as XTerminal } from "@xterm/xterm";
import type { FitAddon as XFitAddon } from "@xterm/addon-fit";

interface TerminalViewProps {
  wsEndpoint?: string | null;
  onData?: (data: string) => void;
  onReady?: (terminal: XTerminal) => void;
}

export function TerminalView({ wsEndpoint, onData, onReady }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerminal | null>(null);
  const fitAddonRef = useRef<XFitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    let terminal: XTerminal | null = null;
    let fitAddon: XFitAddon | null = null;

    async function init() {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      if (!containerRef.current) return;

      terminal = new Terminal({
        theme: {
          background: "#1e1e2e",
          foreground: "#cdd6f4",
          cursor: "#f5e0dc",
          cursorAccent: "#1e1e2e",
          selectionBackground: "#585b7066",
          black: "#45475a",
          red: "#f38ba8",
          green: "#a6e3a1",
          yellow: "#f9e2af",
          blue: "#89b4fa",
          magenta: "#f5c2e7",
          cyan: "#94e2d5",
          white: "#bac2de",
          brightBlack: "#585b70",
          brightRed: "#f38ba8",
          brightGreen: "#a6e3a1",
          brightYellow: "#f9e2af",
          brightBlue: "#89b4fa",
          brightMagenta: "#f5c2e7",
          brightCyan: "#94e2d5",
          brightWhite: "#a6adc8",
        },
        fontSize: 16,
        fontFamily: "'Geist Mono', 'Fira Code', monospace",
        cursorBlink: true,
        cursorStyle: "block",
        scrollback: 1000,
        allowProposedApi: true,
      });

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current);
      fitAddon.fit();

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      terminal.writeln("\x1b[1;34m  GitPath ターミナル\x1b[0m");
      terminal.writeln(
        "\x1b[90m  AIガイドと一緒にGitを学びましょう\x1b[0m"
      );
      terminal.writeln("");

      if (onData) {
        terminal.onData(onData);
      }

      if (onReady) {
        onReady(terminal);
      }
    }

    init();

    const handleResize = () => {
      fitAddonRef.current?.fit();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      terminal?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [onData, onReady]);

  // WebSocket connection - separate effect so it can reconnect when wsEndpoint changes
  useEffect(() => {
    if (!wsEndpoint || !terminalRef.current) return;

    const terminal = terminalRef.current;
    const ws = new WebSocket(wsEndpoint);
    wsRef.current = ws;

    ws.onopen = () => {
      terminal.writeln("\x1b[32m  接続しました\x1b[0m");
      terminal.writeln("");
    };

    ws.onmessage = (event) => {
      terminal.write(event.data);
    };

    ws.onclose = () => {
      terminal.writeln("");
      terminal.writeln("\x1b[33m  接続が切断されました\x1b[0m");
    };

    // Send terminal input to WebSocket
    const dataDisposable = terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    return () => {
      dataDisposable.dispose();
      ws.close();
      wsRef.current = null;
    };
  }, [wsEndpoint]);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-700 shadow-lg">
      {/* Title Bar */}
      <div className="flex items-center gap-2 bg-[#181825] px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-yellow-400" />
          <span className="h-3 w-3 rounded-full bg-green-400" />
        </div>
        <span className="ml-2 text-sm text-gray-400">ターミナル</span>
      </div>

      {/* Terminal Container */}
      <div
        ref={containerRef}
        className="min-h-[400px] bg-[#1e1e2e] p-2"
        role="application"
        aria-label="ターミナル"
      />
    </div>
  );
}
