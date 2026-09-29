const Report = require("../models/ISDABI Report");
const Call = require("../models/ISDABI Call");
const Analysis = require("../models/ISDABI Analysis");
const User = require("../models/ISDABI User");

function scopeForUser(user) {
  return user?.role === "head_analyst"
    ? {}
    : { uploadedBy: user?._id };
}

exports.getReports = async (req, res) => {
  try {
    const page = Math.max(
      1,
      parseInt(req.query.page || "1", 10)
    );

    const limit = Math.min(
      50,
      Math.max(
        1,
        parseInt(req.query.limit || "20", 10)
      )
    );

    const callIds = (
      await Call.find({
        uploadedBy: req.user._id
      })
        .select("_id")
        .lean()
    ).map((x) => x._id);

    const [items, total] = await Promise.all([
      Report.find({
        callId: { $in: callIds },
        generationStatus: "generated"
      })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(
          "callId",
          "callId originalFilename createdAt"
        )
        .lean(),

      Report.countDocuments({
        callId: { $in: callIds },
        generationStatus: "generated"
      })
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("[reports]", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve reports."
    });
  }
};

exports.getRoleBasedReports = async (
  req,
  res
) => {
  try {
    const allowedViewerRoles = [
      "analyst",
      "head_analyst"
    ];

    if (
      !allowedViewerRoles.includes(
        req.user?.role
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Role based reports are available to analysts and head analysts."
      });
    }

    const requestedRole = String(req.query.role || "").trim();

    if (
      requestedRole &&
      ![
        "analyst",
        "sales_representative"
      ].includes(requestedRole)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid role filter."
      });
    }

    const callFilter = {};

    const User =
      require("../models/ISDABI User");

    const users =
      await User.find(
        requestedRole
          ? {
              role: requestedRole
            }
          : {
              role: {
                $in: [
                  "sales_representative",
                  "analyst"
                ]
              }
            }
      )
        .select("_id")
        .lean();

    callFilter.uploadedBy = {
      $in: users.map(
        (user) => user._id
      )
    };
    const calls =
      await Call.find(callFilter)
        .sort({
          createdAt: -1
        })
        .limit(500)
        .populate(
          "uploadedBy",
          "name email role"
        )
        .lean();

    const callIds =
      calls.map(
        (call) => call._id
      );

    const [
      reports,
      analyses
    ] = await Promise.all([
      callIds.length
        ? Report.find({
            callId: {
              $in: callIds
            },
            generationStatus:
              "generated"
          })
            .sort({
              createdAt: -1
            })
            .lean()
        : [],

      callIds.length
        ? Analysis.find({
            callId: {
              $in: callIds
            }
          }).lean()
        : []
    ]);

    const reportByCall =
      new Map();

    for (const reportItem of reports) {
      reportByCall.set(
        String(
          reportItem.callId
        ),
        reportItem
      );
    }

    const analysisByCall =
      new Map();

    for (const analysisItem of analyses) {
      analysisByCall.set(
        String(
          analysisItem.callId
        ),
        analysisItem
      );
    }

    const items =
      calls.map((call) => {
        const reportItem =
          reportByCall.get(
            String(call._id)
          ) || null;

        const analysisItem =
          analysisByCall.get(
            String(call._id)
          ) || null;

        return {
          ...call,

          salesOutcome:
            analysisItem?.salesOutcome ||
            reportItem?.salesOutcome ||
            null,

          successConfidence:
            analysisItem?.successConfidence ??
            null,

          customerIntent:
            analysisItem?.customerIntent ||
            null,

          buyingSignals:
            analysisItem?.buyingSignals ||
            reportItem?.keyBuyingSignals ||
            [],

          objections:
            analysisItem?.objections ||
            reportItem?.mainObjections ||
            [],

          customerSituation:
            analysisItem?.customerSituation ||
            reportItem?.customerSituation ||
            null,

          report: reportItem,
          analysis: analysisItem,

          reportAvailable:
            Boolean(reportItem),

          analysisAvailable:
            Boolean(analysisItem)
        };
      });

    return res.json({
      success: true,
      data: items,
      meta: {
        scope:
          "organization",

        roleFilter:
          requestedRole || null,

        total:
          items.length
      }
    });
  } catch (error) {
    console.error(
      "[role-based-reports]",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve role based reports."
    });
  }
};

exports.getReport = async (
  req,
  res
) => {
  try {
    const isHead =
      req.user?.role ===
      "head_analyst";

    const callFilter = {
      $or: [
        { callId: req.params.id },
        { _id: req.params.id }
      ]
    };

    if (!isHead) {
      callFilter.uploadedBy =
        req.user._id;
    }

    const call =
      await Call.findOne(
        callFilter
      )
        .select("_id")
        .lean();

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Report not found."
      });
    }

    const report =
      await Report.findOne({
        callId: call._id
      })
        .populate("analysisId")
        .lean();

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found."
      });
    }

    return res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error(
      "[report]",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve report."
    });
  }
};

