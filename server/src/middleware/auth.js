const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const token = req.cookies?.st_token || '';
  if (!token) return res.status(401).json({ error: 'UNAUTHENTICATED' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'UNAUTHENTICATED' });
  }
}

module.exports = { requireAuth };

