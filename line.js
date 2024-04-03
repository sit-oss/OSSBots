'use strict';
const express = require('express');
const router = express.Router();

const fs = require('fs');
const path = require('path');
const line = require('@line/bot-sdk');

// create LINE SDK config from env variables
const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
};

// create LINE SDK client
const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
});
const blobClient = new line.messagingApi.MessagingApiBlobClient({
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
});

const baseURL = process.env.BASE_URL;

const groupId = process.env.GROUP_ID;

const adminIds = process.env.ADMIN_IDS.split(',');


const replyText = (token, texts) => {
    texts = Array.isArray(texts) ? texts : [texts];
    return client.replyMessage(
        {
            replyToken: token,
            messages: texts.map((text) => ({ type: 'text', text }))
        }
    );
}

const replyImage = (token, image) => {
    return client.replyMessage(
        {
            replyToken: token,
            messages: [{
                type: 'image',
                originalContentUrl: image,
                previewImageUrl: image,
            }]
        }
    );
}

const replyAudio = (token, audio) => {
    return client.replyMessage(
        {
            replyToken: token,
            messages: [{
                type: 'audio',
                originalContentUrl: audio,
            }]
        }
    );
}

async function downloadContent(messageId, downloadPath) {
    const stream = await blobClient.getMessageContent(messageId)

    const pipelineAsync = util.promisify(pipeline);

    const writable = fs.createWriteStream(downloadPath);
    await pipelineAsync(stream, writable);
}

// event handler
function handleEvent(event) {
    switch (event.type) {
        case 'message':
            const message = event.message;
            switch (message.type) {
                case 'text':
                    return handleText(message, event.replyToken, event.source);
                case 'image':
                    return handleImage(message, event.replyToken);
                case 'video':
                    return handleVideo(message, event.replyToken);
                case 'audio':
                    return handleAudio(message, event.replyToken);
                case 'location':
                    return handleLocation(message, event.replyToken);
                case 'sticker':
                    return handleSticker(message, event.replyToken);
                default:
                    throw new Error(`Unknown message: ${JSON.stringify(message)}`);
            }
        case 'follow':
            // return replyText(event.replyToken, 'Got followed event');
            return console.log(`Followed this bot: ${JSON.stringify(event)}`);
        case 'unfollow':
            return console.log(`Unfollowed this bot: ${JSON.stringify(event)}`);
        case 'join':
            // return replyText(event.replyToken, `Joined ${event.source.type}`);
            return console.log(`Joined: ${JSON.stringify(event)}`);
        case 'leave':
            return console.log(`Left: ${JSON.stringify(event)}`);
        case 'postback':
            let data = event.postback.data;
            if (data === 'DATE' || data === 'TIME' || data === 'DATETIME') {
                data += `(${JSON.stringify(event.postback.params)})`;
            }
            // return replyText(event.replyToken, `Got postback: ${data}`);
            return console.log(`Got postback: ${data}`);
        case 'beacon':
            // return replyText(event.replyToken, `Got beacon: ${event.beacon.hwid}`);
            return console.log(`Got beacon: ${event.beacon.hwid}`);
        case 'memberLeft':
            // return replyText(event.replyToken, `Member left: ${event.left.members.map((member) => member.userId).join(',')}`);
            return console.log(`Member left: ${event.left.members.map((member) => member.userId).join(',')}`);
        default:
            throw new Error(`Unknown event: ${JSON.stringify(event)}`);
    }
}

async function handleGroupMessage(message, replyToken, source) {
    console.log(`handleGroupMessage: ${replyToken} ${JSON.stringify(message)}}`);
    if (source.groupId === groupId && message.text.startsWith('@bot')) {
        // let messageText = message.text.substring(4).trim();
        let response = 'Yes, how can I help you?';
        if (adminIds.includes(source.userId)) {
            response = 'hi, how can I help you?';
        }
        return replyText(replyToken, response);
    }
}

async function handleRoomMessage(message, replyToken, source) {
    console.log(`handleRoomMessage: ${replyToken} ${JSON.stringify(message)}}`);
}

