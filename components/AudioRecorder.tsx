
import React, { useState, useRef, useEffect } from 'react';
import { RecordingStatus } from '../types';

interface AudioRecorderProps {
  onRecordingComplete: (base64Audio: string, mimeType: string, duration: number) => void;
  status: RecordingStatus;
  setStatus: (status: RecordingStatus) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete, status, setStatus }) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // Fixed: Replaced NodeJS.Timeout with ReturnType<typeof setInterval> to resolve the "Cannot find namespace 'NodeJS'" error.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          onRecordingComplete(base64String, mediaRecorder.mimeType, recordingTime);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      setStatus('recording');
      setRecordingTime(0);
      mediaRecorder.start();

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error al acceder al micrófono:", err);
      setStatus('error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setStatus('processing');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="relative">
        {status === 'recording' && (
          <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-25"></div>
        )}
        <button
          onClick={status === 'recording' ? stopRecording : startRecording}
          disabled={status === 'processing'}
          className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${
            status === 'recording' 
              ? 'bg-red-500 hover:bg-red-600 scale-110' 
              : status === 'processing'
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105'
          }`}
        >
          {status === 'recording' ? (
            <i className="fas fa-stop text-white text-3xl"></i>
          ) : status === 'processing' ? (
            <i className="fas fa-spinner fa-spin text-white text-3xl"></i>
          ) : (
            <i className="fas fa-microphone text-white text-3xl"></i>
          )}
        </button>
      </div>

      <div className="text-center">
        {status === 'recording' ? (
          <p className="text-xl font-mono font-medium text-red-600 transition-colors animate-pulse">
            Grabando: {formatTime(recordingTime)}
          </p>
        ) : status === 'processing' ? (
          <p className="text-gray-500 animate-pulse font-medium">Procesando audio...</p>
        ) : (
          <p className="text-gray-500 font-medium">Haz clic para empezar a hablar</p>
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;
