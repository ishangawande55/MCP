const Application = require('../../models/Application');
const { APPLICATION_STATUS } = require('../../utils/constants');

const getDashboardStats = async (req, res) => {
  try {
    const user = req.user; // Authenticated user
    const department = user.department;
    const role = user.role;

    let matchQuery = { department };

    if (role === 'OFFICER') {
      // Officers see all pending/under review applications of their department
      matchQuery.status = { $in: [APPLICATION_STATUS.PENDING, APPLICATION_STATUS.UNDER_REVIEW] };
    }

    if (role === 'COMMISSIONER') {
      // Commissioners see applications forwarded to them in their department
      matchQuery.status = { $in: [APPLICATION_STATUS.FORWARDED_TO_COMMISSIONER, APPLICATION_STATUS.APPROVED, APPLICATION_STATUS.REJECTED] };
    }

    // Fetch applications
    const applications = await Application.find(matchQuery)
      .select('-__v') // Remove internal fields
      .lean();

    // Map to include only type-specific details
    const formattedApplications = applications.map(app => {
      const result = {
        applicationId: app.applicationId,
        type: app.type,
        department: app.department,
        status: app.status,
        assignedOfficer: app.assignedOfficer,
        forwardedCommissioner: app.forwardedCommissioner,
        createdAt: app.createdAt
      };

      // Include only relevant type-specific details
      if (app.type === 'BIRTH') result.birthDetails = app.birthDetails;
      if (app.type === 'DEATH') result.deathDetails = app.deathDetails;
      if (app.type === 'TRADE_LICENSE') result.tradeDetails = app.tradeDetails;
      if (app.type === 'NOC') result.nocDetails = app.nocDetails;

      return result;
    });

    // Aggregate stats by status for the department
    const stats = await Application.aggregate([
      { $match: { department } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const totalApplications = await Application.countDocuments({ department });
    const assignedToMe = role === 'OFFICER'
      ? await Application.countDocuments({
          assignedOfficer: user._id,
          department,
          status: { $in: [APPLICATION_STATUS.PENDING, APPLICATION_STATUS.UNDER_REVIEW] }
        })
      : 0;

    const statusCounts = {};
    stats.forEach(stat => statusCounts[stat._id] = stat.count);

    res.json({
      success: true,
      data: {
        department,
        role,
        totalApplications,
        assignedToMe,
        statusCounts,
        applications: formattedApplications
      }
    });

  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching dashboard statistics.'
    });
  }
};

module.exports = { getDashboardStats };