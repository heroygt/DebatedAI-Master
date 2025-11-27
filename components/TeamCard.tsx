import React from 'react';
import { Team } from '../types';

interface TeamCardProps {
  team: Team;
  currentSpeakerName?: string;
  isWinner?: boolean;
}

const TeamCard: React.FC<TeamCardProps> = ({ team, currentSpeakerName, isWinner }) => {
  const isProp = team.side === 'proposition';
  const bgClass = isProp ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-rose-900/20 border-rose-500/30';
  const titleClass = isProp ? 'text-emerald-400' : 'text-rose-400';
  const borderClass = isProp ? 'border-emerald-500/50' : 'border-rose-500/50';

  return (
    <div className={`p-4 rounded-xl border ${bgClass} backdrop-blur-sm flex-1 min-w-[300px]`}>
      <h3 className={`text-xl font-bold mb-4 uppercase tracking-wider flex items-center gap-2 ${titleClass}`}>
        {isProp ? <span className="material-icons">thumb_up</span> : <span className="material-icons">thumb_down</span>}
        {team.name}
      </h3>
      <div className="space-y-3">
        {team.members.map((member) => {
          const isSpeaking = currentSpeakerName === member.name;
          
          return (
            <div 
              key={member.id}
              className={`
                relative flex items-center gap-3 p-3 rounded-lg border transition-all duration-300
                ${isSpeaking ? `${borderClass} bg-white/10 scale-105 shadow-lg` : 'border-transparent hover:bg-white/5'}
              `}
            >
              <img 
                src={member.avatarUrl} 
                alt={member.name}
                className={`w-10 h-10 rounded-full object-cover border-2 ${isProp ? 'border-emerald-500' : 'border-rose-500'} bg-white`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <p className={`font-bold truncate ${isSpeaking ? 'text-white' : 'text-slate-300'}`}>
                    {member.name}
                  </p>
                  <span className="text-xs uppercase tracking-tighter text-slate-500 font-semibold">{member.role}</span>
                </div>
                <p className="text-xs text-slate-400 truncate">{member.style}</p>
              </div>
              {isSpeaking && (
                <div className="absolute -right-1 -top-1">
                   <span className="relative flex h-3 w-3">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isProp ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${isProp ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeamCard;