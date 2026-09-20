import jwt from 'jsonwebtoken'

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token

  if (!token) {
    return res.status(401).json({ message: 'You are not logged in' })
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch (error) {
    return res.status(401).json({ message: 'Session expired, please log in again' })
  }
}

export default verifyToken
