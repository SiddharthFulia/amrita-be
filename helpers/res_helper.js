// ─── Response Helper ─────────────────────────────────────────────────────────
// Standardized API responses (same pattern as pf-server)

const success = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    status: true,
    message,
    data,
  });
};

const error = (res, message = 'Something went wrong', statusCode = 500, data = null) => {
  return res.status(statusCode).json({
    status: false,
    message,
    data,
  });
};

export default { success, error };
