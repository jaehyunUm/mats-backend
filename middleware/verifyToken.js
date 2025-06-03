const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { 
      id: decoded.id, 
      role: decoded.role,  
      dojang_code: decoded.dojang_code 
    };



next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "jwt expired" });
    }
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

module.exports = verifyToken;
