import React from 'react';
import { Message } from '../types';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isProp = message.speakerSide === 'proposition';
  const isOpp = message.speakerSide === 'opposition';
  const isMod = message.speakerSide === 'moderator';

  // Alignment Logic
  // Proposition: Left (Standard)
  // Opposition: Right (Reverse)
  // User: Right (Reverse)
  // Moderator: Center
  let alignClass = 'flex-row'; // Default Left
  let textAlignClass = 'items-start';
  let bubbleRadiusClass = 'rounded-tl-sm'; // Point to left
  
  if (isOpp || isUser) {
    alignClass = 'flex-row-reverse';
    textAlignClass = 'items-end';
    bubbleRadiusClass = 'rounded-tr-sm'; // Point to right
  } else if (isMod) {
    alignClass = 'justify-center';
    textAlignClass = 'items-center';
    bubbleRadiusClass = 'rounded-lg';
  }
  
  // Bubble Colors
  let bubbleClass = 'bg-white text-slate-900'; // Default
  if (isUser) {
    bubbleClass = 'bg-indigo-600 text-white';
  } else if (isProp) {
    bubbleClass = 'bg-emerald-100 text-emerald-950';
  } else if (isOpp) {
    bubbleClass = 'bg-rose-100 text-rose-950';
  } else {
    // Moderator
    bubbleClass = 'bg-slate-700/50 text-slate-200 border border-slate-600/50 backdrop-blur-sm';
  }

  // Fallback avatar for user - using PNG for better export compatibility
  const userAvatar = "https://api.dicebear.com/9.x/avataaars/png?seed=User&backgroundColor=c7d2fe";
  const avatarUrl = isUser ? userAvatar : (message.avatarUrl || "https://api.dicebear.com/9.x/notionists/png?seed=Moderator&backgroundColor=slate");

  return (
    <div className={`flex w-full mb-6 gap-3 ${alignClass} animate-fade-in-up`}>
      {/* Avatar - Hide if Moderator */}
      {!isMod && (
        <div className="flex-shrink-0 flex flex-col items-center">
          <img 
            src={avatarUrl} 
            alt={message.speakerName} 
            className="w-10 h-10 rounded-full bg-slate-700 object-cover border border-slate-600 shadow-md"
          />
        </div>
      )}

      {/* Message Content */}
      <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${textAlignClass}`}>
        {!isUser && !isMod && (
           <div className="flex items-baseline gap-2 mb-2 mx-1">
             <span className="text-xs font-bold text-slate-300">
              {message.speakerName}
             </span>
             <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold tracking-wider ${
               isProp ? 'bg-emerald-900/50 text-emerald-400' : 'bg-rose-900/50 text-rose-400'
             }`}>
               {isProp ? '正方' : '反方'}
             </span>
           </div>
        )}
        
        {isMod && !isUser && (
            <div className="mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest">主持人</div>
        )}
        
        <div className={`relative px-4 py-3 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed ${bubbleClass} ${bubbleRadiusClass}`}>
          <div className="markdown-content">
             <ReactMarkdown
               components={{
                 p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                 ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                 ol: ({node, ...props}) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
                 li: ({node, ...props}) => <li className="" {...props} />,
                 strong: ({node, ...props}) => <strong className="font-bold opacity-90" {...props} />,
                 em: ({node, ...props}) => <em className="italic opacity-90" {...props} />,
                 h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2 border-b border-current/20 pb-1" {...props} />,
                 h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2" {...props} />,
                 h3: ({node, ...props}) => <h3 className="font-bold mb-1" {...props} />,
                 blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-current/30 pl-3 italic opacity-80 my-2" {...props} />,
                 code: ({node, ...props}) => <code className="bg-black/10 rounded px-1 py-0.5 font-mono text-xs" {...props} />,
               }}
             >
               {message.content}
             </ReactMarkdown>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default ChatMessage;