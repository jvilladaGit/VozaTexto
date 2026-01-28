
export interface TranscriptionSegment {
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
}

export interface TranscriptionEntry {
  id: string;
  text: string;
  segments?: TranscriptionSegment[];
  timestamp: number;
  duration: number;
  audioUrl?: string; // Local blob URL for playback during session
}

export type RecordingStatus = 'idle' | 'recording' | 'processing' | 'error';
