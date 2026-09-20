const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Only admin can perform this action' })
  }
  next()
}

export default requireAdmin
