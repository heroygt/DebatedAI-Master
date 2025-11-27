import { GoogleGenAI, Chat, GenerateContentResponse, Type } from "@google/genai";
import { Team, Debater } from "../types";

const API_KEY = process.env.API_KEY || '';
const MODEL_NAME = 'gemini-3-pro-preview';

export interface TurnSegment {
  speaker: string;
  content: string;
  type: 'moderator' | 'debater';
}

export class DebateSession {
  private chat: Chat | null = null;
  public propTeam: Team | null = null;
  public oppTeam: Team | null = null;

  constructor(private topic: string) {}

  private getClient() {
    return new GoogleGenAI({ apiKey: API_KEY });
  }

  async initializeTeams(): Promise<{ proposition: Team; opposition: Team }> {
    const ai = this.getClient();
    
    // Initialize chat with system instructions in Chinese
    this.chat = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: `
          你是一个专业的 AI 辩论主持人和模拟器。
          辩题: "${this.topic}"
          
          第一阶段：团队生成
          当被要求生成团队时，请提供结构化的 JSON 响应，定义两个团队（正方和反方），每队 4 名成员。
          请使用中文生成所有内容（姓名、角色、风格）。
          
          第二阶段：辩论模拟
          团队生成后，你将模拟辩论。
          - 你控制流程。
          - 你扮演主持人介绍发言人。
          - 你扮演当前的发言人发表讲话。
          - 演讲要观点鲜明，逻辑清晰，但要简洁（约 150 字左右）。
          - 使用标准的辩论技巧（如立论、反驳、质询、总结）。
          
          *** 极为重要的输出格式 ***
          为了让程序能够正确显示头像，你必须将不同角色的发言分行显示，并使用特定标记：
          
          如果是主持人说话，请另起一行写：
          MODERATOR: (内容)
          
          如果是辩手说话，请另起一行写：
          SPEAKER: [准确的姓名]
          (内容)
          
          示例：
          MODERATOR: 下面有请正方一辩发言。
          SPEAKER: 林晓宇
          谢谢主席。我方的观点是...
          
          请确保 "SPEAKER:" 后面的名字与生成的团队名单中的名字完全一致。
        `
      }
    });

    const prompt = `
      请为辩题 "${this.topic}" 创建两个辩论队。
      1. 正方 (Proposition)
      2. 反方 (Opposition)
      
      每队必须正好有 4 名成员，拥有独特的中文姓名、角色（如一辩、二辩、三辩、四辩/结辩）和简短的辩论风格描述。
    `;

    // Use specific config for the first message to get JSON
    const response = await this.chat.sendMessage({
      message: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            proposition: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                members: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      role: { type: Type.STRING },
                      style: { type: Type.STRING },
                    },
                    required: ["name", "role", "style"]
                  }
                }
              },
              required: ["name", "members"]
            },
            opposition: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                members: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      role: { type: Type.STRING },
                      style: { type: Type.STRING },
                    },
                    required: ["name", "role", "style"]
                  }
                }
              },
              required: ["name", "members"]
            }
          },
          required: ["proposition", "opposition"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.error("JSON Parse Error:", e);
        throw new Error("Failed to parse debate teams configuration.");
    }
    
    const propData = data.proposition || {};
    const oppData = data.opposition || {};
    
    const propMembers = Array.isArray(propData.members) ? propData.members : [];
    const oppMembers = Array.isArray(oppData.members) ? oppData.members : [];

    if (propMembers.length === 0) {
        propMembers.push({ name: "正方辩手 1", role: "辩手", style: "标准" });
    }
    if (oppMembers.length === 0) {
        oppMembers.push({ name: "反方辩手 1", role: "辩手", style: "标准" });
    }

    // Helper to generate consistent avatar URLs
    // Using PNG instead of SVG to ensure compatibility with html2canvas for image export
    const getAvatar = (name: string, side: string) => {
        const seed = encodeURIComponent(`${name}-${side}`);
        const bg = side === 'proposition' ? 'ecfccb' : 'ffe4e6';
        return `https://api.dicebear.com/9.x/micah/png?seed=${seed}&backgroundColor=${bg}&backgroundType=gradientLinear&radius=50`;
    };

    this.propTeam = {
      side: 'proposition',
      name: propData.name || '正方',
      members: propMembers.map((m: any, i: number) => ({
        ...m,
        id: `prop-${i}`,
        side: 'proposition',
        avatarUrl: getAvatar(m.name, 'proposition')
      }))
    };

    this.oppTeam = {
      side: 'opposition',
      name: oppData.name || '反方',
      members: oppMembers.map((m: any, i: number) => ({
        ...m,
        id: `opp-${i}`,
        side: 'opposition',
        avatarUrl: getAvatar(m.name, 'opposition')
      }))
    };

    return { proposition: this.propTeam, opposition: this.oppTeam };
  }

  async nextTurn(userInput?: string): Promise<TurnSegment[]> {
    if (!this.chat) throw new Error("Chat not initialized");

    let message = userInput || "请继续下一轮辩论发言。严格遵守 'MODERATOR:' 和 'SPEAKER:' 格式。";
    
    try {
      const response: GenerateContentResponse = await this.chat.sendMessage({ 
        message,
        config: {
            responseMimeType: 'text/plain',
            responseSchema: undefined
        }
      });
      const text = response.text || "";
      
      const lines = text.split('\n');
      const segments: TurnSegment[] = [];
      
      let currentSpeaker = "主持人";
      let currentType: 'moderator' | 'debater' = 'moderator';
      let currentContent: string[] = [];

      const flush = () => {
          if (currentContent.length > 0) {
              segments.push({
                  speaker: currentSpeaker,
                  content: currentContent.join('\n').trim(),
                  type: currentType
              });
              currentContent = [];
          }
      };

      for (const line of lines) {
          const modMatch = line.match(/^MODERATOR:\s*(.*)/i);
          const spkMatch = line.match(/^SPEAKER:\s*(.*)/i);

          if (modMatch) {
              flush();
              currentSpeaker = "主持人";
              currentType = 'moderator';
              if (modMatch[1].trim()) currentContent.push(modMatch[1].trim());
          } else if (spkMatch) {
              flush();
              currentSpeaker = spkMatch[1].trim();
              currentType = 'debater';
              // If there is content on the same line as SPEAKER: Name, it's usually empty based on instructions, 
              // but if the AI adds text there, we should keep it? 
              // Usually the format requested is SPEAKER: Name \n Content. 
              // But let's check if the capture group 1 has more than just the name.
              // Assuming Name is short.
          } else {
              currentContent.push(line);
          }
      }
      flush();

      // Fallback if no formatted segments found (e.g. error or raw text)
      if (segments.length === 0) {
           return [{ speaker: "主持人", content: text, type: "moderator" }];
      }

      return segments;

    } catch (e) {
      console.error(e);
      return [{ speaker: "系统", content: "生成错误: " + (e as any).message, type: "moderator" }];
    }
  }
}