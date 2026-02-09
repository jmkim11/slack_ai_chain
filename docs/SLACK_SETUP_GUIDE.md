# 🤖 Slack Bot Setup Guide (Socket Mode)

This guide walks you through setting up the Slack App for "SoundMate".
Since we use **Socket Mode**, you **DO NOT** need `ngrok` or a public IP. You can test it locally!

## 1. Create a Slack App
1.  Go to [Slack API: Your Apps](https://api.slack.com/apps).
2.  Click **Create New App**.
3.  Select **From scratch**.
4.  Enter App Name: `SoundMate` (or whatever you like).
5.  Select your Development Workspace (Create a free one if you don't have one).

## 2. Enable Socket Mode
1.  In the left sidebar, click **Socket Mode**.
2.  Toggle **Enable Socket Mode**.
3.  When asked to generate an App-Level Token:
    -   Token Name: `socket-token`
    -   Click **Generate**.
    -   **Copy the `xapp-...` token**. This is your `SLACK_APP_TOKEN`.
    -   Paste it into your `.env` file.

## 3. Configure Permissions (OAuth & Permissions)
1.  In the left sidebar, click **OAuth & Permissions**.
2.  Scroll down to **Bot Token Scopes**.
3.  Add the following scopes:
    -   `app_mentions:read` (To hear "@SoundMate hello")
    -   `chat:write` (To reply)
    -   `im:read` (To hear DMs)
    -   `im:write` (To reply in DMs)
    -   `im:history` (To read DM history)
4.  Scroll up and click **Install to Workspace**.
5.  **Copy the `xoxb-...` token**. This is your `SLACK_BOT_TOKEN`.
6.  Paste it into your `.env` file.

## 4. Get Signing Secret
1.  In the left sidebar, click **Basic Information**.
2.  Scroll down to **App Credentials**.
3.  Show and **Copy the Signing Secret**.
4.  Paste it into your `.env` file as `SLACK_SIGNING_SECRET`.

## 5. Enable Event Subscriptions
1.  In the left sidebar, click **Event Subscriptions**.
2.  Toggle **Enable Events**.
3.  (Since Socket Mode is on, verification is automatic).
4.  Expand **Subscribe to bot events**.
5.  Add:
    -   `app_mention`
    -   `message.im`
6.  Click **Save Changes** (bottom right).

## 6. How to Test
1.  Start your server: `npm run start`
2.  Go to your Slack Workspace.
3.  In the sidebar, under **Apps**, click `SoundMate`.
4.  Send a DM: "Hello!" or "Book a room".
5.  The bot should reply! 🎉

## Trouble Shooting
-   If the bot doesn't reply, check your terminal logs.
-   Make sure you invited the bot to the channel if you are testing in a public channel (`/invite @SoundMate`).
