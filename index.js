const dotenv = require('dotenv');
dotenv.config({ path: `${__dirname}/.env` });
const express = require('express');
const axios = require('axios');
const { google } = require('googleapis');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();

const port = process.env.PORT || 3000;
// Discord Bot Token
const discordToken = process.env.DISCORDTOKEN;

// YouTube Data API Key
const youtubeApiKey = process.env.YOUTUBEAPIKEY;

// YouTube Video ID (the video you want to retrieve)
const youtubeVideoId = process.env.YOUTUBEVIDEOID;

const twitchClientID = process.env.TWITCH_CLIENT_ID;
const twitchSecret = process.env.TWITCH_SECRET;
const twitchStreamer = process.env.STREAMER_NAME;
const discordChannelID = process.env.DISCORD_CHANNEL_ID;
let twitchToken;
let isLive = false;



const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  checkForNewVideo(); // Send an alert for the latest video on startup

  // Check for new videos every hour (in milliseconds)
  setInterval(checkForNewVideo, 3600000);
});

axios.post(`https://id.twitch.tv/oauth2/token?client_id=${twitchClientID}&client_secret=${twitchSecret}&grant_type=client_credentials`)
    .then(res => {
        twitchToken = res.data.access_token;
    });
    
function sendLiveNotification(streamTitle) {
    let channel = client.channels.cache.get(discordChannelID);
    if (channel) {
        channel.send(`${twitchStreamer} is live now!\n\nStream Title: "${streamTitle}"\n\nWatch here: https://twitch.tv/${twitchStreamer}`);
    }
}

app.get('/twitch', (req, res) => {
    if (twitchToken) {
        res.status(200).json({ connected: true });
    } else {
        res.status(500).json({ connected: false });
    }
});

async function checkForNewVideo() {
  const youtube = google.youtube({
    version: 'v3',
    auth: youtubeApiKey,
  });

  try {
    const response = await youtube.videos.list({
      id: youtubeVideoId,
      part: 'snippet', // Include the 'snippet' part
    });

    const video = response.data.items[0];
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;
    const videoTitle = video.snippet.title;

    // Replace CHANNEL_ID with the ID of the Discord channel where you want to send alerts.
    const alertChannel = await client.channels.fetch('CHANNEL_ID');

    alertChannel.send(`New video: ${videoTitle}\n${videoUrl}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Check if the bot is connected to Twitch
app.get('/twitch', (req, res) => {

    if (twitchToken) {

        res.status(200).json({ connected: true });
    } else {
        res.status(500).json({ connected: false });
    }
});

// Check if the bot is connected to Discord
app.get('/discord', (req, res) => {
    if (client.readyAt) {
        res.status(200).json({ connected: true });
    } else {
        res.status(500).json({ connected: false });
    }
});

// Get the current live status
app.get('/status', (req, res) => {
    res.status(200).json({ isLive });
});

// Every minute, check if the stream is live
setInterval(() => {
    axios.get(`https://api.twitch.tv/helix/streams?user_login=${twitchStreamer}`, {
        headers: {
            'Client-ID': twitchClientID,
            'Authorization': `Bearer ${twitchToken}`
        }
    }).then(res => {
        if (res.data.data.length > 0) {
            // Stream is live
            if (!isLive) {
                // Stream just went live
                isLive = true;
                let streamTitle = res.data.data[0].title; // Extracting stream title from the response
                sendLiveNotification(streamTitle);
            }
        } else {
            // Stream is offline
            isLive = false;
        }
    });
}, 60000);

// Start the web server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});


// Log in to Discord
client.login(discordToken);

