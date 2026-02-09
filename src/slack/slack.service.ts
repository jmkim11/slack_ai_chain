import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App } from '@slack/bolt';
import { AgentService } from '../agent/agent.service';

@Injectable()
export class SlackService implements OnModuleInit {
    private app: App;
    private readonly logger = new Logger(SlackService.name);

    constructor(
        private configService: ConfigService,
        private agentService: AgentService,
    ) { }

    onModuleInit() {
        const signingSecret = this.configService.get<string>('SLACK_SIGNING_SECRET');
        const token = this.configService.get<string>('SLACK_BOT_TOKEN');
        const appToken = this.configService.get<string>('SLACK_APP_TOKEN');

        // Only initialize if credentials are present (to avoid crashing in dev without them)
        if (!signingSecret || !token || !appToken) {
            this.logger.warn('Slack credentials not found. Slack integration disabled.');
            return;
        }

        this.app = new App({
            signingSecret,
            token,
            appToken,
            socketMode: true, // Easier for local dev than exposing localhost via ngrok
        });

        this.registerListeners();
        this.startApp();
    }

    private registerListeners() {
        this.app.event('app_mention', async ({ event, say }) => {
            this.logger.log(`Received mention: ${event.text}`);
            if (!event.user) return; // Guard: Ensure user exists
            await this.handleMessage(event.user, event.text, event.ts, say);
        });

        this.app.message(async ({ message, say }) => {
            // Filter out bot messages and subtypes
            if ((message as any).subtype || (message as any).bot_id) return;

            const text = (message as any).text;
            if (!text) return;

            this.logger.log(`Received message: ${text}`);
            await this.handleMessage((message as any).user, text, (message as any).ts, say);
        });
    }

    private async handleMessage(user: string, text: string, threadId: string, say: any) {
        try {
            // Send "Typing..." indicator (optional, Bolt doesn't support generic typing easily without RTM, but we can just reply)
            // await say({ text: "Thinking...", thread_ts: threadId });

            const reply = await this.agentService.processMessage(user, text, threadId);

            await say({
                text: reply,
                thread_ts: threadId, // Reply in thread
            });
        } catch (error) {
            this.logger.error('Error handling Slack message', error);
            await say({
                text: "Sorry, something went wrong while processing your request.",
                thread_ts: threadId,
            });
        }
    }

    private async startApp() {
        try {
            await this.app.start();
            this.logger.log('⚡️ Slack Bolt app is running!');
        } catch (error) {
            this.logger.error('Failed to start Slack app', error);
        }
    }
}
