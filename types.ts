export interface Debater {
  id: string;
  name: string;
  role: string;
  side: 'proposition' | 'opposition';
  style: string;
  avatarUrl: string;
}

export interface Team {
  side: 'proposition' | 'opposition';
  name: string;
  members: Debater[];
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  speakerName?: string;
  speakerSide?: 'proposition' | 'opposition' | 'moderator';
  avatarUrl?: string;
  content: string;
  timestamp: number;
}

export type DebateStatus = 'idle' | 'setting_up' | 'ongoing' | 'paused' | 'finished';