const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const AI_API_URL = process.env.AI_API_URL || 'http://127.0.0.1:8000';

async function analyzeAudio(filePath, originalFilename) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), {
    filename: originalFilename || path.basename(filePath),
    contentType: 'audio/wav'
  });

  const response = await axios.post(`${AI_API_URL}/analyze`, form, {
    headers: form.getHeaders(),
    timeout: 600000, // 10 min for long calls
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });

  return response.data;
}

async function checkAiHealth() {
  try {
    const res = await axios.get(`${AI_API_URL}/health`, { timeout: 5000 });
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { analyzeAudio, checkAiHealth };
