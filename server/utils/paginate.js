const paginate = (query, { page = 1, limit = 12 }) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.max(Number(limit) || 12, 1);
  const skip = (safePage - 1) * safeLimit;

  return {
    safePage,
    safeLimit,
    skip,
    query: query.skip(skip).limit(safeLimit),
  };
};

module.exports = paginate;
