export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export const truncate = (text, max = 110) => {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

export const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
};
