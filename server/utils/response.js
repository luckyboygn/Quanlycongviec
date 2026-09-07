function success(res, data = {}, message = 'Thành công', statusCode = 200) {
  return res.status(statusCode).json(data);
}

function error(res, message = 'Có lỗi xảy ra', statusCode = 500, details = null) {
  const payload = { error: message };
  if (details) payload.details = details;
  return res.status(statusCode).json(payload);
}

module.exports = {
  success,
  error
};
