const {
  access: { minAuthLevel, features },
  loginServer: { authUrl: loginURL },
} = require('../../config/config');

module.exports = (req, res, next) => {
  const { locals: { populatedUser } } = req;
  const editorUrl = req.whiteLabel ? req.whiteLabel.getEditorUrl() : loginURL;

  if (!populatedUser) {
    const redirectUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    return res.redirect(`${editorUrl}/login?redirect_url=${encodeURIComponent(redirectUrl)}`);
  }

  if (!(populatedUser.authorityLevel <= minAuthLevel
    || (populatedUser.features[features.main] && populatedUser.features[features.main].state === 'enabled'))) {
    return res.redirect(`${editorUrl}/missing-permissions`);
  }

  next();
};
