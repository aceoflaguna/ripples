const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Handle specific error types
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload'
    });
  }

  if (err.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({
      success: false,
      message: 'Resource already exists'
    });
  }

  if (err.code === '23503') { // PostgreSQL foreign key violation
    return res.status(400).json({
      success: false,
      message: 'Invalid reference to related resource'
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export default errorHandler;