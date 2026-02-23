const recommendProducts = ({ products, wishlist = [], subscriptions = [] }) => {
  const wishlistCategories = new Set(wishlist.map((item) => String(item.category)));
  const subscriptionFarmerIds = new Set(subscriptions.map((id) => String(id)));

  return [...products]
    .map((product) => {
      let score = product.popularity || 0;

      if (wishlistCategories.has(String(product.category?._id || product.category))) {
        score += 15;
      }

      if (subscriptionFarmerIds.has(String(product.farmer?._id || product.farmer))) {
        score += 20;
      }

      score += (product.ratingAverage || 0) * 5;

      return { product, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.product);
};

module.exports = {
  recommendProducts,
};
