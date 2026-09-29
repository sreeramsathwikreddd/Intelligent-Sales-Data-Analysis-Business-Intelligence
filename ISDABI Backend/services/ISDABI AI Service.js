const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");

const AI_API_URL =
  process.env.AI_API_URL || "http://127.0.0.1:8000";

const AI_TIMEOUT =
  30 * 60 * 1000;

async function checkAIHealth() {
  try {
    const response = await axios.get(
      `${AI_API_URL}/health`,
      {
        timeout: 10000
      }
    );

    return {
      ok: true,
      data: response.data
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error.response?.data ||
        error.message ||
        "AI API unreachable."
    };
  }
}

async function analyzeAudio(
  filePath,
  originalFilename,
  callId,
  onStage
) {
  if (!filePath) {
    throw new Error("Audio file path is required.");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Audio file does not exist: ${filePath}`
    );
  }

  console.log(
    `[ISDABI AI] Sending audio to AI API: ${originalFilename}`
  );

  const form = new FormData();

  form.append(
    "file",
    fs.createReadStream(filePath),
    {
      filename: originalFilename
    }
  );

  if (callId) {
    form.append(
      "call_id",
      String(callId)
    );
  }

  let stopped = false;
  let lastStage = null;
  let pollTimer = null;

  const pollProgress = async () => {
    if (!callId || stopped) {
      return;
    }

    try {
      const progressResponse = await axios.get(
        `${AI_API_URL}/progress/${encodeURIComponent(
          String(callId)
        )}`,
        {
          timeout: 10000
        }
      );

      const stage =
        progressResponse.data?.stage || null;

      if (
        stage &&
        stage !== lastStage
      ) {
        lastStage = stage;

        if (
          typeof onStage === "function"
        ) {
          try {
            await onStage(stage);
          } catch (stageError) {
            console.warn(
              "[ISDABI AI] Unable to save processing stage:",
              stageError?.message ||
                stageError
            );
          }
        }
      }
    } catch (progressError) {
      /*
       * Progress reporting is only telemetry.
       * If progress polling fails, the actual
       * AI analysis must continue normally.
       */
    }

    if (!stopped) {
      pollTimer = setTimeout(
        pollProgress,
        1000
      );
    }
  };

  if (callId) {
    pollProgress();
  }

  try {
    const response = await axios.post(
      `${AI_API_URL}/analyze`,
      form,
      {
        headers: {
          ...form.getHeaders()
        },

        maxContentLength: Infinity,
        maxBodyLength: Infinity,

        timeout: AI_TIMEOUT
      }
    );

    console.log(
      "[ISDABI AI] AI API response received."
    );

    return response.data;
  } catch (error) {
    if (
      error.code ===
      "ECONNABORTED"
    ) {
      throw new Error(
        "AI API timed out after 30 minutes."
      );
    }

    if (error.response) {
      throw new Error(
        `AI API error ${error.response.status}: ${
          typeof error.response.data ===
          "string"
            ? error.response.data
            : JSON.stringify(
                error.response.data
              )
        }`
      );
    }

    throw new Error(
      `Unable to reach ISDABI AI API: ${
        error.message ||
        "Unknown error"
      }`
    );
  } finally {
    stopped = true;

    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }
}

module.exports = {
  analyzeAudio,
  checkAIHealth
};