
import React, { useState, useEffect, useRef } from 'react';
import { TranscriptionEntry, RecordingStatus, TranscriptionSegment } from './types';
import { transcribeAudio } from './services/geminiService';
import AudioRecorder from './components/AudioRecorder';

const App: React.FC = () => {
  const [history, setHistory] = useState<TranscriptionEntry[]>([]);
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [currentEntry, setCurrentEntry] = useState<TranscriptionEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('transcription_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Blob URLs don't persist across reloads, so we clear them
        const cleaned = parsed.map((e: TranscriptionEntry) => ({ ...e, audioUrl: undefined }));
        setHistory(cleaned);
      } catch (e) {
        console.error("Error al cargar el historial");
      }
    }
  }, []);

  const processTranscription = async (base64Audio: string, mimeType: string, duration: number, audioUrl: string, fileName?: string) => {
    setError(null);
    setStatus('processing');
    try {
      const result = await transcribeAudio(base64Audio, mimeType);
      
      const newEntry: TranscriptionEntry = {
        id: Date.now().toString(),
        text: fileName ? `[Archivo: ${fileName}]\n${result.text}` : result.text,
        segments: result.segments,
        timestamp: Date.now(),
        duration,
        audioUrl,
      };
      
      const updatedHistory = [newEntry, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('transcription_history', JSON.stringify(updatedHistory.map(e => ({ ...e, audioUrl: undefined }))));
      setCurrentEntry(newEntry);
      setStatus('idle');
    } catch (err) {
      setError("Error al procesar la transcripción profesional. Inténtalo de nuevo.");
      setStatus('error');
    }
  };

  const handleRecordingComplete = (base64Audio: string, mimeType: string, duration: number) => {
    const audioBlob = b64toBlob(base64Audio, mimeType);
    const audioUrl = URL.createObjectURL(audioBlob);
    processTranscription(base64Audio, mimeType, duration, audioUrl);
  };

  const b64toBlob = (b64Data: string, contentType = '', sliceSize = 512) => {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setError("Selecciona un archivo de audio.");
      return;
    }

    const audioUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      processTranscription(base64String, file.type, 0, audioUrl, file.name);
    };
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatSRTTime = (seconds: number) => {
    const date = new Date(seconds * 1000);
    const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss},${ms}`;
  };

  const exportToSRT = (entry: TranscriptionEntry) => {
    if (!entry.segments) return;
    const srtContent = entry.segments.map((seg, i) => {
      return `${i + 1}\n${formatSRTTime(seg.startTime)} --> ${formatSRTTime(seg.endTime)}\n${seg.text}\n`;
    }).join('\n');

    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `subtitulos_${entry.id}.srt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportHistoryToTxt = () => {
    if (history.length === 0) return;
    const content = history.map(entry => {
      const date = new Date(entry.timestamp).toLocaleString('es-ES');
      return `FECHA: ${date}\nCONTENIDO:\n${entry.text}\n${'-'.repeat(40)}\n`;
    }).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcripciones_completo.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearHistory = () => {
    if (window.confirm("¿Borrar historial?")) {
      setHistory([]);
      localStorage.removeItem('transcription_history');
      setCurrentEntry(null);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const isSegmentActive = (seg: TranscriptionSegment) => {
    return currentTime >= seg.startTime && currentTime <= seg.endTime;
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      audioRef.current.play();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 sm:px-6">
      <header className="max-w-4xl w-full flex justify-between items-center mb-12">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg">
            <i className="fas fa-microphone-lines text-white text-xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Transcriptor Pro AI</h1>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <span className="hidden sm:inline">Modo Profesional Activo</span>
          <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></div>
        </div>
      </header>

      <main className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-4 flex flex-col space-y-6">
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center">
            <AudioRecorder 
              onRecordingComplete={handleRecordingComplete} 
              status={status} 
              setStatus={setStatus} 
            />
            
            <div className="mt-8 w-full">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="audio/*" />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={status !== 'idle'}
                className="w-full flex items-center justify-center space-x-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 py-3 px-4 rounded-2xl border border-indigo-100 transition-all disabled:opacity-50"
              >
                <i className="fas fa-cloud-arrow-up"></i>
                <span>Cargar Audio Externo</span>
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs flex items-center space-x-2">
                <i className="fas fa-circle-exclamation"></i>
                <span>{error}</span>
              </div>
            )}
          </section>

          <section className="bg-gray-900 p-6 rounded-3xl text-white shadow-xl">
            <h3 className="font-bold mb-4 flex items-center text-indigo-400">
              <i className="fas fa-gear mr-2"></i>
              Herramientas de Exportación
            </h3>
            <div className="space-y-3">
              <button 
                onClick={exportHistoryToTxt}
                className="w-full text-left text-sm hover:bg-white/10 p-3 rounded-xl transition-colors flex items-center justify-between group"
              >
                <span>Resumen del Historial (.txt)</span>
                <i className="fas fa-chevron-right text-[10px] group-hover:translate-x-1 transition-transform"></i>
              </button>
              <button 
                onClick={() => currentEntry && exportToSRT(currentEntry)}
                disabled={!currentEntry?.segments}
                className="w-full text-left text-sm hover:bg-white/10 p-3 rounded-xl transition-colors flex items-center justify-between group disabled:opacity-30"
              >
                <span>Subtítulos YouTube (.srt)</span>
                <i className="fas fa-closed-captioning text-indigo-400"></i>
              </button>
            </div>
          </section>
        </div>

        <div className="md:col-span-8 flex flex-col space-y-6">
          {currentEntry && (
            <section className="bg-white p-8 rounded-3xl shadow-md border-2 border-indigo-50 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Resultados en Tiempo Real</h2>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => navigator.clipboard.writeText(currentEntry.text)}
                    className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                    title="Copiar texto"
                  >
                    <i className="far fa-copy"></i>
                  </button>
                  <button 
                    onClick={() => exportToSRT(currentEntry)}
                    className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                    title="Exportar SRT"
                  >
                    <i className="fas fa-file-code"></i>
                  </button>
                </div>
              </div>

              {currentEntry.audioUrl && (
                <div className="mb-8 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <audio 
                    ref={audioRef} 
                    src={currentEntry.audioUrl} 
                    controls 
                    onTimeUpdate={handleTimeUpdate}
                    className="w-full h-10"
                  />
                  <p className="text-[10px] text-indigo-400 mt-2 font-medium uppercase tracking-widest text-center">
                    Sincronización de Texto Inteligente
                  </p>
                </div>
              )}

              <div className="relative text-gray-800 leading-relaxed text-lg min-h-[150px]">
                {currentEntry.segments ? (
                  <div className="flex flex-wrap gap-1">
                    {currentEntry.segments.map((seg, i) => (
                      <span 
                        key={i}
                        onClick={() => seekTo(seg.startTime)}
                        className={`cursor-pointer px-1 rounded transition-all duration-200 ${
                          isSegmentActive(seg) 
                          ? 'bg-indigo-600 text-white shadow-lg scale-105' 
                          : 'hover:bg-indigo-50'
                        }`}
                      >
                        {seg.text}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{currentEntry.text}</div>
                )}
              </div>
            </section>
          )}

          <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex-1">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-lg font-bold text-gray-900">Registro de Sesión</h2>
              {history.length > 0 && (
                <button onClick={clearHistory} className="text-xs font-bold text-gray-300 hover:text-red-400 uppercase tracking-widest">
                  Limpiar Todo
                </button>
              )}
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {history.length === 0 ? (
                <div className="text-center py-20 text-gray-300">
                  <i className="fas fa-folder-open text-4xl mb-4 opacity-10"></i>
                  <p className="text-sm">No hay actividad reciente registrada</p>
                </div>
              ) : (
                history.map((entry) => (
                  <div 
                    key={entry.id} 
                    onClick={() => {
                      // Only set current entry if it's not already active to avoid resets
                      if (currentEntry?.id !== entry.id) setCurrentEntry(entry);
                    }}
                    className={`group p-5 rounded-2xl border transition-all cursor-pointer ${
                      currentEntry?.id === entry.id 
                      ? 'bg-indigo-50 border-indigo-200' 
                      : 'bg-gray-50 border-transparent hover:border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        {entry.segments && (
                          <span className="bg-indigo-100 text-indigo-600 text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase">
                            Sync
                          </span>
                        )}
                      </div>
                      <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => {e.stopPropagation(); exportToSRT(entry)}} className="text-gray-400 hover:text-indigo-600">
                          <i className="fas fa-file-lines text-xs"></i>
                        </button>
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm line-clamp-2 leading-snug">
                      {entry.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="mt-20 text-center">
        <div className="inline-flex items-center space-x-4 bg-white px-6 py-3 rounded-full shadow-sm border border-gray-100">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estado del Sistema:</span>
          <div className="flex items-center space-x-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span className="text-[10px] font-bold text-gray-600">Online</span>
          </div>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        @keyframes zoom-in-95 { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-in { animation: zoom-in-95 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default App;