async function handlePrivateMessage(message, replyToken, source) {
    switch (message.text) {
        case 'profile':
            if (source.userId) {
                return client.getProfile(source.userId)
                    .then((profile) => replyText(
                        replyToken,
                        [
                            `ID: ${profile.userId}`,
                            `Display name: ${profile.displayName}`,
                            `Status message: ${profile.statusMessage}`,
                        ]
                    ));
            } else {
                return replyText(replyToken, 'Bot can\'t use profile API without user ID');
            }
        default:
            // console.log(`Echo message to ${replyToken}: ${message.text}`);
            // return replyText(replyToken, message.text);
            return console.log(`handlePrivateMessage: ${replyToken} ${JSON.stringify(message)}}`);
    }
}

async function handleText(message, replyToken, source) {
    switch (source.type) {
        case 'group':
            return handleGroupMessage(message, replyToken, source);
        case 'room':
            return handleRoomMessage(message, replyToken, source);
        case 'user':
            return handlePrivateMessage(message, replyToken, source);
    }
}

async function handleImage(message, replyToken) {
    function sendReply(originalContentUrl, previewImageUrl) {
        return client.replyMessage(
            {
                replyToken,
                messages: [{
                    type: 'image',
                    originalContentUrl,
                    previewImageUrl,
                }]
            }
        );
    }

    if (message.contentProvider.type === "line") {
        const downloadPath = path.join(__dirname, 'public', 'downloaded', `${message.id}.jpg`);
        //const previewPath = path.join(__dirname, 'public', 'downloaded', `${message.id}-preview.jpg`);

        await downloadContent(message.id, downloadPath);

        // ImageMagick is needed here to run 'convert'
        // Please consider security and performance by yourself
        //cp.execSync(`convert -resize 240x jpeg:${downloadPath} jpeg:${previewPath}`);

        await sendReply(
            baseURL + '/downloaded/' + path.basename(downloadPath),
            baseURL + '/downloaded/' + path.basename(downloadPath),//previewPath
        );
    } else if (message.contentProvider.type === "external") {
        await sendReply(message.contentProvider.originalContentUrl, message.contentProvider.previewImageUrl);
    }
}

async function handleVideo(message, replyToken) {
    console.log(`handleVideo: ${replyToken} ${JSON.stringify(message)}}`);

    function sendReply(originalContentUrl, previewImageUrl) {
        return client.replyMessage(
            {
                replyToken,
                messages: [{
                    type: 'video',
                    originalContentUrl,
                    previewImageUrl,
                }]
            }
        );
    }

    if (message.contentProvider.type === "line") {
        const downloadPath = path.join(__dirname, 'downloaded', `${message.id}.mp4`);
        const previewPath = path.join(__dirname, 'downloaded', `${message.id}-preview.jpg`);

        await downloadContent(message.id, downloadPath);

        // FFmpeg and ImageMagick is needed here to run 'convert'
        // Please consider security and performance by yourself
        cp.execSync(`convert mp4:${downloadPath}[0] jpeg:${previewPath}`);

        await sendReply(
            baseURL + '/downloaded/' + path.basename(downloadPath),
            baseURL + '/downloaded/' + path.basename(previewPath),
        );
    } else if (message.contentProvider.type === "external") {
        await sendReply(message.contentProvider.originalContentUrl, message.contentProvider.previewImageUrl);
    }
}

async function handleAudio(message, replyToken) {
    function sendReply(originalContentUrl) {
        return client.replyMessage(
            {
                replyToken,
                messages: [{
                    type: 'audio',
                    originalContentUrl,
                    duration: message.duration,
                }]
            }
        );
    }

    if (message.contentProvider.type === "line") {
        const downloadPath = path.join(__dirname, 'downloaded', `${message.id}.m4a`);

        await downloadContent(message.id, downloadPath)
        await sendReply(baseURL + '/downloaded/' + path.basename(downloadPath));
    } else {
        await sendReply(message.contentProvider.originalContentUrl);
    }
}

async function handleLocation(message, replyToken) {
    return client.replyMessage(
        {
            replyToken,
            messages: [{
                type: 'location',
                title: message.title,
                address: message.address,
                latitude: message.latitude,
                longitude: message.longitude,
            }]
        }
    );
}

async function handleSticker(message, replyToken) {
    return client.replyMessage(
        {
            replyToken,
            messages: [{
                type: 'sticker',
                packageId: message.packageId,
                stickerId: message.stickerId,
            }]
        }
    );
}

router.get('/line', (req, res) => res.end(`I'm listening. Please access with POST.`));
// register a webhook handler with middleware
router.post('/line', line.middleware(config), (req, res) => {
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result))
        .catch((err) => {
            console.error(err);
            res.status(500).end();
        });
});

module.exports = router;