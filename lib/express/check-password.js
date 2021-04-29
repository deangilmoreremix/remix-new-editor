module.exports = (req, res, next) => {
  if (!req.body.currentPassword) {
    return res.json(400, {
      error: 'check parameters',
    });
  }
  next();
};
