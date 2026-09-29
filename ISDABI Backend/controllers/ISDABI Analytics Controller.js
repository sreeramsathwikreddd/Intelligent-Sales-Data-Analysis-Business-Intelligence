const Call = require("../models/ISDABI Call");
const Analysis = require("../models/ISDABI Analysis");

function callScope(user) {
  return user?.role === "head_analyst"
    ? {}
    : { uploadedBy: user?._id };
}

function increment(map, value) {
  if (!value) return;

  const key = String(value).trim();

  if (!key) return;

  map[key] = (map[key] || 0) + 1;
}

exports.getAnalytics = async (
  req,
  res
) => {
  try {
    const filter = callScope(
      req.user
    );

    const calls =
      await Call.find(filter)
        .sort({
          createdAt: -1
        })
        .populate(
          "uploadedBy",
          "name email role"
        )
        .lean();

    const completed =
      calls.filter(
        (call) =>
          call.processingStatus ===
          "completed"
      );

    const completedIds =
      completed.map(
        (call) => call._id
      );

    const analyses =
      completedIds.length
        ? await Analysis.find({
            callId: {
              $in: completedIds
            }
          }).lean()
        : [];

    const analysisByCall =
      new Map(
        analyses.map(
          (analysis) => [
            String(analysis.callId),
            analysis
          ]
        )
      );

    const successful =
      analyses.filter(
        (analysis) =>
          analysis.salesOutcome ===
          "SUCCESS"
      ).length;

    const failed =
      analyses.filter(
        (analysis) =>
          analysis.salesOutcome ===
          "FAILURE"
      ).length;

    const intentMap = {};
    const signalMap = {};
    const objectionMap = {};
    const roleMap = {};
    const userMap = {};

    for (const call of completed) {
      const owner =
        call.uploadedBy;

      if (owner?.role) {
        increment(
          roleMap,
          owner.role
        );
      }

      if (owner?._id) {
        const key =
          String(owner._id);

        if (!userMap[key]) {
          userMap[key] = {
            id: key,
            name:
              owner.name ||
              owner.email ||
              "Unknown user",
            email:
              owner.email || "",
            role:
              owner.role ||
              "unknown",
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0
          };
        }

        userMap[key].totalCalls += 1;
      }

      const analysis =
        analysisByCall.get(
          String(call._id)
        );

      if (!analysis) {
        continue;
      }

      increment(
        intentMap,
        analysis.customerIntent
      );

      (
        analysis.buyingSignals ||
        []
      ).forEach(
        (item) =>
          increment(
            signalMap,
            item
          )
      );

      (
        analysis.objections ||
        []
      ).forEach(
        (item) =>
          increment(
            objectionMap,
            item
          )
      );

      if (owner?._id) {
        const row =
          userMap[
            String(owner._id)
          ];

        if (
          analysis.salesOutcome ===
          "SUCCESS"
        ) {
          row.successfulCalls += 1;
        }

        if (
          analysis.salesOutcome ===
          "FAILURE"
        ) {
          row.failedCalls += 1;
        }
      }
    }

    const confidenceValues =
      analyses
        .map((analysis) =>
          Number(
            analysis.successConfidence
          )
        )
        .filter(
          (value) =>
            Number.isFinite(value)
        );

    const averageConfidence =
      confidenceValues.length
        ? confidenceValues.reduce(
            (sum, value) =>
              sum + value,
            0
          ) /
          confidenceValues.length
        : 0;

    const durationValues =
      completed
        .map((call) =>
          Number(
            call.durationSeconds
          )
        )
        .filter(
          (value) =>
            Number.isFinite(value) &&
            value >= 0
        );

    const averageDuration =
      durationValues.length
        ? durationValues.reduce(
            (sum, value) =>
              sum + value,
            0
          ) /
          durationValues.length
        : 0;

    const totalCalls =
      completed.length;

    const recentCalls =
      completed
        .slice(0, 10)
        .map((call) => {
          const analysis =
            analysisByCall.get(
              String(call._id)
            );

          return {
            _id: call._id,
            callId: call.callId,
            originalFilename:
              call.originalFilename,
            processingStatus:
              call.processingStatus,
            createdAt:
              call.createdAt,
            durationSeconds:
              call.durationSeconds,
            salesOutcome:
              analysis?.salesOutcome ||
              "UNKNOWN",
            successConfidence:
              analysis?.successConfidence ??
              null,
            uploadedBy:
              call.uploadedBy ||
              null
          };
        });

    const userPerformance =
      Object.values(userMap)
        .map((user) => ({
          ...user,

          successRate:
            user.totalCalls
              ? Math.round(
                  (
                    user.successfulCalls /
                    user.totalCalls
                  ) *
                    1000
                ) / 10
              : 0
        }))
        .sort(
          (a, b) =>
            b.totalCalls -
            a.totalCalls
        );

    return res.json({
      success: true,

      data: {
        scope:
          req.user?.role ===
          "head_analyst"
            ? "organization"
            : "own_calls",

        metrics: {
          totalCalls,

          successfulCalls:
            successful,

          failedCalls:
            failed,

          successRate:
            totalCalls
              ? Math.round(
                  (
                    successful /
                    totalCalls
                  ) *
                    1000
                ) / 10
              : 0,

          averageConfidence:
            Math.round(
              averageConfidence *
                1000
            ) / 10,

          averageDuration:
            Math.round(
              averageDuration
            )
        },

        roleDistribution:
          Object.entries(
            roleMap
          )
            .map(
              ([name, value]) => ({
                name,
                value
              })
            )
            .sort(
              (a, b) =>
                b.value -
                a.value
            ),

        userPerformance,

        intentDistribution:
          Object.entries(
            intentMap
          )
            .map(
              ([name, value]) => ({
                name,
                value
              })
            )
            .sort(
              (a, b) =>
                b.value -
                a.value
            ),

        buyingSignalDistribution:
          Object.entries(
            signalMap
          )
            .map(
              ([name, value]) => ({
                name,
                value
              })
            )
            .sort(
              (a, b) =>
                b.value -
                a.value
            )
            .slice(0, 10),

        objectionDistribution:
          Object.entries(
            objectionMap
          )
            .map(
              ([name, value]) => ({
                name,
                value
              })
            )
            .sort(
              (a, b) =>
                b.value -
                a.value
            )
            .slice(0, 10),

        outcomeDistribution: [
          {
            name: "SUCCESS",
            value: successful
          },
          {
            name: "FAILURE",
            value: failed
          }
        ],

        recentCalls
      }
    });
  } catch (error) {
    console.error(
      "[analytics]",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load analytics."
    });
  }
};