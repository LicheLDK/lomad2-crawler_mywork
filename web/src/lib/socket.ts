import { io, Socket } from 'socket.io-client';

/**
 * Docker nginx(same-origin) 빌드: VITE_SOCKET_URL="" → window.location.origin
 * 로컬 Vite: 미설정 → http://127.0.0.1:3100
 */
function resolveSocketUrl(): string {
  const raw = import.meta.env.VITE_SOCKET_URL;
  if (raw === '') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return '';
  }
  if (typeof raw === 'string' && raw.length > 0) {
    return raw.replace(/\/$/, '');
  }
  return 'http://127.0.0.1:3100';
}

const SOCKET_URL = resolveSocketUrl();

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

export type SearchJobProgressEvent = {
  jobId: string;
  searchHistoryId: string | null;
  status: string;
  currentSite: string | null;
  progress: number;
  resultCount: number;
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

  const onConnect = () => {
    socket.emit('subscribe', { searchId });
  };

  socket.on('progress', handler);
  socket.on('progress:broadcast', handler);
  if (socket.connected) {
    socket.emit('subscribe', { searchId });
  } else {
    socket.once('connect', onConnect);
  }

  return () => {
    socket.off('connect', onConnect);
    if (socket.connected) {
      socket.emit('unsubscribe', { searchId });
    }
    socket.off('progress', handler);
    socket.off('progress:broadcast', handler);
  };
}

/** Search Job Progress — WebSocket (job:progress) */
export function subscribeSearchJobProgress(
  jobId: string,
  onProgress: (event: SearchJobProgressEvent) => void,
): () => void {
  const socket = getCrawlSocket();

  const handler = (event: SearchJobProgressEvent) => {
    if (event.jobId === jobId) onProgress(event);
  };

  const onConnect = () => {
    socket.emit('subscribe', { jobId });
  };

  socket.on('job:progress', handler);
  socket.on('job:progress:broadcast', handler);
  if (socket.connected) {
    socket.emit('subscribe', { jobId });
  } else {
    socket.once('connect', onConnect);
  }

  return () => {
    socket.off('connect', onConnect);
    if (socket.connected) {
      socket.emit('unsubscribe', { jobId });
    }
    socket.off('job:progress', handler);
    socket.off('job:progress:broadcast', handler);
  };
}

