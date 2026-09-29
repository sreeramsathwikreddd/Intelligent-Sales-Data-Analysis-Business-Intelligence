const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const Call = require("../models/ISDABI Call");
const Analysis = require("../models/ISDABI Analysis");
const Report = require("../models/ISDABI Report");

const { analyzeAudio } = require("../services/ISDABI AI Service");

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (value === null || value === undefined || value === "") {
    return [];
  }

  return [String(value)];
}

function firstDefined(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null
    ) {
      return value;
    }
  }

  return null;
}

function extractAIResult(result) {
  const miniLM =
    result?.miniLM ||
    result?.minilm ||
    {};

  const managerReport =
    result?.manager_report ||
    result?.qwen_manager_report ||
    result?.report ||
    {};

  const speechToText =
    result?.speech_to_text ||
    {};

  return {
    salesOutcome:
      firstDefined(
        result?.sales_outcome,
        miniLM?.predicted_outcome,
        managerReport?.sales_outcome,
        "UNKNOWN"
      ),

    successConfidence:
      firstDefined(
        result?.success_confidence,
        miniLM?.success_probability
      ),

    failureConfidence:
      firstDefined(
        result?.failure_confidence,
        miniLM?.failure_probability
      ),

    customerIntent:
      firstDefined(
        result?.customer_intent,
        miniLM?.customer_intent,
        "Not identified"
      ),

    buyingSignals:
      normalizeList(
        firstDefined(
          result?.buying_signals,
          miniLM?.buying_signals,
          []
        )
      ),

    objections:
      normalizeList(
        firstDefined(
          result?.objections,
          miniLM?.objections,
          []
        )
      ),

    customerSituation:
      firstDefined(
        managerReport?.customer_situation,
        result?.customer_situation,
        "Not identified from the conversation."
      ),

    decisionPoint:
      firstDefined(
        result?.decision_point,
        miniLM?.decision_point,
        null
      ),

    transcript:
      firstDefined(
        result?.transcript,
        speechToText?.transcript,
        ""
      ),

    detectedLanguage:
      firstDefined(
        result?.detected_language,
        speechToText?.language,
        null
      ),

    durationSeconds:
      firstDefined(
        result?.duration_seconds,
        result?.audio_metadata?.duration_seconds,
        null
      ),

    managerReport,

    qwenStatus:
      managerReport &&
      Object.keys(managerReport).length > 0
        ? "QWEN_FORMATTED_GROUNDED"
        : "NOT_RUN",

    evidence:
      result?.evidence || {
        productReference: null,
        productDescription: null,
        informationTopics: []
      }
  };
}

