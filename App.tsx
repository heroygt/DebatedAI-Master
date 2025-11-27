import React, { useState, useEffect, useRef } from 'react';
import { DebateSession, TurnSegment } from './services/gemini';
import { Team, Message, DebateStatus } from './types';
import TeamCard from './components/TeamCard';
import ChatMessage from './components/ChatMessage';
// @ts-ignore
import html2canvas from 'html2canvas';

// Simple ID generator
const uid = () => Math.random().toString(36).substr(2, 9);

// Custom Logo Component
const DebateLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="url(#grad1)" />
    <path d="M30 35H65C67.7614 35 70 37.2386 70 40V60C70 62.7614 67.7614 65 65 65H40L30 75V35Z" fill="white" fillOpacity="0.9" />
    <path d="M70 25H35C32.2386 25 30 27.2386 30 30V35H65C67.7614 35 70 37.2386 70 40V55L80 45V25Z" fill="white" fillOpacity="0.4" />
    <defs>
      <linearGradient id="grad1" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4F46E5" />
        <stop offset="1" stopColor="#06B6D4" />
      </linearGradient>
    </defs>
  </svg>
);

function App() {
  const [status, setStatus] = useState<DebateStatus>('idle');
  const [topic, setTopic] = useState('');
  const [propTeam, setPropTeam] = useState<Team | null>(null);
  const [oppTeam, setOppTeam] = useState<Team | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingTurn, setIsLoadingTurn] = useState(false);
  
  // Session ref to persist across renders
  const sessionRef = useRef<DebateSession | null>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoadingTurn]);

  const handleStartSetup = async () => {
    if (!topic.trim()) return;
    setStatus('setting_up');
    setError(null);
    setMessages([]); // Clear previous messages
    setIsLoadingTurn(false);
    
    try {
      // Initialize Session first
      const session = new DebateSession(topic);
      sessionRef.current = session;
      
      // Step 1: Generate Teams (Optimized single-session approach)
      const { proposition, opposition } = await session.initializeTeams();
      setPropTeam(proposition);
      setOppTeam(opposition);
      
      setStatus('ongoing');
      
      // Trigger first turn automatically
      await triggerNextTurn(session);

    } catch (err: any) {
      console.error(err);
      setError("无法初始化辩论，请检查网络或重试。");
      setStatus('idle');
    }
  };

  const triggerNextTurn = async (session: DebateSession, userInterjection?: string) => {
    if (!session) return;
    if (isLoadingTurn) return; // Prevent concurrent calls

    setIsLoadingTurn(true);
    
    // Optimistic user message if interjection
    if (userInterjection) {
      addMessage({
        id: uid(),
        role: 'user',
        content: userInterjection,
        speakerName: "你",
        timestamp: Date.now()
      });
    }

    try {
      const segments: TurnSegment[] = await session.nextTurn(userInterjection);
      
      // Process segments sequentially with a delay for simulation effect
      for (const segment of segments) {
        // Determine side based on speaker name matching
        let side: 'proposition' | 'opposition' | 'moderator' = 'moderator';
        let avatarUrl: string | undefined = undefined;
        let speakerName = segment.speaker;

        // Try to find the speaker in the teams by partial match to be robust
        const n = speakerName.toLowerCase().replace(/\s/g, '');
        
        const propMember = session.propTeam?.members.find(m => {
            const mn = m.name.toLowerCase().replace(/\s/g, '');
            return mn.includes(n) || n.includes(mn);
        });
        
        const oppMember = session.oppTeam?.members.find(m => {
            const mn = m.name.toLowerCase().replace(/\s/g, '');
            return mn.includes(n) || n.includes(mn);
        });

        if (propMember) {
            side = 'proposition';
            avatarUrl = propMember.avatarUrl;
            speakerName = propMember.name; // Use canonical name
            setCurrentSpeaker(propMember.name);
        } else if (oppMember) {
            side = 'opposition';
            avatarUrl = oppMember.avatarUrl;
            speakerName = oppMember.name; // Use canonical name
            setCurrentSpeaker(oppMember.name);
        } else {
            side = 'moderator';
            // Moderator avatar handled (hidden) in ChatMessage component now
            setCurrentSpeaker(null); // Moderator speaking doesn't highlight a specific debater
        }

        addMessage({
            id: uid(),
            role: 'model',
            content: segment.content,
            speakerName: speakerName,
            speakerSide: side,
            avatarUrl: avatarUrl,
            timestamp: Date.now()
        });

        // Simulate reading/speaking time before next message
        // 2 seconds delay
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Clear current speaker after turn ends
      setCurrentSpeaker(null);

    } catch (e) {
      console.error(e);
      setError("生成回合失败。");
    } finally {
      setIsLoadingTurn(false);
    }
  };

  const addMessage = (msg: Message) => {
    setMessages(prev => [...prev, msg]);
  };

  const handleNextTurnClick = () => {
    if (sessionRef.current && !isLoadingTurn) {
      triggerNextTurn(sessionRef.current);
    }
  };

  const handleInterjection = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoadingTurn) return;

    const formData = new FormData(e.currentTarget);
    const text = formData.get('interjection') as string;
    if (text && sessionRef.current) {
      e.currentTarget.reset();
      triggerNextTurn(sessionRef.current, text);
    }
  };

  const handleExportImage = async () => {
    if (!chatContainerRef.current) return;

    const qrCodePath = "copyright.png";
    let qrCodeDataUrl = qrCodePath;
    
    // Pre-load local image to Data URL to avoid html2canvas loading race conditions
    try {
        const response = await fetch(qrCodePath);
        const blob = await response.blob();
        qrCodeDataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn("Could not load copyright.png, falling back to path. Error:", e);
    }

    const originalContent = chatContainerRef.current;
    
    // Create the main wrapper
    const exportContainer = document.createElement('div');
    exportContainer.style.width = '800px';
    exportContainer.style.backgroundColor = '#0f172a'; // slate-900
    exportContainer.style.color = '#e2e8f0'; // slate-200
    exportContainer.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif';
    exportContainer.style.position = 'fixed';
    exportContainer.style.top = '0';
    exportContainer.style.left = '-9999px';
    exportContainer.style.zIndex = '-1000';
    
    // 1. Header Section
    const headerDiv = document.createElement('div');
    headerDiv.style.padding = '40px 40px 20px 40px';
    headerDiv.style.borderBottom = '1px solid #334155'; // slate-700
    headerDiv.style.background = 'linear-gradient(to right, #1e293b, #0f172a)'; // slate-800 to slate-900
    headerDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
         <div style="width: 48px; height: 48px;">
           <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="20" fill="#4F46E5" />
            <path d="M30 35H65C67.7614 35 70 37.2386 70 40V60C70 62.7614 67.7614 65 65 65H40L30 75V35Z" fill="white" fill-opacity="0.9" />
            <path d="M70 25H35C32.2386 25 30 27.2386 30 30V35H65C67.7614 35 70 37.2386 70 40V55L80 45V25Z" fill="white" fill-opacity="0.4" />
          </svg>
         </div>
         <div>
           <h1 style="font-size: 24px; font-weight: bold; margin: 0; color: white;">AI 辩论大师</h1>
           <p style="font-size: 14px; color: #94a3b8; margin: 4px 0 0 0;">Generated Debate History</p>
         </div>
      </div>
      <div style="background: rgba(79, 70, 229, 0.1); border: 1px solid rgba(79, 70, 229, 0.3); padding: 16px; border-radius: 12px;">
         <p style="font-size: 12px; color: #818cf8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; font-weight: bold;">Current Topic</p>
         <h2 style="font-size: 20px; font-weight: bold; color: white; margin: 0;">${topic || '未命名辩题'}</h2>
      </div>
    `;
    exportContainer.appendChild(headerDiv);

    // 2. Content Section
    const contentDiv = document.createElement('div');
    contentDiv.style.padding = '40px';
    // Clone internal HTML
    contentDiv.innerHTML = originalContent.innerHTML;
    exportContainer.appendChild(contentDiv);

    // 3. Footer Section (QR Code)
    const footerDiv = document.createElement('div');
    footerDiv.style.padding = '30px 40px 50px 40px';
    footerDiv.style.background = '#020617'; // slate-950
    footerDiv.style.borderTop = '1px solid #1e293b'; // slate-800
    footerDiv.style.display = 'flex';
    footerDiv.style.flexDirection = 'column';
    footerDiv.style.alignItems = 'center';
    footerDiv.style.justifyContent = 'center';
    footerDiv.innerHTML = `
      <div style="margin-bottom: 16px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 2px; font-size: 12px;">
        Scan to Connect
      </div>
      <div style="background: white; padding: 10px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        <img src="${qrCodeDataUrl}" width="120" height="120" style="display: block;" />
      </div>
      <div style="margin-top: 20px; color: #475569; font-size: 14px;">
        Generated by AI 辩论大师
      </div>
    `;
    exportContainer.appendChild(footerDiv);

    document.body.appendChild(exportContainer);

    try {
      const canvas = await html2canvas(exportContainer, {
        backgroundColor: '#0f172a',
        useCORS: true,
        scale: 2,
        logging: false,
        height: exportContainer.scrollHeight
      });

      const link = document.createElement('a');
      link.download = `debate-history-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed:", err);
      alert("导出图片失败，请重试。");
    } finally {
      document.body.removeChild(exportContainer);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-slate-900 text-slate-200 font-sans overflow-hidden">
      
      {/* Header */}
      <header className="flex-none bg-slate-900/95 border-b border-slate-800 backdrop-blur z-20 h-16">
        <div className="max-w-full px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DebateLogo className="w-9 h-9 drop-shadow-lg" />
            <h1 className="text-xl font-bold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              AI <span className="text-indigo-400">辩论大师</span>
            </h1>
          </div>
          {status === 'ongoing' && (
            <div className="flex items-center gap-2 md:gap-4">
               <span className="text-sm text-slate-400 hidden md:inline">当前辩题: <span className="text-indigo-300 font-medium">{topic}</span></span>
               
               <button 
                 onClick={handleExportImage}
                 className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors border border-slate-700"
                 title="导出对话长图"
               >
                 <span className="material-icons text-sm">image</span>
                 <span className="hidden sm:inline">导出长图</span>
               </button>

               <button 
                 onClick={() => {
                    setStatus('idle'); 
                    setMessages([]);
                    setPropTeam(null);
                    setOppTeam(null);
                 }}
                 className="text-xs text-slate-500 hover:text-rose-400 transition-colors"
               >
                 结束辩论
               </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area - Fixed Height, Scrollable Children */}
      <main className="flex-1 flex flex-col md:flex-row min-h-0 relative">
        
        {status === 'idle' || status === 'setting_up' ? (
          <div className="flex-1 flex items-center justify-center p-4">
             <div className="max-w-md w-full bg-slate-800/50 p-8 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-xl">
                <div className="flex justify-center mb-6">
                  <DebateLogo className="w-20 h-20" />
                </div>
                <h2 className="text-3xl font-bold mb-2 text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                  开启一场辩论
                </h2>
                <p className="text-slate-400 text-center mb-8">
                  输入任意有趣、深刻或荒谬的话题，AI 将为你生成双方战队并展开激辩。
                </p>

                {error && (
                  <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm text-center">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">辩题</label>
                    <input 
                      type="text" 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="例如：AI 会让人类更幸福吗？"
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-white placeholder-slate-600 outline-none transition-all"
                      disabled={status === 'setting_up'}
                    />
                  </div>
                  
                  <button 
                    onClick={handleStartSetup}
                    disabled={!topic.trim() || status === 'setting_up'}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                  >
                    {status === 'setting_up' ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        正在组建战队...
                      </>
                    ) : (
                      <>
                        开始辩论
                        <span className="material-icons text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
                      </>
                    )}
                  </button>
                </div>
             </div>
          </div>
        ) : (
          <>
            {/* Left Panel: Teams - Scrollable Independently */}
            <div className="md:w-80 lg:w-96 flex-none bg-slate-900/50 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col overflow-y-auto custom-scrollbar">
              <div className="p-4 space-y-6">
                 {propTeam && <TeamCard team={propTeam} currentSpeakerName={currentSpeaker || undefined} />}
                 <div className="flex items-center justify-center relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-800"></div>
                    </div>
                    <span className="relative z-10 bg-slate-900 px-3 text-slate-500 font-bold italic text-xl">VS</span>
                 </div>
                 {oppTeam && <TeamCard team={oppTeam} currentSpeakerName={currentSpeaker || undefined} />}
              </div>
            </div>

            {/* Right Panel: Chat - Scrollable Independently */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
              {/* Messages Area - Captured by ref for export */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 custom-scrollbar">
                 {messages.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                      <span className="material-icons text-6xl mb-4">forum</span>
                      <p>等待辩论开始...</p>
                   </div>
                 )}
                 
                 {messages.map((msg) => (
                   <ChatMessage key={msg.id} message={msg} />
                 ))}
                 
                 {/* Scroll Anchor */}
                 <div ref={scrollEndRef} className="h-4" />
              </div>

              {/* Input Area - Fixed at bottom */}
              <div className="flex-none p-4 md:p-6 bg-slate-900 border-t border-slate-800 shadow-[0_-5px_20px_rgba(0,0,0,0.3)] z-10">
                 <form 
                   onSubmit={handleInterjection}
                   className="flex gap-3 max-w-4xl mx-auto"
                 >
                   <input 
                     name="interjection"
                     type="text" 
                     placeholder="发表你的评论或提出质询..."
                     className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-white placeholder-slate-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                     autoComplete="off"
                     disabled={isLoadingTurn}
                   />
                   <button 
                     type="submit"
                     disabled={isLoadingTurn}
                     className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     <span className="material-icons">send</span>
                   </button>
                   <button 
                     type="button"
                     onClick={handleNextTurnClick}
                     disabled={isLoadingTurn}
                     className={`px-6 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 whitespace-nowrap
                       ${isLoadingTurn 
                         ? 'bg-indigo-600/50 text-white/50 cursor-not-allowed shadow-none' 
                         : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                       }`}
                   >
                     {isLoadingTurn ? (
                       <>
                         <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                         辩论中...
                       </>
                     ) : (
                       <>
                         <span className="material-icons">play_arrow</span>
                         下一轮
                       </>
                     )}
                   </button>
                 </form>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;