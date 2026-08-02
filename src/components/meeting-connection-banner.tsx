"use client";

import { useConnectionState } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { LoaderCircle, WifiOff } from "lucide-react";

export function MeetingConnectionBanner() {
  const state = useConnectionState();

  if (state === ConnectionState.Connected) {
    return null;
  }

  if (state === ConnectionState.Reconnecting) {
    return (
      <div className="meeting-connection-banner is-reconnect" role="status">
        <LoaderCircle className="spin" size={14} />
        Koneksi terputus sementara — menyambung ulang…
      </div>
    );
  }

  if (state === ConnectionState.Connecting) {
    return (
      <div className="meeting-connection-banner" role="status">
        <LoaderCircle className="spin" size={14} />
        Menghubungkan ke ruang meeting…
      </div>
    );
  }

  if (state === ConnectionState.Disconnected) {
    return (
      <div className="meeting-connection-banner is-offline" role="alert">
        <WifiOff size={14} />
        Koneksi terputus
      </div>
    );
  }

  return null;
}