async function processCall(callId) {
  try {
    const call = await Call.findById(callId);

    if (!call) {
      return;
    }

    await Call.findByIdAndUpdate(
      callId,
      {
        processingStatus: "processing",
processingStage: "transcribing",
processingStartedAt: new Date(),
processingError: null
      }
    );

    const result = await analyzeAudio(
      call.audioPath,
      call.originalFilename,
      String(call._id),
      async (stage) => {
        await Call.findByIdAndUpdate(
          callId,
          {
            processingStage: stage
          }
        );
      }
    );

    const ai = extractAIResult(result);

    const validOutcome =
      ["SUCCESS", "FAILURE", "UNKNOWN"].includes(
        ai.salesOutcome
      )
        ? ai.salesOutcome
        : "UNKNOWN";

    await Call.findByIdAndUpdate(
      callId,
      {
        transcript: ai.transcript || "",
        detectedLanguage:
          ai.detectedLanguage || null,
        durationSeconds:
          ai.durationSeconds,
          processingStatus: "completed",
          processingStage: null,
          processingCompletedAt: new Date(),
          processingError: null
      }
    );

    const analysis =
      await Analysis.findOneAndUpdate(
        {
          callId: callId
        },
        {
          callId: callId,

          modelVersion:
            "ISDABI AI Pipeline V1.4.0",

          speechToTextModel:
            "Faster-Whisper Small",

          outcomeModel:
            "MiniLM Sales Outcome V1",

          llmModel:
            "Qwen2.5-0.5B-Instruct Q4_K_M",

          salesOutcome:
            validOutcome,

          successConfidence:
            ai.successConfidence,

          failureConfidence:
            ai.failureConfidence,

          customerIntent:
            ai.customerIntent,

          buyingSignals:
            ai.buyingSignals,

          objections:
            ai.objections,

          customerSituation:
            ai.customerSituation,

          decisionPoint:
            ai.decisionPoint,

          evidence:
            ai.evidence,

          qwenStatus:
            ai.qwenStatus,

          analysisStatus:
            "completed",

          analysisError:
            null
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );

    const reportData =
      ai.managerReport || {};

    await Report.findOneAndUpdate(
      {
        callId: callId
      },
      {
        callId: callId,

        analysisId:
          analysis._id,

        salesOutcome:
          validOutcome,

        customerSituation:
          reportData.customer_situation ||
          ai.customerSituation ||
          "Not identified from the conversation.",

        keyBuyingSignals:
          normalizeList(
            reportData.key_buying_signals ??
            ai.buyingSignals
          ),

        mainObjections:
          normalizeList(
            reportData.main_objections ??
            ai.objections
          ),

        whatWentWell:
          normalizeList(
            reportData.what_went_well
          ),

        whatNeedsImprovement:
          normalizeList(
            reportData.what_needs_improvement
          ),

        recommendedFollowUp:
          normalizeList(
            reportData.recommended_follow_up
          ),

        reportVersion:
          "ISDABI Manager Report V1",

        generationStatus:
          "generated",

        generationError:
          null
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    console.log(
      `[ISDABI] Call completed: ${call.callId}`
    );

  } catch (error) {
    console.error(
      "[ISDABI] Call processing failed:",
      error
    );

    await Call.findByIdAndUpdate(
      callId,
      {
        processingStatus: "failed",
processingStage: null,
processingCompletedAt: new Date(),
processingError:
  error?.message ||
  "AI processing failed."
      }
    );

    await Analysis.findOneAndUpdate(
      {
        callId: callId
      },
      {
        analysisStatus: "failed",
        analysisError:
          error?.message ||
          "AI processing failed."
      },
      {
        upsert: true
      }
    );
  }
}

exports.uploadAndAnalyze = async (
  req,
  res,
  next
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Audio file is required."
      });
    }

    const extension =
      path
        .extname(req.file.originalname)
        .replace(".", "")
        .toLowerCase();

    const call = await Call.create({
      callId:
        `call_${randomUUID().replace(/-/g, "")}`,

      uploadedBy:
        req.user?._id || null,

      originalFilename:
        req.file.originalname,

      storedFilename:
        req.file.filename,

      audioPath:
        req.file.path,

      audioFormat:
        extension,

      audioSizeBytes:
        req.file.size,

      processingStatus:
        "uploaded"
    });

    return res.status(201).json({
      success: true,

      message:
        "Audio uploaded successfully. Analysis has not started.",

      data: {
        id: call._id,
        callId: call.callId,
        originalFilename:
          call.originalFilename,
        processingStatus:
          call.processingStatus,
        createdAt:
          call.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.analyzeCall = async (
  req,
  res,
  next
) => {
  try {
    const requestedId =
      String(req.params.id || "").trim();

    const isObjectId =
      mongoose.isValidObjectId(
        requestedId
      );

    const isOrgViewer =
      ["analyst", "head_analyst"].includes(
        req.user?.role
      );

    let call = null;

    if (isObjectId) {
      call = await Call.findOne(
        isOrgViewer
          ? { _id: requestedId }
          : {
              _id: requestedId,
              uploadedBy: req.user?._id
            }
      );
    }

    if (!call) {
      call = await Call.findOne(
        isOrgViewer
          ? { callId: requestedId }
          : {
              callId: requestedId,
              uploadedBy: req.user?._id
            }
      );
    }

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found."
      });
    }

    if (
      call.processingStatus ===
      "completed"
    ) {
      return res.status(200).json({
        success: true,
        message:
          "This call has already been analyzed.",
        data: {
          id: call._id,
          callId: call.callId,
          processingStatus:
            call.processingStatus
        }
      });
    }

    if (
      call.processingStatus ===
        "queued" ||
      call.processingStatus ===
        "processing"
    ) {
      return res.status(202).json({
        success: true,
        message:
          "Analysis is already running.",
        data: {
          id: call._id,
          callId: call.callId,
          processingStatus:
            call.processingStatus
        }
      });
    }

    await Call.findByIdAndUpdate(
      call._id,
      {
        processingStatus:
          "queued",
        processingStartedAt: null,
        processingCompletedAt: null,
        processingError: null
      }
    );

    setImmediate(() => {
      processCall(call._id);
    });

    return res.status(202).json({
      success: true,
      message:
        "Analysis started.",
      data: {
        id: call._id,
        callId: call.callId,
        processingStatus:
          "queued"
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getCalls = async (
  req,
  res,
  next
) => {
  try {
    const page =
      Math.max(
        Number(req.query.page) || 1,
        1
      );

    const limit =
      Math.min(
        Math.max(
          Number(req.query.limit) || 20,
          1
        ),
        100
      );

    const skip =
      (page - 1) * limit;

    const filter = {};

    if (req.user?._id) {
      filter.uploadedBy =
        req.user._id;
    }

    const [
      data,
      total
    ] = await Promise.all([
      Call.find(filter)
        .sort({
          createdAt: -1
        })
        .skip(skip)
        .limit(limit),

      Call.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      data,

      pagination: {
        page,
        limit,
        total,
        pages:
          Math.ceil(
            total / limit
          )
      }
    });

  } catch (error) {
    next(error);
  }
};

exports.getCall = async (
  req,
  res,
  next
) => {
  try {
    const requestedId =
      String(req.params.id || "").trim();

    const isHeadAnalyst =
      req.user?.role === "head_analyst";

    const isAnalyst =
      req.user?.role === "analyst";

    const ownershipFilter =
      isHeadAnalyst || isAnalyst
        ? {}
        : {
            uploadedBy:
              req.user?._id
          };

    let call = null;

    if (
      mongoose.isValidObjectId(
        requestedId
      )
    ) {
      call =
        await Call.findOne({
          _id: requestedId,
          ...ownershipFilter
        }).populate(
          "uploadedBy",
          "name email role"
        );
    }

    if (!call) {
      call =
        await Call.findOne({
          callId: requestedId,
          ...ownershipFilter
        }).populate(
          "uploadedBy",
          "name email role"
        );
    }

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found."
      });
    }

    if (
      isAnalyst &&
      call.uploadedBy?.role === "head_analyst"
    ) {
      return res.status(404).json({
        success: false,
        message: "Call not found."
      });
    }

    const analysis =
      await Analysis.findOne({
        callId: call._id
      });

    const report =
      await Report.findOne({
        callId: call._id
      });

    return res.json({
      success: true,

      data: {
        call,
        analysis,
        report
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteCall = async (
  req,
  res,
  next
) => {
  try {
    const requestedId =
      String(req.params.id || "").trim();

    let call = null;

    /*
     * The frontend sends the MongoDB _id for deletion.
     *
     * Also support the public callId so deletion remains
     * compatible with either identifier.
     */

    const isHeadAnalyst =
      req.user?.role === "head_analyst";

    const isAnalyst =
      req.user?.role === "analyst";

    const ownershipFilter =
      isHeadAnalyst || isAnalyst
        ? {}
        : {
            uploadedBy:
              req.user?._id
          };

    if (
      mongoose.isValidObjectId(
        requestedId
      )
    ) {
      call =
        await Call.findOne({
          _id: requestedId,
          ...ownershipFilter
        });
    }

    if (!call) {
      call =
        await Call.findOne({
          callId: requestedId,
          ...ownershipFilter
        });
    }

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found."
      });
    }

    /*
     * Delete all data connected to the actual
     * MongoDB Call _id.
     */

    await Analysis.deleteMany({
      callId: call._id
    });

    await Report.deleteMany({
      callId: call._id
    });

    if (
      call.audioPath &&
      fs.existsSync(call.audioPath)
    ) {
      try {
        fs.unlinkSync(
          call.audioPath
        );
      } catch (fileError) {
        console.error(
          "[ISDABI] Audio deletion warning:",
          fileError.message
        );
      }
    }

    await Call.deleteOne({
      _id: call._id
    });

    return res.json({
      success: true,
      message:
        "Call deleted successfully."
    });

  } catch (error) {
    next(error);
  }
};