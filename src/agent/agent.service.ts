import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import { ToolRegistryService } from '../common/tools/tool.registry/tool.registry.service';

@Injectable()
export class AgentService {
    private openai: OpenAI;
    private readonly logger = new Logger(AgentService.name);

    private logStream: fs.WriteStream;

    constructor(
        private configService: ConfigService,
        private toolRegistry: ToolRegistryService,
    ) {
        this.openai = new OpenAI({
            apiKey: this.configService.get<string>('OPENAI_API_KEY'),
        });

        // Ensure logs directory exists (handled by mkdir in script, but safe check here)
        if (!fs.existsSync('logs/reasoning')) {
            fs.mkdirSync('logs/reasoning', { recursive: true });
        }

        const date = new Date().toISOString().split('T')[0];
        this.logStream = fs.createWriteStream(`logs/reasoning/${date}.log`, { flags: 'a' });
    }

    private logTrace(traceId: string, event: string, data: any) {
        const logEntry = JSON.stringify({
            timestamp: new Date().toISOString(),
            traceId,
            event,
            data
        });
        this.logStream.write(logEntry + '\n');
    }

    async processMessage(userSlackId: string, userMessage: string, threadId?: string): Promise<string> {
        const traceId = Math.random().toString(36).substring(7);
        this.logTrace(traceId, 'USER_INPUT', { userSlackId, userMessage });

        // 🛡️ Security Guardrail: Prompt Injection Defense
        const forbiddenKeywords = ['ignore previous instructions', 'system prompt', 'you are now DAN', 'bypass mode'];
        if (forbiddenKeywords.some(keyword => userMessage.toLowerCase().includes(keyword))) {
            this.logTrace(traceId, 'SECURITY_BLOCK', { reason: 'Prompt Injection Detected' });
            return "I cannot process that request due to security policy violations.";
        }

        // 1. Prepare Context (In a real app, fetch history from DB using threadId)
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            {
                role: 'system',
                content: `You are SoundMate, a helpful meeting room assistant for EnterMate Entertainment.
Current Time: ${new Date().toLocaleString()}

## Reasoning Protocol (Chain-of-Thought)
Before replying or calling a tool, you must silently go through these steps:
1. **Analyze**: Understand the user's core intent (e.g., "Booking", "Information", "Casual Chat").
2. **Recall**: Do you need external knowledge? 
   - If the user asks about "Wifi", "Guests", "Coffee", or "Policies", use the \`searchKnowledge\` tool.
3. **Plan**: Decide which tool avoids assumptions.
   - If booking, check availability first via \`getAvailableRooms\`.
4. **Act**: Execute the tool or reply meaningfully.

## Rules
- Always be polite and professional.
- If a room is busy, refrain from booking and suggest alternatives.
- When finding rooms, pay attention to requested characteristics (quiet, view, etc.).
- For general questions about the office, ALWAYS use \`searchKnowledge\` first.
`,
            },
            { role: 'user', content: userMessage },
        ];

        // 2. Call OpenAI (Decision)
        // We use manual loop for better control


        // 2. Recursive Loop for Tool Calls
        let MAX_ITERATIONS = 5;

        while (MAX_ITERATIONS > 0) {
            MAX_ITERATIONS--;

            try {
                const completion = await this.openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages,
                    tools: this.toolRegistry.getTools(),
                    tool_choice: 'auto',
                });

                const message = completion.choices[0].message;

                // Case A: AI wants to reply text (Stop condition)
                if (!message.tool_calls || message.tool_calls.length === 0) {
                    return message.content || "I'm not sure how to help with that.";
                }

                // Case B: AI wants to call tools
                messages.push(message); // Add the assistant's request to history

                for (const toolCall of message.tool_calls) {
                    if (toolCall.type !== 'function') continue;

                    const toolName = toolCall.function.name;
                    const args = JSON.parse(toolCall.function.arguments);

                    this.logger.log(`Executing tool: ${toolName}`);
                    this.logTrace(traceId, 'TOOL_EXECUTION', { toolName, args });

                    try {
                        const toolResult = await this.toolRegistry.execute(toolName, args, userSlackId);
                        this.logTrace(traceId, 'TOOL_RESULT', { toolName, result: toolResult });

                        messages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(toolResult),
                        });
                    } catch (e) {
                        this.logTrace(traceId, 'TOOL_ERROR', { toolName, error: e.message });
                        messages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: JSON.stringify({ error: e.message }),
                        });
                    }
                }
                // Loop continues to next iteration (sending tool outputs back to OpenAI)
            } catch (error) {
                this.logger.error('Error in agent process', error);
                return "Sorry, I encountered an error processing your request.";
            }
        }

        return "Request timed out or too many steps.";
    }
}
