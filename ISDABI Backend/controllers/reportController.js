const Call = require('../models/Call');

exports.getReports = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const filter = {
      userId: req.user._id,
      processingStatus: 'completed',
      'managerReport.fullText': { $exists: true }
    };

    const [items, total] = await Promise.all([
      Call.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('callId originalFilename salesOutcome successConfidence managerReport createdAt duration')
        .lean(),
      Call.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Unable to retrieve reports' });
  }
};

exports.getReport = async (req, res) => {
  try {
    const call = await Call.findOne({
      $or: [{ callId: req.params.id }, { _id: req.params.id }],
      userId: req.user._id,
      processingStatus: 'completed'
    }).lean();
    if (!call) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: call });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Unable to retrieve report' });
  }
};
