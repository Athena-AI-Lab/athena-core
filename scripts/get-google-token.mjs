import { google } from "googleapis";
import http from "http";

// Replace these with your credentials from Google Cloud Console
const CLIENT_ID = "google-client-id.apps.googleusercontent.com";
const CLIENT_SECRET = "google-client-secret";
const REDIRECT_URI = "http://localhost:3000/auth/google/callback";

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
);

const scopes = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: scopes,
  prompt: "consent",
});

const server = http.createServer(async (req, res) => {
  if (req.url?.startsWith("/auth/google/callback")) {
    const url = new URL(req.url, "http://localhost:3000");
    const code = url.searchParams.get("code");

    if (!code) {
      res.end("Error: No authorization code received");
      return;
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);

      console.log("\n" + "=".repeat(50));
      console.log("Your refresh token:");
      console.log("=".repeat(50));
      console.log(tokens.refresh_token);
      console.log("=".repeat(50) + "\n");

      res.end(
        "Success! Check your terminal for the refresh token. You can close this window.",
      );
    } catch (error) {
      console.error("Error getting token:", error);
      res.end("Error getting token. Check terminal for details.");
    }

    server.close();
    process.exit(0);
  }
});

server.listen(3000, () => {
  console.log("\n" + "=".repeat(50));
  console.log("Google OAuth Token Generator");
  console.log("=".repeat(50));
  console.log("\n1. Open this URL in your browser:\n");
  console.log(authUrl);
  console.log("\n2. Sign in and authorize the application");
  console.log("3. The refresh token will appear here\n");
  console.log("Waiting for authorization...\n");
});
