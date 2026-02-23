const suggestPrice = ({ basePrice, isOrganic, weatherFactor = 1, trendFactor = 1, quantity }) => {
  let suggested = Number(basePrice || 0);

  if (isOrganic) {
    suggested *= 1.12;
  }

  suggested *= weatherFactor;
  suggested *= trendFactor;

  if (quantity > 100) {
    suggested *= 0.95;
  }

  return Number(suggested.toFixed(2));
};

module.exports = {
  suggestPrice,
};
