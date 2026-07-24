import { io, Socket } from 'socket.io-client';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL?.replace(/\/$/, '') ||
  'http://127.0.0.1:3100';

export type CrawlProgressEvent = {
  searchId: string;
  keyword: string;
  status: 'queued' | 'running' | 'completed' | 'partial' | 'failed';
  percent: number;
  currentSite: string | null;
  completedSites: string[];
  pendingSites: string[];
  resultCount: number;
  totalSites: number;
  message?: string;
  at: string;
};

let shared: Socket | null = null;

export function getCrawlSocket(): Socket {
  if (!shared) {
    shared = io(`${SOCKET_URL}/crawl`, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
    });
  }
  return shared;
}

export function subscribeSearchProgress(
  searchId: string,
  onProgress: (event: CrawlProgressEvent) => void,
): () => void {
  const socket = getCrawlSocket();

  const handler = (event: CrawlProgressEvent) => {
    if (event.searchId === searchId) onProgress(event);
  };

  socket.emit('subscribe', { searchId });
  socket.on('progress', handler);

  return () => {
    socket.emit('unsubscribe', { searchId });
    socket.off('progress', handler);
  };
}
