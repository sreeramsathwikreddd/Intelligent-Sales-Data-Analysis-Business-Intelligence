const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const Call = require('../models/Call');
const { analyzeAudio } = require('../services/aiService');

exports.uploadAndAnalyze = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No audio file uploaded' });
  }

  const callId = `call_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const filePath = req.file.path;

  let call;
  try {
    call = await Call.create({
      callId,
      userId: req.user._id,
      originalFilename: req.file.originalname,
      audioPath: filePath,
      processingStatus: 'uploaded'
    });

    // Respond immediately so UI can show processing state
    res.status(202).json({
      success: true,
      message: 'Upload received. Analysis started.',
      callId: call.callId,
      id: call._id
    });

    // Background analysis
    (async () => {
      try {
        await Call.findByIdAndUpdate(call._id, { processingStatus: 'transcribing' });
        const result = await analyzeAudio(filePath, req.file.originalname);

        const update = {
          processingStatus: 'completed',
          transcript: result.transcript || '',
          detectedLanguage: result.detected_language || result.language || '',
          duration: result.duration || 0,
          salesOutcome: (result.sales_outcome || result.outcome || 'UNKNOWN').toUpperCase(),
          successConfidence: result.success_confidence ?? result.confidence ?? 0,
          failureConfidence: result.failure_confidence ?? 0,
          customerIntent: result.customer_intent || result.intent || '',
          buyingSignals: result.buying_signals || [],
          objections: result.objections || [],
          customerSituation: result.customer_situation || '',
          decisionPoint: result.decision_point || '',
          managerReport: result.manager_report || {
            salesOutcome: result.sales_outcome,
            customerSituation: result.customer_situation || 'Not identified from the conversation.',
            keyBuyingSignals: result.buying_signals || [],
            mainObjections: result.objections || [],
            whatWentWell: result.what_went_well || 'Not identified from the conversation.',
            whatNeedsImprovement: result.what_needs_improvement || 'Not identified from the conversation.',
            recommendedFollowUp: result.recommended_follow_up || 'Not identified from the conversation.',
            fullText: result.report_text || ''
          },
          rawAiResult: result,
          processingError: null
        };

        await Call.findByIdAndUpdate(call._id, update);

        // Cleanup temp audio after success (optional)
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (_) {}
      } catch (err) {
        console.error('[call/analyze]', err.message);
        await Call.findByIdAndUpdate(call._id, {
          processingStatus: 'failed',
          processingError: err.response?.data?.detail || err.message || 'AI analysis failed'
        });
      }
    })();
  } catch (err) {
    console.error('[call/upload]', err.message);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Unable to start analysis' });
    }
  }
};

exports.getCalls = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;
    const filter = { userId: req.user._id };

    if (req.query.outcome) filter.salesOutcome = req.query.outcome.toUpperCase();
    if (req.query.status) filter.processingStatus = req.query.status;
    if (req.query.q) {
      filter.$or = [
        { originalFilename: new RegExp(req.query.q, 'i') },
        { callId: new RegExp(req.query.q, 'i') },
        { customerIntent: new RegExp(req.query.q, 'i') }
      ];
    }

    const [items, total] = await Promise.all([
      Call.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Call.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('[calls/list]', err.message);
    res.status(500).json({ success: false, message: 'Unable to retrieve calls' });
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

    const isOrganizationViewer =
      ["analyst", "head_analyst"].includes(
        req.user?.role
      );

    const CallModel =
      require("../models/ISDABI Call");

    const AnalysisModel =
      require("../models/ISDABI Analysis");

    const ReportModel =
      require("../models/ISDABI Report");

    let call = null;

    if (
      mongoose.isValidObjectId(
        requestedId
      )
    ) {
      call =
        await CallModel.findOne({
          _id: requestedId,
          ...(isOrganizationViewer
            ? {}
            : { uploadedBy: req.user?._id })
        }).populate(
          "uploadedBy",
          "name email role"
        );
    }

    if (!call) {
      call =
        await CallModel.findOne({
          callId: requestedId,
          ...(isOrganizationViewer
            ? {}
            : { uploadedBy: req.user?._id })
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
      req.user?.role === "analyst" &&
      call.uploadedBy?.role === "head_analyst"
    ) {
      return res.status(404).json({
        success: false,
        message: "Call not found."
      });
    }

    const analysis =
      await AnalysisModel.findOne({
        callId: call._id
      });

    const report =
      await ReportModel.findOne({
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
exports.deleteCall = async (req, res) => {
  try {
    const call = await Call.findOneAndDelete({
      $or: [{ callId: req.params.id }, { _id: req.params.id }],
      userId: req.user._id
    });
    if (!call) return res.status(404).json({ success: false, message: 'Call not found' });
    if (call.audioPath && fs.existsSync(call.audioPath)) {
      try { fs.unlinkSync(call.audioPath); } catch (_) {}
    }
    res.json({ success: true, message: 'Call deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Unable to delete call' });
  }
};
