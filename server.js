const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const base64 = require('base-64');

const app = express();
const PORT = 300;

app.use(bodyParser.json());
app.use(cors());

// API Keys
const OPENAI_API_KEY = 'sk-proj-xdaCtyba5tk8BRBfkJRjT3BlbkFJO8dWUsSwAyfODWoPM32D';
const DID_API_KEY = 'dHVsZXNob3ZhX3NhcmFAbWFpbC5ydQ:LECLGHGKS8tJcR16JqLhP';
const encodedApiKey = base64.encode(DID_API_KEY);

// Function to get response from ChatGPT
async function getChatGPTResponse(question) {
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: question }
            ],
            max_tokens: 150
        }, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error('Error getting response from OpenAI:', error);
        return null;
    }
}

// Function to generate video with D-ID
async function generateVideoDID(inputText) {
    try {
        const payload = {
            source_url: "https://i.postimg.cc/hvBgzkng/2024-07-03-171546.png",  // Replace with your image URL
            script: {
                type: "text",
                input: inputText,
                provider: {
                    type: "microsoft",
                    voice_id: "en-US-JennyNeural"
                }
            },
            config: {
                fluent: "false",
                pad_audio: "0.0",
                result_format: "mp4"
            }
        };
        const headers = {
            'accept': 'application/json',
            'content-type': 'application/json',
            'authorization': `Basic ${encodedApiKey}`
        };
        const response = await axios.post('https://api.d-id.com/talks', payload, { headers });
        if (response.status === 201) {
            return response.data.id;
        }
        return null;
    } catch (error) {
        console.error('Error generating video:', error);
        return null;
    }
}

// Function to check video status
async function checkVideoStatus(talkId) {
    try {
        const headers = {
            'accept': 'application/json',
            'authorization': `Basic ${encodedApiKey}`
        };
        const response = await axios.get(`https://api.d-id.com/talks/${talkId}`, { headers });
        return response.data;
    } catch (error) {
        console.error('Error checking video status:', error);
        return null;
    }
}

// Endpoint to handle the question and response flow
app.post('/ask-question', async (req, res) => {
    const { question } = req.body;

    const gptResponse = await getChatGPTResponse(question);
    if (gptResponse) {
        const talkId = await generateVideoDID(gptResponse);
        if (talkId) {
            for (let i = 0; i < 30; i++) {
                const status = await checkVideoStatus(talkId);
                if (status && status.status === 'done') {
                    return res.json({ videoUrl: status.result_url });
                } else if (status && status.status === 'error') {
                    return res.status(500).send('Video generation failed.');
                }
                await new Promise(resolve => setTimeout(resolve, 10000));  // Wait for 10 seconds
            }
            return res.status(500).send('Video generation is taking longer than expected. Please try again later.');
        }
        return res.status(500).send('Failed to generate video.');
    }
    return res.status(500).send('Failed to get response from ChatGPT.');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
