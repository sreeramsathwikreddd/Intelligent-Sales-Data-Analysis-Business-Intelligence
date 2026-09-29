const Call = require('../models/Call');

exports.getAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;
    const completed = await Call.find({ userId, processingStatus: 'completed' }).lean();

    const total = completed.length;
    const successful = completed.filter((c) => c.salesOutcome === 'SUCCESS').length;
    const failed = completed.filter((c) => c.salesOutcome === 'FAILURE').length;
    const successRate = total ? (successful / total) * 100 : 0;
    const avgConfidence =
      total
        ? completed.reduce((s, c) => s + (c.successConfidence || 0), 0) / total
        : 0;
    const avgDuration =
      total ? completed.reduce((s, c) => s + (c.duration || 0), 0) / total : 0;

    const intentMap = {};
    const signalMap = {};
    const objectionMap = {};
    completed.forEach((c) => {
      if (c.customerIntent) intentMap[c.customerIntent] = (intentMap[c.customerIntent] || 0) + 1;
      (c.buyingSignals || []).forEach((s) => {
        signalMap[s] = (signalMap[s] || 0) + 1;
      });
      (c.objections || []).forEach((o) => {
        objectionMap[o] = (objectionMap[o] || 0) + 1;
      });
    });

    const recent = await Call.find({ userId })
      .sort({ createdAt: -1 })
      .limit(8)
      .select('callId originalFilename salesOutcome successConfidence duration processingStatus createdAt')
      .lean();

    res.json({
      success: true,
      data: {
        metrics: {
          totalCalls: total,
          successfulCalls: successful,
          failedCalls: failed,
          successRate: Math.round(successRate * 10) / 10,
          averageConfidence: Math.round(avgConfidence * 1000) / 10,
          averageDuration: Math.round(avgDuration)
        },
        intentDistribution: Object.entries(intentMap).map(([name, value]) => ({ name, value })),
        buyingSignalDistribution: Object.entries(signalMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10),
        objectionDistribution: Object.entries(objectionMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10),
        outcomeDistribution: [
          { name: 'SUCCESS', value: successful },
          { name: 'FAILURE', value: failed }
        ],
        recentCalls: recent
      }
    });
  } catch (err) {
    console.error('[analytics]', err.message);
    res.status(500).json({ success: false, message: 'Unable to load analytics' });
  }
};
